#!/usr/bin/env node
/**
 * Ghost에서 관제센터 페이지 찾기
 */

const https = require('https');
const crypto = require('crypto');

const GHOST_CONFIG = {
  host: 'insight.ubion.global',
  key: '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625',
  version: 'v5.0'
};

function createGhostJWT() {
  const [id, secret] = GHOST_CONFIG.key.split(':');
  
  const header = Buffer.from(JSON.stringify({
    alg: 'HS256',
    kid: id,
    typ: 'JWT'
  })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: '/admin/'
  })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  const signature = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${header}.${payload}.${signature}`;
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
        if (res.statusCode >= 400) {
          reject(new Error(`Ghost API Error (${res.statusCode}): ${body}`));
        } else {
          resolve(JSON.parse(body || '{}'));
        }
      });
    });
    
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function findPages() {
  try {
    console.log('🔍 Ghost의 모든 페이지 검색 중...\n');
    
    const result = await ghostRequest('GET', '/pages/?limit=100');
    
    if (!result.pages) {
      console.log('❌ 페이지가 없습니다.');
      return;
    }
    
    console.log(`✅ 총 ${result.pages.length}개 페이지 찾음\n`);
    console.log('📄 페이지 목록:');
    console.log('─'.repeat(80));
    
    result.pages.forEach((page, i) => {
      console.log(`\n${i + 1}. ${page.title}`);
      console.log(`   ID: ${page.id}`);
      console.log(`   Slug: ${page.slug}`);
      console.log(`   Status: ${page.status}`);
      console.log(`   Updated: ${new Date(page.updated_at).toLocaleString('ko-KR')}`);
    });
    
    console.log('\n─'.repeat(80));
    console.log('\n💡 대시보드를 연결할 페이지 ID를 선택하세요!');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

findPages().catch(console.error);
