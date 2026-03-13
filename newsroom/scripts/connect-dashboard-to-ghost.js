#!/usr/bin/env node
/**
 * Ghost 관제센터 페이지에 대시보드 연결
 * 사용법: node connect-dashboard-to-ghost.js
 */

const https = require('https');
const crypto = require('crypto');

// Ghost API 설정
const GHOST_CONFIG = {
  host: 'ubion.ghost.io',
  key: '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625',
  pageId: '69a8cadce2eb440001d5584c', // 기존 관제센터 페이지
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
 * 대시보드 HTML 생성
 */
function createDashboardHTML() {
  return `
<!-- UBION Dashboard v2 (2026-03-06) -->
<div id="dashboard-container" style="margin: 0 auto; padding: 20px;"></div>

<script>
  // 1분마다 대시보드 로드
  async function loadDashboard() {
    try {
      const response = await fetch('http://127.0.0.1:3848/pages/main.html', {
        method: 'GET',
        cache: 'no-cache'
      });
      
      if (!response.ok) throw new Error('HTTP ' + response.status);
      
      const html = await response.text();
      
      // body 태그 내용만 추출
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\\/body>/i);
      const content = bodyMatch ? bodyMatch[1] : html;
      
      document.getElementById('dashboard-container').innerHTML = content;
      
      // 동적 스크립트 실행
      const scripts = content.match(/<script[^>]*>([\s\S]*?)<\\/script>/g) || [];
      scripts.forEach(script => {
        const code = script.replace(/<\/?script[^>]*>/g, '');
        try {
          eval(code);
        } catch (e) {
          console.warn('스크립트 실행 오류:', e.message);
        }
      });
    } catch (error) {
      document.getElementById('dashboard-container').innerHTML = \`
        <div style="
          background: #fee2e2;
          border: 2px solid #ef4444;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          color: #991b1b;
        ">
          <p style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">⚠️ 대시보드 연결 실패</p>
          <p style="font-size: 14px; margin-bottom: 12px;">\${error.message}</p>
          <p style="font-size: 12px; color: #7f1d1d;">Port 3848에서 대시보드 서버가 실행 중인지 확인하세요.</p>
          <button onclick="loadDashboard()" style="
            margin-top: 16px;
            padding: 8px 16px;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
          ">재시도</button>
        </div>
      \`;
    }
  }
  
  // 초기 로드
  loadDashboard();
  
  // 1분마다 자동 갱신
  setInterval(loadDashboard, 60 * 1000);
</script>

<style>
  #dashboard-container {
    width: 100%;
  }
</style>
`;
}

/**
 * 페이지 업데이트
 */
async function updatePage() {
  try {
    console.log('🔐 Ghost API 인증 중...\n');
    
    // 1. 기존 페이지 조회
    console.log('📖 기존 페이지 정보 조회 중...');
    const getResult = await ghostRequest('GET', `/pages/${GHOST_CONFIG.pageId}`);
    
    if (!getResult.pages || !getResult.pages[0]) {
      throw new Error('페이지를 찾을 수 없습니다.');
    }
    
    const currentPage = getResult.pages[0];
    console.log(`✅ 페이지 찾음: "${currentPage.title}"\n`);
    
    // 2. 페이지 업데이트
    console.log('🔄 대시보드 HTML 적용 중...');
    const updateData = {
      pages: [{
        html: createDashboardHTML(),
        status: currentPage.status,
        title: '🏢 UBION 관제센터 v2'
      }]
    };
    
    const updateResult = await ghostRequest('PUT', `/pages/${GHOST_CONFIG.pageId}`, updateData);
    
    if (updateResult.pages && updateResult.pages[0]) {
      const updatedPage = updateResult.pages[0];
      console.log('✅ 페이지 업데이트 완료!\n');
      
      console.log('📊 업데이트 정보:');
      console.log(`   제목: ${updatedPage.title}`);
      console.log(`   상태: ${updatedPage.status}`);
      console.log(`   URL: https://ubion.ghost.io/${updatedPage.slug}/\n`);
      
      console.log('🎉 대시보드가 관제센터 페이지에 연결되었습니다!');
      console.log(`   → https://ubion.ghost.io/newsroom-status/`);
      console.log(`   → https://ubion.ghost.io/${updatedPage.slug}/\n`);
      
      return updatedPage;
    } else {
      throw new Error('페이지 응답이 없습니다');
    }
  } catch (error) {
    console.error('\n❌ 오류:', error.message);
    console.log('\n💡 수동으로 연결하려면:');
    console.log('1. Ghost Admin에서 관제센터 페이지 (newsroom-status) 편집');
    console.log('2. Code 모드에서 다음 HTML 붙여넣기:\n');
    console.log(createDashboardHTML());
    
    process.exit(1);
  }
}

// 실행
updatePage().catch(console.error);
