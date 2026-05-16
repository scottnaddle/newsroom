#!/usr/bin/env python3
"""
Manual upload of pre-generated ComfyUI images to Ghost + cache build.
Use when pregen-article-images.py succeeded in generating images
but Ghost uploads failed (e.g., DNS transient error).

Usage:
  # Auto-discover latest images (recommended):
  python3 scripts/upload-and-cache.py
  
  # Or specify explicit image indices:
  python3 scripts/upload-and-cache.py --first 20 --last 25

Prerequisites:
- Mac Studio online (SSH key auth to 100.108.26.68)
- ComfyUI output files at ~/ComfyUI/output/newsroom_gen_*.png
- .env at /root/.openclaw/workspace/newsroom/.env
"""
import argparse, json, hmac, time, base64, urllib.request, os, subprocess, sys, re

MAC_IP = "100.108.26.68"
MAC_OUTPUT_DIR = "/Users/axc/ComfyUI/output"
ENV_FILE = "/root/.openclaw/workspace/newsroom/.env"
PIPELINE_DIR = "/root/.openclaw/workspace/newsroom/pipeline/07-copy-edited"
CACHE_FILE = "/root/.openclaw/workspace/newsroom/.imgcache/pending.json"

# ── Load Ghost config ──────────────────────────────────────────────
with open(ENV_FILE) as f:
    lines = f.read().strip().split('\n')
url = key = ''
for line in lines:
    if line.startswith('GHOST_URL='): url = line.split('=',1)[1].strip()
    elif line.startswith('GHOST_ADMIN_API_KEY='): key = line.split('=',1)[1].strip()
ghost_domain = url.replace('https://','').strip('/')
kid, secret = key.split(':')


def ghost_jwt():
    now = int(time.time())
    h = base64.urlsafe_b64encode(json.dumps({'alg':'HS256','typ':'JWT','kid':kid}).encode()).rstrip(b'=').decode()
    p = base64.urlsafe_b64encode(json.dumps({'iat':now,'exp':now+300,'aud':'/admin/'}).encode()).rstrip(b'=').decode()
    s = base64.urlsafe_b64encode(hmac.new(bytes.fromhex(secret), (h+'.'+p).encode(), 'sha256').digest()).rstrip(b'=').decode()
    return h+'.'+p+'.'+s


def scp_get(remote_path, local_path):
    r = subprocess.run(['scp', '-o', 'StrictHostKeyChecking=no', f'axc@{MAC_IP}:{remote_path}', local_path],
                       capture_output=True, timeout=30)
    if r.returncode != 0:
        raise RuntimeError("SCP failed: " + r.stderr.decode()[:200])


def upload_to_ghost(local_path, retries=3, delay=5):
    """Upload to Ghost with retry loop. Returns CDN URL or raises."""
    jwt = ghost_jwt()
    with open(local_path, 'rb') as f:
        img_data = f.read()
    boundary = '----FormBoundary' + os.urandom(4).hex()
    header = ('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="'+os.path.basename(local_path)+'"\r\nContent-Type: image/png\r\n\r\n').encode()
    footer = ('\r\n--'+boundary+'--\r\n').encode()
    body = header + img_data + footer

    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                'https://'+ghost_domain+'/ghost/api/admin/images/upload',
                data=body,
                headers={
                    'Authorization': 'Ghost '+jwt,
                    'Content-Type': 'multipart/form-data; boundary='+boundary,
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
                    'Origin': 'https://'+ghost_domain,
                    'Referer': 'https://'+ghost_domain+'/ghost/',
                }
            )
            resp = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
            url = resp.get('images', [{}])[0].get('url', '')
            if url:
                return url
            last_err = "Ghost returned empty URL"
        except Exception as e:
            last_err = str(e)[:120]
            if attempt < retries - 1:
                print(f'  ⚠️  Retry {attempt+1}/{retries} after {delay}s: {last_err}')
                time.sleep(delay)
    raise RuntimeError(f"All {retries} attempts failed: {last_err}")


def discover_remote_images(n):
    """SSH to Mac Studio, find latest N newsroom_gen_*.png, return sorted paths."""
    r = subprocess.run(
        ['ssh', '-o', 'StrictHostKeyChecking=no', f'axc@{MAC_IP}',
         f'ls -t {MAC_OUTPUT_DIR}/newsroom_gen_*.png | head -{n}'],
        capture_output=True, timeout=15, text=True)
    if r.returncode != 0:
        raise RuntimeError("SSH discovery failed: " + r.stderr.decode()[:200])
    paths = [p.strip() for p in r.stdout.strip().split('\n') if p.strip()]
    paths.reverse()  # oldest-first matches article order
    return paths


# ── Main ───────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Upload ComfyUI images to Ghost")
parser.add_argument('--first', type=int, help='First image index (e.g. 20)')
parser.add_argument('--last', type=int, help='Last image index (e.g. 25)')
args = parser.parse_args()

# Read articles
files = sorted([f for f in os.listdir(PIPELINE_DIR) if f.endswith('.json')])
headlines = []
for fname in files:
    with open(os.path.join(PIPELINE_DIR, fname)) as f:
        data = json.load(f)
    hl = data.get('draft', {}).get('headline', '').replace('\n',' ').strip()
    headlines.append(hl)

n = len(headlines)
print(f"Found {n} articles")

# Determine remote image paths
if args.first and args.last:
    remote_images = [f'{MAC_OUTPUT_DIR}/newsroom_gen_{i:05d}_.png' for i in range(args.first, args.last + 1)]
    print(f"Using explicit indices {args.first}–{args.last}")
else:
    remote_images = discover_remote_images(n)
    print(f"Auto-discovered {len(remote_images)} images on Mac Studio")
    for p in remote_images:
        print(f"  {p}")

if len(remote_images) != n:
    print(f"⚠️  Found {len(remote_images)} images but {n} articles. "
          f"Using min({len(remote_images)}, {n}) = {min(len(remote_images), n)}")
    remote_images = remote_images[:n]

# Upload each image
cache = {}
for i, (fname, headline, remote_img) in enumerate(zip(files, headlines, remote_images)):
    local_path = f'/tmp/comfyui-news-{int(time.time()*1000)}.png'

    print(f'[{i+1}/{n}] {headline[:40]}...')

    # SCP from Mac Studio
    try:
        scp_get(remote_img, local_path)
        print(f'  SCP OK')
    except Exception as e:
        print(f'  ❌ SCP failed: {e}')
        continue

    # Upload to Ghost with retry
    try:
        img_url = upload_to_ghost(local_path)
        print(f'  ✅ Ghost upload: {img_url[:60]}...')
        cache[headline] = img_url
    except Exception as e:
        print(f'  ❌ Upload failed: {e}')

    try: os.remove(local_path)
    except: pass

# Write cache (fresh — clears any stale entries from prior runs)
os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
with open(CACHE_FILE, 'w', encoding='utf-8') as f:
    json.dump(cache, f, ensure_ascii=False, indent=2)

print(f'\nDone! {len(cache)}/{n} images cached → {CACHE_FILE}')
if cache:
    print(f'Now run: node /root/newsroom-analysis/newsroom/scripts/publish-ghost-fixed.js')
