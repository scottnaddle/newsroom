#!/usr/bin/env python3
"""
에듀테크 생태계 시평 (EdTech Ecosystem Editorial)
=================================================
매일 발행된 뉴스 + 논문을 종합하여 에듀테크 생태계 관점의 사설 형식 분석글을 생성합니다.
Run: python3 scripts/edtech-editorial.py [--date YYYY-MM-DD] [--publish]
"""
import json, subprocess, base64, hmac, hashlib, time, re, sys, os, argparse
from datetime import datetime, timedelta
from urllib.parse import quote_plus

# ─── Config ───────────────────────────────────────
GHOST_URL = 'https://newsroom.ubion.global'
ENV_PATH = '/root/.openclaw/workspace/newsroom/.env'
DEEPSEEK_API_KEY = None
DEEPSEEK_BASE_URL = os.environ.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1')
TAG_NAME = '에듀생태계시평'
TAG_SLUG = 'edtech-editorial'

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

def fetch_day_articles(target_date):
    """Fetch all published articles from a specific date."""
    all_posts = []
    page = 1
    while True:
        data = ghost_api('GET', f'posts/?limit=200&page={page}&formats=html,plaintext&filter=status:published')
        if not data.get('posts') or len(data['posts']) == 0:
            break
        all_posts.extend(data['posts'])
        page += 1
    
    # Filter by date
    day_posts = [p for p in all_posts if (p.get('published_at') or '').startswith(target_date)]
    
    news = []
    papers = []
    for p in day_posts:
        html = p.get('html','') or ''
        text = re.sub(r'<[^>]+>', '', html).strip()[:600]
        tags = [t.get('name','') for t in p.get('tags',[])]
        item = {'title': p['title'], 'body': text, 'tags': tags, 'slug': p['slug']}
        if any('ai-paper' in t.get('slug','') for t in p.get('tags',[])):
            papers.append(item)
        else:
            news.append(item)
    
    return news, papers

def ensure_tag(token):
    """Create the editorial tag in Ghost if it doesn't exist."""
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
            '-d', json.dumps({'tags': [{'name': TAG_NAME, 'slug': TAG_SLUG, 'description': '에듀테크 생태계 데일리 시평'}]})],
            capture_output=True, text=True, timeout=15)
        print(f"  ✅ 태그 생성: #{TAG_NAME}")
    return TAG_SLUG

# ─── LLM Editorial Writer ──────────────────────────
def call_llm(prompt, system=None):
    """Call DeepSeek API."""
    global DEEPSEEK_API_KEY
    if not DEEPSEEK_API_KEY:
        with open(ENV_PATH) as f:
            env = f.read()
        match = re.search(r'DEEPSEEK_API_KEY=(.+)', env)
        DEEPSEEK_API_KEY = match.group(1).strip() if match else None
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system or "You are a Korean EdTech columnist."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 3000
    }
    
    r = subprocess.run(['curl', '-s', '-X', 'POST',
        f'{DEEPSEEK_BASE_URL}/chat/completions',
        '-H', f'Authorization: Bearer {DEEPSEEK_API_KEY}',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps(payload)], capture_output=True, text=True, timeout=120)
    
    try:
        data = json.loads(r.stdout)
        return data['choices'][0]['message']['content']
    except:
        print(f"  ❌ LLM 호출 실패: {r.stdout[:200]}")
        return None

EDITORIAL_SYSTEM = """당신은 한국 에듀테크 생태계를 분석하는 전문 칼럼니스트입니다.
매일 발행된 뉴스 기사와 학술 논문 요약을 종합하여 1500~2000자 분량의 사설(시평)을 작성합니다.

글의 성격:
- 에듀테크 생태계에 종사하는 사람들(스타트업, 교육자, 정책 입안자, 연구자)을 위한 분석
- 단순 요약이 아니라, 오늘의 소식이 에듀테크 생태계에 어떤 의미를 갖는지 해석
- 국내 이야기와 해외 트렌드를 연결지어 한국에의 시사점 도출
- 냉철한 분석과 날카로운 통찰

형식:
1. 오프닝: 오늘의 에듀테크 생태계 키워드 / 한 줄 요약
2. 주요 뉴스 분석: 2~3개 테마로 묶어 해설 (사실 전달 + 해석 + 의견)
3. 오늘의 논문 인사이트: 연구 결과가 현장에 주는 의미
4. 에듀테크 생태계 관점: 이 소식들이 한국 시장/생태계에 주는 시사점
5. 마무리: 전체적인 평가와 전망

어조:
- 전문적이지만 딱딱하지 않게
- 객관적 분석에 개인적 의견을 곁들여 ('필자의 생각은...')
- '~입니다' 체의 격식 있는 문어체
- 전문 용어는 자연스럽게 풀어서

형식 규칙:
- 중요한 용어나 문장 강조는 **볼드** 대신 자연스러운 문장으로
- --- 으로 구분선 사용 자유롭게 (자동으로 hr 태그로 변환됨)
- 첫 문단은 리드(lead) 역할을 하도록 작성"""

