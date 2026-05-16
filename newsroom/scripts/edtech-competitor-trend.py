#!/usr/bin/env python3
"""
에듀테크 경쟁사 동향 기사 생성기 (EdTech Competitor Trend Reporter)
===============================================================
오늘 수집된 국내 에듀테크 기업 뉴스를 종합하여 
트렌드 중심의 경쟁사 동향 분석 기사를 생성합니다.

Usage:
    python3 scripts/edtech-competitor-trend.py [--publish] [--dev]

Options:
    --publish    Ghost에 발행 (없으면 미리보기만)
    --dev        개발 서버(http://localhost:2380)에 발행
"""

import json, subprocess, base64, hmac, hashlib, time, re, sys, os, argparse
from datetime import datetime, timedelta, timezone

# ─── Config ───────────────────────────────────────
WORKSPACE = '/root/.openclaw/workspace/newsroom'
ENV_PATH = f'{WORKSPACE}/.env'
DEEPSEEK_API_KEY = None
DEEPSEEK_BASE_URL = os.environ.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1')
TAG_NAME = 'edtech-ecosystem'
TAG_SLUG = 'edtech-ecosystem'
TAG_TITLE = '시장동향'

PUBLISHED_DIR = f'{WORKSPACE}/pipeline/08-published'

# ─── Ghost API ─────────────────────────────────────
def get_ghost_token(dev=False):
    with open(ENV_PATH) as f:
        env = f.read()
    if dev:
        match = re.search(r'GHOST_DEV_ADMIN_API_KEY=(.+)', env)
        if not match:
            match = re.search(r'GHOST_ADMIN_API_KEY=(.+)', env)
    else:
        match = re.search(r'GHOST_ADMIN_API_KEY=(.+)', env)
    key = match.group(1).strip()
    id_part, secret_part = key.split(':')
    header = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","kid":id_part,"typ":"JWT"}).encode()).rstrip(b'=').decode()
    payload = base64.urlsafe_b64encode(json.dumps({"iat":int(time.time()),"exp":int(time.time())+300,"aud":"/admin/"}).encode()).rstrip(b'=').decode()
    sig = base64.urlsafe_b64encode(hmac.new(bytes.fromhex(secret_part), f"{header}.{payload}".encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
    return f"{header}.{payload}.{sig}"

def ghost_api(method, path, body=None, dev=False):
    GHOST_URL = 'http://localhost:2380' if dev else 'https://newsroom.ubion.global'
    token = get_ghost_token(dev)
    r = subprocess.run(['curl', '-s', '-w', '%{http_code}', '-o', '/tmp/ghost_res.json', '-X', method,
        f'{GHOST_URL}/ghost/api/admin/{path}',
        '-H', f'Authorization: Ghost {token}',
        '-H', 'Content-Type: application/json; charset=utf-8',
        *(('-d', json.dumps(body)) if body else [])], capture_output=True, text=True, timeout=30)
    with open('/tmp/ghost_res.json') as f:
        data = json.load(f)
    return data, r.stdout

# ─── Load published articles from edtech collector ──
MAX_SOURCE_AGE_HOURS = 48  # ⏰ 48시간 이내 기사만 사용

def parse_source_date(date_str):
    """Parse source date string like '6 days ago', '1 day ago', '2026-05-10' into datetime."""
    if not date_str:
        return None
    date_str = date_str.strip().lower()
    now = datetime.now(timezone.utc)
    
    # Try direct date format
    try:
        return datetime.strptime(date_str[:10], '%Y-%m-%d').replace(tzinfo=timezone.utc)
    except:
        pass
    
    # Try 'X days ago' / 'X week ago'
    m = re.match(r'(\d+)\s*(day|days|week|weeks)\s*ago', date_str)
    if m:
        num = int(m.group(1))
        unit = m.group(2)
        if unit.startswith('day'):
            return now - timedelta(days=num)
        else:
            return now - timedelta(weeks=num)
    
    return None

def load_recent_articles():
    """Load recently published edtech company articles from 08-published/.
    Only includes articles whose source date is within MAX_SOURCE_AGE_HOURS."""
    articles = []
    os.makedirs(PUBLISHED_DIR, exist_ok=True)
    now = datetime.now(timezone.utc)
    skipped_old = 0
    
    for f in sorted(os.listdir(PUBLISHED_DIR)):
        if not f.endswith('.json'):
            continue
        fpath = os.path.join(PUBLISHED_DIR, f)
        try:
            with open(fpath, encoding='utf-8') as fh:
                data = json.load(fh)
        except:
            continue
        draft = data.get('draft', {})
        company = data.get('company_tag', {})
        src = data.get('source', {})
        
        if not company or not (draft.get('headline') and company.get('name_ko')):
            continue
        
        # ⏰ Source date freshness filter
        src_date_str = src.get('date', '')
        src_dt = parse_source_date(src_date_str)
        if src_dt:
            age_hours = (now - src_dt).total_seconds() / 3600
            if age_hours > MAX_SOURCE_AGE_HOURS:
                skipped_old += 1
                continue
        
        articles.append({
            'headline': draft.get('headline', ''),
            'company_ko': company.get('name_ko', ''),
            'company_en': company.get('name_en', ''),
            'category': company.get('category', ''),
            'body': draft.get('html', '')[:300],
            'source_title': src.get('title', ''),
            'source_url': src.get('url', ''),
            'date': src_date_str,
            'file': f
        })
    
    if skipped_old > 0:
        print(f'  ⏰ {skipped_old}건 제외 (소스 날짜가 {MAX_SOURCE_AGE_HOURS}시간 초과)')
    return articles

# ─── LLM ───────────────────────────────────────────
from llm_utils import call_llm as fallback_call_llm

def call_llm(prompt, system=None):
    return fallback_call_llm(prompt, system=system, temperature=0.7, max_tokens=3000, label='시장동향')

SYSTEM_PROMPT = """당신은 한국 에듀테크 산업을 분석하는 전문 애널리스트입니다.

오늘 수집된 국내 에듀테크 기업들의 뉴스를 종합하여 
'에듀테크 기업 동향' 분석 기사를 1500~2000자 분량으로 작성합니다.

글의 성격:
- 국내 에듀테크 업계 관계자(스타트업 CEO, 투자자, 기획자)를 위한 주간 동향 분석
- 단순 뉴스 나열이 아니라, 기업들의 움직임을 트렌드로 묶어 해석
- 경쟁 구도, 투자 트렌드, 정책 변화와의 연관성 도출
- **비판적 시각 유지**: 각 기업의 움직임이 실제로 의미 있는지, 한계는 무엇인지, 단순 홍보성 뉴스인지 냉철하게 평가
- **"분석가의 시각", "필자의 생각" 같은 별도 표식 없이** 본문에 자연스럽게 비판적 해석을 녹여낼 것
- 장밋빛 전망보다는 현실적 리스크와 과제를 함께 짚어줄 것

형식:
- ##, ### 같은 마크다운 헤더를 사용하지 마세요. 구분선(---)도 사용하지 마세요.
- 트렌드 전환은 자연스러운 문단 전환으로만 처리하세요.
- 예: "먼저 ... 분야를 살펴보자." → "다음으로 ... 분야를 살펴보자."

1. 오프닝: 이번 주 에듀테크 업계의 핵심 키워드/트렌드 — 비판적 시각 포함
2. 트렌드별 기업 동향 분석 (2~3개 트렌드로 묶음)
   - 각 트렌드에 해당하는 **구체적인 기업명**을 반드시 언급 (예: "에듀테크 스타트업"이 아니라 "뤼이드, 클래스팅, 매스프레소")
   - 각 기업의 움직임과 그 한계/과제를 함께 분석
   - 경쟁 구도와 시사점
3. 마무리: 업계 전체의 방향성과 향후 전망 — 비판적 평가 포함

중요 규칙:
- 각 트렌드에서 다루는 기업은 **구체적인 회사명**을 반드시 언급
- 각 기업의 구체적인 행보를 짚어주고, 그 의미와 한계를 함께 해석
- **비판적 시각 유지**: "과연...일까?", "...라는 점은 의문이다", "실효성은 아직 미지수" 같은 냉철한 평가
- 트렌드 분석 후 해당 트렌드와 관련된 기사들의 **출처와 링크**를 각주 형식으로 포함 (예: [참고: 기사제목 - 출처명](URL))
- 각 트렌드 섹션이 끝날 때 관련 기사들의 링크를 모아서 표시

어조:
- 전문적이지만 딱딱하지 않게
- **비판적이면서도 건설적인 논조**
- 한국어 자연스러운 문어체
- 기업명은 영어보다 한글 중심으로

형식 규칙:
- --- 으로 구분선 (자동으로 hr 태그로 변환됨)
- 각 기업 언급시 굵게 표시하지 않고 자연스럽게"""

def generate_article(articles, today):
    """Generate competitor trend article from collected articles"""
    
    # Sort by company category
    categorized = {}
    for a in articles:
        cat = a.get('category', 'general')
        if cat not in categorized:
            categorized[cat] = []
        categorized[cat].append(a)
    
    # Build prompt
    items_text = ""
    cat_labels = {
        'ai-tutoring': 'AI 튜터링',
        'edtech-platform': '에듀테크 플랫폼',
        'publishing': '교육출판',
        'test-prep': '입시/자격증',
        'corporate-edu': '기업교육',
        'coding-edu': '코딩교육',
        'special-edu': '특수교육',
        'global-edu': '글로벌',
        'general': '일반/기타'
    }
    
    for cat, items in sorted(categorized.items()):
        label = cat_labels.get(cat, cat)
        items_text += f"\n[{label} 분야]\n"
        for a in items:
            items_text += f"- {a['company_ko']}: {a['headline']}\n"
            if a.get('source_url'):
                items_text += f"  출처: {a['source_title']} ({a['source_url']})\n"
    
    prompt = f"""오늘({today}) 수집된 국내 에듀테크 기업 뉴스들입니다. 각 기사에는 출처 링크가 포함되어 있습니다.

{items_text}

---

위 기업 뉴스들을 종합하여 국내 에듀테크 기업 동향 분석 기사를 작성해주세요.
1500~2000자 분량으로 작성해주세요.

중요:
1. 각 트렌드 섹션에서는 **구체적인 기업명**(뤼이드, 클래스팅, 매스프레소 등)을 반드시 언급하세요. "에듀테크 스타트업" 같은 모호한 표현 대신 실제 회사명을 사용하세요.
2. 각 트렌드 섹션이 끝날 때 해당 기사들의 **출처 링크**를 모아서 표시해주세요.
3. 기사 본문에서 기업을 언급할 때 자연스럽게 회사명을 포함시키세요.
4. 링크는 마크다운 형식 [텍스트](URL) 으로 표시해주세요."""
    
    return call_llm(prompt, SYSTEM_PROMPT)

# ─── HTML Converter ────────────────────────────────
def text_to_html(text):
    """Convert markdown-style text to Ghost-compatible HTML (via unified formatter)."""
    from format_article import text_to_html as format_text_to_html
    return format_text_to_html(text, use_blockquote_lead=True)

# ─── Tag ───────────────────────────────────────────
def ensure_tag(token, dev=False):
    GHOST_URL = 'http://localhost:2380' if dev else 'https://newsroom.ubion.global'
    r = subprocess.run(['curl', '-s', '-X', 'GET',
        f'{GHOST_URL}/ghost/api/admin/tags/?limit=200',
        '-H', f'Authorization: Ghost {token}'], capture_output=True, text=True, timeout=15)
    data = json.loads(r.stdout)
    exists = any(t.get('slug') == TAG_SLUG for t in data.get('tags',[]))
    if not exists:
        subprocess.run(['curl', '-s', '-X', 'POST',
            f'{GHOST_URL}/ghost/api/admin/tags/',
            '-H', f'Authorization: Ghost {token}',
            '-H', 'Content-Type: application/json',
            '-d', json.dumps({'tags': [{'name': TAG_TITLE, 'slug': TAG_SLUG, 'description': '에듀테크 기업 주간 동향'}]})],
            capture_output=True, text=True, timeout=15)
        print(f"  ✅ 태그 생성: #{TAG_TITLE}")
    return TAG_SLUG

# ─── Image ─────────────────────────────────────────
def select_style(date_str):
    STYLE_PALETTE = [
        "Corporate flat vector design, solid colors, geometric shapes, bold composition",
        "Isometric 3D perspective, colorful geometric blocks, data visualization style",
        "Blueprint technical style, white line drawings on deep blue background",
        "Paper collage art, cut-out elements, layered textures, vintage magazine style",
        "Chalkboard hand-drawn style, white and pastel chalk on dark board",
        "Bauhaus geometric design, primary colors, clean lines, constructivist",
        "Swiss typographic style, strict grid layout, clean systematic design",
        "Art Deco geometric luxury patterns, gold foil accents, rich jewel tones",
        "Neumorphic UI style, soft shadows, raised elements, monochromatic palette",
        "Editorial documentary photography, candid moments, natural lighting",
    ]
    idx = abs(hash(date_str)) % len(STYLE_PALETTE)
    return STYLE_PALETTE[idx]

def generate_image(articles, date_str, dev=False):
    """Generate feature image for the article"""
    GHOST_URL = 'http://localhost:2380' if dev else 'https://newsroom.ubion.global'
    style = select_style(date_str)
    
    # Build scene from company names
    companies = list(set(a['company_ko'] for a in articles[:5]))
    scene = f"Korean edtech companies business landscape, {companies[0] if companies else 'edtech'} market analysis, modern corporate environment, professional"
    
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from flux_image import generate_flux_image
        prompt = f"{scene}, {style}, absolutely NO text, NO letters, NO characters, NO watermark"
        ghost_url = generate_flux_image(prompt)
        if ghost_url:
            print(f"     ✅ FLUX 이미지 생성 완료")
            return ghost_url
    except Exception as e:
        print(f"     ⚠️ FLUX 실패 ({e}), 기본 이미지 사용")
    
    return None

# ─── Main ──────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='에듀테크 경쟁사 동향 기사 생성기')
    parser.add_argument('--publish', action='store_true', help='Ghost에 발행')
    parser.add_argument('--dev', action='store_true', help='개발 서버 사용')
    args = parser.parse_args()
    
    today = datetime.now().strftime('%Y-%m-%d')
    GHOST_LABEL = '개발 서버' if args.dev else '운영 서버'
    
    print(f"📊 {today} 에듀테크 경쟁사 동향 기사 생성 ({GHOST_LABEL})...")
    
    # 1. Load recent articles
    articles = load_recent_articles()
    if not articles:
        print("  ❌ 수집된 기업 뉴스가 없습니다. 수집기부터 실행하세요.")
        return
    
    print(f"  📰 최근 발행 기업 뉴스: {len(articles)}개")
    
    # ⏰ 최소 기사 수 체크 (3개 미만이면 의미 있는 분석 어려움)
    MIN_ARTICLES = 3
    if len(articles) < MIN_ARTICLES:
        print(f"  ⏭️ 기사 수가 {MIN_ARTICLES}개 미만({len(articles)}개)이므로 발행을 건너뜁니다.")
        return
    
    # Check for existing article today
    token = get_ghost_token(args.dev)
    existing_res, _ = ghost_api('GET', f'posts/?filter=tag:{TAG_SLUG}+published_at:{today}&limit=5', dev=args.dev)
    if existing_res.get('posts') and len(existing_res['posts']) > 0:
        print(f"  ⚠️ 오늘({today}) 동향 기사가 이미 존재합니다.")
        return
    
    # 2. Generate article
    print(f"  ✍️ 동향 기사 생성 중...")
    article_text = generate_article(articles, today)
    if not article_text:
        print("  ❌ 기사 생성 실패")
        return
    
    print(f"  ✅ 생성 완료 ({len(article_text)}자)")
    
    # 3. Ensure tag
    tag_slug = ensure_tag(token, args.dev)
    
    # 4. Convert to HTML
    html = text_to_html(article_text)
    title = f"에듀테크 기업 동향: {today}"
    
    if not args.publish:
        print(f"\n--- 생성된 기사 (미발행) ---\n")
        print(f"제목: {title}")
        print(article_text[:1000])
        print("\n...")
        print(f"\n✅ 미리보기 완료. --publish 옵션으로 발행하세요.")
        return
    
    # 5. Generate image
    print(f"  🖼️ 이미지 생성 중...")
    feature_image = generate_image(articles, today, args.dev)
    
    # 6. Publish
    print(f"  📤 Ghost 발행 중...")
    result, code = ghost_api('POST', 'posts/?source=html', {
        'posts': [{
            'title': title,
            'html': html,
            'feature_image': feature_image,
            'status': 'published',
            'visibility': 'public',
            'featured': True,
            'tags': [{'name': TAG_TITLE, 'slug': tag_slug}],
            'custom_excerpt': f"{today} 국내 에듀테크 기업 동향 분석"
        }]
    }, dev=args.dev)
    
    if result.get('posts'):
        slug = result['posts'][0]['slug']
        if args.dev:
            print(f"  ✅ 발행 완료! http://localhost:2380/{slug}/")
        else:
            print(f"  ✅ 발행 완료! https://newsroom.ubion.global/{slug}/")
    else:
        print(f"  ❌ 발행 실패: {json.dumps(result, ensure_ascii=False)[:200]}")

if __name__ == '__main__':
    main()
