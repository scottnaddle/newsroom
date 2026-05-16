#!/usr/bin/env python3
"""
Pre-generate feature images for all pending news articles via FLUX 2 Turbo (FAL AI).
1. Reads article JSON files from 07-copy-edited/
2. Generates image via FLUX 2 Turbo API (FAL AI)
3. Uploads to Ghost CMS
4. Caches Ghost CDN URLs to /root/.openclaw/workspace/newsroom/.imgcache/pending.json

Usage: python3 pregen-article-images.py
"""
import subprocess, sys, os, json, time, hmac, base64, urllib.request, urllib.error, random, re, pathlib

# FLUX 2 Dev 모듈 임포트
sys.path.insert(0, '/root/newsroom-analysis/newsroom/scripts')
from flux_image import generate_flux_image

MAC_IP = "100.108.26.68"
ENV_FILE = "/root/.openclaw/workspace/newsroom/.env"
PIPELINE_DIR = "/root/.openclaw/workspace/newsroom/pipeline/07-copy-edited"
CACHE_DIR = "/root/.openclaw/workspace/newsroom/.imgcache"
CACHE_FILE = os.path.join(CACHE_DIR, "pending.json")

# 🍌 BananaX-inspired Style Palette (22 diverse visual styles)
# Each entry = (style_name, style_prompt_suffix)
# Deterministically selected via hash(headline)
STYLE_PALETTE = [
    ("Flat Illustration / Corporate",
     "vector flat design, solid colors, geometric shapes, bold composition, professional corporate illustration"),
    ("Isometric / Data Viz",
     "isometric 3D perspective, colorful geometric blocks, data visualization style, clean angled lines"),
    ("Watercolor / Vintage",
     "watercolor painting, soft edges, translucent washes, impressionistic, gentle color blending, textured paper"),
    ("Blueprint / Technical",
     "technical blueprint style, white line drawings on deep blue background, architectural drafting, grid lines"),
    ("Manga / Screen Tone",
     "manga illustration style, screentone textures, expressive line art, comic panel composition"),
    ("Collage / Paper",
     "paper collage art, cut-out elements, layered textures, vintage magazine clippings, mixed media"),
    ("Knolling / Flat Lay",
     "knolling photography, top-down flat lay, neatly arranged objects at right angles, organized composition"),
    ("Chalkboard / Hand-drawn",
     "chalk drawing on dark chalkboard, hand-drawn style, white and pastel chalk strokes, rustic texture"),
    ("Pixel Art / 8-bit",
     "pixel art style, retro 8-bit video game aesthetic, blocky pixels, limited color palette"),
    ("Doodle / Notebook",
     "hand-drawn doodle style, casual sketch on notebook paper, simple line art, playful illustration"),
    ("Paper Cutout / Shadow Box",
     "paper cutout craft style, layered paper with shadows, pastel colors, dimensional depth, handmade aesthetic"),
    ("Glassmorphism / Frosted",
     "glassmorphism style, frosted glass effect, blur and transparency, soft gradients, modern UI aesthetic"),
    ("Low Poly / Faceted",
     "low poly 3D style, faceted geometric surfaces, angular shapes, vertex-based rendering, game art aesthetic"),
    ("Bauhaus / Geometric",
     "Bauhaus design style, geometric shapes, primary colors, clean lines, constructivist composition"),
    ("Swiss Style / Grid",
     "Swiss typographic style, strict grid layout, sans-serif typography as design element, clean systematic"),
    ("Art Deco / Gold Foil",
     "Art Deco style, geometric luxury patterns, gold foil accents, rich jewel tones, symmetrical composition"),
    ("Ukiyo-e / Woodblock",
     "Ukiyo-e woodblock print style, flat colors, bold outlines, traditional Japanese composition"),
    ("Retro Anime / Cel Shading",
     "retro 80s-90s anime style, warm tones, cel shading, nostalgic Japanese animation, soft glow"),
    ("Cyberpunk / Neon",
     "cyberpunk aesthetic, neon lights on dark backgrounds, blue-purple palette, holographic elements"),
    ("Risograph / Offset",
     "Risograph print style, offset misregistration, neon spot colors, gritty textured print"),
    ("Neumorphism / Soft",
     "neumorphic UI style, soft shadows, raised and inset elements, monochromatic light palette, subtle depth"),
    ("Editorial / Documentary",
     "editorial documentary photography, candid moments, natural lighting, high resolution, professional"),
]

