#!/usr/bin/env python3
"""
Crawl4AI Pipeline v2 — 실제 기사 URL에 본문 추출 + 이미지 수집
===========================================================
1. pipeline/01-sourced/ 에서 기사 URL 읽기 (collect-sources.py 의 산출물)
2. 각 URL에 Crawl4AI (PruningFilter) 로 clean 본문 추출
3. 기사 이미지 추출
4. Ghost Draft 발행 준비 (HTML 포맷)

Usage:
  python3 scripts/crawl4ai-pipeline.py         # 모든 소스 처리
  python3 scripts/crawl4ai-pipeline.py --test  # 5개만 처리
"""

import asyncio, json, os, re, sys, urllib.parse
from datetime import datetime, timezone
from html import escape as h

# ─── Config ─────────────────────────────────────
NEWSROOM_DIR = "/root/.openclaw/workspace/newsroom"
SOURCED_DIR = f"{NEWSROOM_DIR}/pipeline/01-sourced"
CONTENT_DIR = f"{NEWSROOM_DIR}/pipeline/crawl4ai-content"
DRAFT_DIR = f"{NEWSROOM_DIR}/pipeline/04-drafted"

os.makedirs(CONTENT_DIR, exist_ok=True)
os.makedirs(DRAFT_DIR, exist_ok=True)

# 교육 관련성 점수 (기사 제목 + 설명 기준)
EDU_KEYWORDS_SCORE = {
    'education': 3, 'ai': 2, 'artificial intelligence': 3, 'learning': 2,
    'student': 2, 'teacher': 2, 'school': 2, 'classroom': 3, 'teaching': 3,
    'edtech': 3, 'curriculum': 2, 'digital': 1, 'online learning': 2,
    'k-12': 3, 'university': 1, 'training': 1, 'literacy': 2,
    '교육': 3, '학교': 2, '교사': 3, '학생': 2, '에듀테크': 3,
    '수업': 3, '교실': 3, '인공지능': 3, 'AI': 3, '학습': 2,
    '교과서': 3, '디지털': 1,
}

EXCLUDED_DOMAINS = [
    'bbs.ruliweb.com', 'sisajournal.com', 'namu.wiki', 'gall.dcinside.com',
    'dcinside.com', 'igm.or.kr', 'edpolicy.kedi.re.kr', 'hrmsoft.co.kr',
]

EXCLUDED_TITLES_PATTERNS = [
    r'실시간\s*베스트', r'갤러리', r'전체\s*글\s*보기',
    r'게시판', r'커뮤니티',
]

# ─── Load Source Items ──────────────────────────
def load_source_items():
    """pipeline/01-sourced/ 에서 item list 로드"""
    items = []
    for fname in sorted(os.listdir(SOURCED_DIR)):
        if not fname.endswith('.json'):
            continue
        with open(os.path.join(SOURCED_DIR, fname)) as f:
            item = json.load(f)
        source = item.get('source', {})
        url = source.get('url', '')
        title = source.get('title', '')
        
        # low-quality source 제외
        if any(d in url for d in EXCLUDED_DOMAINS):
            continue
        
        # 패턴 제외
        if any(re.search(p, title) for p in EXCLUDED_TITLES_PATTERNS):
            continue

        items.append({
            'id': item.get('id', fname.replace('.json', '')),
            'title': title,
            'url': url,
            'description': source.get('description', ''),
            'source': source.get('source', ''),
            'region': item.get('region', 'global'),
            'score': item.get('score', 50),
        })
    return items


def score_relevance(title, desc):
    """제목+설명으로 교육 관련성 점수"""
    text = f"{title} {desc}".lower()
    score = 0
    for kw, pts in EDU_KEYWORDS_SCORE.items():
        if kw in text:
            score += pts
    return score


