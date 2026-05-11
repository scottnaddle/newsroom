#!/usr/bin/env python3
"""
Article Quality Control (QC) — UBION Newsroom 자동 품질 검사 및 수정
=====================================================================
Ghost CMS에 발행된 최근 기사를 스캔하여 알려진 문제를 자동 검사/수정합니다.

검사 항목:
1. 📸 피처 이미지 누락 (모든 기사 대상)
2. ⭐ Featured 플래그 (AI테크브리핑/시평 = True, 나머지 = False)
3. 🔗 하이퍼링크 체크 (AI테크브리핑: 10개 이상 외부 링크 필요)
4. 📐 HTML 구조 (AI테크브리핑: 번호 이슈가 h2가 아닌 strong인지)
5. 🔄 중복 주제 (같은 날 AI테크브리핑 × 일반뉴스 중복)
6. ⏰ 발행 시간대 (하루 2회 AI테크브리핑 정상 발행 확인)

실행: python3 scripts/article-qc.py [--fix] [--report]
  --fix    : 자동 수정 가능한 항목 수정
  --report : 텔레그램 리포트 출력
"""
import json, subprocess, base64, hmac, hashlib, time, re, sys, os, argparse
from datetime import datetime, timedelta

# ─── Config ───────────────────────────────────────
GHOST_URL = 'https://newsroom.ubion.global'
ENV_PATH = '/root/.openclaw/workspace/newsroom/.env'
QC_CACHE = '/tmp/article-qc-cache.json'

# 태그별 Featured 규칙
FEATURED_RULES = {
    'ai-tech-brief': True,   # AI테크브리핑 → Featured (slug)
    'AI테크브리핑': True,   # (name)
    '에듀생태계시평': True,  # 시평 → Featured
}

# 폴백 이미지 풀 (404 이미지 교체용)
FALLBACK_IMAGES = [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&q=80',
    'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&q=80',
    'https://images.unsplash.com/photo-1523050854058-8df90110c7f1?w=1200&q=80',
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&q=80',
    'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=1200&q=80',
    'https://images.unsplash.com/photo-1452860606245-08a4f54d129b?w=1200&q=80',
    'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200&q=80',
    'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=1200&q=80',
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&q=80',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&q=80',
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&q=80',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80',
    'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=1200&q=80',
]

# 태그별 최소 하이퍼링크 수
MIN_LINKS = {
    'ai-tech-brief': 8,  # 최소 8개 이상 외부 링크
}

