#!/usr/bin/env node

/**
 * Ghost에서 발행된 기사 중 타이틀이나 내용이 없는 기사를 모두 Draft로 옮김
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const https = require('https');

// Ghost 설정 로드
const configPath = path.join(__dirname, '../shared/config/ghost.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.log('❌ ghost.json을 읽을 수 없습니다.');
  process.exit(1);
}

const [keyId, secret] = config.adminApiKey.split(':');
let movedCount = 0;
let errorCount = 0;
const results = {
  moved: [],
  error: [],
  skipped: []
};

// JWT 토큰 생성
function generateToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + 5 * 60,
    aud: '/v3/admin/'
  };
  
  const secretBuffer = Buffer.from(secret, 'hex');
  return jwt.sign(payload, secretBuffer, {
    algorithm: 'HS256',
    header: {
      alg: 'HS256',
      typ: 'JWT',
      kid: keyId
    }
  });
}

// Ghost API 요청
function makeGhostRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const token = generateToken();
    const url = new URL(`${config.apiUrl}${path}`);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'NewsroomAgent/1.0'
      },
      timeout: 15000
    };

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: null,
            raw: data
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// 기사가 비어있는지 확인
function isEmptyArticle(post) {
  const hasNoTitle = !post.title || post.title.trim() === '';
  const hasNoContent = !post.html || post.html.trim() === '' || post.html.length < 50;
  
  return hasNoTitle || hasNoContent;
}

// 메인 프로세스
async function moveEmptyArticlesToDraft() {
  console.log('🚀 Ghost에서 비어있는 기사를 Draft로 옮기기 시작\n');
  console.log(`📍 API URL: ${config.apiUrl}`);
  console.log(`🔑 API Key ID: ${keyId}\n`);

  try {
    // 1단계: 발행된 기사 모두 조회
    console.log('📊 발행된 기사 조회 중...\n');
    const response = await makeGhostRequest('GET', '/ghost/api/v3/admin/posts/?status=published&limit=200');
    
    if (response.status !== 200) {
      console.log(`❌ Ghost API 오류: ${response.status}`);
      process.exit(1);
    }

    const posts = response.body.posts || [];
    console.log(`✅ 발행된 기사 ${posts.length}개 조회됨\n`);

    // 2단계: 비어있는 기사 찾기
    const emptyPosts = posts.filter(isEmptyArticle);
    console.log(`🔍 확인 결과:`);
    console.log(`   타이틀/내용 없는 기사: ${emptyPosts.length}개`);
    console.log(`   정상 기사: ${posts.length - emptyPosts.length}개\n`);

    if (emptyPosts.length === 0) {
      console.log('✅ 비어있는 기사가 없습니다!');
      return;
    }

    // 3단계: 각 기사를 Draft로 옮기기
    console.log('📝 Draft로 옮기는 중...\n');

    for (const post of emptyPosts) {
      try {
        const title = post.title || '(제목 없음)';
        const contentLength = post.html ? post.html.length : 0;
        
        console.log(`⏳ 옮기는 중: ${title.substring(0, 40)}... (ID: ${post.id})`);
        
        // PUT 요청으로 상태를 draft로 변경
        const updateResponse = await makeGhostRequest('PUT', `/ghost/api/v3/admin/posts/${post.id}/?formats=html`, {
          posts: [{
            id: post.id,
            status: 'draft',
            updated_at: post.updated_at
          }]
        });

        if (updateResponse.status === 200 || updateResponse.status === 201) {
          console.log(`   ✅ Draft로 옮겨짐\n`);
          movedCount++;
          results.moved.push({
            id: post.id,
            title: title,
            contentLength: contentLength
          });
        } else {
          console.log(`   ❌ 오류 (${updateResponse.status})\n`);
          errorCount++;
          results.error.push({
            id: post.id,
            title: title,
            error: updateResponse.body?.errors?.[0]?.message || `HTTP ${updateResponse.status}`
          });
        }

        // API 레이트 제한 회피
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (err) {
        console.log(`   ❌ 요청 실패: ${err.message}\n`);
        errorCount++;
        results.error.push({
          id: post.id,
          error: err.message
        });
      }
    }

  } catch (err) {
    console.log(`❌ 치명적 오류: ${err.message}`);
    process.exit(1);
  }

  // 최종 보고
  console.log('='.repeat(50));
  console.log(`\n✅ 처리 완료\n`);
  console.log(`📊 결과:`);
  console.log(`   Draft로 옮겨짐: ${movedCount}개`);
  console.log(`   오류: ${errorCount}개`);
  console.log(`   합계: ${movedCount + errorCount}개\n`);

  if (movedCount > 0) {
    console.log(`🎉 ${movedCount}개 기사가 Draft로 옮겨졌습니다!\n`);
    console.log(`옮겨진 기사:`);
    results.moved.forEach(post => {
      console.log(`   - ${post.title.substring(0, 40)}... (ID: ${post.id})`);
    });
  }

  if (errorCount > 0) {
    console.log(`\n⚠️  ${errorCount}개 기사 처리 실패:`);
    results.error.forEach(err => {
      console.log(`   - ${err.title || err.id}: ${err.error}`);
    });
  }

  // 결과 파일 저장
  const reportPath = path.join(__dirname, '../pipeline/draft-move-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    api: config.apiUrl,
    moved: movedCount,
    errors: errorCount,
    total: movedCount + errorCount,
    results: results
  }, null, 2));

  console.log(`\n📄 상세 보고서: ${reportPath}`);
}

// 실행
moveEmptyArticlesToDraft().catch(err => {
  console.log(`❌ 예상치 못한 오류: ${err.message}`);
  process.exit(1);
});
