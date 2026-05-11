#!/usr/bin/env python3
"""
AI 테크 브리핑 (AI Tech Brief) v2.0
=====================================
RSS + Brave Search/News API에서 어제/오늘의 AI 기술 핫이슈를 수집하여 기사화합니다.
각 이슈마다 출처 URL을 하이퍼링크로 포함합니다.
하루 2회: 오전(09:00) / 오후(18:00)
Run: python3 scripts/ai-tech-brief.py [--publish] [--time-slot morning|afternoon]
"""
import json, subprocess, base64, hmac, hashlib, time, re, sys, os, argparse, html as html_mod
from datetime import datetime, timedelta, timezone
from xml.etree import ElementTree
from urllib.parse import quote_plus

# ─── Config ───────────────────────────────────────
GHOST_URL = 'https://newsroom.ubion.global'
ENV_PATH = '/root/.openclaw/workspace/newsroom/.env'
DEEPSEEK_BASE_URL = os.environ.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1')
TAG_NAME = 'AI테크브리핑'
TAG_SLUG = 'ai-tech-brief'
USED_SOURCES_DIR = '/tmp/ai-brief-used-sources'
USED_SOURCES_DB = '/tmp/ai-brief-used-sources/db.json'

# Expanded Brave Search queries (English + Korean)
SEARCH_QUERIES = [
    'AI breakthrough model release announcement',
    'machine learning research paper launch',
    '"open source" AI model release',
    '"artificial intelligence" latest news technology',
    '인공지능 AI 최신 뉴스 기술',
    'AI agent startup funding investment',
    'artificial intelligence regulation policy law',
    'machine learning benchmark leaderboard',
    'generative AI enterprise deployment',
    'AI chip hardware semiconductor news',
]

NEWS_QUERIES = ['AI', 'artificial intelligence', 'LLM', 'deep learning', 'AI regulation']

# Expanded RSS Feeds (14 → 22)
RSS_FEEDS = [
    # Major AI labs
    'https://openai.com/blog/news.xml',
    'https://blog.google/technology/ai/rss/',
    'https://ai.meta.com/blog/feed/',
    'https://www.anthropic.com/feed.xml',
    'https://deepmind.google/blog/rss.xml',
    'https://nvidia.com/en-us/about-nvidia/ai-at-nvidia/rss.xml',
    # Platform & community
    'https://huggingface.co/blog/feed.xml',
    'https://news.ycombinator.com/rss',
    'https://simonwillison.net/atom.xml',
    'https://www.reddit.com/r/artificial/.rss',
    # Tech news
    'https://techcrunch.com/category/artificial-intelligence/feed/',
    'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml',
    'https://venturebeat.com/category/ai/feed/',
    'https://www.technologyreview.com/topic/artificial-intelligence/feed/',
    'https://www.artificialintelligence-news.com/feed/',
    'https://arstechnica.com/ai/feed/',
    'https://www.wired.com/feed/tag/ai/latest/rss.xml',
    'https://news.mit.edu/topic/artificial-intelligence/rss.xml',
    'https://www.zdnet.com/topic/artificial-intelligence/rss.xml',
    # Research
    'https://arxiv.org/rss/cs.AI',
    'https://arxiv.org/rss/cs.CL',
    'https://www.microsoft.com/en-us/research/blog/feed/',
]

BRAVE_API_KEY = None
DEEPSEEK_API_KEY = None

# ─── Utilities ─────────────────────────────────────
def load_env():
    global BRAVE_API_KEY, DEEPSEEK_API_KEY
    with open(ENV_PATH) as f:
        env = f.read()
    m = re.search(r'BRAVE_API_KEY=(.+)', env)
    BRAVE_API_KEY = m.group(1).strip() if m else None
    m = re.search(r'DEEPSEEK_API_KEY=(.+)', env)
    DEEPSEEK_API_KEY = m.group(1).strip() if m else None

