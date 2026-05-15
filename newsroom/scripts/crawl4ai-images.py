#!/usr/bin/env python3
"""
Crawl4AI Image Collector — Pipeline 이미지 수집 전용
====================================================
pipeline/01-sourced/ 의 기사 URL을 방문하여:
  - 실제 뉴스 사진/일러스트 추출
  - 로컬에 다운로드 후 Ghost에 업로드
  - source item에 image_url 메타데이터 추가

Usage:
  python3 scripts/crawl4ai-images.py              # 모든 소스 처리
  python3 scripts/crawl4ai-images.py --test       # 3개만 처리

Output:
  pipeline/images/{source_id}/  ← 다운로드된 이미지
  01-sourced/{item}.json       ← image_url 필드가 추가됨
"""

import asyncio, json, os, re, sys, urllib.request, subprocess
from datetime import datetime
from urllib.parse import urlparse

NEWSROOM_DIR = "/root/.openclaw/workspace/newsroom"
SOURCED_DIR = f"{NEWSROOM_DIR}/pipeline/01-sourced"
IMAGES_DIR = f"{NEWSROOM_DIR}/pipeline/images"
CONTENT_DIR = f"{NEWSROOM_DIR}/pipeline/crawl4ai-content"

os.makedirs(IMAGES_DIR, exist_ok=True)

# 수집 제외 패턴 (로고, 아이콘, UI 요소)
EXCLUDE_IMG_PATTERNS = [
    'logo', 'icon', 'button', 'banner', 'facebook', 'twitter', 'share',
    'weibo', 'weixin', 'linkedin', 'timg', 'sign_ico', 'sub_ico',
    'more_art', 'showmobile', 'favicon', 'sprite', 'btn', 'arrow',
    'bg_', 'footer', 'header_', 'nav_', 'top_', 'img_e/', 'svg',
    'pixel', 'track', 'analytics', 'spacer', 'blank', 'placeholder',
    '1x1', 'transparent',
]


def load_source_items():
    """01-sourced/ 에서 처리할 item list 로드"""
    items = []
    for fname in sorted(os.listdir(SOURCED_DIR)):
        if not fname.endswith('.json'):
            continue
        with open(os.path.join(SOURCED_DIR, fname)) as f:
            item = json.load(f)
        source = item.get('source', {})
        url = source.get('url', '')
        title = source.get('title', '')
        if not url:
            continue
        items.append({
            'id': item.get('id', fname.replace('.json', '')),
            'title': title,
            'url': url,
            'source': source.get('source', ''),
            'fpath': os.path.join(SOURCED_DIR, fname),
            'item': item,
        })
    return items


async def extract_images(url, crawler):
    """Crawl4AI 로 기사 페이지 방문 → 이미지 URL 추출"""
    from crawl4ai import CrawlerRunConfig, CacheMode
    from crawl4ai.content_filter_strategy import PruningContentFilter
    from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

    config = CrawlerRunConfig(
        markdown_generator=DefaultMarkdownGenerator(
            content_filter=PruningContentFilter(threshold=0.4, threshold_type="fixed")
        ),
        word_count_threshold=5,
        cache_mode=CacheMode.ENABLED,
        excluded_tags=["nav", "footer", "header", "aside", "script", "style",
                       "noscript", "form", "button", "svg", "dialog", "iframe"],
    )
    result = await crawler.arun(url=url, config=config)
    if not result or not result.success:
        return []

    md = result.markdown
    if not md:
        return []

    # 모든 이미지 URL 추출 (마크다운)
    all_imgs = list(set(re.findall(r'!\[.*?\]\((https?://[^\s)]+)\)', md)))

    # HTML raw 에서도 추출 (마크다운에 없을 수 있음)
    html = getattr(result, 'html', '') or ''
    html_imgs = re.findall(r'<img[^>]+src=[\'"](https?://[^\'"]+)[\'"]', html)
    all_imgs.extend(html_imgs)

    # Og:image 추출
    og_img = re.search(r'<meta\s+property=[\'"]og:image[\'"]\s+content=[\'"](https?://[^\'"]+)[\'"]', html)
    if og_img:
        all_imgs.append(og_img.group(1))

    # 중복 제거
    all_imgs = list(set(all_imgs))

    # 제외 패턴 필터링
    filtered = []
    for u in all_imgs:
        u_lower = u.lower()
        if any(p in u_lower for p in EXCLUDE_IMG_PATTERNS):
            continue
        # 파일 확장자 체크
        parsed = urlparse(u)
        ext = os.path.splitext(parsed.path)[1].lower()
        if ext and ext not in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
            continue
        filtered.append(u)

    # 컨텐츠 이미지 우선 정렬
    content_imgs = [u for u in filtered if '/images/' in u.lower() or '/photo/' in u.lower() or '/article/' in u.lower()]
    other_imgs = [u for u in filtered if u not in content_imgs]

    # 상위 3개 이미지 + og:image (feature image 후보)
    candidates = (content_imgs + other_imgs)[:4]

    # og:image가 있으면 1순위
    if og_img and og_img.group(1) not in candidates:
        candidates.insert(0, og_img.group(1))

    return candidates[:3]


def download_image(img_url, source_id, index):
    """이미지 다운로드 및 Ghost 업로드 → URL 반환"""
    img_dir = os.path.join(IMAGES_DIR, source_id)
    os.makedirs(img_dir, exist_ok=True)

    ext = os.path.splitext(urlparse(img_url).path)[1] or '.jpg'
    local_path = os.path.join(img_dir, f"img-{index}{ext}")

    try:
        req = urllib.request.Request(img_url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; UBION Newsroom/1.0)',
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            if len(data) < 1024:  # 1KB 미만 = 아이콘/스팸
                return None
            with open(local_path, 'wb') as f:
                f.write(data)

        # Ghost 에 업로드
        ghost_url = upload_to_ghost(local_path)
        return ghost_url
    except Exception as e:
        print(f"     ⚠️ 이미지 다운로드 실패 ({img_url[:50]}...): {e}")
        return None


