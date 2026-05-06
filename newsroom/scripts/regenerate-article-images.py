#!/usr/bin/env python3
"""
Regenerate feature images for 해외-tagged articles that got world map images.
Uses Python urllib for Ghost API calls (more reliable than subprocess curl).
"""
import subprocess, sys, os, json, time, hmac, base64, urllib.request, urllib.error, random, re, ssl

MAC_IP = "100.108.26.68"
ENV_FILE = "/root/.openclaw/workspace/newsroom/.env"

# ─── Prompt templates ───────────────────────────────
SCENES = {
    "default": "A modern classroom scene, professional photography",
    "ai": "Artificial intelligence in education, futuristic classroom, AI robots helping students",
    "edu": "Students learning in a classroom, teachers guiding, warm educational atmosphere",
    "tech": "Modern education technology, digital devices, tablets and laptops in classroom",
    "research": "Academic research, university library, scientists analyzing data",
    "school": "Bright school corridor or campus, students walking, cheerful atmosphere",
    "robot": "Educational robots in classroom, robots interacting with students",
    "language": "Language learning, multilingual conversation, diverse students communicating",
    "digital": "Digital learning, online education, students with devices",
    "crisis": "Education challenge or inequality, thoughtful documentary style",
    "future": "Future of education, innovative classroom, holographic learning displays",
    "global": "Diverse students learning together in international classroom, multicultural education"
}
STYLES = ["photorealistic, documentary style, natural lighting, high quality, no text", 
          "cinematic shot, warm colors, professional photography, detailed, sharp focus",
          "editorial photography style, natural, candid, high resolution, professional"]

COUNTRY_SCENE_MAP = {
    "인도": [
        "Indian classroom with students in traditional and modern setting, educational technology in India",
        "Students using laptops in colorful Indian classroom, teacher helping, warm atmosphere",
        "Modern Indian school with smartboard, diverse students from different Indian regions",
    ],
    "미국": [
        "American classroom with diverse students using modern technology, US education system",
        "Students collaborating on projects in bright American classroom, flexible seating",
        "American university lecture hall with students and professor discussing technology",
    ],
    "일본": [
        "Japanese classroom with students at desks, clean organized learning environment in Japan",
        "Japanese students in school uniform using tablets, organized modern classroom",
        "Japanese university campus or laboratory, students researching with AI technology",
    ],
    "싱가포르": [
        "Modern Singapore classroom with high-tech learning environment, Asian students studying",
        "Singapore students in smart school with interactive displays, futuristic classroom",
        "Multi-ethnic Singapore classroom, collaborative learning with digital tools",
    ],
    "중국": [
        "Chinese classroom with students learning, modern educational setting in China",
        "Chinese students using AI learning platforms, large classroom with smart technology",
        "Modern Chinese school campus, students engaged in STEM education activities",
    ],
    "영국": [
        "British classroom or university setting, traditional academic environment in UK",
        "UK college students in modern classroom with wood paneling and digital screens",
        "British university library or tutorial room, students discussing with professor",
    ],
    "독일": [
        "German educational setting, modern classroom or vocational training in Germany",
        "German students in STEM lab, clean organized learning space with modern equipment",
    ],
    "프랑스": [
        "French educational setting, classroom or university environment in France",
        "French students in lycee classroom, philosophical discussion with teacher",
    ],
    "유럽": [
        "European classroom with diverse students, modern educational setting",
        "Multi-national European students studying together, EU education exchange program",
        "European university campus with students from different countries collaborating",
    ],
    "호주": [
        "Australian classroom, students learning outdoors and indoors, Australian education",
        "Australian students in open-plan classroom with natural light and modern technology",
    ],
    "핀란드": [
        "Finnish classroom, Scandinavian minimalist education environment",
        "Finnish students in bright modern classroom, independent learning approach",
    ],
    "아프리카": [
        "African classroom with students learning, community education setting",
        "African students using tablets in bright classroom, modern educational technology in Africa",
        "Diverse African university campus, students collaborating on research projects",
    ],
}

