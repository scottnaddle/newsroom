#!/usr/bin/env node

/**
 * Ghost 최신 타임스탐프로 동기화
 * 1. Ghost에서 각 기사의 최신 updated_at 가져오기
 * 2. 로컬 HTML로 업데이트 (최신 타임스탐프 사용)
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
let successCount = 0;
let errorCount = 0;
let versionConflicts = 0;

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

// 메인 프로세스
async function syncWithLatestTimestamps() {
  console.log('🚀 Ghost 최신 타임스탐프로 동기화\n');
  console.log(`📍 API URL: ${config.apiUrl}\n`);

  const publishedDir = path.join(__dirname, '../pipeline/08-published');
  
  let files;
  try {
    files = fs.readdirSync(publishedDir).filter(f => f.endsWith('.json'));
  } catch (err) {
    console.log('❌ 발행된 기사 폴더를 찾을 수 없습니다.');
    process.exit(1);
  }

  console.log(`📄 처리할 로컬 파일: ${files.length}개\n`);
  console.log(`🔄 각 기사의 최신 타임스탐프를 Ghost에서 가져온 후 업데이트\n`);

  for (const file of files) {
    const filePath = path.join(publishedDir, file);
    
    try {
      const localData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (!localData.ghost_id || !localData.draft || !localData.draft.html) {
        continue;
      }

      const title = (localData.draft.headline || localData.draft.title || file).substring(0, 40);
      console.log(`📝 동기화: ${title}...`);

      // Step 1: Ghost에서 최신 기사 정보 가져오기
      const getResponse = await makeGhostRequest(
        'GET',
        `/ghost/api/v3/admin/posts/${localData.ghost_id}/?formats=html`
      );

      if (getResponse.status !== 200) {
        console.log(`   ⚠️  GET 실패 (${getResponse.status})\n`);
        errorCount++;
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      const ghostPost = getResponse.body?.posts?.[0];
      if (!ghostPost) {
        console.log(`   ⚠️  기사 데이터 없음\n`);
        errorCount++;
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      // Step 2: 최신 updated_at으로 업데이트
      const updateResponse = await makeGhostRequest(
        'PUT',
        `/ghost/api/v3/admin/posts/${localData.ghost_id}/?formats=html`,
        {
          posts: [{
            id: localData.ghost_id,
            html: localData.draft.html,
            title: localData.draft.headline || localData.draft.title || title,
            custom_excerpt: (localData.draft.subheadline || '').substring(0, 300),
            feature_image: localData.draft.feature_image || localData.og_image,
            updated_at: ghostPost.updated_at  // ⭐ Ghost에서 가져온 최신 타임스탐프 사용
          }]
        }
      );

      if (updateResponse.status === 200) {
        console.log(`   ✅ 동기화 완료\n`);
        successCount++;
      } else if (updateResponse.status === 409) {
        console.log(`   ⚠️  409 충돌 (버전 불일치)\n`);
        versionConflicts++;
      } else {
        console.log(`   ❌ 오류 (${updateResponse.status})\n`);
        errorCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 800));

    } catch (err) {
      console.log(`   ❌ 오류: ${err.message}\n`);
      errorCount++;
    }
  }

  // 최종 보고
  console.log('='.repeat(50));
  console.log(`\n✅ 동기화 완료!\n`);
  console.log(`📊 결과:`);
  console.log(`   성공: ${successCount}개`);
  console.log(`   409 충돌: ${versionConflicts}개`);
  console.log(`   기타 오류: ${errorCount}개\n`);

  if (successCount > 0) {
    console.log(`🎉 ${successCount}개 기사가 Ghost와 동기화되었습니다!\n`);
  }
}

// 실행
syncWithLatestTimestamps().catch(err => {
  console.log(`❌ 예상치 못한 오류: ${err.message}`);
  process.exit(1);
});
