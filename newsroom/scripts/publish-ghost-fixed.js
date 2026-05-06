const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');

const env = fs.readFileSync('/root/.openclaw/workspace/newsroom/.env', 'utf8');
const apiKey = env.match(/GHOST_ADMIN_API_KEY=(.+)/)[1].trim();
const ghostUrl = new URL(env.match(/GHOST_URL=(.+)/)[1].trim());
const [id, secret] = apiKey.split(':');

const CACHE_DIR = '/root/.openclaw/workspace/newsroom/.imgcache';
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// ★ AI 이미지 생성 시드 추적 (동일 프롬프트 → 다른 이미지)
const USED_PROMPT_SEEDS = new Set();

// 폴백 이미지 풀 (AI 생성 실패 시)
const FALLBACK = [
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
];

// ★ AI 이미지 프롬프트 생성 (헤드라인 + 태그 기반)
const STYLES = [
  'digital art style, vibrant colors, professional lighting',
  'modern illustration style, clean lines, soft gradients',
  'cinematic photography style, warm tones, shallow depth of field',
  'concept art style, dramatic lighting, detailed environment',
  'studio photography style, well-composed, editorial quality',
  'isometric illustration style, flat design, pastel colors',
  'watercolor illustration style, artistic, textured paper feel',
];

const SCENES = {
  default: 'educational technology concept, people collaborating',
  ai: 'artificial intelligence concept, glowing neural network, data streams',
  edu: 'classroom setting, students learning, books and digital devices',
  tech: 'modern technology, computers, digital interface, futuristic',
  research: 'scientific research, laboratory, data analysis, papers',
  school: 'school building, campus, students walking, academic atmosphere',
  robot: 'robot interacting with humans, futuristic technology',
  language: 'translation concept, communication between cultures, speech bubbles',
  digital: 'digital transformation, glowing screens, data visualization',
  crisis: 'challenge and problem solving, analytical thinking',
  future: 'futuristic cityscape, innovation, forward-looking concept',
  global: 'international education collaboration, diverse students learning together, multicultural classroom',
};

function buildPrompt(headline, tags) {
  const text = headline || '';
  const tagList = (tags || []).map(t => typeof t === 'string' ? t : (t.name || ''));
  
  // 태그 기반 씬 선택
  let scene = SCENES.default;
  if (tagList.some(t => /ai|인공지능/i.test(t))) scene = SCENES.ai;
  if (tagList.some(t => /edu|교육|학습/i.test(t))) scene = SCENES.edu;
  if (tagList.some(t => /tech|기술|디지털|에듀테크/i.test(t))) scene = SCENES.tech;
  if (tagList.some(t => /paper|논문|연구|research/i.test(t))) scene = SCENES.research;
  if (tagList.some(t => /school|학교|교실/i.test(t))) scene = SCENES.school;
  if (tagList.some(t => /robot|로봇/i.test(t))) scene = SCENES.robot;
  if (tagList.some(t => /언어|language|자연어/i.test(t))) scene = SCENES.language;
  if (tagList.some(t => /digital|디지털/i.test(t))) scene = SCENES.digital;
  if (tagList.some(t => /위기|crisis/i.test(t))) scene = SCENES.crisis;
  if (tagList.some(t => /미래|future/i.test(t))) scene = SCENES.future;
  if (tagList.some(t => /글로벌|global|해외|국제/i.test(t))) scene = SCENES.global;
  
  // 헤드라인 키워드 기반 씬 (더 세부적으로)
  if (text.includes('격차') || text.includes('불평등') || text.includes('디지털 격차')) scene = SCENES.crisis;
  if (text.includes('도입') || text.includes('시작') || text.includes('출범')) scene = SCENES.future;
  if (text.includes('번역') || text.includes('언어')) scene = SCENES.language;
  if (text.includes('로봇') || text.includes('AI')) scene = SCENES.ai;

  // 랜덤 스타일
  const style = STYLES[Math.floor(Math.random() * STYLES.length)];
  
  // 헤드라인의 영어 단어 추출
  const enWords = (text.match(/[a-zA-Z]{3,}/g) || []).slice(0, 5).join(', ') || '';
  
  let prompt = `${scene}, ${style}`;
  if (enWords) prompt += `, theme: ${enWords}`;
  prompt += `, high quality, 16:9 aspect ratio, no text, no logos`;
  
  return prompt;
}

function generateJWT() {
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:id})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:n,exp:n+300,aud:'/admin/'})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
}