def generate_editorial(news, papers, target_date):
    news_section = "\n\n".join([f"[📰 {a['title']}]\n{a['body'][:400]}" for a in news])
    papers_section = "\n\n".join([f"[📄 {a['title']}]\n{a['body'][:400]}" for a in papers])
    
    prompt = f"""오늘({target_date}) 발행된 에듀테크 관련 콘텐츠입니다.

=== 📰 오늘의 뉴스 ===
{news_section}

=== 📄 오늘의 논문 요약 ===
{papers_section}

---
위 소식들을 종합하여 에듀테크 생태계 관점의 사설을 작성해주세요.
1500~2000자 분량으로 작성해주세요."""
    
    return call_llm(prompt, EDITORIAL_SYSTEM)

def editorial_to_html(text):
    """Convert editorial text to Ghost-compatible HTML."""
    # Fix markdown bold first
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    
    paragraphs = text.strip().split('\n\n')
    html_parts = []
    first_real = True
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        # Headers
        if p.startswith('## '):
            html_parts.append(f'<h2>{p[3:]}</h2>')
        elif p.startswith('# '):
            html_parts.append(f'<h2>{p[2:]}</h2>')  # Ghost uses h1 for title, skip h1
        # Horizontal rule
        elif p == '---' or p == '—':
            html_parts.append('<hr />')
        # Bold lead: wrap first real paragraph in blockquote
        elif first_real and not html_parts:
            html_parts.append(f'<blockquote>{p}</blockquote>')
            first_real = False
        else:
            html_parts.append(f'<p>{p}</p>')
    
    html = '\n'.join(html_parts)
    # Clean up any remaining standalone --- in paragraphs
    html = re.sub(r'<p>---</p>', '<hr />', html)
    html = re.sub(r'<p>—</p>', '<hr />', html)
    return html

# ─── Image Generation ──────────────────────────────
# 🍌 BananaX-inspired Style Palette (22 diverse visual styles)
# Each style = technique / palette / style_prompt
# Used for deterministic selection via hash(target_date)
STYLE_PALETTE = [
    ("Flat Illustration", "Corporate / Modern",
     "Clean vector flat design style, solid colors, geometric shapes, bold composition, no gradients, professional corporate illustration"),
    ("Isometric", "Data Visualization",
     "Isometric 3D perspective view, colorful geometric blocks, data visualization elements, infographic style, clean lines and angles"),
    ("Watercolor", "Vintage / Soft",
     "Watercolor painting style, soft edges, translucent washes, impressionistic, gentle color blending, textured paper feel"),
    ("Blueprint", "Technical / Cyan",
     "Technical blueprint style, white line drawings on deep blue background, architectural drafting, grid lines, engineering precision"),
    ("Manga", "Screen Tone / Comic",
     "Japanese manga illustration style, screentone textures, black and white with gray tones, comic panel composition, expressive lines"),
    ("Collage", "Vintage / Paper",
     "Paper collage art, cut-out elements, layered textures, vintage magazine clippings, mixed media, tactile composition"),
    ("Knolling", "Organized / Flat Lay",
     "Knolling photography style, top-down flat lay, neatly arranged objects at right angles, organized composition, clean product aesthetic"),
    ("Chalkboard", "Hand-drawn / Cafe",
     "Chalk drawing on dark chalkboard, hand-drawn style, white and pastel chalk strokes, rustic texture, educational atmosphere"),
    ("Pixel Art", "Retro Game / 8-bit",
     "Pixel art style, retro 8-bit video game aesthetic, blocky pixels, limited color palette, nostalgic gaming look"),
    ("Doodle", "Notebook / Cute",
     "Hand-drawn doodle style, casual sketch on notebook paper, simple line art, playful, whimsical illustration"),
    ("Paper Cutout", "Shadow Box / Pastel",
     "Paper cutout craft style, layered paper with shadows, pastel colors, dimensional depth, shadow box effect, handmade aesthetic"),
    ("Glassmorphism", "Frosted / Abstract",
     "Glassmorphism style, frosted glass effect, blur and transparency, soft gradients, modern UI aesthetic, ethereal dreamy look"),
    ("Risograph", "Multi-color / Offset",
     "Risograph print style, offset misregistration, neon and spot colors, gritty textured print, imperfect ink alignment, zine aesthetic"),
    ("Bauhaus", "Geometric / Primary",
     "Bauhaus design style, geometric shapes, primary colors (red, yellow, blue), clean lines, constructivist composition, 1920s modernism"),
    ("Swiss Style", "Typography / Grid",
     "Swiss/International typographic style, strict grid layout, sans-serif typography as design element, clean, systematic layout"),
    ("Art Deco", "Gold Foil / Luxury",
     "Art Deco style, geometric luxury patterns, gold foil accents, rich jewel tones, symmetrical composition, 1920s glamour elegance"),
    ("Low Poly", "Isometric / Faceted",
     "Low poly 3D style, faceted geometric surfaces, angular shapes, vertex-based rendering, modern game art aesthetic"),
    ("Ukiyo-e", "Japanese / Woodblock",
     "Ukiyo-e Japanese woodblock print style, flat colors, bold outlines, traditional Japanese composition, nature elements, Hokusai-inspired"),
    ("Neumorphism", "Soft / Minimal",
     "Neumorphic UI style, soft shadows, raised and inset elements, monochromatic light palette, subtle depth, clean minimal"),
    ("Retro Anime", "VHS / Warm",
     "Retro 80s-90s anime style, VHS color grading, cel shading, warm tones, nostalgic Japanese animation aesthetic, soft glow"),
    ("Cyberpunk", "Neon / Dark",
     "Cyberpunk aesthetic, neon lights on dark backgrounds, blue and purple palette, futuristic cityscape, holographic elements, tech noir"),
    ("Space", "Cosmic / Dark",
     "Deep space aesthetic, star fields, cosmic colors, dark background with bright highlights, celestial, astronomical photography style"),
]