def parse_rss_date(date_str):
    """Parse various RSS/Atom date formats to datetime. Returns None if unparseable."""
    if not date_str:
        return None
    # Common RSS formats
    for fmt in [
        '%a, %d %b %Y %H:%M:%S %z',     # RFC 2822: Thu, 25 Dec 2024 12:00:00 +0000
        '%a, %d %b %Y %H:%M:%S %Z',      # RFC 2822 with timezone name
        '%Y-%m-%dT%H:%M:%S%z',            # ISO 8601: 2024-12-25T12:00:00+00:00
        '%Y-%m-%dT%H:%M:%SZ',             # ISO 8601 UTC: 2024-12-25T12:00:00Z
        '%Y-%m-%dT%H:%M:%S.%f%z',         # ISO 8601 with microseconds
        '%Y-%m-%dT%H:%M:%S.%fZ',          # ISO 8601 with microseconds UTC
        '%Y-%m-%d',                        # Date only
    ]:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    return None

def parse_atom_date(date_str):
    """Parse Atom-style date strings."""
    if not date_str:
        return None
    for fmt in [
        '%Y-%m-%dT%H:%M:%S%z',
        '%Y-%m-%dT%H:%M:%SZ',
        '%Y-%m-%dT%H:%M:%S.%f%z',
        '%Y-%m-%dT%H:%M:%S.%fZ',
        '%Y-%m-%d',
    ]:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    return None

def is_recent(pub_date, today):
    """Check if pub_date is yesterday or today."""
    if pub_date is None:
        return True  # can't verify, pass through
    yesterday = today - timedelta(days=1)
    # Compare dates only (ignore time)
    pub_date_only = pub_date.date()
    return pub_date_only >= yesterday.date()

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

def ghost_api(method, path, body=None):
    token = get_ghost_token()
    r = subprocess.run(['curl', '-s', '-X', method,
        f'{GHOST_URL}/ghost/api/admin/{path}',
        '-H', f'Authorization: Ghost {token}',
        '-H', 'Content-Type: application/json; charset=utf-8',
        *(('-d', json.dumps(body)) if body else [])], capture_output=True, text=True, timeout=30)
    try: return json.loads(r.stdout)
    except: return {}

def ensure_tag(token):
    r = subprocess.run(['curl', '-s', '-X', 'GET', f'{GHOST_URL}/ghost/api/admin/tags/?limit=200',
        '-H', f'Authorization: Ghost {token}'], capture_output=True, text=True, timeout=15)
    try:
        data = json.loads(r.stdout)
    except:
        data = {"tags": []}
        print(f'  ⚠️ Ghost API 오류 (태그 확인 불가), 태그명: #{TAG_NAME} 사용')
    exists = any(t.get('slug') == TAG_SLUG for t in data.get('tags',[]))
    if not exists:
        subprocess.run(['curl', '-s', '-X', 'POST', f'{GHOST_URL}/ghost/api/admin/tags/',
            '-H', f'Authorization: Ghost {token}', '-H', 'Content-Type: application/json',
            '-d', json.dumps({'tags': [{'name': TAG_NAME, 'slug': TAG_SLUG, 'description': 'AI 기술 데일리 브리핑'}]})],
            capture_output=True, text=True, timeout=15)
        print(f'  ✅ 태그 생성: #{TAG_NAME}')
    return TAG_SLUG
# ─── Source Collection ─────────────────────────────
def brave_search(query, count=10):
    if not BRAVE_API_KEY: return None
    r = subprocess.run(['curl', '-s', f'https://api.search.brave.com/res/v1/web/search?q={quote_plus(query)}&count={count}&freshness=pd',
        '-H', f'X-Subscription-Token: {BRAVE_API_KEY}', '-H', 'Accept: application/json'],
        capture_output=True, text=True, timeout=15)
    try:
        data = json.loads(r.stdout)
        if data.get('type') == 'ErrorResponse':
            err_detail = str(data.get('error', {}).get('detail', ''))
            if 'RATE_LIMIT' in err_detail.upper() or '429' in err_detail or 'rate limit' in err_detail.lower():
                print(f'     ⚠️  rate limit')
                return []
            return None
        return [{'title': i.get('title',''), 'url': i.get('url',''), 'description': i.get('description',''),
                 'source': 'brave', 'query_type': query[:50], 'date': ''}
                for i in data.get('web', {}).get('results', [])]
    except: return []