function ghostReq(method, path, body) {
  return new Promise((resolve) => {
    const j = generateJWT();
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { hostname: ghostUrl.hostname, path, method, headers: { 'Authorization': 'Ghost '+j, 'Content-Type': 'application/json; charset=utf-8', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    });
    req.on('error', () => resolve({}));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ★ AI 이미지 생성 (ComfyUI FLUX.1-schnell on Mac Studio) → Ghost 업로드
// Uses pre-generated images from pregen-article-images.py cache, falls back to Unsplash
async function generateAIImage(headline, tags, label) {
  // Check pre-generated cache first
  const cacheFile = '/root/.openclaw/workspace/newsroom/.imgcache/pending.json';
  try {
    if (fs.existsSync(cacheFile)) {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cache[headline]) {
        const url = cache[headline];
        console.log(`     💾 캐시된 이미지 사용: ${url.substring(0, 60)}...`);
        return url;
      }
    }
  } catch(e) {
    // ignore cache errors
  }

  // No cache — try direct generation via Python wrapper
  const prompt = buildPrompt(headline, tags);
  console.log(`     🤖 ComfyUI 이미지 생성 중: "${prompt.substring(0, 60)}..."`);

  try {
    const remotePath = await new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      const cmd = `/tmp/gen-ghost-image.py ${JSON.stringify(prompt)}`;
      exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
        if (err) reject(err);
        else resolve(stdout.trim());
      });
    });

    if (remotePath && remotePath.startsWith('https://')) {
      console.log(`     ✅ Ghost 업로드 완료: ${remotePath.substring(0, 60)}...`);
      return remotePath;
    }
  } catch(e) {
    console.log(`     ⚠️ ComfyUI 이미지 생성 오류: ${e.message.substring(0, 100)}`);
  }

  // Ultimate fallback to Unsplash
  return null;
}

// ★ Ghost 게시글 제목 중복 체크
async function loadGhostTitles() {
  let all = [];
  let page = 1;
  while (true) {
    const res = await ghostReq('GET', `/ghost/api/admin/posts/?limit=200&page=${page}&fields=title,slug,published_at`);
    if (!res.posts || !res.posts.length) break;
    all = all.concat(res.posts.map(p => ({ title: p.title, slug: p.slug, date: (p.published_at || '').slice(0,10) })));
    page++;
  }
  return all;
}

function isDuplicateTitle(newTitle, existingPosts) {
  const clean = s => s.replace(/[^가-힣a-zA-Z0-9 ]/g, '').toLowerCase().trim();
  const norm = clean(newTitle);
  const words = norm.split(/\s+/).filter(Boolean);
  if (!words.length) return { duplicate: false };

  // Extract Korean character trigrams for semantic similarity
  function getTrigrams(s) {
    const t = s.replace(/[^가-힣a-z0-9]/g, '');
    const trigrams = new Set();
    for (let i = 0; i < t.length - 2; i++) trigrams.add(t.substring(i, i + 3));
    return trigrams;
  }
  const newTri = getTrigrams(norm);
  if (!newTri.size) return { duplicate: false };

  for (const post of existingPosts) {
    const pubNorm = clean(post.title);
    // Exact match (normalized)
    if (norm === pubNorm) return { duplicate: true, match: post };
    
    // Word overlap > 65%
    const pubWords = pubNorm.split(/\s+/).filter(Boolean);
    const common = words.filter(w => pubWords.includes(w)).length;
    const maxLen = Math.max(words.length, pubWords.length);
    if (maxLen > 0 && common / maxLen > 0.50) return { duplicate: true, match: post, score: common / maxLen };  // lowered from 0.65
    
    // Korean character trigram similarity (> 40%)
    const pubTri = getTrigrams(pubNorm);
    if (pubTri.size > 0) {
      const intersect = new Set([...newTri].filter(t => pubTri.has(t)));
      const union = new Set([...newTri, ...pubTri]);
      const triSim = intersect.size / Math.max(union.size, 1);
      if (triSim > 0.40) return { duplicate: true, match: post, score: triSim };
    }
    
    // If one title contains the other
    if (norm.includes(pubNorm) || pubNorm.includes(norm)) return { duplicate: true, match: post };
  }
  return { duplicate: false };
}

