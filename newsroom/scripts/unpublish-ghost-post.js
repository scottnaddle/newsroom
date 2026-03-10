#!/usr/bin/env node
/**
 * Ghost에서 기사 unpublish/delete
 * 사용법: node unpublish-ghost-post.js <post_id>
 */

const https = require('https');
const crypto = require('crypto');

const GHOST_CONFIG = {
  host: 'ubion.ghost.io',
  key: '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625',
  version: 'v5.0'
};

const postId = process.argv[2];

if (!postId) {
  console.error('❌ 사용법: node unpublish-ghost-post.js <post_id>');
  console.error('예: node unpublish-ghost-post.js 69aa1e71ff4fbf0001ab6d75');
  process.exit(1);
}

function createGhostJWT() {
  const [id, secret] = GHOST_CONFIG.key.split(':');
  
  const header = Buffer.from(JSON.stringify({
    alg: 'HS256',
    kid: id,
    typ: 'JWT'
  })).toString('base64url');
  
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: '/admin/'
  })).toString('base64url');
  
  const message = header + '.' + payload;
  const sig = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(message)
    .digest('base64url');
  
  return message + '.' + sig;
}

function ghostRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const jwt = createGhostJWT();
    
    const options = {
      hostname: GHOST_CONFIG.host,
      path: `/ghost/api/${GHOST_CONFIG.version}${path}`,
      method,
      headers: {
        'Authorization': `Ghost ${jwt}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.errors) {
            reject(new Error(`Ghost API error: ${response.errors.map(e => e.message).join(', ')}`));
          } else {
            resolve(response);
          }
        } catch (e) {
          reject(new Error(`Failed to parse Ghost response: ${e.message}`));
        }
      });
    });
    
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function unpublishPost() {
  try {
    console.log(`🔍 Ghost 기사 조회 중... (ID: ${postId})\n`);
    
    // 1. 기사 조회
    const getResult = await ghostRequest('GET', `/posts/${postId}`);
    const post = getResult.posts[0];
    
    console.log(`📄 기사 정보:`);
    console.log(`   제목: ${post.title}`);
    console.log(`   상태: ${post.status}`);
    console.log(`   URL: ${post.url}\n`);
    
    // 2. Delete (또는 unpublish)
    console.log(`⚠️ Ghost에서 기사 삭제 중...\n`);
    
    const deleteResult = await ghostRequest('DELETE', `/posts/${postId}`);
    
    console.log(`✅ Ghost에서 삭제 완료!\n`);
    console.log(`결과:`);
    console.log(`   상태: 삭제됨`);
    console.log(`   제목: ${post.title}`);
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    
    // 대체 방법 제시
    console.log('\n💡 수동 방법:');
    console.log(`1. https://ubion.ghost.io/ghost/#/editor/post/${postId} 접속`);
    console.log(`2. 우측 상단 "더보기" → "삭제"클릭`);
    console.log(`3. 확인`);
    
    process.exit(1);
  }
}

unpublishPost().catch(console.error);