# ─── Crawl4AI Content Extraction (Async) ────────
async def extract_article(url, crawler, max_len=3000):
    """Crawl4AI로 기사 본문 추출 (PruningFilter)"""
    from crawl4ai import CrawlerRunConfig, CacheMode
    from crawl4ai.content_filter_strategy import PruningContentFilter
    from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

    config = CrawlerRunConfig(
        markdown_generator=DefaultMarkdownGenerator(
            content_filter=PruningContentFilter(threshold=0.45, threshold_type="fixed")
        ),
        word_count_threshold=10,
        cache_mode=CacheMode.ENABLED,
        excluded_tags=["nav", "footer", "header", "aside", "script", "style",
                       "noscript", "form", "button", "svg", "dialog",
                       "iframe", "object"],
    )
    result = await crawler.arun(url=url, config=config)
    if not result or not result.success:
        return None, []
    
    md = result.markdown
    if not md or len(md) < 200:
        return None, []

    # 이미지 추출
    img_urls = list(set(re.findall(r'!\[.*?\]\((https?://[^\s)]+)\)', md)))
    img_urls = [u for u in img_urls if not any(x in u.lower() for x in
        ['logo', 'icon', 'button', 'banner', 'facebook', 'twitter', 'share',
         'weibo', 'weixin', 'linkedin', 'timg', 'sign_ico', 'sub_ico',
         'more_art', 'showmobile', 'favicon', 'sprite', 'btn', 'arrow',
         'bg_', 'footer', 'header_', 'nav_', 'top_', 'img_e/', 'svg',
         'pixel', 'track', 'analytics'])]
    
    # 컨텐츠 이미지 우선
    content_imgs = [u for u in img_urls if '/images/' in u.lower() or '/photo/' in u.lower() or '/article/' in u.lower()]
    other_imgs = [u for u in img_urls if u not in content_imgs]
    img_urls = (content_imgs + other_imgs)[:5]

    # clean: navigation 스킵
    lines = md.split('\n')
    content_start = 0
    nav_count = 0
    for i, l in enumerate(lines):
        t = l.strip()
        if t.startswith('* [') or t.startswith('[') or len(t) < 30:
            nav_count += 1
            continue
        if nav_count > 2 and len(t) > 30:
            content_start = i
            break
    if content_start == 0 and len(lines) > 5:
        content_start = len(lines) // 4
    
    content = '\n'.join(lines[content_start:])
    # 꼬리말 제거
    content = re.sub(r'(?i)(copyright|©|all rights reserved).*', '', content).strip()
    content = re.sub(r'(?im)^(share|print|email|facebook|twitter|wechat).*$', '', content).strip()
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    # 길이 제한
    if len(content) > max_len:
        content = content[:max_len] + "\n\n... *(이하 원문 참조)*"
    
    return content, img_urls


def save_content(item_id, content, img_urls, title, source_name):
    """추출된 내용 저장"""
    # .md 저장
    md_file = f"{CONTENT_DIR}/{item_id}.md"
    header = f"# {title}\n\n*출처: {source_name}*\n\n"
    with open(md_file, "w") as f:
        f.write(header + content)
    
    # 이미지 저장
    if img_urls:
        img_file = f"{CONTENT_DIR}/{item_id}-images.json"
        with open(img_file, "w") as f:
            json.dump(img_urls, f, indent=2)
    
    return md_file