def brave_news_search(query, count=8):
    if not BRAVE_API_KEY: return []
    r = subprocess.run(['curl', '-s',
        f'https://api.search.brave.com/res/v1/news/search?q={quote_plus(query)}&count={count}&freshness=pd',
        '-H', f'X-Subscription-Token: {BRAVE_API_KEY}', '-H', 'Accept: application/json'],
        capture_output=True, text=True, timeout=15)
    try:
        data = json.loads(r.stdout)
        results = []
        for i in data.get('results', []):
            pub_date_str = i.get('age', '') or i.get('published_date', '') or ''
            results.append({'title': i.get('title',''), 'url': i.get('url',''),
                            'description': i.get('description',''), 'source': 'brave-news',
                            'query_type': query[:50], 'date': pub_date_str})
        return results
    except: return []

def fetch_rss(url, max_items=5):
    """Fetch RSS feed and return items with parsed dates. Filters to yesterday/today."""
    try:
        r = subprocess.run(['curl', '-s', '-L', url, '-m', '15'], capture_output=True, text=True, timeout=20)
        root = ElementTree.fromstring(r.stdout)
        items = []
        today = datetime.now(timezone.utc)
        recent_count = 0
        max_check = 20  # check up to 20 items to find 5 recent ones
        
        for entry in (root.findall('.//item') or root.findall('.//entry')):
            if recent_count >= max_items:
                break
                
            title = entry.findtext('title', '') or ''
            link_el = entry.find('link')
            link = ''
            if link_el is not None:
                link = link_el.attrib.get('href', '') if link_el.attrib.get('href') else (link_el.text or '')
            desc = re.sub(r'<[^>]+>', '', entry.findtext('description', '') or entry.findtext('summary', '') or '').strip()[:300]
            
            # Extract date
            pub_date_str = None
            for tag in ['pubDate', 'published', 'updated', 'dc:date']:
                el = entry.find(tag)
                if el is not None and el.text:
                    pub_date_str = el.text.strip()
                    break
            
            pub_date = parse_rss_date(pub_date_str) if pub_date_str else None
            
            # Log date info
            date_label = pub_date.strftime('%m-%d') if pub_date else '날짜-'
            
            # Filter: only yesterday or today
            if not is_recent(pub_date, today):
                continue  # skip old items silently
            
            recent_count += 1
            items.append({'title': title, 'url': str(link), 'description': desc,
                          'source': 'rss', 'query_type': url, 'date': date_label})
            
        return items
    except Exception as e:
        return []

def collect_sources():
    print(f"  🔍 웹 검색 수집 중...")
    all_items = []
    brave_ok = True
    for q in SEARCH_QUERIES:
        if not brave_ok: break
        results = brave_search(q)
        if results is None:
            brave_ok = False
            print(f"     ⏭️  Brave API 오류")
            break
        all_items.extend(results)
        print(f"     {q[:45]:45s} → {len(results)}개")
        time.sleep(1.2)
    # Brave News
    if brave_ok:
        for q in NEWS_QUERIES:
            results = brave_news_search(q)
            all_items.extend(results)
            print(f"     [뉴스] {q:25s} → {len(results)}개")
            time.sleep(1.2)
    # RSS
    print(f"  📡 RSS 수집 중... (어제/오늘만)")
    for url in RSS_FEEDS:
        items = fetch_rss(url)
        all_items.extend(items)
        if items:
            date_range = f"{items[0]['date']}~{items[-1]['date']}"
        else:
            date_range = "최근항목없음"
        print(f"     {url.split('/')[2]:30s} → {len(items)}개 ({date_range})")
    
    print(f"\n  📥 총 수집: {len(all_items)}개")
    return all_items

def dedup_and_rank(items):
    seen_urls = set()
    unique = []
    for item in items:
        url = item.get('url', '').strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        unique.append(item)
    final = []
    for item in unique:
        title = item['title'].lower().strip()
        is_dup = False
        for existing in final:
            words = set(title.split())
            ex_words = set(existing['title'].lower().split())
            if len(words) > 3 and len(words & ex_words) / max(len(words), len(ex_words)) > 0.6:
                is_dup = True
                break
        if not is_dup: final.append(item)
    return final[:40]  # collect more to allow better TOP 10 selection

