#!/usr/bin/env node
/**
 * === AI 기사 이미지 생성기 (v2) ===
 * Ghost 기사 내용 → 국가/지역 컨텍스트 추출 → ComfyUI(FLUX) → Ghost 업로드
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// ─── 국가/지역 감지 데이터베이스 ─────────────────────────

const COUNTRY_PATTERNS = [
  { match: /(?:한국|대한민국|서울|경기|경남|경북|전남|전북|충남|충북|강원|제주|부산|인천|대구|대전|울산|광주|수원|고양|용인|성남|안산|경기도교육|서울시교육|북촌초)/i, country: 'South Korea', region: '한국', ethnic: 'Korean', setting: 'Korean classroom' },
  { match: /(?:교육청|교육지원단|학교|교사|학생|초등학교|중학교|고등학교|대학|학부모|수업|교실|울산교육청|경남교육청|경기도교육청)/i, country: 'South Korea', region: '한국', ethnic: 'Korean', setting: 'Korean classroom', score: 0.4 },
  { match: /(?:미국|USA|United States|뉴욕|NYC|뉴욕타임스|실리콘밸리|캘리포니아|LA|시카고|보스턴|워싱턴|하버드|MIT|스탠포드)/i, country: 'USA', region: '미국', ethnic: 'multi-ethnic American', setting: 'American classroom' },
  { match: /(?:일본|Japan|도쿄|Tokyo|오사카|교토|재팬타임스|도쿄대)/i, country: 'Japan', region: '일본', ethnic: 'Japanese', setting: 'Japanese classroom' },
  { match: /(?:중국|China|베이징|상하이|홍콩|광저우|선전)/i, country: 'China', region: '중국', ethnic: 'Chinese', setting: 'Chinese classroom' },
  { match: /(?:인도네시아|Indonesia|자카르타|발리|반둥|수라바야)/i, country: 'Indonesia', region: '인도네시아', ethnic: 'Indonesian', setting: 'Indonesian classroom', score: 2.0 },
  { match: /(?:인도(?!네시아)|India|뭄바이|델리|방갈로르|하이데라바드|SVIS|IIT|타밀나두)/i, country: 'India', region: '인도', ethnic: 'Indian', setting: 'Indian classroom', score: 1.5 },
  { match: /(?:싱가포르|Singapore)/i, country: 'Singapore', region: '싱가포르', ethnic: 'multi-ethnic Southeast Asian', setting: 'Singapore classroom' },
  { match: /(?:영국|UK|United Kingdom|런던|옥스포드|케임브리지|BBC|가디언)/i, country: 'United Kingdom', region: '영국', ethnic: 'British', setting: 'British classroom' },
  { match: /(?:프랑스|France|파리|소르본)/i, country: 'France', region: '프랑스', ethnic: 'French', setting: 'French classroom' },
  { match: /(?:독일|Germany|베를린|뮌헨)/i, country: 'Germany', region: '독일', ethnic: 'German', setting: 'German classroom' },
  { match: /(?:핀란드|Finland|헬싱키|알토|Aalto)/i, country: 'Finland', region: '핀란드', ethnic: 'Finnish', setting: 'Finnish classroom' },
  { match: /(?:에스토니아|Estonia|탈린)/i, country: 'Estonia', region: '에스토니아', ethnic: 'Estonian', setting: 'Estonian classroom' },
  { match: /(?:유럽|Europe|EU|europe)/i, country: 'Europe', region: '유럽', ethnic: 'multi-ethnic European', setting: 'European classroom' },
  { match: /(?:아프리카|Africa|케냐|나이지리아|남아공|가나|에티오피아|르완다)/i, country: 'Africa', region: '아프리카', ethnic: 'African', setting: 'African classroom' },
  { match: /(?:호주|Australia|시드니|멜버른)/i, country: 'Australia', region: '호주', ethnic: 'multi-ethnic Australian', setting: 'Australian classroom' },
  { match: /(?:UAE|아랍에미리트|두바이|아부다비|중동|사우디|Middle East)/i, country: 'Middle East', region: '중동', ethnic: 'Middle Eastern', setting: 'Middle Eastern classroom' },
  { match: /(?:태국|Thailand|방콕)/i, country: 'Thailand', region: '태국', ethnic: 'Thai', setting: 'Thai classroom' },
  { match: /(?:베트남|Vietnam|하노이|호치민)/i, country: 'Vietnam', region: '베트남', ethnic: 'Vietnamese', setting: 'Vietnamese classroom' },
  { match: /(?:원광대|피지컬|울산|경남|전국인력|IT비즈|삼성SDS|아이에스동서)/i, country: 'South Korea', region: '한국', ethnic: 'Korean', setting: 'Korean classroom', score: 0.7 },
  { match: /(?:에듀테크|하이러닝|경기교육)/i, country: 'South Korea', region: '한국', ethnic: 'Korean', setting: 'Korean classroom', score: 0.6 },
  { match: /(?:고등교육|대학|캠퍼스|교수|강의)(?!.*(?:미국|인도|일본|중국|유럽))/i, country: 'South Korea', region: '한국', ethnic: 'Korean', setting: 'Korean university', score: 0.5 },
];

const SSH_HOST = 'axc@axc-macstudio.tailea4ca3.ts.net';

// ─── 국가 컨텍스트 추출 ─────────────────────────

function detectCountryContext(headline, bodyText, tags) {
  const text = [headline || '', bodyText || '', (tags || []).join(' ')].join(' ');
  let bestMatch = null;
  let bestScore = 0;
  for (const p of COUNTRY_PATTERNS) {
    const matches = text.match(p.match);
    if (matches) {
      const score = (p.score || 1.0) * matches.length;
      if (score > bestScore) { bestScore = score; bestMatch = p; }
    }
  }
  return bestMatch || { country: 'Global', region: '글로벌', ethnic: 'multi-ethnic', setting: 'modern classroom' };
}

// ─── 기사 장면 분석 엔진 ─────────────────────────
// headline + bodyText에서 setting, subjects, action, mood를 추출

const SCENE_KEYWORDS = {
  protest: { keywords: /(?:^|[^가-힣a-zA-Z])(?:반발|반대|항의|우려|걱정|불안|회의적|부정적|갈등|딜레마|추방|위기|부작용|protest|concern|opposition|backlash|dilemma|controversy)(?:$|[^가-힣a-zA-Z])/i, setting: 'community meeting or protest gathering', subjects: 'concerned parents and community members voiced objection', action: 'expressing concern and discussing educational technology policy in a community meeting', mood: 'tension and thoughtful concern' },
  partnership: { keywords: /(?:^|[^가-힣a-zA-Z])(?:협력|파트너십|업무협약|MOU|제휴|계약|공동|SDS|오픈AI|동서|전직원|협약|파트너)(?:$|[^가-힣a-zA-Z])/i, setting: 'corporate meeting room or innovation lab', subjects: 'business executives and technology leaders', action: 'signing partnership agreement or shaking hands in a professional business setting', mood: 'professional optimism and collaborative energy' },
  policy: { keywords: /(?:^|[^가-힣a-zA-Z])(?:교육청|교육지원단|출범|정책|정부|지원단|도의회|법안|조례|예산|지원사업|대책|계획|발표|출범식|결의)(?:$|[^가-힣a-zA-Z])/i, setting: 'government office or press conference hall with podium and official backdrop', subjects: 'education officials and policymakers in formal attire', action: 'announcing new education policy at official press conference', mood: 'official, formal, authoritative, forward-looking' },
  research: { keywords: /(?:^|[^가-힣a-zA-Z])(?:연구|분석|예측|논문|실험|데이터|측정|리뷰|가이드라인|교수학습|통계|조사|설문|결과|발견)(?:$|[^가-힣a-zA-Z])/i, setting: 'research laboratory or university study room with computers', subjects: 'researchers and academics analyzing data on monitors', action: 'analyzing data charts and research findings on computer screens with graphs visible', mood: 'focused, analytical, academic' },
  university: { keywords: /(?:^|[^가-힣a-zA-Z])(?:대학생|대학원|캠퍼스|교수|강의|학부|입학|등록금|학점|전공|수강|고등교육|대학들|university|college|campus|professor|lecture)(?:$|[^가-힣a-zA-Z])/i, setting: 'university lecture hall or campus common area', subjects: 'college students and professors in an academic setting', action: 'discussing academic topics in a university environment', mood: 'intellectual curiosity and academic rigor' },
  online: { keywords: /(?:^|[^가-힣a-zA-Z])(?:온라인|원격|비대면|화상|줌|zoom|virtual|remote|online|디지털|플랫폼)(?:$|[^가-힣a-zA-Z])/i, setting: 'home study space with computer screen displaying virtual class', subjects: 'student engaging with online learning platform from home', action: 'participating in virtual class on laptop with AI tutoring interface visible', mood: 'focused independent learning in digital environment' },
  ai_tool: { keywords: /(?:^|[^가-힣a-zA-Z])(?:챗봇|튜터|도구|앱|프로그램|AI 도구|AI 수업|AI 선생님|AI 선생|AI 비서|AI 에이전트|AI 교육)(?:$|[^가-힣a-zA-Z])/i, setting: 'interactive learning space with AI interface on display', subjects: 'student interacting with AI tutoring system on a tablet or laptop', action: 'using AI-powered learning application with visible interface and feedback', mood: 'engaged human-AI interaction' },
  language: { keywords: /(?:^|[^가-힣a-zA-Z])(?:번역|언어|아프리카 언어|통역|다국어|외국어|english|language|translation|linguistics|번역가)(?:$|[^가-힣a-zA-Z])/i, setting: 'language lab or translator workspace with dual monitors showing translated text', subjects: 'language professional or student using AI translation tools', action: 'comparing AI-translated text with original language document on screen', mood: 'focused concentration at intersection of technology and linguistics' },
  coding: { keywords: /(?:^|[^가-힣a-zA-Z])(?:코딩|프로그래밍|개발|소프트웨어|코드|알고리즘|algorithm|code|programming)(?:$|[^가-힣a-zA-Z])/i, setting: 'computer lab or coding workspace with multiple monitors', subjects: 'students writing code on multiple monitors', action: 'collaborating on programming project with AI code assistant', mood: 'creative problem-solving with technology' },
  webtoon: { keywords: /(?:^|[^가-힣a-zA-Z])(?:웹툰|만화|manga|webtoon|comic|cartoon)(?:$|[^가-힣a-zA-Z])/i, setting: 'illustrated graphic novel style storytelling scene', subjects: 'character in a comic-style illustration', action: 'narrative scene from a graphic novel', mood: 'artistic, illustrated, story-driven' },
  future: { keywords: /(?:^|[^가-힣a-zA-Z])(?:미래형|미래교육|미래학교|4차산업|미래기술|transformation|next-gen)(?:$|[^가-힣a-zA-Z])/i, setting: 'futuristic learning environment with holographic displays and advanced technology', subjects: 'forward-looking students and teachers in an innovative space', action: 'exploring next-generation educational technology', mood: 'aspirational and visionary' },
  equity: { keywords: /(?:^|[^가-힣a-zA-Z])(?:격차|불평등|격차해소|디지털격차|소외|포용|다양성|형평|access|equity|divide|inclusion)(?:$|[^가-힣a-zA-Z])/i, setting: 'diverse community learning center bridging digital divide', subjects: 'students from diverse socioeconomic backgrounds learning together', action: 'accessing educational technology regardless of background', mood: 'hopeful determination toward educational equity' },
};

// 국가별 컨텍스트 (약식 — 장면 위에 오버레이)
const COUNTRY_CONTEXT = {
  'South Korea': { ethnic: 'Korean', style: 'Korean educational setting with school uniforms, modern smartboards, and technology-integrated classrooms' },
  'USA': { ethnic: 'multi-ethnic American (African American, Caucasian, Hispanic, Asian American)', style: 'diverse American educational setting with colorful decor and flexible learning spaces' },
  'Japan': { ethnic: 'Japanese', style: 'Japanese educational setting with clean lines and organized learning environment' },
  'India': { ethnic: 'Indian (diverse South Asian skin tones)', style: 'Indian educational setting with vibrant colors and mix of traditional and modern elements' },
  'Indonesia': { ethnic: 'Indonesian (diverse archipelago features)', style: 'tropical Indonesian educational setting with open architecture and batik uniform elements' },
  'Singapore': { ethnic: 'multi-ethnic Southeast Asian (Chinese, Malay, Indian)', style: 'modern high-tech Singapore educational setting' },
  'United Kingdom': { ethnic: 'multi-ethnic British', style: 'UK educational setting with historic architecture and modern technology blend' },
  'Finland': { ethnic: 'Finnish (Northern European)', style: 'Scandinavian minimalist educational setting with natural materials' },
  'Estonia': { ethnic: 'Estonian (Baltic/Northern European)', style: 'Nordic digital society educational setting with advanced e-learning infrastructure' },
  'Africa': { ethnic: 'African (diverse ethnicities)', style: 'warm African educational setting with natural light and vibrant community atmosphere' },
  'Europe': { ethnic: 'multi-ethnic European', style: 'modern continental European educational setting' },
  'Middle East': { ethnic: 'Middle Eastern', style: 'Middle Eastern educational setting with regional architectural elements' },
  'Global': { ethnic: 'multi-ethnic (diverse global representation)', style: 'international educational setting with multicultural elements' },
};

// ─── 기사 기반 장면 분석 ─────────────────────────

function analyzeScene(headline, bodyText, tags) {
  const text = [headline || '', bodyText || '', (tags || []).join(' ')].join(' ');

  let bestScene = null;
  let bestScore = 0;

  for (const [sceneName, sceneData] of Object.entries(SCENE_KEYWORDS)) {
    const matches = text.match(sceneData.keywords);
    if (matches) {
      // 중복 제거해서 unique keyword count
      const unique = new Set(matches.map(m => m.toLowerCase()));
      const score = unique.size * 2;
      if (score > bestScore) {
        bestScore = score;
        bestScene = { name: sceneName, ...sceneData, matchedKeywords: [...unique].slice(0, 5) };
      }
    }
  }

  return bestScene || null;
}

// ─── AI 프롬프트 생성 (v4 — 🍌 BananaX Style Palette) ─────────
//
// 핵심 설계:
// 1. 22가지 다양한 시각 스타일 (BananaX 인포그래픽 참고)
// 2. headline + 첫 번째 본문 문단 → 프롬프트에 직접 주입
// 3. 태그 기반 장면 분석 유지
// 4. hash(title)로 결정론적 스타일 선택 → 같은 기사면 항상 같은 스타일
// 5. FLUX.1-schnell 최적화: 짧고 직접적인 프롬프트 (100-200자)

// 22가지 시각 스타일 (BananaX-inspired, seed by hash(headline) % STYLE_PALETTE.length)
// 각 스타일 = { name, desc }: 시각적 기법 + 무드 + 컬러팔레트
const STYLE_PALETTE = [
  // 0: Flat Illustration / Corporate
  { name: 'flat-illustration', desc: 'Vector flat illustration style, solid colors, geometric shapes, bold composition, professional corporate graphic design, no gradients.' },
  // 1: Isometric / Data Viz
  { name: 'isometric', desc: 'Isometric 3D perspective design, colorful geometric blocks, data visualization elements, clean angled lines, infographic aesthetic.' },
  // 2: Watercolor / Vintage
  { name: 'watercolor', desc: 'Soft watercolor painting style, translucent washes, gentle color blending, textured paper feel, impressionistic artistic quality.' },
  // 3: Blueprint / Technical
  { name: 'blueprint', desc: 'Technical blueprint / cyanotype style, white line drawings on deep blue background, architectural drafting, grid lines, engineering precision.' },
  // 4: Manga / Screen Tone
  { name: 'manga', desc: 'Japanese manga comic style, screentone textures, expressive black-and-white line art, comic panel composition, dynamic angles.' },
  // 5: Collage / Paper
  { name: 'collage', desc: 'Mixed-media paper collage, cut-out elements from magazines, layered textures, vintage print clippings, tactile analog composition.' },
  // 6: Knolling / Flat Lay
  { name: 'knolling', desc: 'Knolling photography style, birdseye top-down flat lay, neatly arranged objects at right angles, organized aesthetic, clean product photography.' },
  // 7: Chalkboard / Hand-drawn
  { name: 'chalkboard', desc: 'Chalk drawing on dark chalkboard, hand-drawn white pastel strokes, educational rustic texture, cafe chalk art style.' },
  // 8: Pixel Art / 8-bit
  { name: 'pixel-art', desc: 'Retro 8-bit pixel art style, blocky square pixels, limited NES-era color palette, nostalgic video game aesthetic.' },
  // 9: Doodle / Notebook
  { name: 'doodle', desc: 'Playful hand-drawn doodle style, casual sketch on lined notebook paper, simple whimsical line art, cute illustration.' },
  // 10: Paper Cutout / Shadow Box
  { name: 'paper-cutout', desc: 'Layered paper cutout craft style, dimensional depth, soft cast shadows, pastel colors, handmade tactile aesthetic.' },
  // 11: Glassmorphism / Frosted
  { name: 'glassmorphism', desc: 'Glassmorphism UI aesthetic, frosted glass effect with blur, transparency layers, soft gradients, modern sleek digital look.' },
  // 12: Low Poly / Faceted
  { name: 'low-poly', desc: 'Low poly 3D rendering style, faceted geometric surfaces, angular vertex-based shapes, modern game art aesthetic.' },
  // 13: Bauhaus / Geometric
  { name: 'bauhaus', desc: 'Bauhaus design style, bold geometric shapes, primary red-yellow-blue palette, clean constructivist lines, 1920s modernism.' },
  // 14: Swiss Style / Grid
  { name: 'swiss-style', desc: 'Swiss International typographic style, strict modular grid, sans-serif type composition, clean systematic modern layout.' },
  // 15: Art Deco / Gold
  { name: 'art-deco', desc: 'Art Deco luxury style, geometric ornamental patterns, gold foil metallic accents, rich jewel tones, symmetrical elegant composition.' },
  // 16: Ukiyo-e / Woodblock
  { name: 'ukiyo-e', desc: 'Ukiyo-e Japanese woodblock print style, flat colors with bold black outlines, traditional Hokusai-inspired composition, nature motifs.' },
  // 17: Retro Anime / Cel Shading
  { name: 'retro-anime', desc: 'Retro 80s-90s anime cel shading style, warm VHS-toned palette, soft glow, nostalgic Japanese animation aesthetic.' },
  // 18: Cyberpunk / Neon
  { name: 'cyberpunk', desc: 'Cyberpunk futuristic aesthetic, neon lights against dark backgrounds, blue-purple color palette, holographic tech noir elements.' },
  // 19: Risograph / Offset Print
  { name: 'risograph', desc: 'Risograph duplicator print style, neon spot colors, offset misregistration effects, gritty ink texture, zine aesthetic.' },
  // 20: Neumorphism / Soft UI
  { name: 'neumorphism', desc: 'Neumorphic soft UI design, raised and inset elements with subtle shadows, monochromatic light palette, clean minimal depth.' },
  // 21: Editorial / Documentary
  { name: 'editorial-doc', desc: 'Professional editorial documentary photography, natural authentic lighting, candid human moments, high resolution, journalistic quality.' },
];

// 스타일 선택 (hash(headline) 기반 결정론적)
function selectStyle(headline) {
  let hash = 0;
  for (let i = 0; i < (headline || '').length; i++) {
    const char = headline.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const idx = Math.abs(hash) % STYLE_PALETTE.length;
  return STYLE_PALETTE[idx];
}

// 첫 번째 본문 문단 추출 (blockquote/푸터 제외)
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
  // 첫 번째 문단 추출
  const firstPara = extractFirstParagraph(bodyText);
  const countryCtx = COUNTRY_CONTEXT[context.country] || COUNTRY_CONTEXT['Global'];
  
  // 태그 기반 장면 분석
  const scene = analyzeScene(headline, firstPara || bodyText || '', tags);
  
  // 결정론적 스타일 선택
  const style = selectStyle(headline);
  
  // 헤드라인 키워드 추출 (한글+영문)
  const keywords = (headline || '')
    .replace(/[^가-힣a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length >= 2)
    .slice(0, 5)
    .join(', ');
  
  // 장면 설정
  const sceneDesc = scene
    ? `${scene.setting} in ${context.region}. ${scene.subjects}. ${scene.action}. ${scene.mood}.`
    : `Educational setting in ${context.region}, ${context.country}. ${countryCtx.style}.`;
  
  // 📌 FLUX 최적화: 하나의 응집된 문단으로 구성 (150-250자)
  // 형식: [스타일] [장면] [국가/민족] [기사내용] [제약조건]
  const prompt = [
    `${style.desc}`,                              // 스타일 설명 (다양함)
    `Scene: ${sceneDesc}`,                         // 장면 + 국가
    `People: Authentic ${countryCtx.ethnic}.`,     // 인종
    `Topic: ${keywords}.`,                         // 기사 키워드
    firstPara ? `Content: ${firstPara.substring(0, 200)}.` : '',  // 기사 첫 문단
    `NO text, NO letters, NO words, NO watermark, NO logo.`,       // 제약조건
  ].filter(Boolean).join(' ');
  
  return prompt;
}

// ─── ComfyUI 이미지 생성 (SSH) ─────────────────────────

function generateImage(prompt, mode = 'news') {
  const timeout = mode === 'news' ? 300000 : 600000; // 5분 / 10분
  const promptFile = `/tmp/comfy-in-${Date.now()}.txt`;

  // Write prompt to file as base64 to avoid shell quoting issues
  fs.writeFileSync(promptFile + '.b64', Buffer.from(prompt, 'utf8').toString('base64'), 'utf8');

  // 1. Copy base64 prompt to Mac Studio and decode there
  execSync(`scp "${promptFile}.b64" ${SSH_HOST}:/tmp/comfy-prompt.b64`, { timeout: 10000 });

  // 2. On Mac Studio: decode prompt, then run v2 script (reads from file)
  const cmd = `ssh ${SSH_HOST} "python3 -c 'import base64,sys; sys.stdout.write(base64.b64decode(sys.stdin.read()).decode())' < /tmp/comfy-prompt.b64 > /tmp/comfy-prompt-in.txt && bash /tmp/comfyui-gen-v2.sh '${mode}' /tmp/comfy-prompt-in.txt" 2>&1`;

  try {
    const output = execSync(cmd, { timeout, shell: '/bin/bash', maxBuffer: 2 * 1024 * 1024 }).toString().trim();
    const lines = output.split('\n').map(l => l.trim()).filter(Boolean);
    const genPath = lines.find(l => l.startsWith('/tmp/ai-'));
    
    if (genPath) {
      const localPath = `/tmp/ai-final-${Date.now()}.png`;
      execSync(`scp ${SSH_HOST}:"${genPath}" "${localPath}"`, { timeout: 30000 });
      
      if (fs.existsSync(localPath) && fs.statSync(localPath).size > 5000) {
        try { fs.unlinkSync(promptFile + '.b64'); } catch(e) {}
        return localPath;
      }
    }
    
    // Fallback: check output directory for newest file
    const checkCmd = `ssh ${SSH_HOST} "ls -t /Users/axc/ComfyUI/output/ComfyUI-news-*.png 2>/dev/null | head -1"`;
    const latest = execSync(checkCmd, { timeout: 10000 }).toString().trim();
    if (latest) {
      const localPath = `/tmp/ai-fallback-${Date.now()}.png`;
      execSync(`scp ${SSH_HOST}:"${latest}" "${localPath}"`, { timeout: 30000 });
      if (fs.existsSync(localPath) && fs.statSync(localPath).size > 5000) {
        try { fs.unlinkSync(promptFile + '.b64'); } catch(e) {}
        return localPath;
      }
    }
    
    throw new Error(`No image found. Output: ${output.substring(0, 300)}`);
  } catch (err) {
    if (err.message.includes('ETIMEDOUT') || err.message.includes('Command timed out')) {
      throw new Error(`Generation timeout (${timeout/1000}s)`);
    }
    throw err;
  } finally {
    try { fs.unlinkSync(promptFile + '.b64'); } catch(e) {}
  }
}

// ─── Ghost 이미지 업로드 ─────────────────────────

function getGhostToken() {
  const crypto = require('crypto');
  const env = fs.readFileSync('/root/.openclaw/workspace/newsroom/.env', 'utf8');
  const match = env.match(/GHOST_ADMIN_API_KEY=(\S+)/);
  if (!match) throw new Error('GHOST_ADMIN_API_KEY not found');
  const [id, secret] = match[1].trim().split(':');
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
  const filename = `ai-article-${Date.now()}${ext}`;

  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
    imgData,
    `\r\n--${boundary}--\r\n`
  ];

  const totalLen = Buffer.byteLength(Buffer.concat([
    Buffer.from(parts[0]), Buffer.from(parts[1]), Buffer.from(parts[2])
  ]));

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'newsroom.ubion.global',
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
    req.write(Buffer.from(parts[0]));
    req.write(Buffer.from(parts[1]));
    req.write(Buffer.from(parts[2]));
    req.end();
  });
}

// ─── 메인 함수 ─────────────────────────

async function generateImageForArticle({ headline, bodyHtml, tags, mode = 'news' }) {
  console.log(`[ImageGen] ===== ${headline} =====`);
  console.log(`[ImageGen] Analyzing country context...`);

  const context = detectCountryContext(headline, bodyHtml, tags);
  console.log(`[ImageGen] Country: ${context.country} (${context.region}) → Ethnicity: ${context.ethnic}`);

  const prompt = buildPrompt(headline, bodyHtml, tags, context);
  console.log(`[ImageGen] Prompt (${prompt.length} chars): ${prompt.substring(0, 200)}...`);

  console.log(`[ImageGen] Generating image via ComfyUI (mode: ${mode})...`);
  const startTime = Date.now();
  const imagePath = generateImage(prompt, mode);
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const sizeKB = Math.round(fs.statSync(imagePath).size / 1024);
  console.log(`[ImageGen] ✅ Generated in ${elapsed}s (${sizeKB}KB): ${imagePath}`);

  console.log(`[ImageGen] Uploading to Ghost...`);
  const ghostUrl = await uploadToGhost(imagePath);
  console.log(`[ImageGen] ✅ Ghost URL: ${ghostUrl}`);

  try { fs.unlinkSync(imagePath); } catch(e) {}
  return { url: ghostUrl, context };
}

// ─── CLI ─────────────────────────

if (require.main === module) {
  const headline = process.argv[2];
  const bodyText = process.argv[3] || '';
  const tags = (process.argv[4] || '').split(',').filter(Boolean);
  const mode = process.argv[5] || 'news';

  if (!headline) {
    console.error('Usage: node generate-article-image.js <headline> [bodyText] [tags] [mode=news|manga|shorts]');
    process.exit(1);
  }

  generateImageForArticle({ headline, bodyHtml: bodyText, tags, mode })
    .then(({ url, context }) => {
      console.log(`\n🎯 ${headline}`);
      console.log(`   Country: ${context.country} (${context.region})`);
      console.log(`   Image: ${url}`);
    })
    .catch(err => {
      console.error(`\n❌ ${err.message}`);
      process.exit(1);
    });
}

module.exports = { generateImageForArticle, detectCountryContext, buildPrompt, analyzeScene };