def build_prompt(headline, tags):
    text = headline or ""
    tag_list = [t.lower() if isinstance(t, str) else "" for t in (tags or [])]
    scene = SCENES["default"]
    if any("ai" in t or "인공지능" in t for t in tag_list): scene = SCENES["ai"]
    if any("edu" in t or "교육" in t or "학습" in t for t in tag_list): scene = SCENES["edu"]
    if any("tech" in t or "기술" in t or "디지털" in t or "에듀테크" in t for t in tag_list): scene = SCENES["tech"]
    if any("paper" in t or "논문" in t or "연구" in t or "research" in t for t in tag_list): scene = SCENES["research"]
    if any("school" in t or "학교" in t or "교실" in t for t in tag_list): scene = SCENES["school"]
    if any("robot" in t or "로봇" in t for t in tag_list): scene = SCENES["robot"]
    if any("언어" in t or "language" in t or "자연어" in t for t in tag_list): scene = SCENES["language"]
    if any("digital" in t or "디지털" in t for t in tag_list): scene = SCENES["digital"]
    if any("위기" in t or "crisis" in t for t in tag_list): scene = SCENES["crisis"]
    if any("미래" in t or "future" in t for t in tag_list): scene = SCENES["future"]
    if any("글로벌" in t or "global" in t or "해외" in t or "국제" in t for t in tag_list): scene = SCENES["global"]
    style = random.choice(STYLES)
    en_words = ' '.join(re.findall(r'[a-zA-Z]{4,}', headline or ''))[:80]
    country_scene = None
    for country, cscenes in COUNTRY_SCENE_MAP.items():
        if country in headline:
            country_scene = country_scenes
            break
    
    if country_scene:
        # Cycle through variants based on headline hash for consistency per article
        variant_idx = hash(headline) % len(country_scene)
        scene = country_scene[variant_idx]

    prompt = f"{scene}, {style}"
    if en_words: prompt += f", theme: {en_words}"
    prompt += ", no text, no logos, no typography"
    return prompt

# ─── Ghost API ──────────────────────────────────────
def load_env():
    with open(ENV_FILE) as f:
        text = f.read()
    url_match = re.search(r'GHOST_URL=(.+)', text)
    key_match = re.search(r'GHOST_ADMIN_API_KEY=(.+)', text)
    if not url_match or not key_match:
        raise RuntimeError("Failed to load Ghost config from .env")
    raw_url = url_match.group(1).strip()
    # Strip protocol prefix if present
    ghost_domain = raw_url.replace('https://', '').replace('http://', '').split('/')[0]
    return ghost_domain, key_match.group(1).strip()

def make_jwt(ghost_admin_key):
    kid, secret = ghost_admin_key.split(":")
    now = int(time.time())
    jh = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","typ":"JWT","kid":kid}).encode()).rstrip(b"=").decode()
    jp = base64.urlsafe_b64encode(json.dumps({"iat":now,"exp":now+300,"aud":"/admin/"}).encode()).rstrip(b"=").decode()
    js = base64.urlsafe_b64encode(hmac.new(bytes.fromhex(secret), f"{jh}.{jp}".encode(), "sha256").digest()).rstrip(b"=").decode()
    return f"{jh}.{jp}.{js}"

def ghost_request(method, path, body=None):
    """Make a Ghost Admin API request using urllib (reliable, works with Cloudflare)."""
    ghost_domain, ghost_admin_key = load_env()
    jwt = make_jwt(ghost_admin_key)
    url = f"https://{ghost_domain}/ghost/api/admin/{path}"
    
    headers = {
        "Authorization": f"Ghost {jwt}",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        "Origin": f"https://{ghost_domain}",
        "Referer": f"https://{ghost_domain}/ghost/"
    }
    
    data = None
    if body:
        data = json.dumps(body).encode('utf-8')
        headers["Content-Type"] = "application/json; charset=utf-8"
        headers["Content-Length"] = str(len(data))
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    # Allow HTTPS context
    ctx = ssl.create_default_context()
    
    try:
        resp = urllib.request.urlopen(req, timeout=30, context=ctx)
        return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f"  ❌ Ghost API {method} {path}: HTTP {e.code} - {body[:200]}")
        return {}
    except Exception as e:
        print(f"  ❌ Ghost API {method} {path}: {e}")
        return {}

def get_ghost_posts():
    """Get all posts."""
    return ghost_request('GET', 'posts/?limit=50&order=published_at%20DESC').get('posts', [])

def update_post_feature_image(post_id, new_image_url, updated_at):
    """Update a post's feature_image."""
    body = {'posts': [{'feature_image': new_image_url, 'updated_at': updated_at}]}
    result = ghost_request('PUT', f'posts/{post_id}/', body)
    return bool(result.get('posts'))