# ─── LLM Article Writer ────────────────────────────
def call_llm(prompt, system=None):
    if not DEEPSEEK_API_KEY: load_env()
    payload = {"model": "deepseek-chat", "messages": [
        {"role": "system", "content": system or "You are an AI tech news curator."},
        {"role": "user", "content": prompt}
    ], "temperature": 0.6, "max_tokens": 5000}
    r = subprocess.run(['curl', '-s', '-X', 'POST', f'{DEEPSEEK_BASE_URL}/chat/completions',
        '-H', f'Authorization: Bearer {DEEPSEEK_API_KEY}', '-H', 'Content-Type: application/json',
        '-d', json.dumps(payload)], capture_output=True, text=True, timeout=120)
    try: return json.loads(r.stdout)['choices'][0]['message']['content']
    except: print(f"  ❌ LLM 실패: {r.stdout[:300]}"); return None

BRIEF_SYSTEM = """당신은 AI 기술 뉴스레터 편집자입니다.
매일 오전/오후 각각 발행되는 속보성 브리핑입니다.
Brave 검색, AI 블로그 RSS에서 수집된 오늘의 주요 AI 기술 토픽들을 정리하여
하나의 읽기 쉬운 기사로 만듭니다.

형식:
1. 오프닝: "오늘의 AI 업계 키워드: ..." (한 줄 요약)
2. TOP 10 핫이슈: 각 이슈별로
   - 헤드라인 (굵은 글씨 없이 자연스럽게)
   - 2~3문장 요약 (무슨 일인지, 왜 중요한지)
3. 📊 트렌드 요약: 전체적인 흐름 분석 (1문단)

중요 규칙:
- --- 로 구분선 사용 (자동 hr 변환)
- 객관적 사실 전달
- 딱딱하지 않은 뉴스레터 톤
- ~입니다체
- 3000~4000자
- 첫 문단은 리드 역할
- **각 이슈마다 반드시 출처 URL을 하이퍼링크로 포함할 것**
  - 예시: [원문: CNN Business](https://edition.cnn.com/...)
  - 소스 URL이 정확해야 함. 추측하지 말고 제공된 URL 그대로 사용
"""

def generate_brief(items, target_date, excluded_topics=None):
    # Build source list with explicit URLs for the LLM
    sources_lines = []
    for i, item in enumerate(items[:20]):
        date_marker = ""
        if item.get('date'):
            date_marker = f" [날짜:{item['date']}]"
        src_type = item.get('source', 'web')
        sources_lines.append(
            f"[{i+1}] {item['title']}{date_marker}\n"
            f"   🔗 URL: {item['url']}\n"
            f"   출처: {src_type} | {item['query_type'][:60]}\n"
            f"   내용: {item['description'][:200]}"
        )
    sources = "\n\n".join(sources_lines)
    
    # Build excluded topics section
    exclude_section = ""
    if excluded_topics:
        exclude_list = "\n".join(f"- {t}" for t in excluded_topics)
        exclude_section = f"""
[주의: 이미 오늘 발행된 기사 주제]
아래 주제들은 오늘 이미 다른 기사로 발행되었습니다.
AI 테크 브리핑에서 이 주제들을 다루지 말고, 다른 새로운 소스 중심으로 작성하세요.
(단, 시사점이나 종합 분석에서 간략히 언급하는 것은 허용)

{exclude_list}
"""
    
    prompt = f"""오늘({target_date}) AI 기술 토픽입니다.

=== 수집된 소스 (어제/오늘 발행된 것만) ===
{sources}
{exclude_section}
---
위 소스들을 분석하여 오늘의 핫이슈 TOP 10 기사를 작성해주세요.

[중요 요구사항]
1. TOP 10 이슈 (10개 모두 반드시 포함)
2. 각 이슈마다 출처 URL을 [원문: 출처명](URL) 형식의 하이퍼링크로 포함
3. 소스 URL은 실제 링크여야 함 (추측 금지)
4. 3000~4000자
5. 첫 문단은 리드 역할
6. 각 이슈는 2~3문장 요약"""
    
    return call_llm(prompt, BRIEF_SYSTEM)

