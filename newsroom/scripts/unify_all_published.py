#!/usr/bin/env python3
"""
Unify ALL published Ghost articles to match the 5/13 Chinese AI article format.
통일 포맷:
  <blockquote>한줄 출처</blockquote>
  <p>본문...</p>
  <p>본문...</p>
  <p>원문 보기: <a href="URL">URL</a></p>
  <p>본 기사는 AI로 작성되었습니다...</p>

No inline styles, no <h2>, <h3>, <hr> - just blockquote + paragraphs.
"""

import json, urllib.request, hmac, hashlib, base64, time, re, sys, os

ENV_FILE = '/root/.openclaw/workspace/newsroom/.env'
GHOST_URL = None
GHOST_KEY = None

with open(ENV_FILE) as f:
    for line in f:
        line = line.strip()
        if line.startswith('GHOST_URL='):
            GHOST_URL = line.split('=', 1)[1].strip().rstrip('/')
        elif line.startswith('GHOST_ADMIN_API_KEY='):
            GHOST_KEY = line.split('=', 1)[1].strip()

if not GHOST_URL or not GHOST_KEY:
    print("ERROR: Could not read .env")
    sys.exit(1)

ghost_api = GHOST_URL + '/ghost/api/admin'
key_id, secret_hex = GHOST_KEY.split(':', 1)
secret_bytes = bytes.fromhex(secret_hex)

