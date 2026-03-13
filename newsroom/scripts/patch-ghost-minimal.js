#!/usr/bin/env node

/**
 * Minimal Ghost PATCH - 최소한의 필드만으로 업데이트
 * updated_at 없이 순수 html만 전송
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
async function patchGhostMinimal() {
  console.log('🚀 Minimal Ghost PATCH - HTML만 업데이트\n');
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

  for (const file of files) {
    const filePath = path.join(publishedDir, file);
    
    try {
      const localData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (!localData.ghost_id || !localData.draft || !localData.draft.html) {
        continue;
      }

      const title = (localData.draft.headline || localData.draft.title || file).substring(0, 40);
      console.log(`📝 패치: ${title}...`);

      // ⭐ MINIMAL: updated_at 없이 html만 전송
      const updateResponse = await makeGhostRequest(
        'PUT',
        `/ghost/api/v3/admin/posts/${localData.ghost_id}/?formats=html`,
        {
          posts: [{
            id: localData.ghost_id,
            html: localData.draft.html
          }]
        }
      );

      if (updateResponse.status === 200) {
        console.log(`   ✅ 패치 완료\n`);
        successCount++;
      } else {
        console.log(`   ❌ 오류 (${updateResponse.status})\n`);
        errorCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err) {
      // 조용히 스킵
    }
  }

  // 최종 보고
  console.log('='.repeat(50));
  console.log(`\n✅ 처리 완료!\n`);
  console.log(`📊 결과:`);
  console.log(`   성공: ${successCount}개`);
  console.log(`   오류: ${errorCount}개\n`);

  if (successCount > 0) {
    console.log(`🎉 ${successCount}개 기사가 Ghost에 업데이트되었습니다!\n`);
  }
}

// 실행
patchGhostMinimal().catch(err => {
  console.log(`❌ 예상치 못한 오류: ${err.message}`);
  process.exit(1);
});