def article_to_html(text):
    # Convert markdown links: [text](url) -> <a href="url">text</a>
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    # Convert **bold** to <strong>
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    html_parts = []
    first_real = True
    for p in text.strip().split('\n\n'):
        p = p.strip()
        if not p: continue
        ## h3 line → <p><strong> (Ghost에서 h3 스타일 깨질 수 있으므로 bold 단락으로)
        if p.startswith('### '):
            content = re.sub(r'^###\s+', '', p)
            html_parts.append(f'<p><strong>{content}</strong></p>')
        ## h2 line with number prefix (e.g., "## 1. Anthropic") → <p><strong>
        elif re.match(r'##\s+\d+[\.\)]', p):
            content = re.sub(r'^##\s+', '', p)
            html_parts.append(f'<p><strong>{content}</strong></p>')
        ## h2 line that is a known section header → <h2>
        elif p.startswith('## ') and any(kw in p for kw in ['키워드', '트렌드', 'TOP', '📊', '🔥']):
            html_parts.append(f'<h2>{p.lstrip("# ")}</h2>')
        ## h2 line that looks like content (not section header) → <p><strong>
        elif p.startswith('## '):
            content = re.sub(r'^##\s+', '', p)
            html_parts.append(f'<p><strong>{content}</strong></p>')
        elif p.startswith('# '):
            html_parts.append(f'<h2>{p.lstrip("# ")}</h2>' if len(p.lstrip("# ")) < 30 else f'<p><strong>{p.lstrip("# ")}</strong></p>')
        elif p in ('---', '—'):
            html_parts.append('<hr />')
        elif first_real:
            html_parts.append(f'<blockquote>{p}</blockquote>')
            first_real = False
        else:
            html_parts.append(f'<p>{p}</p>')
    html = '\n'.join(html_parts)
    html = re.sub(r'<p>---</p>', '<hr />', html)
    html = re.sub(r'<p>—</p>', '<hr />', html)
    return html

# ─── Image Generation ──────────────────────────────
def generate_image_prompt(article_text, items, time_label):
    """Use DeepSeek to generate a content-aware image prompt based on today's actual top news."""
    # Get top 3 headlines for context
    top_headlines = '\n'.join([f"- {item['title']}" for item in items[:5] if item.get('title')])
    
    system = "You are an AI image prompt engineer for a tech news briefing. Given today's AI tech news headlines, create ONE detailed English image prompt for a cover image. The prompt should describe a visually striking scene that represents today's main AI news story. MUST include specific visual elements related to the actual technology/company/concept in the news (e.g., glowing neural networks, futuristic data centers, robot hands, digital brains, circuit board patterns, holographic interfaces). Keep the tone professional and tech-focused, NOT fantasy or nature. Use concrete visual elements. Output ONLY the prompt text, nothing else."
    
    mood = "bright, energetic, optimistic" if time_label == '오전' else "dramatic, deep, sophisticated"
    
    user = f"""Today's top AI news:
{top_headlines}

Create a detailed image prompt (50-80 words) for a feature image that visually represents today's biggest AI news story. Style: professional tech concept art / digital art, {mood} mood. IMPORTANT: The image must clearly look like it's about AI/technology - include tech elements like neural networks, data centers, robots, holograms, servers, or futuristic interfaces. Represent the specific news story visually. No text, no letters, no typography in the image. NOT abstract patterns, NOT nature, NOT fantasy."""

    if not DEEPSEEK_API_KEY:
        load_env()
    payload = {"model": "deepseek-chat", "messages": [
        {"role": "system", "content": system},
        {"role": "user", "content": user}
    ], "temperature": 0.8, "max_tokens": 200}
    r = subprocess.run(['curl', '-s', '-X', 'POST', f'{DEEPSEEK_BASE_URL}/chat/completions',
        '-H', f'Authorization: Bearer {DEEPSEEK_API_KEY}', '-H', 'Content-Type: application/json',
        '-d', json.dumps(payload)], capture_output=True, text=True, timeout=30)
    try:
        prompt = json.loads(r.stdout)['choices'][0]['message']['content'].strip()
        # Remove quotes if present
        prompt = prompt.strip('"\'').strip()
        print(f"     AI 생성 프롬프트: {prompt[:100]}...")
        return prompt
    except:
        print(f"     ⚠️ 프롬프트 생성 실패, 기본 프롬프트 사용")
        return None

