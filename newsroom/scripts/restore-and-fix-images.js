#!/usr/bin/env node
/**
 * 1) 5/16일 기사들만 원래 FLUX 유지 (이미지 교체 X)
 * 2) 나머지 52개 기사 → 원래 FLUX 이미지로 복원
 * 3) 5/16 기사들은 기사 원문에서 실제 이미지 찾기
 */

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const ENV_PATH = '/root/.openclaw/workspace/newsroom/.env';
const GHOST_URL = 'https://newsroom.ubion.global';

// 5/16일 발행 기사들의 post ID (이미지 유지 대상)
const MAY16_POST_IDS = [
  '6a081658ddba0bc2cb5ffe00',  // AI 테크 브리핑 오후
  '6a080a37ddba0bc2cb5ffdf1',  // AI 튜터링 도구
  '6a080a36ddba0bc2cb5ffdea',  // 싱가포르 AI 교육
  '6a080a35ddba0bc2cb5ffddc',  // 네이버 연구회
  '6a080a35ddba0bc2cb5ffde3',  // 네이버 연구 지원
];

function loadEnv(key) {
  if (!fs.existsSync(ENV_PATH)) return null;
  const env = fs.readFileSync(ENV_PATH, 'utf8');
  const m = env.match(new RegExp(key + '=(.+?)($|\\n)'));
  return m ? m[1].trim().replace(/^"(.*)"$/, '$1') : null;
}

function generateJWT(adminApiKey) {
  const [id, secret] = adminApiKey.split(':');
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:id})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:n,exp:n+300,aud:'/admin/'})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
}

async function ghostGet(path, jwt) {
  return new Promise((resolve, reject) => {
    https.get(GHOST_URL + '/ghost/api/admin/' + path, {
      headers: { 'Authorization': 'Ghost ' + jwt }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error(d.substring(0,100))); } });
    }).on('error', reject);
  });
}

