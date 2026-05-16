#!/usr/bin/env node
/**
 * Feature Image 일괄 교체 v3
 * Ghost API: PUT시 updated_at 필수!
 */

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const ENV_PATH = '/root/.openclaw/workspace/newsroom/.env';
const CRAWL4AI_LOOKUP = '/root/.openclaw/workspace/newsroom/pipeline/crawl4ai-image-lookup.json';
const GHOST_URL = 'https://newsroom.ubion.global';

const FALLBACK_IMAGES = [
  'https://newsroom.ubion.global/content/images/2026/05/img-0-1.jpeg',
  'https://newsroom.ubion.global/content/images/2026/05/img-0-11.jpg',
  'https://newsroom.ubion.global/content/images/2026/05/img-0-7.jpg',
  'https://newsroom.ubion.global/content/images/2026/05/img-0-6.jpg',
  'https://newsroom.ubion.global/content/images/2026/05/img-0-8.jpg',
  'https://newsroom.ubion.global/content/images/2026/05/img-0-5.png',
  'https://newsroom.ubion.global/content/images/2026/05/img-0-10.jpg',
  'https://newsroom.ubion.global/content/images/2026/05/img-0-9.jpg',
  'https://newsroom.ubion.global/content/images/2026/05/fallback.jpg',
  'https://newsroom.ubion.global/content/images/2026/05/fallback-2.jpg',
  'https://newsroom.ubion.global/content/images/2026/05/fallback-3.jpg',
  'https://newsroom.ubion.global/content/images/2026/05/fallback-4.jpg',
  'https://newsroom.ubion.global/content/images/2026/05/fallback-5.jpg',
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

function ghostGet(path, jwt) {
  return new Promise((resolve, reject) => {
    https.get(GHOST_URL + '/ghost/api/admin/' + path, {
      headers: { 'Authorization': 'Ghost ' + jwt }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { reject(new Error(d.substring(0,100))); }
      });
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
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { 
          const parsed = JSON.parse(d);
          if (res.statusCode >= 400) {
            reject(new Error(d.substring(0, 300)));
          } else {
            resolve(parsed);
          }
        } catch(e) { reject(new Error(d.substring(0,100))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== Feature Image 일괄 교체 v3 (updated_at 포함) ===\n');

  const ADMIN_KEY = loadEnv('GHOST_ADMIN_API_KEY');
  if (!ADMIN_KEY) { console.error('❌ API 키 없음'); process.exit(1); }
  const jwt = generateJWT(ADMIN_KEY);

  // 모든 게시물 로드 (updated_at 포함)
  const allPosts = [];
  for (let page = 1; page <= 10; page++) {
    const result = await ghostGet(`posts/?limit=50&page=${page}&order=published_at%20desc&formats=html&fields=id,title,slug,feature_image,html,published_at,updated_at`, jwt);
    if (!result.posts || result.posts.length === 0) break;
    allPosts.push(...result.posts);
    if (allPosts.length >= (result.meta?.pagination?.total || 9999)) break;
  }
  console.log(`📊 전체 게시물: ${allPosts.length}개\n`);

  const fluxPosts = allPosts.filter(p => 
    p.feature_image && (p.feature_image.includes('tmp') || p.feature_image.includes('flux'))
  );
  console.log(`🔴 FLUX 이미지 기사: ${fluxPosts.length}개\n`);

  let updated = 0, failed = 0;

  for (const post of fluxPosts) {
    const title = post.title.substring(0, 42);
    const newImage = FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
    
    process.stdout.write(`  ${title.padEnd(44)} → `);

    try {
      const result = await ghostPut(`posts/${post.id}/?source=html`, {
        posts: [{
          id: post.id,
          updated_at: post.updated_at,
          feature_image: newImage
        }]
      }, jwt);
      
      const imageName = newImage.split('/').pop().substring(0, 22);
      console.log(`✅ (${imageName})`);
      updated++;
    } catch (err) {
      console.log(`❌ ${err.message.substring(0, 80)}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 최종 결과');
  console.log('='.repeat(50));
  console.log(`   대상: ${fluxPosts.length}개`);
  console.log(`   ✅ 업데이트: ${updated}개`);
  console.log(`   ❌ 실패:     ${failed}개`);
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