def generate_feature_image(items, target_date, time_label, article_text=""):
    """Generate a content-aware feature image based on today's actual news."""
    print(f"  🖼️ 이미지 생성 중...")
    
    # Generate prompt from actual news content
    llm_prompt = generate_image_prompt(article_text, items, time_label)
    
    if not llm_prompt:
        # Fallback: simple contextual prompt
        headlines = ' '.join([item.get('title', '') for item in items[:3]])
        theme = 'AI technology'
        if 'model' in headlines.lower() or 'opus' in headlines.lower():
            theme = 'AI brain neural network'
        elif 'military' in headlines.lower() or 'defense' in headlines.lower():
            theme = 'futuristic military technology'
        elif 'open source' in headlines.lower() or 'open-source' in headlines.lower():
            theme = 'open source code community'
        elif 'regulation' in headlines.lower() or 'policy' in headlines.lower():
            theme = 'government AI regulation'
        elif 'robot' in headlines.lower() or 'humanoid' in headlines.lower():
            theme = 'humanoid robot AI'
        mood = 'bright minimal' if time_label == '오전' else 'dark dramatic'
        llm_prompt = f"Digital art concept, {theme} theme, {mood}, professional magazine cover quality, no text"
        print(f"     기본 프롬프트: {llm_prompt}")
    
    safe_prompt = quote_plus(llm_prompt)
    img_url = f"https://image.pollinations.ai/prompt/{safe_prompt}?width=1400&height=800&nofeed=true"
    
    # Download image
    local_path = f"/tmp/ai-brief-{target_date}-{time_label}.jpg"
    subprocess.run(['curl', '-sL', '-o', local_path, '-m', '30',
        '-H', 'User-Agent: Mozilla/5.0', img_url],
        capture_output=True, text=True, timeout=45)
    
    if not os.path.exists(local_path) or os.path.getsize(local_path) < 1000:
        print(f"     ⚠️ 이미지 생성 실패, 진행")
        return None
    
    file_size = os.path.getsize(local_path)
    print(f"     다운로드 완료: {file_size/1024:.0f}KB")
    
    # Upload to Ghost
    token = get_ghost_token()
    up = subprocess.run(['curl', '-s', '-X', 'POST',
        f'{GHOST_URL}/ghost/api/admin/images/upload/',
        '-H', f'Authorization: Ghost {token}',
        '-F', f'file=@{local_path};type=image/jpeg'],
        capture_output=True, text=True, timeout=30)
    try:
        img_data = json.loads(up.stdout)
        ghost_url = img_data.get('images', [{}])[0].get('url', '')
        if ghost_url:
            print(f"     ✅ 업로드 완료: {ghost_url.split('/')[-1][:50]}")
            return ghost_url
        else:
            print(f"     ⚠️ 업로드 실패: {up.stdout[:150]}")
            return None
    except:
        print(f"     ⚠️ 업로드 파싱 실패")
        return None

# ─── Used Sources Tracker (Enhanced) ──────────────
def get_title_trigrams(title):
    """Extract character trigrams from title for similarity matching."""
    title = title.lower().strip()
    trigrams = set()
    for i in range(len(title) - 2):
        trigrams.add(title[i:i+3])
    return trigrams

def title_similarity(title1, title2):
    """Compute trigram-based similarity between two titles (0.0 ~ 1.0)."""
    t1 = get_title_trigrams(title1)
    t2 = get_title_trigrams(title2)
    if not t1 or not t2:
        return 0.0
    overlap = len(t1 & t2)
    union = len(t1 | t2)
    return overlap / max(union, 1)

def load_used_sources_db(days=7):
    """Load the rolling database of all used sources from last N days."""
    if not os.path.exists(USED_SOURCES_DB):
        return []
    try:
        with open(USED_SOURCES_DB) as f:
            data = json.load(f)
        # Keep only recent entries (by date string comparison)
        cutoff_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        recent = [s for s in data if s.get('date', '') >= cutoff_date]
        return recent
    except:
        return []