# ─── Ghost API ─────────────────────────────────────
def get_ghost_token():
    with open(ENV_PATH) as f:
        env = f.read()
    match = re.search(r'GHOST_ADMIN_API_KEY=(.+)', env)
    key = match.group(1).strip()
    id_part, secret_part = key.split(':')
    header = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","kid":id_part,"typ":"JWT"}).encode()).rstrip(b'=').decode()
    payload = base64.urlsafe_b64encode(json.dumps({"iat":int(time.time()),"exp":int(time.time())+300,"aud":"/admin/"}).encode()).rstrip(b'=').decode()
    sig = base64.urlsafe_b64encode(hmac.new(bytes.fromhex(secret_part), f"{header}.{payload}".encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
    return f"{header}.{payload}.{sig}"

def ghost_get(path):
    token = get_ghost_token()
    r = subprocess.run(['curl', '-s', '-X', 'GET', f'{GHOST_URL}/ghost/api/admin/{path}',
        '-H', f'Authorization: Ghost {token}'], capture_output=True, text=True, timeout=30)
    try: return json.loads(r.stdout)
    except: return {}

def ghost_put(path, body):
    token = get_ghost_token()
    r = subprocess.run(['curl', '-s', '-X', 'PUT', f'{GHOST_URL}/ghost/api/admin/{path}',
        '-H', f'Authorization: Ghost {token}',
        '-H', 'Content-Type: application/json; charset=utf-8',
        '-d', json.dumps(body)], capture_output=True, text=True, timeout=30)
    try: return json.loads(r.stdout)
    except: return {}

# ─── Quality Checks ────────────────────────────────

def get_title_trigrams(title):
    """Extract character trigrams for similarity matching."""
    title = title.lower().strip()
    trigrams = set()
    for i in range(len(title) - 2):
        trigrams.add(title[i:i+3])
    return trigrams

def title_similarity(t1, t2):
    """Compute trigram-based similarity (0.0~1.0)."""
    tri1 = get_title_trigrams(t1)
    tri2 = get_title_trigrams(t2)
    if not tri1 or not tri2:
        return 0.0
    overlap = len(tri1 & tri2)
    union = len(tri1 | tri2)
    return overlap / max(union, 1)

def check_feature_image(post):
    """Check if post has a feature image AND the URL is actually reachable."""
    img_url = post.get('feature_image')
    if not img_url:
        return False, "❌ 피처 이미지 없음"
    
    # Verify the URL is actually reachable (not 404)
    try:
        r = subprocess.run(
            ['curl', '-sI', '--max-time', '5', img_url],
            capture_output=True, text=True, timeout=10
        )
        status_line = r.stdout.split('\n')[0] if r.stdout else ''
        # Accept 2xx and 3xx (redirects are fine)
        # Handle both HTTP/1.1 200 and HTTP/2 200 (no dot in HTTP/2)
        is_reachable = bool(re.search(r'HTTP/\d+(\.\d+)?\s+[23]\d{2}', status_line))
        if is_reachable:
            return True, f"✅ 피처 이미지 있음 (HTTP {status_line.split()[1] if len(status_line.split())>1 else 'OK'})"
        else:
            return False, f"❌ 피처 이미지 URL 응답 없음 ({status_line.strip()[:60]})"
    except Exception as e:
        # If verification fails, still count it as having an image field
        # but warn about the verification failure
        return True, f"⚠️ 피처 이미지 있음 (URL 검증 실패: {str(e)[:40]})"

def check_featured(post):
    """Check if Featured flag matches tag rules."""
    tags = [t.get('name', '') for t in post.get('tags', [])]  # ← name (not slug)
    current = post.get('featured', False)
    
    expected = False  # default
    for tag in tags:
        if tag in FEATURED_RULES:
            expected = FEATURED_RULES[tag]
            break
    
    if current == expected:
        return True, f"✅ Featured={current} (의도={expected})"
    else:
        return False, f"❌ Featured={current}, 의도={expected} (수정 필요)"

def check_links(post, html):
    """Check external hyperlinks count."""
    tags = [t.get('slug', '') for t in post.get('tags', [])]
    links = re.findall(r'<a\s+(?:[^>]*?\s+)?href="([^"]*)"', html, re.IGNORECASE)
    ext_links = [l for l in links if not l.startswith(GHOST_URL)]
    
    # Check minimum for AI tech brief
    min_needed = 0
    for tag in tags:
        if tag in MIN_LINKS:
            min_needed = MIN_LINKS[tag]
            break
    
    if min_needed > 0 and len(ext_links) < min_needed:
        return False, f"❌ 외부 링크 {len(ext_links)}개 (필요: {min_needed}개)"
    elif ext_links:
        return True, f"✅ 외부 링크 {len(ext_links)}개"
    else:
        return True, f"ℹ️ 외부 링크 {len(ext_links)}개 (일반기사는 링크 없어도 무방)"

def check_html_structure(html, post_title):
    """Check HTML structural issues (h2 misuse for numbered items)."""
    issues = []
    
    # Check for h2 with number prefix (should be strong in AI briefs)
    h2s = re.findall(r'<h2[^>]*>(.*?)</h2>', html, re.DOTALL)
    numbered_h2 = [h for h in h2s if re.match(r'\s*\d+[\.\)]', h.strip())]
    
    if numbered_h2:
        issues.append(f"⚠️ 번호 이슈가 <h2>로 발행됨 ({len(numbered_h2)}개) → <strong>으로 수정 필요")
    
    # Also check h2 items that are content-like (not section headers)
    content_like_h2 = [h for h in h2s if not any(kw in h for kw in ['키워드', '트렌드', 'TOP', '📊', '🔥', 'SUMMARY'])]
    if len(content_like_h2) >= 3 and '브리핑' in post_title:
        issues.append(f"⚠️ AI 브리핑: 콘텐츠성 <h2> {len(content_like_h2)}개 (섹션 제목 외 h2 다수 → strong 권장)")
    
    # Check for missing h2 entirely (should have at least section headers)
    if '브리핑' in post_title:
        # AI Tech Brief should have strong-numbered items (with or without number prefix)
        strongs = re.findall(r'<strong>(.*?)</strong>', html)
        if len(strongs) < 8 and not numbered_h2:
            issues.append(f"⚠️ AI 브리핑: 이슈 항목이 {len(strongs)}개만 발견 (10개 목표)")
        elif len(strongs) >= 8:
            pass  # OK - strong items exist
        elif numbered_h2:
            pass  # already reported above
    
    # Check for duplicate title h2 (first h2 that matches post title)
    if h2s and post_title:
        first_h2 = re.sub(r'<[^>]+>', '', h2s[0]).strip()
        if first_h2 == post_title.strip():
            issues.append(f"⚠️ 첫 h2가 Ghost 타이틀과 동일 (중복) → h2 제거 필요")
    
    # Check for markdown residue
    md_count = len(re.findall(r'###|####', html))
    if md_count > 0:
        issues.append(f"⚠️ 마크다운 잔재 {md_count}개 (###/#### → <h3>/<h4> 변환 필요)")
    
    return issues

def check_topic_overlap(post, all_posts, html, title):
    """Check if this post's content overlaps with other recent posts."""
    overlaps = []
    post_id = post.get('id', '')
    post_tags = [t.get('slug', '') for t in post.get('tags', [])]
    
    # Extract issues from this post
    strongs = re.findall(r'<strong>(\d+\.\s*[^<]{10,100})', html)
    if not strongs:
        strongs = re.findall(r'<h2[^>]*>\s*(\d+\.\s*[^<]{10,100})', html)
    
    for other in all_posts:
        if other.get('id') == post_id:
            continue
        other_title = other.get('title', '')
        other_html = other.get('html', '')
        other_tags = [t.get('slug', '') for t in other.get('tags', [])]
        
        # Title similarity
        sim = title_similarity(title, other_title)
        if sim > 0.35 and 'AI 테크 브리핑' in title and 'AI 테크 브리핑' in other_title:
            overlaps.append(f"⚠️ 같은 날 AI 브리핑 제목 유사도 {sim:.0%}: '{other_title[:50]}'")
        
        # Issue topic overlap (for AI Tech Brief vs regular news)
        if 'ai-tech-brief' in post_tags and 'ai-tech-brief' not in other_tags:
            other_strongs = re.findall(r'<strong>([^<]{10,150})', other_html)
            if not other_strongs:
                other_strongs = re.findall(r'<h2[^>]*>([^<]{10,150})', other_html)
            
            for issue in strongs:
                issue_clean = issue.split('>')[-1] if '>' in issue else issue
                for other_s in other_strongs:
                    other_clean = other_s.split('>')[-1] if '>' in other_s else other_s
                    if title_similarity(issue_clean, other_clean) > 0.45:
                        overlaps.append(f"⚠️ 일반뉴스와 주제 중복: '{other_title[:40]}' ↔ '{issue_clean[:50]}'")
                        break
    
    return overlaps

# ─── Main QC ───────────────────────────────────────
def run_qc(fix=False):
    print("=" * 60)
    print(f"📋 UBION Newsroom 품질 검사 — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)
    
    # Get recent posts (last 3 days)
    today = datetime.now().strftime('%Y-%m-%d')
    three_days_ago = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
    data = ghost_get(f'posts/?filter=published_at:%3E%3D{three_days_ago}&limit=50&order=published_at%20DESC&formats=html')
    posts = data.get('posts', [])
    
    if not posts:
        print("\n❌ 최근 3일간 발행된 기사 없음")
        return
    
    print(f"\n📰 검사 대상: 최근 3일간 {len(posts)}개 기사\n")
    
    results = {
        'total': len(posts),
        'passed': 0,
        'fixed': 0,
        'warnings': [],
        'errors': [],
        'report_lines': []
    }
    
    for post in posts:
        title = post.get('title', '')
        slug = post.get('slug', '')
        html = post.get('html', '')
        tags = [t.get('name', '') for t in post.get('tags', [])]
        tag_slugs = [t.get('slug', '') for t in post.get('tags', [])]
        post_id = post.get('id', '')
        published = post.get('published_at', '')[:10]
        
        print(f"\n{'─' * 50}")
        print(f"📄 [{published}] {title}")
        print(f"   태그: {', '.join(tags[:3])} | Slug: {slug}")
        
        post_ok = True
        post_fixes = []
        post_issues = []
        
        # 1. Feature Image Check
        has_img, img_msg = check_feature_image(post)
        print(f"   {img_msg}")
        if not has_img:
            if fix and ('404' in img_msg or '이미지 없음' in img_msg):
                # 자동 교체: hash(title) 기반 폴백 이미지 선택 → Ghost 업로드
                import hashlib
                fallback_idx = int(hashlib.md5(title.encode()).hexdigest(), 16) % len(FALLBACK_IMAGES)
                fallback_url = FALLBACK_IMAGES[fallback_idx]
                
                # 폴백 이미지가 응답하는지 확인
                try:
                    fb_r = subprocess.run(
                        ['curl', '-sI', '--max-time', '5', fallback_url],
                        capture_output=True, text=True, timeout=10
                    )
                    fb_ok = bool(re.search(r'HTTP/\d+(\.\d+)?\s+[23]\d{2}', fb_r.stdout))
                except:
                    fb_ok = False
                
                if fb_ok:
                    # 폴백 다운로드 → Ghost 업로드
                    try:
                        dl_r = subprocess.run(['curl', '-sL', '--max-time', '10', '-o', f'/tmp/qc-fix-{slug}.jpg', fallback_url],
                            capture_output=True, text=True, timeout=15)
                        if os.path.exists(f'/tmp/qc-fix-{slug}.jpg') and os.path.getsize(f'/tmp/qc-fix-{slug}.jpg') > 5000:
                            # Ghost 업로드
                            token = get_ghost_token()
                            upload_r = subprocess.run([
                                'curl', '-s', '-X', 'POST', f'{GHOST_URL}/ghost/api/admin/images/upload/',
                                '-H', f'Authorization: Ghost {token}',
                                '-F', f'file=@/tmp/qc-fix-{slug}.jpg',
                            ], capture_output=True, text=True, timeout=30)
                            upload_result = json.loads(upload_r.stdout) if upload_r.stdout else {}
                            new_img_url = upload_result.get('images', [{}])[0].get('url', '')
                            
                            if new_img_url:
                                # Post에 새 이미지 설정 (updated_at 포함)
                                post_current = ghost_get(f'posts/{post_id}/?fields=id,updated_at')
                                updated_at = post_current.get('posts', [{}])[0].get('updated_at', '')
                                result = ghost_put(f'posts/{post_id}/', {
                                    'posts': [{'id': post_id, 'feature_image': new_img_url, 'updated_at': updated_at}]
                                })
                                if result.get('posts'):
                                    post_fixes.append(f"📸 이미지 교체완료 (→ Ghost CDN)")
                                    print(f"     → ✅ 이미지 자동 교체: {new_img_url[:50]}...")
                                else:
                                    print(f"     → ❌ 이미지 설정 실패")
                            else:
                                # Ghost 업로드 실패 → 직접 Unsplash URL 설정
                                post_current = ghost_get(f'posts/{post_id}/?fields=id,updated_at')
                                updated_at = post_current.get('posts', [{}])[0].get('updated_at', '')
                                result = ghost_put(f'posts/{post_id}/', {
                                    'posts': [{'id': post_id, 'feature_image': fallback_url, 'updated_at': updated_at}]
                                })
                                if result.get('posts'):
                                    post_fixes.append(f"📸 이미지 교체 (Unsplash 직접 URL)")
                                    print(f"     → ✅ 이미지 교체 (Unsplash 직접): {fallback_url[:50]}...")
                                else:
                                    print(f"     → ❌ 이미지 교체 실패")
                        else:
                            print(f"     → ⚠️ 폴백 다운로드 실패 (크기 {os.path.getsize(f'/tmp/qc-fix-{slug}.jpg') if os.path.exists(f'/tmp/qc-fix-{slug}.jpg') else 0}bytes)")
                    except Exception as e:
                        print(f"     → ⚠️ 이미지 교체 중 오류: {e[:80]}")
                else:
                    print(f"     → ⚠️ 폴백 이미지 자체가 응답 없음 (skip)")
            else:
                post_issues.append(f"📸 [{slug}] {img_msg}")
        
        # 2. Featured Check
        feat_ok, feat_msg = check_featured(post)
        print(f"   {feat_msg}")
        if not feat_ok:
            if fix:
                # Fix featured flag — MUST include updated_at for Ghost v6.22 optimistic locking
                expected_feat = False
                for t in tag_slugs:
                    if t in FEATURED_RULES:
                        expected_feat = FEATURED_RULES[t]
                        break
                # GET latest updated_at first
                post_current = ghost_get(f'posts/{post_id}/?fields=id,updated_at')
                updated_at = post_current.get('posts', [{}])[0].get('updated_at', '')
                result = ghost_put(f'posts/{post_id}/', {
                    'posts': [{'id': post_id, 'featured': expected_feat, 'updated_at': updated_at}]
                })
                if result.get('posts'):
                    post_fixes.append(f"⭐ Featured → {expected_feat} (수정완료)")
                    print(f"     → ✅ 자동 수정: Featured={expected_feat}")
                else:
                    err_msg = json.dumps(result, ensure_ascii=False)[:100]
                    post_fixes.append(f"⭐ Featured 수정 실패 ({err_msg})")
                    print(f"     → ❌ 수정 실패: {err_msg}")
            else:
                post_issues.append(f"⭐ [{slug}] {feat_msg}")
        
        # 3. Link Check
        link_ok, link_msg = check_links(post, html)
        print(f"   {link_msg}")
        if not link_ok:
            post_issues.append(f"🔗 [{slug}] {link_msg}")
        
        # 4. HTML Structure Check
        struct_issues = check_html_structure(html, title)
        for si in struct_issues:
            print(f"   {si}")
            post_issues.append(f"📐 [{slug}] {si}")
        
        # Auto-fix HTML structure if needed
        if struct_issues and fix:
            new_html = html
            
            # Fix 1: Remove duplicate title h2 (first h2 matching post title)
            if any('타이틀과 동일' in s for s in struct_issues):
                title_text = post.get('title', '')
                new_html = re.sub(rf'<h2[^>]*>{re.escape(title_text)}</h2>\s*', '', new_html, count=1)
                print(f'     → 제목 중복 h2 제거')
            
            # Fix 2: Convert markdown ### → h3, #### → h4
            md_before = len(re.findall(r'###|####', new_html))
            if md_before > 0:
                new_html = re.sub(r'<p>####\s+(.+?)</p>', r'<h4>\1</h4>', new_html)
                new_html = re.sub(r'<p>###\s+(.+?)</p>', r'<h3>\1</h3>', new_html)
                md_after = len(re.findall(r'###|####', new_html))
                fixed_md = md_before - md_after
                if fixed_md > 0:
                    print(f'     → 마크다운 {fixed_md}개 → h3/h4 변환')
            
            # Fix 3: Convert content-like h2 to p+strong (for AI brief numbered items)
            if ('브리핑' in title or '시평' in title) and any('h2' in s and '타이틀' not in s for s in struct_issues):
                h2_pattern = r'<h2[^>]*>(?!오늘의|📊|🔥|SUMMARY)(.*?)</h2>'
                def convert_h2(m):
                    content = m.group(1)
                    if any(kw in content for kw in ['키워드', '트렌드', 'TOP', '📊', '🔥', 'SUMMARY']):
                        return m.group(0)
                    return f'<p><strong>{content}</strong></p>'
                new_html = re.sub(h2_pattern, convert_h2, html, flags=re.DOTALL)
            
            if new_html != html:
                result = ghost_put(f'posts/{post_id}/?source=html', {
                    'posts': [{'html': new_html, 'updated_at': post.get('updated_at')}]
                })
                if result.get('posts'):
                    post_fixes.append(f"📐 HTML 구조 수정")
                    print(f'     → ✅ 자동 수정 완료')
                    html = new_html
                else:
                    print(f'     → ❌ 수정 실패: {json.dumps(result, ensure_ascii=False)[:100]}')
        
        # 5. Topic Overlap Check (only for recent posts)
        if published >= three_days_ago:
            overlaps = check_topic_overlap(post, posts, html, title)
            for ov in overlaps:
                print(f"   {ov}")
                post_issues.append(f"🔄 {ov}")
        
        if post_issues:
            results['errors'].extend(post_issues)
            post_ok = False
        if post_fixes:
            results['fixed'] += len(post_fixes)
        
        if post_ok:
            results['passed'] += 1
    
    # Summary
    print(f"\n{'=' * 60}")
    print(f"📊 QC 결과 요약")
    print(f"{'=' * 60}")
    total_issues = len(results['errors'])
    passed = results['passed']
    fixed = results['fixed']
    
    summary = [
        f"📰 검사: {results['total']}개 기사",
        f"✅ 이상없음: {passed}개",
        f"⚠️ 이슈: {total_issues}개",
        f"🔧 자동수정: {fixed}개" if fix else f"🔧 --fix 옵션으로 자동 수정 가능",
    ]
    for s in summary:
        print(f"  {s}")
    
    # Detailed issues
    if results['errors']:
        print(f"\n📋 상세 이슈 목록:")
        for e in results['errors']:
            print(f"  • {e}")
    
    # Create report for Telegram
    report = f"📋 **UBION QC 리포트** ({datetime.now().strftime('%m/%d %H:%M')})\n\n"
    report += f"📰 검사: {results['total']}개 기사\n"
    report += f"✅ 정상: {passed}개\n"
    report += f"⚠️ 이슈: {total_issues}개\n"
    if fix:
        report += f"🔧 수정: {fixed}건\n"
    if results['errors']:
        report += "\n**이슈 목록:**\n"
        for e in results['errors'][:10]:
            report += f"• {e}\n"
        if len(results['errors']) > 10:
            report += f"...외 {len(results['errors'])-10}개\n"
    
    # Save to cache
    with open(QC_CACHE, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_posts': results['total'],
            'passed': passed,
            'issues': total_issues,
            'fixed': fixed,
            'errors': results['errors'][:20]
        }, f, ensure_ascii=False)
    
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='UBION Article Quality Control')
    parser.add_argument('--fix', action='store_true', help='자동 수정 가능한 항목 수정')
    parser.add_argument('--report', action='store_true', help='텔레그램 리포트 형식 출력')
    args = parser.parse_args()
    
    report = run_qc(fix=args.fix)
    
    if args.report and report:
        print(f"\n--- 텔레그램 리포트 ---\n{report}")
    elif args.fix:
        print(f"\n✅ QC 완료 (--fix 적용)")