def md_to_ghost_html(md_content, title, img_urls, original_url):
    """Markdown → Ghost 호환 HTML 변환 (Mobiledoc-safe)"""
    lines = md_content.split('\n')
    html_parts = []
    in_list = False
    
    for line in lines:
        stripped = line.strip()
        
        # Skip empty lines — close any open list
        if not stripped:
            if in_list:
                html_parts.append('')
                in_list = False
            html_parts.append('')
            continue
        
        # Skip title (already in header)
        if stripped.startswith('# ') and stripped.rstrip('#').strip() == title[:50]:
            continue
        
        # Headers
        if stripped.startswith('## '):
            html_parts.append(f'<h3>{escape(stripped[3:])}</h3>')
        elif stripped.startswith('### '):
            html_parts.append(f'<h4>{escape(stripped[4:])}</h4>')
        
        # Horizontal rule
        elif stripped in ('---', '***', '___'):
            html_parts.append('<hr>')
        
        # Bullet lists
        elif stripped.startswith('* ') or stripped.startswith('- '):
            text = escape(stripped[2:])
            text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
            text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
            if not in_list:
                html_parts.append('<ul>')
                in_list = True
            html_parts.append(f'<li>{text}</li>')
        
        # Numbered lists
        elif re.match(r'^\d+[.)]\s', stripped):
            text = escape(re.sub(r'^\d+[.)]\s', '', stripped))
            text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
            text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
            if not in_list:
                html_parts.append('<ol>')
                in_list = True
            html_parts.append(f'<li>{text}</li>')
        
        # Images
        elif stripped.startswith('!['):
            m = re.match(r'!\[.*?\]\((https?://[^\s)]+)\)', stripped)
            if m:
                img_url = m.group(1)
                html_parts.append(f'<figure class="kg-card kg-image-card"><img src="{escape(img_url)}" alt="" class="kg-image" /></figure>')
        
        # Quotes
        elif stripped.startswith('> '):
            text = escape(stripped[2:])
            text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
            text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
            html_parts.append(f'<blockquote>{text}</blockquote>')
        
        # Regular paragraph
        else:
            if in_list:
                html_parts.append('')
                in_list = False
            
            text = escape(stripped)
            if text.startswith('*출처:'):
                html_parts.append(f'<p><em>{text}</em></p>')
                continue
            
            # inline formatting
            text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
            text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
            text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
            text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
            
            if text:
                html_parts.append(f'<p>{text}</p>')
    
    # Close any open list
    if in_list:
        html_parts.append('')
    
    # Collect images
    img_html = ''
    if img_urls:
        img_html = '\n'.join([
            f'<figure class="kg-card kg-image-card"><img src="{escape(u)}" alt="" class="kg-image" /></figure>'
            for u in img_urls[:3]
        ])
    
    # Build full HTML
    body = '\n'.join(html_parts)
    full_html = f"""<blockquote>AI 시대 교육의 변화를 살펴보는 UBION Newsroom의 큐레이션입니다.</blockquote>
{img_html}
{body}
<hr />
<p><strong>원문 보기:</strong> <a href="{escape(original_url)}">{escape(original_url)}</a></p>
<p><em>본 콘텐츠는 AI가 수집·요약한 정보를 바탕으로 작성되었습니다.</em></p>"""
    
    return full_html


def escape(text):
    return h(text)


def publish_to_ghost(title, html_content, tags, status='draft'):
    """Ghost Admin API로 Draft 발행 (Node.js publish-ghost-fixed.js 활용)"""
    import subprocess, tempfile, os
    
    ghost_url = os.environ.get('GHOST_URL', 'https://newsroom.ubion.global')
    api_key = os.environ.get('GHOST_ADMIN_API_KEY', '')
    
    if not api_key:
        env_file = f"{NEWSROOM_DIR}/.env"
        if os.path.exists(env_file):
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('GHOST_ADMIN_API_KEY='):
                        api_key = line.split('=', 1)[1].strip()
                    elif line.startswith('GHOST_URL='):
                        ghost_url = line.split('=', 1)[1].strip()
    
    if not api_key:
        print(f"  ⚠️ Ghost API key 없음 — 발행 불가")
        return False
    
    # Node.js one-liner를 사용하여 Ghost API 호출
    tag_json = json.dumps(tags)
    html_escaped = html_content.replace("'", "'\\''").replace('"', '\\"')
    
    js_code = f'''
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const apiKey = {json.dumps(api_key)};
const ghostUrl = new URL({json.dumps(ghost_url)});
const [id, secret] = apiKey.split(':');

function generateJWT() {{
  const h = Buffer.from(JSON.stringify({{alg:'HS256',typ:'JWT',kid:id}})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({{iat:n,exp:n+300,aud:'/admin/'}})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
}}

const j = generateJWT();
const postBody = JSON.stringify({{
  posts: [{{
    title: {json.dumps(title)},
    html: {json.dumps(html_content)},
    status: {json.dumps(status)},
    visibility: 'public',
    tags: {tag_json}
  }}]
}});

const opts = {{
  hostname: ghostUrl.hostname,
  path: '/ghost/api/admin/posts/?source=html',
  method: 'POST',
  headers: {{
    'Authorization': 'Ghost '+j,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postBody)
  }}
}};

const req = https.request(opts, res => {{
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {{
    if (res.statusCode >= 200 && res.statusCode < 300) {{
      try {{
        const post = JSON.parse(d).posts[0];
        process.stdout.write(JSON.stringify({{ok:true, id:post.id, slug:post.slug}}));
      }} catch(e) {{
        process.stdout.write(JSON.stringify({{ok:true, raw:d.substring(0,200)}}));
      }}
    }} else {{
      process.stdout.write(JSON.stringify({{ok:false, code:res.statusCode, msg:d.substring(0,200)}}));
    }}
  }});
}});
req.on('error', e => process.stdout.write(JSON.stringify({{ok:false, msg:e.message}})));
req.write(postBody);
req.end();
'''
    
    try:
        result = subprocess.run(
            ['node', '-e', js_code],
            capture_output=True, text=True, timeout=30,
            cwd=NEWSROOM_DIR
        )
        out = result.stdout.strip()
        if out:
            data = json.loads(out)
            if data.get('ok'):
                post_id = data.get('id', '?')
                slug = data.get('slug', '?')
                print(f"  ✅ Ghost Draft 발행: {ghost_url}/ghost/#/editor/post/{post_id} (/{slug})")
                return True
            else:
                print(f"  ❌ Ghost API 오류 ({data.get('code','?')}): {data.get('msg','?')}")
                return False
        else:
            print(f"  ❌ Node.js 출력 없음 (stderr: {result.stderr[:200]})")
            return False
    except subprocess.TimeoutExpired:
        print(f"  ❌ Node.js 타임아웃")
        return False
    except Exception as e:
        print(f"  ❌ Node.js 예외: {e}")
        return False


