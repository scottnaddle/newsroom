#!/usr/bin/env node
/**
 * Ghost CMS에 대시보드 페이지 생성
 * 사용법: node create-dashboard-page.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Ghost API 설정
const GHOST_CONFIG = {
  host: 'insight.ubion.global',
  key: '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625',
  version: 'v5.0'
};

/**
 * Ghost JWT 생성
 */
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

/**
 * Ghost API 요청
 */
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

/**
 * 대시보드 페이지 HTML 생성
 */
function createDashboardHTML() {
  return `
<!-- 대시보드 로드 (HTTP 폴링 - 1분마다) -->
<div id="dashboard-container" style="margin: 0 auto;"></div>

<script>
  // 1분마다 대시보드 페이지 reload
  async function loadDashboard() {
    try {
      const response = await fetch('http://127.0.0.1:3848/pages/main.html');
      const html = await response.text();
      
      // <html>, <head>, <body> 태그 제거 후 content 추출
      const content = html.match(/<body[^>]*>([\s\S]*)<\\/body>/i)?.[1] || html;
      document.getElementById('dashboard-container').innerHTML = content;
    } catch (error) {
      console.error('대시보드 로드 실패:', error);
      document.getElementById('dashboard-container').innerHTML = 
        '<p style="color: #ef4444; padding: 20px; text-align: center;">⚠️ 대시보드 서버 연결 실패 (Port 3848)</p>';
    }
  }
  
  // 초기 로드
  loadDashboard();
  
  // 1분마다 폴링
  setInterval(loadDashboard, 60 * 1000);
</script>

<style>
  #dashboard-container {
    max-width: 1400px;
  }
</style>
`;
}

/**
 * Ghost에 페이지 생성
 */
async function createPage() {
  try {
    console.log('🔐 Ghost API 인증 중...');
    
    const pageData = {
      pages: [{
        title: '🏢 UBION 관제센터 v2',
        slug: 'dashboard',
        html: createDashboardHTML(),
        status: 'draft',
        visibility: 'public'
      }]
    };
    
    console.log('📝 페이지 생성 중...');
    const result = await ghostRequest('POST', '/pages/', pageData);
    
    if (result.pages && result.pages[0]) {
      const page = result.pages[0];
      console.log('\n✅ Ghost 페이지 생성 완료!\n');
      console.log(`📄 페이지: ${page.title}`);
      console.log(`🔗 Slug: ${page.slug}`);
      console.log(`📍 URL: https://insight.ubion.global/${page.slug}/`);
      console.log(`\n✨ Ghost Admin에서 "Publish"를 눌러 공개하세요!`);
      
      return page;
    } else {
      throw new Error('페이지 응답이 없습니다');
    }
  } catch (error) {
    console.error('\n❌ 오류:', error.message);
    
    // 대체 안내문
    console.log('\n💡 수동으로 Ghost 페이지 추가하려면:');
    console.log('1. https://insight.ubion.global/ghost/ 접속');
    console.log('2. Pages → New page');
    console.log('3. 제목: "🏢 UBION 관제센터 v2"');
    console.log('4. 아래 HTML을 editor에 붙여넣기:\n');
    console.log(createDashboardHTML());
    
    process.exit(1);
  }
}

// 실행
createPage().catch(console.error);
