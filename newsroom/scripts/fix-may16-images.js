#!/usr/bin/env node
/**
 * 5/16 기사 이미지 정리 (OG 이미지 or 원래 FLUX로 복원)
 */
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const ENV_PATH = '/root/.openclaw/workspace/newsroom/.env';
const GHOST_URL = 'https://newsroom.ubion.global';

function loadEnv(key) {
  if (!fs.existsSync(ENV_PATH)) return null;
  const env = fs.readFileSync(ENV_PATH, 'utf8');
  const m = env.match(new RegExp(key + '=(.+?)($|\\n)'));
  return m ? m[1].trim().replace(/^"(.*)"$/, '$1') : null;
}

function generateJWT(key) {
  const [id, secret] = key.split(':');
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:id})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:n,exp:n+300,aud:'/admin/'})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
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
      res.on('end', () => { try { const p = JSON.parse(d); if (res.statusCode >= 400) reject(new Error(d.substring(0,200))); else resolve(p); } catch(e) { reject(new Error(d.substring(0,100))); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 5/16 기사들 정보
const ARTICLES = [
  {
    id: '6a080a35ddba0bc2cb5ffddc', title: '네이버 연구회',
    ogImage: 'https://www.sentv.co.kr/data/sentv/image/2026/05/15/sentv20260515000042.png',
    fluxFallback: 'https://newsroom.ubion.global/content/images/2026/05/tmpcxsewat5.png'
  },
  {
    id: '6a080a35ddba0bc2cb5ffde3', title: '네이버 연구 지원',
    ogImage: 'https://img7.yna.co.kr/etc/inner/KR/2026/05/15/AKR20260515074400017_01_i_P4.jpg',
    fluxFallback: 'https://newsroom.ubion.global/content/images/2026/05/tmpqdz1dd9a.png'
  },
  {
    id: '6a080a36ddba0bc2cb5ffdea', title: '싱가포르',
    ogImage: null,
    fluxFallback: 'https://newsroom.ubion.global/content/images/2026/05/tmp4xq2rpvy.png'
  },
  {
    id: '6a080a37ddba0bc2cb5ffdf1', title: 'AI 튜터링',
    ogImage: 'https://www.jaipuria.ac.in/blog/wp-content/uploads/2026/05/ai-for-students-transforming-learning.jpg',
    fluxFallback: 'https://newsroom.ubion.global/content/images/2026/05/tmpz_7sg6pk.png'
  },
  {
    id: '6a081658ddba0bc2cb5ffe00', title: 'AI 테크 브리핑',
    ogImage: null,
    fluxFallback: 'https://newsroom.ubion.global/content/images/2026/05/tmp_1sz961p.png'
  },
];

function downloadImage(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 400) { resolve(null); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < 500) { resolve(null); return; }
        resolve(buf);
      });
    }).on('error', () => resolve(null));
    setTimeout(() => resolve(null), 16000);
  });
}

function uploadToGhost(imageBuf, filename) {
  return new Promise((resolve) => {
    const token = generateJWT(loadEnv('GHOST_ADMIN_API_KEY'));
    const boundary = '----Boundary' + Math.random().toString(36).slice(2);
    const parts = [
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
      imageBuf,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ];
    const totalLen = parts.reduce((a, b) => a + b.length, 0);
    const req = https.request({
      hostname: 'newsroom.ubion.global', path: '/ghost/api/admin/images/upload/', method: 'POST',
      headers: { 'Authorization': `Ghost ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': totalLen }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { const p = JSON.parse(d); resolve(p.images?.[0]?.url || null); } catch(e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    for (const p of parts) req.write(p);
    req.end();
  });
}

async function main() {
  const ADMIN_KEY = loadEnv('GHOST_ADMIN_API_KEY');
  const jwt = generateJWT(ADMIN_KEY);
  
  console.log('=== 5/16 기사 이미지 정리 ===\n');
  
  for (const article of ARTICLES) {
    process.stdout.write(`  📰 ${article.title.padEnd(20)} → `);
    
    // Get current post to know updated_at
    const current = await new Promise((resolve) => {
      https.get(GHOST_URL + `/ghost/api/admin/posts/${article.id}/?fields=id,title,feature_image,updated_at`, {
        headers: { 'Authorization': 'Ghost ' + jwt }
      }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try { resolve(JSON.parse(d).posts[0]); } catch(e) { resolve(null); }}); });
    });
    
    if (!current) { console.log('❌ 조회 실패'); continue; }
    
    let newImageUrl = null;
    
    // Try OG image first
    if (article.ogImage) {
      const imgBuf = await downloadImage(article.ogImage);
      if (imgBuf) {
        const filename = article.id.substring(8, 16) + '-og.jpg';
        const ghostUrl = await uploadToGhost(imgBuf, filename);
        if (ghostUrl) newImageUrl = ghostUrl;
      }
    }
    
    // Fallback: original FLUX image
    if (!newImageUrl) {
      newImageUrl = article.fluxFallback;
    }
    
    // Update
    try {
      await ghostPut(`posts/${article.id}/?source=html`, {
        posts: [{ id: article.id, updated_at: current.updated_at, feature_image: newImageUrl }]
      }, jwt);
      console.log(`✅ (${newImageUrl.split('/').pop().substring(0,22)})`);
    } catch (err) {
      console.log(`❌ ${err.message.substring(0, 60)}`);
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('\n✅ 완료!');
}

main().catch(e => console.error('❌', e.message));