def select_style(date_str):
    """Deterministic style selection via hash(date) — same date always = same style."""
    idx = abs(hash(date_str)) % len(STYLE_PALETTE)
    tech, palette, desc = STYLE_PALETTE[idx]
    print(f"     🎨 오늘의 스타일: {tech} / {palette}")
    return tech, palette, desc


def generate_editorial_image(news, target_date):
    """Generate a feature image using Pollinations.ai, with BananaX-inspired style diversity."""
    print(f"  🖼️ 이미지 생성 중...")
    
    # Select deterministic style for today
    technique, palette, style_desc = select_style(target_date)
    
    # Determine scene theme from today's top news
    top_news_titles = [a['title'] for a in news[:5]]
    top_news_text = '\n'.join([f"- {t}" for t in top_news_titles])
    
    # Scene theme hints based on news content keywords
    scene_hints = (
        "Analyze the MAIN THEME of today's news and choose an appropriate scene:\n"
        "- AI policy/regulation → government building, law document, debate chamber\n"
        "- Funding/investment/startup → chart, graph, investor meeting, startup office\n"
        "- Academic research/paper → university lab, library, microscope, data\n"
        "- School/K-12/classroom → classroom, students, teacher, playground\n"
        "- Digital/online learning → device, screen, virtual classroom\n"
        "- AI tool/product launch → product interface, dashboard, app\n"
        "- Global/international → cultural exchange, world map, diverse students\n"
        "- Teacher training/professional → workshop, seminar, certificate"
    )

    system = f"""You are an image prompt engineer for an EdTech editorial.

TODAY'S ASSIGNED VISUAL STYLE:
Technique: {technique}
Color Palette: {palette}
Style Description: {style_desc}

You MUST generate the prompt in this exact style. The visual technique and palette are non-negotiable.

{scene_hints}

Rules:
- The scene must reflect the MAIN TOPIC of today's news, NOT a generic classroom
- The style MUST strictly follow {technique} / {palette}
- 50-80 words, single paragraph
- NO text, NO typography, NO letters, NO watermark
- Be specific and visual — include concrete objects, colors, lighting"""
    
    user = f"""Today's EdTech news headlines:
{top_news_text}

Create ONE detailed image prompt (50-80 words) in {technique} style with {palette} palette for an editorial cover image."""

    # Get prompt from DeepSeek
    global DEEPSEEK_API_KEY
    if not DEEPSEEK_API_KEY:
        with open(ENV_PATH) as f:
            env = f.read()
        match = re.search(r'DEEPSEEK_API_KEY=(.+)', env)
        DEEPSEEK_API_KEY = match.group(1).strip() if match else None

    payload = {"model": "deepseek-chat", "messages": [
        {"role": "system", "content": system},
        {"role": "user", "content": user}
    ], "temperature": 0.9, "max_tokens": 250}
    r = subprocess.run(['curl', '-s', '-X', 'POST', f'{DEEPSEEK_BASE_URL}/chat/completions',
        '-H', f'Authorization: Bearer {DEEPSEEK_API_KEY}', '-H', 'Content-Type: application/json',
        '-d', json.dumps(payload)], capture_output=True, text=True, timeout=30)
    try:
        llm_prompt = json.loads(r.stdout)['choices'][0]['message']['content'].strip().strip("'\"")
        print(f"     AI 프롬프트 ({technique} / {palette}): {llm_prompt[:80]}...")
    except:
        # Fallback prompt with today's style
        llm_prompt = f"{style_desc}, {palette} color palette, {technique} illustration style representing education technology transformation, modern learning, no text"
        print(f"     기본 프롬프트 사용 (LLM 실패)")
    
    # Generate via Pollinations.ai
    safe_prompt = quote_plus(llm_prompt)
    img_url = f"https://image.pollinations.ai/prompt/{safe_prompt}?width=1400&height=800&seed={abs(hash(target_date))}&nofeed=true"
    local_path = f"/tmp/edtech-editorial-{target_date}.jpg"
    subprocess.run(['curl', '-sL', '-o', local_path, '-m', '30', '-H', 'User-Agent: Mozilla/5.0', img_url],
        capture_output=True, text=True, timeout=45)
    
    if not os.path.exists(local_path) or os.path.getsize(local_path) < 1000:
        print(f"     ⚠️ 이미지 생성 실패, 이미지 없이 발행")
        return None
    
    print(f"     다운로드 완료: {os.path.getsize(local_path)/1024:.0f}KB")
    
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
            print(f"     ⚠️ 업로드 실패")
            return None
    except:
        print(f"     ⚠️ 업로드 파싱 실패")
        return None