def make_jwt():
    header = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","kid":key_id,"typ":"JWT"}).encode()).rstrip(b'=').decode()
    now = int(time.time())
    payload = base64.urlsafe_b64encode(json.dumps({"iat":now,"exp":now+300,"aud":"/admin/"}).encode()).rstrip(b'=').decode()
    sig = base64.urlsafe_b64encode(hmac.new(secret_bytes, f"{header}.{payload}".encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
    return f"{header}.{payload}.{sig}"

def ghost_req(method, path, body=None):
    url = f"{ghost_api}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={"Authorization": f"Ghost {make_jwt()}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  HTTP Error {e.code}: {e.read().decode()[:200]}")
        return {}
    except Exception as e:
        print(f"  Error: {e}")
        return {}

def get_all_posts():
    """Get ALL posts including drafts."""
    all_posts = []
    page = 1
    while True:
        r = ghost_req('GET', f'/posts/?limit=200&page={page}&formats=html')
        posts = r.get('posts', [])
        if not posts:
            break
        all_posts.extend(posts)
        page += 1
    return all_posts

def unify_html(html):
    """Convert article HTML to 5/13 Chinese AI style."""
    if not html:
        return html

    # Step 1: Remove ALL inline styles from ALL tags
    html = re.sub(r'\s+style="[^"]*"', '', html)
    html = re.sub(r"\s+style='[^']*'", '', html)

    # Step 2: Remove all <h2>, <h3>, <hr> — convert to <p>
    html = re.sub(r'</?h[23][^>]*>', '', html)
    html = re.sub(r'<hr\s*/?>', '', html)
    html = re.sub(r'\n{2,}', '\n', html)

    # Step 3: Consolidate blockquote: remove inner tags, flatten to one line
    def clean_blockquote(m):
        inner = m.group(1)
        # Remove all inner tags
        inner = re.sub(r'<[^>]+>', '', inner)
        # Collapse whitespace
        inner = re.sub(r'\s+', ' ', inner).strip()
        return f'<blockquote>{inner}</blockquote>'
    html = re.sub(r'<blockquote[^>]*>([\s\S]*?)</blockquote>', clean_blockquote, html)

    # Step 4: Remove empty paragraphs
    html = re.sub(r'<p>\s*</p>', '', html)

    # Step 5: Fix source link format - find "원문 보기:" patterns
    # Pattern: 원문 보기: <a href="URL">SOMETHING</a>
    # Fix: 원문 보기: <a href="URL">URL</a>
    def fix_source_link(m):
        before = m.group(1)
        href = m.group(2)
        # The display text should be the URL itself
        return f'{before}원문 보기: <a href="{href}">{href}</a>'
    html = re.sub(r'(<p>)?\s*원문\s*보기\s*:?\s*<a\s+href="([^"]+)"[^>]*>.*?</a>', fix_source_link, html)

    # Also handle: <a href="URL">📖 원문 보기</a> or 📖<a...>
    html = re.sub(r'📖\s*', '', html)
    html = re.sub(r'<p>\s*<a\s+href="([^"]+)"[^>]*>원문\s*보기.*?</a>\s*</p>', r'<p>원문 보기: <a href="\1">\1</a></p>', html)

    # Step 6: Fix AI notice being inside <a> tag
    # Pattern: <p><a href="URL">본 기사는 AI로 작성...</a></p>
    def fix_ai_in_link(m):
        href = m.group(1)
        ai_text = m.group(2)
        return f'<p>원문 보기: <a href="{href}">{href}</a></p><p>{ai_text}</p>'
    html = re.sub(r'<a\s+href="([^"]+)"[^>]*>(본\s*기사는\s*AI[^<]*?)</a>', fix_ai_in_link, html)

    # Step 7: Ensure AI notice is its own paragraph, not in source link paragraph
    # Pattern: <p>원문 보기: ...</p><p>본 기사는 AI...</p> → keep as is (already correct)
    
    # Step 8: Ensure there's exactly one blank line between paragraphs for readability
    # (Ghost doesn't care, but let's keep it clean)
    html = re.sub(r'</blockquote>\s*', '</blockquote>', html)
    html = re.sub(r'\s*<p>', '<p>', html)
    html = re.sub(r'</p>\s*', '</p>', html)

    # Step 9: Fix broken URLs in display text (https://... pattern)
    html = re.sub(r'(https?://[^"<]+)\.\.\.(</a>)', r'\1\2', html)
    html = re.sub(r'\.\.\.</a>', '</a>', html)

    # Step 10: Final cleanup — remove any remaining empty paragraphs
    html = re.sub(r'<p>\s*</p>', '', html)

    return html.strip()

def analyze_html(html):
    """Analyze the structure of HTML for comparison."""
    lines = []
    # Extract tags in order
    tags = re.findall(r'<(/?)(\w+)[^>]*>', html)
    for is_close, tag in tags:
        if not is_close:
            lines.append(f"  <{tag}>")
        else:
            lines.append(f"  </{tag}>")
    
    # Check for issues
    issues = []
    if 'style=' in html:
        issues.append("❌ Contains inline styles")
    if re.search(r'<a[^>]*>[^<]*본 기사는 AI', html):
        issues.append("❌ AI notice inside <a> tag")
    if '📖' in html:
        issues.append("❌ Contains 📖 emoji")
    if 'https://...' in html:
        issues.append("❌ Truncated URL (https://...)")
    if re.search(r'<h[23]>', html):
        issues.append("⚠️ Contains <h2>/<h3> tags")
    if re.search(r'<hr', html):
        issues.append("⚠️ Contains <hr> tags")
    
    return '\n'.join(lines[:20]) + ('\n  ...' if len(lines) > 20 else ''), issues

def main():
    print("📥 Fetching all Ghost posts...")
    posts = get_all_posts()
    print(f"📊 Total posts: {len(posts)}")

    skip_tags = {'edtech-editorial', 'ai-tech-brief', 'edtech-ecosystem', 'ai-paper', 'ai-edu'}
    
    changed = 0
    skipped = 0
    errors = 0
    unchanged = 0
    problematic = []

    for i, post in enumerate(posts):
        slug = post.get('slug', '?')
        title = post.get('title', '?')[:40]
        html = post.get('html', '')
        
        # Check if this post has tags that should preserve h2 structure
        post_tags = {t.get('slug', '') for t in post.get('tags', [])}
        
        if not html:
            skipped += 1
            continue

        # Analyze before
        old_issues = analyze_html(html)[1]
        
        # Check if it already matches 5/13 format
        has_blockquote = '<blockquote>' in html
        has_source_link = '원문 보기:' in html
        has_ai_notice = '본 기사는 AI' in html
        
        # Apply unify
        new_html = unify_html(html)
        
        if new_html == html:
            unchanged += 1
            continue
        
        # Save to Ghost
        r = ghost_req('PUT', f'/posts/{post["id"]}/?source=html', {
            'posts': [{'html': new_html, 'updated_at': post.get('updated_at')}]
        })
        
        if r.get('posts'):
            changed += 1
            new_issues = analyze_html(new_html)[1]
            if new_issues:
                problematic.append((slug, new_issues))
            
            if changed <= 3 or (i % 10 == 0):
                print(f"  {'✅' if not new_issues else '⚠️'} [{i+1}/{len(posts)}] {slug[:35]}")
                if old_issues:
                    print(f"     Before: {'; '.join(old_issues)}")
                if new_issues:
                    print(f"     After:  {'; '.join(new_issues)}")
        else:
            errors += 1
            print(f"  ❌ [{i+1}/{len(posts)}] {slug[:35]} — update failed")

        if (i + 1) % 50 == 0:
            print(f"\n📊 Progress: {i+1}/{len(posts)} — changed: {changed}, errors: {errors}")

    print(f"\n{'='*50}")
    print(f"📊 최종 결과")
    print(f"{'='*50}")
    print(f"✅ 변환 완료: {changed}개")
    print(f"⏭️  스킵 (HTML 없음): {skipped}개")
    print(f"🔄 변경 없음: {unchanged}개")
    print(f"❌ 오류: {errors}개")

    if problematic:
        print(f"\n⚠️ 변환 후에도 문제 있는 기사:")
        for slug, issues in problematic:
            print(f"  {slug}: {'; '.join(issues)}")

    # Show sample comparison
    print(f"\n{'='*50}")
    print(f"📋 변환 샘플 (첫 번째 + 기준 기사)")
    print(f"{'='*50}")
    
    # Get 5/13 reference article
    ref = ghost_req('GET', '/posts/?filter=slug:junggug-geulrobeol-ai-gyoyug-seobiseu-peulraespom-gaeseol&formats=html')
    if ref.get('posts'):
        print(f"\n--- 5/13 중국 (기준) ---")
        print(ref['posts'][0].get('html', 'N/A')[:500])

if __name__ == '__main__':
    main()