def save_to_used_sources_db(target_date, time_slot, url, title):
    """Add a used source to the rolling database."""
    os.makedirs(USED_SOURCES_DIR, exist_ok=True)
    db = []
    if os.path.exists(USED_SOURCES_DB):
        try:
            with open(USED_SOURCES_DB) as f:
                db = json.load(f)
        except:
            db = []
    # Remove exact duplicate by URL
    db = [s for s in db if s.get('url') != url]
    # Add entry with trigrams for future similarity matching
    trigrams = list(get_title_trigrams(title or ''))
    db.append({
        'date': target_date,
        'slot': time_slot,
        'url': url,
        'title': (title or '')[:120],
        'trigrams': trigrams[:50],  # store top 50 trigrams
        'saved_at': datetime.now().isoformat()
    })
    # Keep only last 7 days
    cutoff_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    db = [s for s in db if s.get('date', '') >= cutoff_date]
    with open(USED_SOURCES_DB, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False)

def is_duplicate_source(url, title, existing_db, title_threshold=0.4):
    """
    Check if a source is a duplicate: same URL OR similar title (trigram-based).
    Returns (is_dup: bool, matched_entry: dict or None)
    """
    # 1. Exact URL check
    for s in existing_db:
        if s.get('url') == url:
            return True, s
    
    # 2. Title trigram similarity check
    new_trigrams = get_title_trigrams(title or '')
    if not new_trigrams or len(new_trigrams) < 4:
        return False, None
    
    for s in existing_db:
        stored_trigrams = set(s.get('trigrams', []))
        if not stored_trigrams or len(stored_trigrams) < 4:
            continue
        overlap = len(new_trigrams & stored_trigrams)
        union = len(new_trigrams | stored_trigrams)
        similarity = overlap / max(union, 1)
        if similarity >= title_threshold:
            return True, s
    
    return False, None

def filter_duplicate_sources(items, existing_db, title_threshold=0.4):
    """Filter out items that are duplicates (same story via URL or title)."""
    kept = []
    removed = 0
    removed_reasons = {'url': 0, 'title': 0}
    
    for item in items:
        url = item.get('url', '')
        title = item.get('title', '')
        is_dup, match = is_duplicate_source(url, title, existing_db, title_threshold)
        if is_dup:
            removed += 1
            if match and match.get('url') == url:
                removed_reasons['url'] += 1
            else:
                removed_reasons['title'] += 1
        else:
            kept.append(item)
    
    if removed > 0:
        print(f"     ⏭️  중복 제외: URL기준 {removed_reasons['url']}개 + 제목유사도 {removed_reasons['title']}개 = 총 {removed}개")
    
    return kept

def get_todays_published_topics(target_date, exclude_tag=None):
    """Fetch today's published post titles to avoid topic overlap."""
    token = get_ghost_token()
    # Use >= filter to get all posts published today or later
    filter_str = f'published_at:%3E%3D{target_date}'
    r = subprocess.run(['curl', '-s', f'{GHOST_URL}/ghost/api/admin/posts/?filter={filter_str}&limit=20',
        '-H', 'Authorization: Ghost ' + token], capture_output=True, text=True, timeout=15)
    try:
        data = json.loads(r.stdout)
        titles = []
        for p in data.get('posts', []):
            tags = [t.get('slug','') for t in p.get('tags',[])]
            # Skip posts with the excluded tag (self)
            if exclude_tag and exclude_tag in tags:
                continue
            titles.append(p.get('title',''))
        return titles
    except:
        return []