# ─── Main ──────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='에듀테크 생태계 데일리 시평 생성기')
    parser.add_argument('--date', help='대상 날짜 (YYYY-MM-DD, 기본: 어제)')
    parser.add_argument('--publish', action='store_true', help='Ghost에 발행')
    args = parser.parse_args()
    
    target_date = args.date or datetime.now().strftime('%Y-%m-%d')
    
    print(f"📊 {target_date} 에듀테크 생태계 시평 생성 시작...")
    
    # 1. Fetch articles
    news, papers = fetch_day_articles(target_date)
    if not news and not papers:
        print(f"  ❌ {target_date}에 발행된 게시글이 없습니다.")
        return
    
    print(f"  📰 뉴스: {len(news)}개, 📄 논문: {len(papers)}개")
    
    # 2. Generate editorial via LLM
    print(f"  ✍️ 사설 생성 중...")
    editorial = generate_editorial(news, papers, target_date)
    if not editorial:
        print("  ❌ 사설 생성 실패")
        return
    
    print(f"  ✅ 생성 완료 ({len(editorial)}자)")
    
    # 3. Check for existing editorial on this date (avoid duplicates)
    token = get_ghost_token()
    existing = ghost_api('GET', f'posts/?filter=tag:{TAG_SLUG}+published_at:{target_date}&limit=5')
    if existing.get('posts') and len(existing['posts']) > 0:
        print(f"  ⚠️ {target_date} 시평이 이미 존재합니다. 덮어쓰지 않음.")
        if not args.publish:
            print(f"\n--- 생성된 시평 (미발행) ---\n{editorial[:500]}...")
        return
    
    # 4. Ensure tag exists
    tag_slug = ensure_tag(token)
    
    # 5. Convert to HTML
    html = editorial_to_html(editorial)
    title = f"에듀테크 생태계 시평: {target_date}"
    
    if not args.publish:
        print(f"\n--- 생성된 시평 (미발행, --publish 옵션 필요) ---\n")
        print(f"제목: {title}")
        print(editorial[:800])
        print("...")
        print(f"\n✅ 미리보기 완료. --publish 옵션으로 발행하세요.")
        return
    
    # 6. Generate feature image
    feature_image = generate_editorial_image(news, target_date)
    
    # 7. Publish
    print(f"  📤 Ghost 발행 중...")
    result = ghost_api('POST', 'posts/?source=html', {
        'posts': [{
            'title': title,
            'html': html,
            'feature_image': feature_image,
            'status': 'published',
            'visibility': 'public',  # 반드시 공개 — Ghost 기본값이 구독자전용일 수 있음
            'featured': True,
            'tags': [{'name': TAG_NAME, 'slug': tag_slug}],
            'custom_excerpt': f"{target_date} 에듀테크 생태계 주요 소식과 분석"
        }]
    })
    
    if result.get('posts'):
        print(f"  ✅ 발행 완료!")
        print(f"  🔗 {GHOST_URL}/{result['posts'][0]['slug']}/")
    else:
        print(f"  ❌ 발행 실패: {json.dumps(result, ensure_ascii=False)[:200]}")

if __name__ == '__main__':
    main()