def upload_to_ghost(local_path):
    """Node.js 스크립트로 Ghost API에 이미지 업로드"""
    js_code = f'''
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

const envText = fs.readFileSync('/root/.openclaw/workspace/newsroom/.env', 'utf8');
const apiKey = envText.match(/GHOST_ADMIN_API_KEY=(.+)/)[1].trim();
const ghostUrl = new URL(envText.match(/GHOST_URL=(.+)/)[1].trim());
const [id, secret] = apiKey.split(':');

function makeJWT() {{
  const h = Buffer.from(JSON.stringify({{alg:'HS256',typ:'JWT',kid:id}})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({{iat:n,exp:n+300,aud:'/admin/'}})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
}}

// Upload image via Ghost Admin API
const imagePath = {json.dumps(local_path)};
const imageData = fs.readFileSync(imagePath);
const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
const body = Buffer.concat([
  Buffer.from('--' + boundary + '\\r\\n' +
    'Content-Disposition: form-data; name="file"; filename="' + path.basename(imagePath) + '"\\r\\n' +
    'Content-Type: image/jpeg\\r\\n\\r\\n'),
  imageData,
  Buffer.from('\\r\\n--' + boundary + '--\\r\\n')
]);

const j = makeJWT();
const opts = {{
  hostname: ghostUrl.hostname,
  path: '/ghost/api/admin/images/upload/',
  method: 'POST',
  headers: {{
    'Authorization': 'Ghost ' + j,
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': body.length
  }}
}};

const req = https.request(opts, res => {{
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {{
    try {{
      const r = JSON.parse(d);
      const url = r && r.images && r.images[0] && r.images[0].url;
      if (url) process.stdout.write(JSON.stringify({{ok:true, url:url}}));
      else process.stdout.write(JSON.stringify({{ok:false, msg:'No URL in response', raw:d.substring(0,200)}}));
    }} catch(e) {{
      process.stdout.write(JSON.stringify({{ok:false, msg:'Parse error: ' + e.message, raw:d.substring(0,200)}}));
    }}
  }});
}});
req.on('error', e => process.stdout.write(JSON.stringify({{ok:false, msg:e.message}})));
req.write(body);
req.end();
'''
    try:
        result = subprocess.run(
            ['node', '-e', js_code],
            capture_output=True, text=True, timeout=30,
        )
        out = result.stdout.strip()
        if out:
            data = json.loads(out)
            if data.get('ok'):
                return data['url']
            else:
                print(f"     ⚠️ Ghost 업로드 실패: {data.get('msg')}")
                return None
        return None
    except Exception as e:
        print(f"     ⚠️ Ghost 업로드 예외: {e}")
        return None


def save_item_with_image(item_data, image_url):
    """source item에 image_url 추가"""
    item = item_data['item']
    source = item.get('source', {})
    source['image_url'] = image_url
    item['source'] = source
    with open(item_data['fpath'], 'w') as f:
        json.dump(item, f, indent=2, ensure_ascii=False)
    print(f"     📝 image_url 저장됨")


async def main():
    is_test = '--test' in sys.argv

    items = load_source_items()
    print(f"📋 소스 아이템 로드: {len(items)}개")

    if is_test:
        items = items[:3]

    from crawl4ai import AsyncWebCrawler

    success = 0
    no_img = 0
    async with AsyncWebCrawler() as crawler:
        for item in items:
            url = item['url']
            title = item['title'][:50]
            sid = item['id']

            print(f"\n🖼️ [{item['source']}] {title}...")

            # 이미지 추출
            img_urls = await extract_images(url, crawler)
            if not img_urls:
                print(f"     ⚠️ 이미지 없음")
                no_img += 1
                continue

            print(f"     📸 {len(img_urls)}개 발견: {[u.split('/')[-1][:30] for u in img_urls]}")

            # 첫 번째 이미지 → 다운로드 + Ghost 업로드
            uploaded = download_image(img_urls[0], sid.replace(':', '_'), 0)
            if uploaded:
                print(f"     ✅ Ghost 업로드 완료: {uploaded[:60]}...")
                save_item_with_image(item, uploaded)
                success += 1
            else:
                print(f"     ⚠️ 업로드 실패")
                no_img += 1

            await asyncio.sleep(0.5)

    print(f"\n{'='*50}")
    print(f"📊 이미지 수집 결과")
    print(f"   ✅ 이미지 저장: {success}개")
    print(f"   ❌ 이미지 없음: {no_img}개")
    print(f"   📁 로컬 저장: {IMAGES_DIR}/")

    # 이미지 룩업 파일 저장 (publish 단계에서 참조)
    lookup = {}
    for fname in os.listdir(SOURCED_DIR):
        if not fname.endswith('.json'): continue
        with open(os.path.join(SOURCED_DIR, fname)) as f:
            item = json.load(f)
        source = item.get('source', {})
        url = source.get('url', '')
        img_url = source.get('image_url', '')
        if url and img_url:
            lookup[url] = img_url
    lookup_path = f"{NEWSROOM_DIR}/pipeline/crawl4ai-image-lookup.json"
    with open(lookup_path, 'w') as f:
        json.dump(lookup, f, indent=2)
    print(f"   📋 룩업 파일 저장: {len(lookup)}개 항목 → {os.path.basename(lookup_path)}")
    print(f"{'='*50}")


if __name__ == '__main__':
    asyncio.run(main())