async function main() {
  const dir = '/root/.openclaw/workspace/newsroom/pipeline/07-copy-edited';
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch(e) {}

  if (!files.length) { console.log('📂 No files to publish'); return; }

  console.log(`📰 ${files.length}개 기사 발행 (AI 이미지 생성)...\n`);
  let ok = 0, fail = 0;
  let aiOk = 0, aiFail = 0;

  console.log('  📋 기존 게시글 로드 중 (중복 체크)...');
  const existingPosts = await loadGhostTitles();
  console.log(`     ${existingPosts.length}개 게시글 로드됨`);
  let skipped = 0;

  for (const f of files.sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const draft = data.draft || {};
    const headline = draft.headline || '';
    const html = draft.html || '';
    const tags = draft.ghost_tags || [];
    const src = data.source || {};

    // ★ 중복 제목 체크
    const dupCheck = isDuplicateTitle(headline, existingPosts);
    if (dupCheck.duplicate) {
      const score = dupCheck.score ? ` (유사도 ${(dupCheck.score*100).toFixed(0)}%)` : '';
      console.log(`  ⏭️ 중복 스킵: "${headline.substring(0, 35)}"${score}`);
      console.log(`     기존: "${dupCheck.match.title.substring(0, 45)}" [${dupCheck.match.date}]`);
      skipped++;
      const rejectedDir = '/root/.openclaw/workspace/newsroom/pipeline/rejected';
      if (!fs.existsSync(rejectedDir)) fs.mkdirSync(rejectedDir, {recursive: true});
      fs.renameSync(path.join(dir, f), path.join(rejectedDir, f));
      continue;
    }

    // ★ AI 이미지 생성
    const enParts = (headline.match(/[a-zA-Z]{3,}/g) || []).slice(0, 3);
    const label = enParts.length ? enParts.join('-').toLowerCase() : 'article';
    
    console.log(`  🔍 "${headline.substring(0, 30)}"`);
    
    let img = await generateAIImage(headline, tags, label);
    if (img) {
      console.log(`     🤖 AI 이미지 ✓ (seed: ${img.match(/ai-[^-]+-(\d+)/)?.[1] || '?'})`);
      aiOk++;
    } else {
      img = FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
      console.log(`     📷 Fallback (AI 생성 실패)`);
      aiFail++;
    }

    try {
      const res = await ghostReq('POST', '/ghost/api/admin/posts/?source=html', {
        posts: [{
          title: headline, html, status: 'published', featured: false,
          tags: tags.map(t => ({ name: t, slug: t })),
          custom_excerpt: headline.substring(0, 100),
          feature_image: img
        }]
      });
      if (res.posts && res.posts[0]) {
        console.log(`  ✅ ${headline.substring(0, 25)} → published`);
        
        // 발행 검증: 깨진 문자 확인
        const newId = res.posts[0].id;
        const verifyRes = await ghostReq('GET', `/ghost/api/admin/posts/${newId}/?formats=html`);
        const savedHtml = verifyRes.posts?.[0]?.html || '';
        const brokenCount = (savedHtml.match(/\uFFFD/g) || []).length;
        if (brokenCount > 0) {
          console.log(`  ⚠️  ${brokenCount}개 깨진 문자 발견! 재시도...`);
          await ghostReq('DELETE', `/ghost/api/admin/posts/${newId}/`);
          const retryRes = await ghostReq('POST', '/ghost/api/admin/posts/?source=html', {
            posts: [{
              title: headline, html, status: 'published', featured: false,
              tags: tags.map(t => ({ name: t, slug: t })),
              custom_excerpt: headline.substring(0, 100),
              feature_image: img
            }]
          });
          if (retryRes.posts && retryRes.posts[0]) {
            console.log(`  ✅ ${headline.substring(0, 25)} → 재발행 성공`);
          } else {
            console.log(`  ❌ 재발행 실패`);
          }
        }
        
        ok++;
        const pub = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
        if (!fs.existsSync(pub)) fs.mkdirSync(pub, {recursive: true});
        fs.renameSync(path.join(dir, f), path.join(pub, f));
      } else {
        console.log(`  ❌ ${headline.substring(0, 25)} → ${JSON.stringify(res).substring(0, 80)}`);
        fail++;
      }
    } catch(e) {
      console.log(`  ❌ ${headline.substring(0, 25)} → ${e.message}`);
      fail++;
    }
  }
  console.log(`\n=== 📊 결과 ===`);
  console.log(`✅ 발행: ${ok}개`);
  console.log(`⏭️  중복스킵: ${skipped}개`);
  console.log(`❌ 실패: ${fail}개`);
  console.log(`🤖 AI 이미지: ${aiOk}개 성공, ${aiFail}개 폴백`);
}

main().catch(console.error);