# ─── Main ──────────────────────────────────────
async def main():
    # Args
    is_test = '--test' in sys.argv
    
    # 1. Source items 로드
    items = load_source_items()
    print(f"📋 소스 아이템 로드: {len(items)}개")
    
    # 2. 교육 관련성 점수 계산
    for item in items:
        item['rel_score'] = score_relevance(item['title'], item.get('description', ''))
    
    items.sort(key=lambda x: x['rel_score'], reverse=True)
    
    if is_test:
        items = items[:5]
    
    print(f"🎯 처리 대상: {len(items)}개 기사")
    
    # 3. Crawl4AI 로 본문 추출
    from crawl4ai import AsyncWebCrawler
    
    success_count = 0
    fail_count = 0
    async with AsyncWebCrawler() as crawler:
        for item in items:
            url = item['url']
            title = item['title']
            print(f"\n🕷️ [{item['source']}] {title[:50]}...")
            print(f"   URL: {url[:80]}")
            
            content, img_urls = await extract_article(url, crawler)
            
            if not content:
                print(f"   ⚠️ 본문 추출 실패 (내용 부족 또는 차단)")
                fail_count += 1
                continue
            
            # Save content
            save_content(item['id'], content, img_urls, title, item['source'])
            print(f"   ✅ 본문 {len(content)}자 추출")
            print(f"   🖼️ 이미지 {len(img_urls)}개 발견")
            
            # 4. Ghost HTML 변환
            html = md_to_ghost_html(content, title, img_urls, url)
            
            # 태그 결정
            region_tag = {
                'korea': '한국교육',
                'global': '글로벌교육',
                'china': '중국교육',
                'japan': '일본교육',
                'europe': '유럽교육',
                'usa': '미국교육',
            }.get(item['region'], '글로벌교육')
            
            tags = [
                {'name': 'AI 교육', 'slug': 'ai-edu'},
                {'name': region_tag, 'slug': item['region']},
            ]
            
            # 5. Ghost Draft 발행
            print(f"   📝 Ghost Draft 발행 중...")
            ok = publish_to_ghost(
                title=title,
                html_content=html,
                tags=tags,
                status='draft'
            )
            
            if ok:
                success_count += 1
            else:
                fail_count += 1
            
            # Rate limiting
            await asyncio.sleep(1)
    
    print(f"\n{'='*50}")
    print(f"📊 Crawl4AI Pipeline 결과")
    print(f"   ✅ 성공: {success_count}개")
    print(f"   ❌ 실패: {fail_count}개")
    print(f"   📁 컨텐츠 저장: {CONTENT_DIR}/")
    print(f"{'='*50}")


if __name__ == '__main__':
    asyncio.run(main())