# Scene templates — content-aware, NOT style (mirrors original SCENES logic)
SCENES = {
    "default": "A modern classroom scene",
    "ai": "Artificial intelligence in education, AI robots helping students",
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

def load_env():
    with open(ENV_FILE) as f:
        text = f.read()
    url_match = re.search(r'GHOST_URL=(.+)', text)
    key_match = re.search(r'GHOST_ADMIN_API_KEY=(.+)', text)
    if not url_match or not key_match:
        raise RuntimeError("Failed to load Ghost config from .env")
    return url_match.group(1).strip(), key_match.group(1).strip()

def build_prompt(headline, tags):
    """Build English prompt from Korean headline + tags (mirroring publish-ghost-fixed.js)"""
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

    # 🍌 BananaX deterministic style selection — same headline = same style
    style_idx = abs(hash(headline or "")) % len(STYLE_PALETTE)
    style_name, style_prompt = STYLE_PALETTE[style_idx]

    en_words = ' '.join(re.findall(r'[a-zA-Z]{4,}', headline or ''))[:80]
    
    # Country-specific prompt augmentation — multiple variants for diversity
    country_scene_map = {
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
    
    country_scenes = None
    for country, cscenes in country_scene_map.items():
        if country in headline:
            country_scenes = cscenes
            break
    
    if country_scenes:
        # Cycle through variants based on headline hash for consistency per article
        variant_idx = hash(headline) % len(country_scenes)
        scene = country_scenes[variant_idx]

    prompt = f"{scene}, {style_prompt}"
    if en_words: prompt += f", theme: {en_words}"
    prompt += f", no text, no logos, no typography, style: {style_name}"
    return prompt

def ssh_run(cmd, timeout=300):
    r = subprocess.run(
        ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=30", f"axc@{MAC_IP}", cmd],
        capture_output=True, text=True, timeout=timeout
    )
    if r.returncode != 0:
        raise RuntimeError(f"SSH failed (exit {r.returncode}): {r.stderr.strip()[:200]}")
    return r.stdout.strip()

def scp_from(remote_path, local_path):
    subprocess.run(
        ["scp", "-o", "StrictHostKeyChecking=no", f"axc@{MAC_IP}:{remote_path}", local_path],
        capture_output=True, timeout=30, check=True
    )

def generate_and_upload_image(prompt, ghost_domain, ghost_admin_key):
    """Generate via FLUX 2 Dev (FAL AI) → upload to Ghost → return CDN URL"""
    print(f"  Generating image via FLUX 2 Dev...", flush=True)
    
    # NO TEXT 강화
    enhanced = prompt + " ABSOLUTELY NO text, NO letters, NO characters, NO words, NO watermark, NO logo. Pure visual imagery only."
    
    try:
        ghost_url = generate_flux_image(enhanced)
        if ghost_url:
            print(f"  ✅ FLUX 이미지 생성 완료: {ghost_url[:60]}...", flush=True)
            return ghost_url
    except Exception as e:
        print(f"  ❌ FLUX 생성 실패: {e}", flush=True)
    
    return None

def main():
    os.makedirs(CACHE_DIR, exist_ok=True)
    ghost_domain, ghost_admin_key = load_env()
    
    # Read pending articles
    files = sorted([f for f in os.listdir(PIPELINE_DIR) if f.endswith('.json')])
    if not files:
        print("No pending articles in 07-copy-edited/")
        # Write empty cache
        with open(CACHE_FILE, 'w') as f:
            json.dump({}, f)
        return
    
    # Load existing cache
    cache = {}
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as f:
            cache = json.load(f)
    
    print(f"Found {len(files)} articles to process")
    
    for fname in files:
        with open(os.path.join(PIPELINE_DIR, fname)) as f:
            data = json.load(f)
        
        draft = data.get("draft", {})
        headline = draft.get("headline", "")
        tags = draft.get("ghost_tags", [])
        
        if not headline:
            print(f"  ⏭️ {fname}: No headline, skipping")
            continue
        
        # Check cache
        if headline in cache and cache[headline]:
            print(f"  ⏭️ '{headline[:30]}...' already cached")
            continue
        
        prompt = build_prompt(headline, tags)
        print(f"\n📰 '{headline[:30]}...'")
        print(f"  Prompt: {prompt[:80]}...")
        
        url = generate_and_upload_image(prompt, ghost_domain, ghost_admin_key)
        if url:
            cache[headline] = url
            with open(CACHE_FILE, 'w') as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)
        else:
            print(f"  ❌ Failed for '{headline[:30]}...'")
    
    print(f"\n Done! {len(cache)} images cached in {CACHE_FILE}")

if __name__ == "__main__":
    main()
