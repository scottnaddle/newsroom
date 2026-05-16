#!/usr/bin/env node
/**
 * === 개발 서버용 AI 기사 이미지 생성기 (v5.1 — FLUX + BananaX + 문자억제) ===
 * FLUX 2 Dev (FAL AI) → 개발 Ghost 서버 업로드
 * BananaX 301 스타일 팔레트 (hash 결정론적 선택)
 * 문자 생성 엄격 금지
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// ─── 환경변수 ─────────────────────────

const ENV_PATH = '/root/newsroom-analysis/newsroom/.env.dev';
function loadEnv(key) {
  if (process.env[key]) return process.env[key];
  if (!fs.existsSync(ENV_PATH)) return null;
  const env = fs.readFileSync(ENV_PATH, 'utf8');
  const m = env.match(new RegExp(key + '=(.+)'));
  return m ? m[1].trim() : null;
}

const FAL_KEY = loadEnv('FAL_KEY');
const GHOST_URL = loadEnv('GHOST_URL') || 'http://167.86.72.98:2380';
const GHOST_ADMIN_API = loadEnv('GHOST_ADMIN_API_KEY');

if (!FAL_KEY) { console.error('❌ FAL_KEY not found in .env.dev'); process.exit(1); }
if (!GHOST_ADMIN_API) { console.error('❌ GHOST_ADMIN_API_KEY not found in .env.dev'); process.exit(1); }

// ─── 국가/지역 감지 ─────────────────────────

const COUNTRY_PATTERNS = [
  { match: /(?:한국|대한민국|서울|경기|경남|경북|전남|전북|충남|충북|강원|제주|부산|인천|대구|대전|울산|광주|수원|고양|용인|성남|안산|경기도교육|서울시교육|북촌초)/i, country: 'South Korea', region: '한국', ethnic: 'Korean', setting: 'Korean classroom' },
  { match: /(?:교육청|교육지원단|학교|교사|학생|초등교육|중등교육|고등교육|대학|학부모|수업|교실)/i, country: 'South Korea', region: '한국', ethnic: 'Korean', setting: 'Korean classroom', score: 0.4 },
  { match: /(?:미국|USA|U\.S\.|United States|뉴욕|NYC|실리콘밸리|캘리포니아|LA|하버드|MIT|스탠포드|워싱턴주|플로리다|플래글러|에드서킷|EdCircuit)/i, country: 'USA', region: '미국', ethnic: 'multi-ethnic American', setting: 'American classroom' },
  { match: /(?:일본|Japan|도쿄|Tokyo)/i, country: 'Japan', region: '일본', ethnic: 'Japanese', setting: 'Japanese classroom' },
  { match: /(?:중국|China|베이징|상하이)/i, country: 'China', region: '중국', ethnic: 'Chinese', setting: 'Chinese classroom' },
  { match: /(?:인도네시아|Indonesia)/i, country: 'Indonesia', region: '인도네시아', ethnic: 'Indonesian', setting: 'Indonesian classroom', score: 2.0 },
  { match: /(?:인도(?!네시아)|India|뭄바이|델리)/i, country: 'India', region: '인도', ethnic: 'Indian', setting: 'Indian classroom', score: 1.5 },
  { match: /(?:싱가포르|Singapore)/i, country: 'Singapore', region: '싱가포르', ethnic: 'multi-ethnic Southeast Asian', setting: 'Singapore classroom' },
  { match: /(?:영국|UK|United Kingdom|런던|옥스포드|케임브리지|영국학교|Rob Williams)/i, country: 'United Kingdom', region: '영국', ethnic: 'British', setting: 'British classroom' },
  { match: /(?:아프리카|Africa|케냐|나이지리아|남아공|가나)/i, country: 'Africa', region: '아프리카', ethnic: 'African', setting: 'African classroom' },
  { match: /(?:에듀테크|하이러닝|경기교육)/i, country: 'South Korea', region: '한국', ethnic: 'Korean', setting: 'Korean classroom', score: 0.6 },
  { match: /(?:^|[^가-힣])美(?=[가-힣\s])/i, country: 'USA', region: '미국', ethnic: 'multi-ethnic American', setting: 'American classroom', score: 3.0 },
  { match: /(?:^|[^가-힣])日(?=[가-힣\s])/i, country: 'Japan', region: '일본', ethnic: 'Japanese', setting: 'Japanese classroom', score: 3.0 },
  { match: /(?:^|[^가-힣])英(?=[가-힣\s])/i, country: 'United Kingdom', region: '영국', ethnic: 'British', setting: 'British classroom', score: 3.0 },
];

const COUNTRY_CONTEXT = {
  'South Korea': { ethnic: 'Korean', style: 'Korean educational setting with school uniforms, modern smartboards.' },
  'USA': { ethnic: 'multi-ethnic American (diverse representation)', style: 'diverse American educational setting with flexible learning spaces.' },
  'United Kingdom': { ethnic: 'multi-ethnic British', style: 'UK educational setting with historic architecture and modern technology blend.' },
  'Africa': { ethnic: 'African (diverse ethnicities)', style: 'warm African educational setting with natural light.' },
  'Global': { ethnic: 'multi-ethnic (diverse global representation)', style: 'international educational setting with multicultural elements.' },
};

// ─── 🍌 BananaX 22가지 스타일 (v5.1 문자억제) ─────────

const STYLE_PALETTE = [
  { name: 'flat-illustration', desc: 'Flat vector illustration style. Clean solid colors, geometric shapes, bold composition. No gradients, no textures. Professional corporate graphic design aesthetic. Digital art with precise vector edges.' },
  { name: 'isometric', desc: 'Isometric 3D perspective design. Colorful geometric blocks at 30-degree angles. Data visualization elements floating in space. Clean angled lines, infographic aesthetic with bright accent colors.' },
  { name: 'watercolor', desc: 'Soft watercolor painting style. Translucent color washes with gentle bleeding. Textured paper feel visible through paint layers. Impressionistic quality, soft edges, dreamy atmospheric mood.' },
  { name: 'blueprint', desc: 'Technical blueprint cyanotype style. White outline drawings on deep navy blue background. Purely visual, abstract architectural lines, grid patterns. Engineering precision, schematic layout without any labels or notations.' },
  { name: 'manga', desc: 'Japanese manga comic art style. Black and white with screentone textures. Expressive line art, comic panel composition, dramatic angles. Dynamic action lines, bold ink strokes.' },
  { name: 'collage', desc: 'Mixed-media paper collage aesthetic. Cut-out elements from textured papers, layered composition. Hand-torn edges, subtle shadows between layers. Tactile analog composition without printed text.' },
  { name: 'knolling', desc: 'Knolling flat lay photography. Birdseye top-down view, neatly arranged objects at right angles. Clean organized product photography aesthetic. Balanced minimalist arrangement on flat surface.' },
  { name: 'chalkboard', desc: 'Chalk drawing on dark chalkboard surface. Hand-drawn white and colored pastel strokes. Slightly dusty textured look. Educational vintage feel with abstract diagrams only, no letters or characters.' },
  { name: 'pixel-art', desc: 'Retro 8-bit pixel art style. Blocky square pixels, limited color palette. NES-era video game aesthetic. Crisp pixel edges, chunky sprite proportions. Purely visual game art without interface elements.' },
  { name: 'doodle', desc: 'Playful hand-drawn doodle style. Casual sketch on light background with subtle texture. Simple whimsical line art, cute illustration with rounded shapes. Messenger sticker feel.' },
  { name: 'paper-cutout', desc: 'Layered paper cutout craft style. Dimensional depth with soft cast shadows between layers. Pastel color palette. Handmade tactile craft aesthetic with subtle paper texture.' },
  { name: 'glassmorphism', desc: 'Glassmorphism UI aesthetic. Frosted glass panels with backdrop blur. Transparency layers with subtle gradients. Modern sleek digital look, clean flat geometric background elements.' },
  { name: 'low-poly', desc: 'Low poly 3D rendering style. Faceted geometric triangulated surfaces. Angular vertex-based poly shapes. Modern game art aesthetic with visible polygon mesh patterns.' },
  { name: 'bauhaus', desc: 'Bauhaus design movement style. Bold geometric shapes (circles, squares, triangles). Primary red-yellow-blue color palette. Clean constructivist lines, 1920s modernist composition. Pure abstract geometry.' },
  { name: 'swiss-style', desc: 'Swiss International design style. Strict modular grid layout. Clean asymmetrical balance. Red and black on white. Systematic modern graphic design using pure geometric blocks and shapes.' },
  { name: 'art-deco', desc: 'Art Deco luxury geometric style. Ornamental repeating patterns, gold foil metallic accents. Rich jewel tones (emerald, ruby, sapphire). Symmetrical elegant composition, 1920s glamour.' },
  { name: 'ukiyo-e', desc: 'Ukiyo-e Japanese woodblock print style. Flat colored areas with bold black ink outlines. Traditional composition inspired by Hokusai. Nature motifs, stylized waves and clouds.' },
  { name: 'retro-anime', desc: 'Retro 1980s-90s anime cel shading style. Warm VHS-toned color palette. Soft glow and halation effects. Nostalgic Japanese hand-drawn animation aesthetic.' },
  { name: 'cyberpunk', desc: 'Cyberpunk futuristic city aesthetic. Neon magenta and cyan lights against dark night atmosphere. Holographic projections, tech noir elements. Rain-slicked streets, urban technology.' },
  { name: 'risograph', desc: 'Risograph duplicator print style. Bright neon spot colors (fluorescent pink, orange, green). Offset registration misalignment effects. Gritty ink texture, poster aesthetic with abstract shapes.' },
  { name: 'neumorphism', desc: 'Neumorphic soft UI design. Raised and inset rounded elements with subtle shadows. Monochromatic light cream palette. Clean minimal depth, soft ambient lighting.' },
  { name: 'editorial-doc', desc: 'Professional editorial documentary photography style. Natural authentic lighting, candid human moments caught in action. High resolution, shallow depth of field. Photojournalistic quality composition.' },
];

function selectStyle(headline) {
  let hash = 0;
  for (let i = 0; i < (headline || '').length; i++) {
    const char = headline.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return STYLE_PALETTE[Math.abs(hash) % STYLE_PALETTE.length];
}

function detectCountryContext(headline, bodyText, tags) {
  const text = [headline || '', bodyText || '', (tags || []).join(' ')].join(' ');
  let bestMatch = null, bestScore = 0;
  for (const p of COUNTRY_PATTERNS) {
    const matches = text.match(p.match);
    if (matches) {
      const score = (p.score || 1.0) * matches.length;
      if (score > bestScore) { bestScore = score; bestMatch = p; }
    }
  }
  return bestMatch || { country: 'Global', region: '글로벌', ethnic: 'multi-ethnic', setting: 'modern educational space' };
}

function extractFirstParagraph(bodyText) {
  if (!bodyText) return '';
  const noBlockquote = bodyText.replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '');
  const clean = noBlockquote.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  const paras = clean.split(/[.!?\n]/).filter(s => {
    const t = s.trim();
    return t.length > 20 && !/^(📖|본 기사|원문 보기|AI|기사는)/.test(t);
  });
  return (paras[0] || clean.substring(0, 200)).trim();
}

function buildPrompt(headline, bodyText, tags, context) {
  const firstPara = extractFirstParagraph(bodyText);
  const countryCtx = COUNTRY_CONTEXT[context.country] || COUNTRY_CONTEXT['Global'];
  const style = selectStyle(headline);

  const keywords = (headline || '')
    .replace(/[^가-힣a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
    .split(/\s+/).filter(w => w.length >= 2).slice(0, 5).join(', ');

  const noTextRule = 'ABSOLUTELY NO text, NO letters, NO characters, NO words, NO numbers, NO labels, NO captions, NO watermark, NO logo, NO typography. No Korean or English or any language letters anywhere. Pure visual imagery only. No written language of any kind.';

  return [
    `${style.desc}`,
    `Scene: ${countryCtx.style} The setting reflects educational innovation and technology integration.`,
    `People: ${countryCtx.ethnic}, engaged in modern learning activities.`,
    `Topic: ${keywords}. ${firstPara ? firstPara.substring(0, 250) : ''}`,
    noTextRule,
  ].filter(Boolean).join(' ');
}

// ─── FAL AI FLUX API ─────────────────────────

function callFlux(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      prompt,
      image_size: 'landscape_4_3',
      num_inference_steps: 28,
      guidance_scale: 3.5,
      sync_mode: true,
      enable_safety_checker: false,
      output_format: 'png',
      seed: Math.floor(Math.random() * 2147483647),
    });

    const req = https.request({
      hostname: 'fal.run',
      path: '/fal-ai/flux/dev',
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error || parsed.detail) return reject(new Error(`FAL 오류: ${parsed.error?.message || parsed.detail}`));
          if (!parsed.images || !parsed.images[0]) return reject(new Error('응답에 images 필드 없음'));
          resolve(parsed);
        } catch(e) { reject(new Error(`JSON 파싱 오류: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function saveImageFromResult(result) {
  const imgUrl = result.images[0].url;
  if (!imgUrl || !imgUrl.startsWith('data:')) throw new Error('Not data URI: ' + (imgUrl || 'undefined'));
  const match = imgUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
  if (!match) throw new Error('data: URI parse fail');
  const ext = match[1] === 'png' ? '.png' : '.jpg';
  const localPath = `/tmp/flux-dev-article-${Date.now()}${ext}`;
  fs.writeFileSync(localPath, Buffer.from(match[2], 'base64'));
  if (fs.statSync(localPath).size > 1000) return localPath;
  throw new Error('Too small');
}

// ─── Ghost 업로드 ─────────────────────────

function getGhostToken() {
  const [id, secret] = GHOST_ADMIN_API.split(':');
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:id})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:n,exp:n+300,aud:'/admin/'})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
}

function uploadToGhost(imagePath) {
  const token = getGhostToken();
  const boundary = '----Boundary' + Math.random().toString(36).slice(2);
  const imgData = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase() || '.png';
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const filename = `flux-article-${Date.now()}${ext}`;

  const parts = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`),
    imgData,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ];
  const totalLen = parts.reduce((a, b) => a + b.length, 0);

  return new Promise((resolve, reject) => {
    const urlObj = new URL(GHOST_URL);
    const hostname = urlObj.hostname;
    const port = parseInt(urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80'));
    const mod = urlObj.protocol === 'https:' ? https : http;

    const req = mod.request({
      hostname, port,
      path: '/ghost/api/admin/images/upload/',
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalLen
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const d = JSON.parse(body);
          if (d.images && d.images[0] && d.images[0].url) resolve(d.images[0].url);
          else reject(new Error(`Upload failed: ${body.substring(0, 200)}`));
        } catch(e) { reject(new Error(`Parse error: ${body.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    for (const p of parts) req.write(p);
    req.end();
  });
}

// ─── 메인 ─────────────────────────

async function generateImageForArticle({ headline, bodyHtml, tags, mode = 'news' }) {
  console.log(`\n[FLUX-Dev] ========== ${headline}`);
  const context = detectCountryContext(headline, bodyHtml, tags);
  const style = selectStyle(headline);
  console.log(`[FLUX-Dev] Country: ${context.country} | Style: ${style.name}`);

  const prompt = buildPrompt(headline, bodyHtml, tags, context);
  console.log(`[FLUX-Dev] Prompt (${prompt.length}자)`);

  const startTime = Date.now();
  const result = await callFlux(prompt);
  const apiTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`[FLUX-Dev] ✅ 응답 (${apiTime}s, seed: ${result.seed})`);

  const imagePath = saveImageFromResult(result);
  const sizeKB = Math.round(fs.statSync(imagePath).size / 1024);

  const ghostUrl = await uploadToGhost(imagePath);
  console.log(`[FLUX-Dev] ✅ 업로드 완료 (${sizeKB}KB)`);
  console.log(`[FLUX-Dev] 📍 ${ghostUrl}`);

  try { fs.unlinkSync(imagePath); } catch(e) {}
  return { url: ghostUrl, context, style: style.name, seed: result.seed };
}

// ─── CLI ─────────────────────────

if (require.main === module) {
  const headline = process.argv[2];
  const bodyText = process.argv[3] || '';
  const tags = (process.argv[4] || '').split(',').filter(Boolean);
  if (!headline) { console.error('Usage: node generate-article-image-dev.js <headline> [bodyText] [tags]'); process.exit(1); }
  generateImageForArticle({ headline, bodyHtml: bodyText, tags })
    .then(r => console.log(`\n🎯 ${headline}\n   Style: ${r.style}\n   Image: ${r.url}`))
    .catch(err => { console.error(`\n❌ ${err.message}`); process.exit(1); });
}

module.exports = { generateImageForArticle };
