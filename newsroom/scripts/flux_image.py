#!/usr/bin/env python3
"""
FLUX 2 Dev 이미지 생성 모듈 (newsroom 파이프라인용)
FAL AI API를 통해 FLUX 2 Dev로 이미지 생성 → Ghost CMS 업로드

사용법:
    from flux_image import generate_flux_image
    
    url = generate_flux_image(prompt_text)
    # 또는 LLM으로 프롬프트 생성 후 FLUX 호출
    url = generate_flux_image(prompt_text, style_name="watercolor")
"""

import json
import os
import base64
import subprocess
import tempfile
import re
import sys

# ─── 환경변수 ─────────────────────────

ENV_PATH = os.path.expanduser('/root/.openclaw/workspace/newsroom/.env')

def load_env(key):
    if key in os.environ:
        val = os.environ[key]
        if val and val.strip():
            return val.strip()
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH) as f:
            for line in f:
                line = line.strip()
                if line.startswith(key + '='):
                    return line.split('=', 1)[1].strip()
    # 개발 서버 .env.dev도 확인
    dev_path = os.path.expanduser('/root/newsroom-analysis/newsroom/.env.dev')
    if os.path.exists(dev_path):
        with open(dev_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith(key + '='):
                    return line.split('=', 1)[1].strip()
    return None

# ─── BananaX 22가지 스타일 팔레트 ─────────

STYLE_PALETTE = [
    {'name': 'flat-illustration', 'desc': 'Flat vector illustration style. Clean solid colors, geometric shapes, bold composition. No gradients, no textures. Professional corporate graphic design aesthetic. Digital art with precise vector edges.'},
    {'name': 'isometric', 'desc': 'Isometric 3D perspective design. Colorful geometric blocks at 30-degree angles. Data visualization elements floating in space. Clean angled lines, infographic aesthetic with bright accent colors.'},
    {'name': 'watercolor', 'desc': 'Soft watercolor painting style. Translucent color washes with gentle bleeding. Textured paper feel visible through paint layers. Impressionistic quality, soft edges, dreamy atmospheric mood.'},
    {'name': 'blueprint', 'desc': 'Technical blueprint cyanotype style. White outline drawings on deep navy blue background. Purely visual, abstract architectural lines, grid patterns. Engineering precision, schematic layout without any labels or notations.'},
    {'name': 'manga', 'desc': 'Japanese manga comic art style. Black and white with screentone textures. Expressive line art, comic panel composition, dramatic angles. Dynamic action lines, bold ink strokes.'},
    {'name': 'collage', 'desc': 'Mixed-media paper collage aesthetic. Cut-out elements from textured papers, layered composition. Hand-torn edges, subtle shadows between layers. Tactile analog composition without printed text.'},
    {'name': 'knolling', 'desc': 'Knolling flat lay photography. Birdseye top-down view, neatly arranged objects at right angles. Clean organized product photography aesthetic. Balanced minimalist arrangement on flat surface.'},
    {'name': 'chalkboard', 'desc': 'Chalk drawing on dark chalkboard surface. Hand-drawn white and colored pastel strokes. Slightly dusty textured look. Educational vintage feel with abstract diagrams only, no letters or characters.'},
    {'name': 'pixel-art', 'desc': 'Retro 8-bit pixel art style. Blocky square pixels, limited color palette. NES-era video game aesthetic. Crisp pixel edges, chunky sprite proportions. Purely visual game art without interface elements.'},
    {'name': 'doodle', 'desc': 'Playful hand-drawn doodle style. Casual sketch on light background with subtle texture. Simple whimsical line art, cute illustration with rounded shapes. Messenger sticker feel.'},
    {'name': 'paper-cutout', 'desc': 'Layered paper cutout craft style. Dimensional depth with soft cast shadows between layers. Pastel color palette. Handmade tactile craft aesthetic with subtle paper texture.'},
    {'name': 'glassmorphism', 'desc': 'Glassmorphism UI aesthetic. Frosted glass panels with backdrop blur. Transparency layers with subtle gradients. Modern sleek digital look, clean flat geometric background elements.'},
    {'name': 'low-poly', 'desc': 'Low poly 3D rendering style. Faceted geometric triangulated surfaces. Angular vertex-based poly shapes. Modern game art aesthetic with visible polygon mesh patterns.'},
    {'name': 'bauhaus', 'desc': 'Bauhaus design movement style. Bold geometric shapes (circles, squares, triangles). Primary red-yellow-blue color palette. Clean constructivist lines, 1920s modernist composition. Pure abstract geometry.'},
    {'name': 'swiss-style', 'desc': 'Swiss International design style. Strict modular grid layout. Clean asymmetrical balance. Red and black on white. Systematic modern graphic design using pure geometric blocks and shapes.'},
    {'name': 'art-deco', 'desc': 'Art Deco luxury geometric style. Ornamental repeating patterns, gold foil metallic accents. Rich jewel tones (emerald, ruby, sapphire). Symmetrical elegant composition, 1920s glamour.'},
    {'name': 'ukiyo-e', 'desc': 'Ukiyo-e Japanese woodblock print style. Flat colored areas with bold black ink outlines. Traditional composition inspired by Hokusai. Nature motifs, stylized waves and clouds.'},
    {'name': 'retro-anime', 'desc': 'Retro 1980s-90s anime cel shading style. Warm VHS-toned color palette. Soft glow and halation effects. Nostalgic Japanese hand-drawn animation aesthetic.'},
    {'name': 'cyberpunk', 'desc': 'Cyberpunk futuristic city aesthetic. Neon magenta and cyan lights against dark night atmosphere. Holographic projections, tech noir elements. Rain-slicked streets, urban technology.'},
    {'name': 'risograph', 'desc': 'Risograph duplicator print style. Bright neon spot colors (fluorescent pink, orange, green). Offset registration misalignment effects. Gritty ink texture, poster aesthetic with abstract shapes.'},
    {'name': 'neumorphism', 'desc': 'Neumorphic soft UI design. Raised and inset rounded elements with subtle shadows. Monochromatic light cream palette. Clean minimal depth, soft ambient lighting.'},
    {'name': 'editorial-doc', 'desc': 'Professional editorial documentary photography style. Natural authentic lighting, candid human moments caught in action. High resolution, shallow depth of field. Photojournalistic quality composition.'},
]

def get_style_by_name(name):
    """스타일 이름으로 찾기"""
    for s in STYLE_PALETTE:
        if s['name'] == name:
            return s
    return STYLE_PALETTE[0]

def select_style(headline):
    """hash(제목) 기반 결정론적 스타일 선택"""
    h = 0
    for c in (headline or ''):
        h = ((h << 5) - h) + ord(c)
        h = h & h  # 32bit
    idx = abs(h) % len(STYLE_PALETTE)
    return STYLE_PALETTE[idx]

# ─── FLUX API 호출 ─────────────────────────

def call_flux(prompt):
    """FAL AI FLUX 2 Turbo API 호출. PNG URL 반환"""
    fal_key = load_env('FAL_KEY')
    if not fal_key:
        raise ValueError('FAL_KEY not found in .env or environment')
    
    payload = json.dumps({
        'prompt': prompt,
        'image_size': 'landscape_4_3',
        'guidance_scale': 2.5,
        'enable_safety_checker': False,
        'output_format': 'png',
    })
    
    result = subprocess.run([
        'curl', '-s', '-X', 'POST', 'https://fal.run/fal-ai/flux-2/turbo',
        '-H', f'Authorization: Key {fal_key}',
        '-H', 'Content-Type: application/json',
        '-d', payload,
        '--max-time', '30',
    ], capture_output=True, text=True, timeout=35)
    
    if result.returncode != 0:
        raise RuntimeError(f'FLUX API curl 실패: {result.stderr}')
    
    data = json.loads(result.stdout)
    if 'error' in data or 'detail' in data:
        err = data.get('error', {}).get('message', data.get('detail', str(data)))
        raise RuntimeError(f'FLUX 오류: {err}')
    
    img_url = data.get('images', [{}])[0].get('url', '')
    if not img_url:
        raise RuntimeError(f'응답에 이미지 URL 없음: {str(data)[:200]}')
    
    # URL인 경우 다운로드
    r = subprocess.run(['curl', '-sL', img_url, '--max-time', '30'],
                       capture_output=True, timeout=35)
    if r.returncode == 0 and len(r.stdout) > 1000:
        return r.stdout
    
    raise RuntimeError(f'이미지 다운로드 실패: URL={img_url[:80]}')

def upload_to_ghost(image_bytes, ghost_url=None, ghost_api_key=None):
    """이미지 바이트를 Ghost CMS에 업로드"""
    if not ghost_url:
        ghost_url = load_env('GHOST_URL') or 'https://newsroom.ubion.global'
    if not ghost_api_key:
        ghost_api_key = load_env('GHOST_ADMIN_API_KEY')
        if not ghost_api_key:
            raise ValueError('GHOST_ADMIN_API_KEY 필요')
    
    # 임시 파일 저장
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        f.write(image_bytes)
        local_path = f.name
    
    try:
        token_result = subprocess.run(['node', '-e', '''
            const crypto = require('crypto');
            const [id, secret] = process.argv[1].split(':');
            const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:id})).toString('base64url');
            const n = Math.floor(Date.now()/1000);
            const p = Buffer.from(JSON.stringify({iat:n,exp:n+300,aud:'/admin/'})).toString('base64url');
            const s = crypto.createHmac('sha256', Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
            process.stdout.write(h+'.'+p+'.'+s);
        ''', ghost_api_key], capture_output=True, text=True, timeout=5)
        token = token_result.stdout.strip()
        
        upload = subprocess.run([
            'curl', '-s', '-X', 'POST',
            f'{ghost_url}/ghost/api/admin/images/upload/',
            '-H', f'Authorization: Ghost {token}',
            '-F', f'file=@{local_path};type=image/png',
            '--max-time', '30',
        ], capture_output=True, text=True, timeout=35)
        
        if upload.returncode != 0:
            raise RuntimeError(f'Ghost 업로드 실패: {upload.stderr}')
        
        data = json.loads(upload.stdout)
        img_url = data.get('images', [{}])[0].get('url', '')
        if not img_url:
            raise RuntimeError(f'Ghost 업로드 응답 오류: {upload.stdout[:200]}')
        
        return img_url
    finally:
        try:
            os.unlink(local_path)
        except:
            pass

def build_flux_prompt(style_name, scene_desc, topic_text, country_context=''):
    """FLUX 프롬프트 조립 (NO TEXT 강화)"""
    style = get_style_by_name(style_name)
    
    no_text = ('ABSOLUTELY NO text, NO letters, NO characters, NO words, NO numbers, '
               'NO labels, NO captions, NO watermark, NO logo, NO typography. '
               'No Korean or English or any language letters anywhere. Pure visual imagery only.')
    
    parts = [
        style['desc'],
        f'Scene: {scene_desc}',
        f'Topic: {topic_text}',
        country_context if country_context else '',
        no_text,
    ]
    return ' '.join(p for p in parts if p)

# ─── 메인 퍼블릭 함수 ─────────────────────────

def generate_flux_image(prompt, style_name=None, scene_desc=None, ghost_url=None, ghost_api_key=None):
    """
    FLUX 2 Turbo 이미지를 생성하고 Ghost에 업로드하여 URL 반환.
    
    Args:
        prompt: str — 직접 프롬프트 또는 스타일+장면이 포함된 경우
        style_name: str (선택) — BananaX 스타일 이름 (없으면 기본 flat-illustration)
        scene_desc: str (선택) — 장면 설명
        ghost_url: str (선택) — Ghost URL 재정의
        ghost_api_key: str (선택) — Ghost API Key 재정의
    
    Returns:
        str — Ghost에 업로드된 이미지 URL
    """
    if style_name:
        style = get_style_by_name(style_name)
        no_text = ('ABSOLUTELY NO text, NO letters, NO characters, NO words, NO numbers, '
                   'NO labels, NO captions, NO watermark, NO logo, NO typography. '
                   'No written language of any kind. Pure visual imagery only.')
        if scene_desc:
            prompt = f'{style["desc"]} Scene: {scene_desc}. {prompt}. {no_text}'
        else:
            prompt = f'{style["desc"]} {prompt}. {no_text}'
    else:
        # NO TEXT 보강
        no_text = (' ABOSLUTELY NO text, NO letters, NO characters, NO words, NO watermark, NO logo. Pure visual imagery only.')
        if 'NO text' not in prompt.upper() and 'NO LETTERS' not in prompt.upper():
            prompt += no_text
    
    print(f'  🖼️ FLUX 2 Turbo 생성 중... ({len(prompt)}자 프롬프트)')
    
    img_bytes = call_flux(prompt)
    size_kb = len(img_bytes) / 1024
    print(f'     ✅ FLUX 응답 완료 ({size_kb:.0f}KB)')
    
    ghost_url_result = upload_to_ghost(img_bytes, ghost_url, ghost_api_key)
    print(f'     ✅ Ghost 업로드 완료')
    
    return ghost_url_result

# ─── CLI 테스트 ─────────────────────────

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('사용법: python3 flux_image.py <프롬프트> [스타일명]')
        sys.exit(1)
    
    prompt = sys.argv[1]
    style_name = sys.argv[2] if len(sys.argv) > 2 else None
    
    print('=== FLUX 2 Turbo 이미지 생성 테스트 ===')
    url = generate_flux_image(prompt, style_name=style_name)
    print(f'\n🎯 결과: {url}')