# ─── ComfyUI (SSH to Mac Studio) ────────────────────
def ssh_run(cmd, timeout=300):
    r = subprocess.run(
        ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=30", f"axc@{MAC_IP}", cmd],
        capture_output=True, text=True, timeout=timeout
    )
    if r.returncode != 0:
        raise RuntimeError(f"SSH fail (exit {r.returncode}): {r.stderr.strip()[:200]}")
    return r.stdout.strip()

def scp_from(remote_path, local_path):
    subprocess.run(
        ["scp", "-o", "StrictHostKeyChecking=no", f"axc@{MAC_IP}:{remote_path}", local_path],
        capture_output=True, timeout=30, check=True
    )

def upload_image_to_ghost(local_path):
    """Upload a local image to Ghost CMS via Admin API."""
    ghost_domain, ghost_admin_key = load_env()
    jwt = make_jwt(ghost_admin_key)
    
    with open(local_path, "rb") as f:
        img_data = f.read()
    
    boundary = "----FormBoundary" + os.urandom(4).hex()
    header = f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{os.path.basename(local_path)}\"\r\nContent-Type: image/png\r\n\r\n".encode()
    footer = f"\r\n--{boundary}--\r\n".encode()
    body = header + img_data + footer
    
    req = urllib.request.Request(
        f"https://{ghost_domain}/ghost/api/admin/images/upload",
        data=body,
        headers={
            "Authorization": f"Ghost {jwt}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
            "Origin": f"https://{ghost_domain}",
            "Referer": f"https://{ghost_domain}/ghost/"
        }
    )
    try:
        ctx = ssl.create_default_context()
        resp = json.loads(urllib.request.urlopen(req, timeout=30, context=ctx).read())
        url = resp.get("images", [{}])[0].get("url", "")
        return url if url else None
    except Exception as e:
        print(f"  ❌ Ghost upload FAILED: {e}")
        return None

def generate_and_upload_image(prompt):
    """Generate via ComfyUI → upload to Ghost → return CDN URL"""
    print(f"  🎨 Generating image...", flush=True)
    remote_path = ssh_run(f"/tmp/generate-news-image.py {json.dumps(prompt)}")
    if remote_path.startswith("ERROR") or not remote_path:
        print(f"  ❌ Generation FAILED: {remote_path}", flush=True)
        return None
    
    local_path = f"/tmp/comfyui-regen-{int(time.time()*1000)}.png"
    scp_from(remote_path, local_path)
    
    url = upload_image_to_ghost(local_path)
    
    try: os.remove(local_path)
    except: pass
    
    if url:
        print(f"  ✅ Uploaded: {url[:60]}...", flush=True)
    return url

# ─── Main ──────────────────────────────────────────
def main():
    print("=" * 60)
    print("🔄 해외 기사 이미지 재생성")
    print("=" * 60)
    
    posts = get_ghost_posts()
    if not posts:
        print("❌ 기사 목록 조회 실패")
        return
    
    today = time.strftime('%Y-%m-%d')
    
    target_articles = []
    for post in posts:
        pub = post.get('published_at','')[:10]
        if pub != today: continue
        tags = [t.get('name') for t in post.get('tags', [])]
        if '해외' in tags and post.get('feature_image'):
            target_articles.append({
                'id': post['id'],
                'title': post['title'],
                'tags': tags,
                'old_image': post['feature_image'],
                'updated_at': post.get('updated_at', '')
            })
    
    if not target_articles:
        print("❌ 재생성 대상 기사 없음")
        return
    
    print(f"\n📰 대상: {len(target_articles)}개 기사\n")
    
    success = 0
    for i, art in enumerate(target_articles, 1):
        print(f"\n[{i}/{len(target_articles)}] {art['title'][:50]}")
        print(f"   태그: {art['tags']}")
        print(f"   기존: {art['old_image'][:60]}...")
        
        prompt = build_prompt(art['title'], art['tags'])
        print(f"   프롬프트: {prompt[:80]}...")
        
        new_url = generate_and_upload_image(prompt)
        if not new_url:
            print(f"   ❌ 이미지 생성/업로드 실패")
            continue
        
        updated = update_post_feature_image(art['id'], new_url, art['updated_at'])
        if updated:
            success += 1
            print(f"   ✅ Feature image 교체 완료!")
        else:
            print(f"   ⚠️ 이미지는 업로드됐으나 Ghost post 업데이트 실패")
    
    print(f"\n{'=' * 60}")
    print(f"✅ 완료: {success}/{len(target_articles)}개 교체 성공")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    main()