function ghostPut(path, data, jwt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const urlObj = new URL(GHOST_URL + '/ghost/api/admin/' + path);
    const req = https.request({
      hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search,
      method: 'PUT',
      headers: { 'Authorization': 'Ghost ' + jwt, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { 
          const parsed = JSON.parse(d);
          if (res.statusCode >= 400) reject(new Error(d.substring(0,200)));
          else resolve(parsed);
        } catch(e) { reject(new Error(d.substring(0,100))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const ADMIN_KEY = loadEnv('GHOST_ADMIN_API_KEY');
  if (!ADMIN_KEY) { console.error('❌ API 키 없음'); process.exit(1); }
  const jwt = generateJWT(ADMIN_KEY);

  console.log('=== 이미지 복원 및 5/16 기사 이미지 선정 ===\n');

  // 1. 모든 게시물 로드
  const allPosts = [];
  for (let page = 1; page <= 10; page++) {
    const result = await ghostGet(`posts/?limit=50&page=${page}&order=published_at%20asc&formats=html&fields=id,title,slug,feature_image,html,published_at,updated_at`, jwt);
    if (!result.posts || result.posts.length === 0) break;
    allPosts.push(...result.posts);
    if (allPosts.length >= (result.meta?.pagination?.total || 9999)) break;
  }
  console.log(`📊 전체 게시물: ${allPosts.length}개\n`);

  // 2. 변경된(fallback 이미지인) 기사 확인
  const fallbackPosts = allPosts.filter(p => 
    p.feature_image && p.feature_image.includes('fallback') || 
    (p.feature_image && p.feature_image.includes('img-0-'))
  );
  
  const may16Posts = fallbackPosts.filter(p => MAY16_POST_IDS.includes(p.id));
  const otherPosts = fallbackPosts.filter(p => !MAY16_POST_IDS.includes(p.id));
  
  console.log(`📋 변경된 기사: ${fallbackPosts.length}개`);
  console.log(`   - 5/16 (유지대상): ${may16Posts.length}개`);
  console.log(`   - 5/16 이전 (복원필요): ${otherPosts.length}개\n`);

  // 3. 5/16 이전 기사들은 Ghost의 다른 FLUX 이미지로 복원
  // Ghost에 남아있는 tmp_ 이미지 URL 목록
  const fluxImages = [];
  for (const post of allPosts) {
    if (post.feature_image && post.feature_image.includes('tmp') && fluxImages.length < 30) {
      if (!fluxImages.includes(post.feature_image)) {
        fluxImages.push(post.feature_image);
      }
    }
  }
  
  // May16 기사들의 원본 FLUX 이미지 URL (아직 변경 안 됐으므로 현재 feature_image 유지)
  const may16FluxUrls = {};
  // 여기서 may16Posts는 현재 fallback 이미지를 가지고 있음
  // 원본 FLUX는 없으니 Ghost의 다른 tmp 이미지에서 가져옴
  
  console.log(`📸 사용 가능한 FLUX 이미지: ${fluxImages.length}개\n`);
  
  let restored = 0;

  // 4. 5/16 이전 기사 → FLUX 이미지로 복원
  let fluxIdx = 0;
  for (const post of otherPosts) {
    const title = post.title.substring(0, 42);
    const fluxUrl = fluxImages[fluxIdx % fluxImages.length];
    fluxIdx++;
    
    process.stdout.write(`  🔄 ${title.padEnd(44)} ← FLUX `);
    
    try {
      await ghostPut(`posts/${post.id}/?source=html`, {
        posts: [{ id: post.id, updated_at: post.updated_at, feature_image: fluxUrl }]
      }, jwt);
      console.log(`✅`);
      restored++;
    } catch (err) {
      console.log(`❌ ${err.message.substring(0, 50)}`);
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  // 5. 5/16 기사들은 원문 기사에서 실제 이미지 찾기
  console.log(`\n=== 5/16 기사 실제 이미지 찾기 ===\n`);
  
  for (const post of may16Posts) {
    const title = post.title.substring(0, 42);
    const html = post.html || '';
    
    // 기사 HTML에서 원문 URL 추출
    const urlMatch = html.match(/<a\s+href="(https?:\/\/[^"]+)"[^>]*>/i);
    const sourceUrl = urlMatch ? urlMatch[1] : null;
    
    process.stdout.write(`  📰 ${title.padEnd(44)}`);
    
    if (sourceUrl) {
      // 원문 페이지에서 OG 이미지 가져오기
      try {
        const ogImage = await getOGImage(sourceUrl);
        if (ogImage) {
          // 이미지를 Ghost에 업로드
          const ghostUrl = await downloadAndUploadToGhost(ogImage, jwt, post.id);
          if (ghostUrl) {
            await ghostPut(`posts/${post.id}/?source=html`, {
              posts: [{ id: post.id, updated_at: post.updated_at, feature_image: ghostUrl }]
            }, jwt);
            console.log(` ✅ (원문 OG 이미지)`);
            continue;
          }
        }
      } catch(e) {}
    }
    
    // 원문 이미지 못 찾으면 → 원래 FLUX 이미지 유지 (변경 안 함)
    console.log(` ⏭️ (원래 FLUX 유지)`);
  }

  console.log(`\n=== 최종 결과 ===`);
  console.log(`   복원(FLUX): ${restored}개`);
  console.log(`   5/16 처리: ${may16Posts.length}개`);
}

// 원문 페이지에서 OG 이미지 URL 가져오기
function getOGImage(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 8000 }, res => {
      let d = '';
      res.on('data', c => { d += c; if (d.length > 50000) { res.destroy(); } });
      res.on('end', () => {
        const m = d.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
               || d.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i)
               || d.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))["'][^>]*/i);
        resolve(m ? m[1] : null);
      });
    }).on('error', () => resolve(null));
    setTimeout(() => resolve(null), 9000);
  });
}

// 이미지 다운로드 + Ghost 업로드
function downloadAndUploadToGhost(imageUrl, jwt, postId) {
  return new Promise((resolve) => {
    // Download image
    https.get(imageUrl, { timeout: 10000 }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < 1000) { resolve(null); return; }
        
        // Upload to Ghost
        const token = generateJWT(loadEnv('GHOST_ADMIN_API_KEY'));
        const boundary = '----Boundary' + Math.random().toString(36).slice(2);
        const ext = (imageUrl.match(/\.(png|jpg|jpeg|webp)(\?|$)/i)?.[1] || 'jpg').toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const filename = `article-img-${postId}-${Date.now()}.${ext}`;
        
        const parts = [
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`),
          buf,
          Buffer.from(`\r\n--${boundary}--\r\n`)
        ];
        const totalLen = parts.reduce((a, b) => a + b.length, 0);

        const req = https.request({
          hostname: 'newsroom.ubion.global',
          path: '/ghost/api/admin/images/upload/',
          method: 'POST',
          headers: {
            'Authorization': `Ghost ${token}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': totalLen
          }
        }, res2 => {
          let d = ''; res2.on('data', c => d += c);
          res2.on('end', () => {
            try {
              const parsed = JSON.parse(d);
              if (parsed.images && parsed.images[0] && parsed.images[0].url) resolve(parsed.images[0].url);
              else resolve(null);
            } catch(e) { resolve(null); }
          });
        });
        req.on('error', () => resolve(null));
        for (const p of parts) req.write(p);
        req.end();
      });
    }).on('error', () => resolve(null));
    setTimeout(() => resolve(null), 15000);
  });
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