# ─── Main ──────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='AI 테크 데일리 브리핑')
    parser.add_argument('--publish', action='store_true', help='Ghost에 발행')
    parser.add_argument('--time-slot', choices=['morning', 'afternoon'], help='시간대 (없으면 자동감지)')
    args = parser.parse_args()
    load_env()
    
    now = datetime.now()
    target_date = now.strftime('%Y-%m-%d')
    
    # Determine time slot
    if args.time_slot == 'morning':
        time_label = '오전'
    elif args.time_slot == 'afternoon':
        time_label = '오후'
    else:
        time_label = '오전' if now.hour < 12 else '오후'
    
    print(f"📊 {target_date} AI 테크 브리핑 ({time_label}) 생성 시작...\n")
    
    # Load rolling DB of all used sources from last 7 days for dedup
    existing_db = load_used_sources_db(days=7)
    print(f"     📂 롤링 DB 로드: 최근 7일간 {len(existing_db)}개 소스 ({'첫 실행' if not existing_db else '중복 체크 활성화'})")
    
    items = collect_sources()
    if not items:
        print("  ❌ 수집된 소스 없음")
        return
    
    ranked = dedup_and_rank(items)
    print(f"\n  📊 1차 중복제거 (내부): {len(ranked)}개")
    
    # Apply cross-session dedup against 7-day rolling DB (URL + title trigram)
    if existing_db:
        before_dedup = len(ranked)
        ranked = filter_duplicate_sources(ranked, existing_db)
        print(f"     📊 2차 중복제거 (롤링 DB): {len(ranked)}개 (제외: {before_dedup - len(ranked)}개)")
    
    print(f"\n  📋 소스 날짜 현황:")
    recent_count = sum(1 for i in ranked if i.get('date'))
    no_date_count = sum(1 for i in ranked if not i.get('date'))
    print(f"     - 날짜 확인됨: {recent_count}개")
    print(f"     - 날짜 미확인(Brave freshness=pd): {no_date_count}개")
    source_types = {}
    for i in ranked:
        src = i.get('source', 'unknown')
        source_types[src] = source_types.get(src, 0) + 1
    for src, cnt in sorted(source_types.items()):
        print(f"     - {src}: {cnt}개")
    
    # Fetch today's other published article titles to avoid topic overlap
    other_titles = get_todays_published_topics(target_date, exclude_tag=TAG_SLUG)
    if other_titles:
        print(f"     📰 오늘 발행된 다른 기사 {len(other_titles)}개 감지 (주제 중복 방지)")
    
    print(f"  ✍️ 기사 생성 중...")
    article = generate_brief(ranked, target_date, excluded_topics=other_titles)
    if not article:
        print("  ❌ 생성 실패")
        return
    print(f"  ✅ 생성 완료 ({len(article)}자)")
    
    token = get_ghost_token()
    existing = ghost_api('GET', f'posts/?filter=tag:{TAG_SLUG}+published_at:{target_date}&limit=5')
    time_exists = False
    for p in existing.get('posts', []):
        if time_label in p.get('title', ''):
            time_exists = True
            break
    if time_exists:
        print(f"  ⚠️ {target_date} {time_label} 브리핑 이미 존재")
        if not args.publish:
            print(f"\n--- 미발행 ---\n{article[:500]}...")
        return
    
    tag_slug = ensure_tag(token)
    html = article_to_html(article)
    title = f"AI 테크 브리핑: {target_date} ({time_label})"
    
    if not args.publish:
        print(f"\n제목: {title}\n{article[:600]}...\n\n✅ --publish 옵션으로 발행")
        return
    
    # Generate feature image (content-aware, based on today's actual news)
    feature_image = generate_feature_image(ranked, target_date, time_label, article)
    
    # Build post payload
    post_data = {
        'posts': [{
            'title': title,
            'html': html,
            'status': 'published',
            'visibility': 'public',  # ★ 반드시 공개 — Ghost 기본값이 구독자전용일 수 있음
            'featured': True,  # ★ AI Tech Brief is always Featured
            'tags': [{'name': TAG_NAME, 'slug': tag_slug}],
            'custom_excerpt': f"{target_date} AI 기술 핫이슈 TOP 10"
        }]
    }
    if feature_image:
        post_data['posts'][0]['feature_image'] = feature_image
    
    result = ghost_api('POST', 'posts/?source=html', post_data)
    if result.get('posts'):
        pub_url = f"{GHOST_URL}/{result['posts'][0]['slug']}/"
        print(f"  ✅ 발행! {pub_url}")
        # Save all used sources to rolling DB for cross-session dedup
        saved_count = 0
        for item in ranked[:30]:
            url = item.get('url', '')
            title = item.get('title', '')
            if url:
                save_to_used_sources_db(target_date, time_label, url, title)
                saved_count += 1
        print(f"     💾 {saved_count}개 소스를 롤링 DB에 저장 (향후 중복 방지)")
    else:
        print(f"  ❌ 발행 실패: {json.dumps(result, ensure_ascii=False)[:300]}")
        # Local save fallback
        os.makedirs('/tmp/ai-brief-backup', exist_ok=True)
        backup_path = f"/tmp/ai-brief-backup/{target_date}_{time_label}.md"
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(f"# {title}\n\n{article}\n\n---\nGenerated: {datetime.now().isoformat()}")
        print(f"     💾 기사 로컬 저장: {backup_path} ({len(article)}자)")

if __name__ == '__main__':
    main()
