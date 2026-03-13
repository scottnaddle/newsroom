#!/usr/bin/env node

/**
 * Ghost의 모든 Draft 기사 삭제
 * 파이프라인 재실행을 위해 Ghost를 깨끗이 정리
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
let deletedCount = 0;
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
async function deleteAllDrafts() {
  console.log('🗑️  Ghost의 모든 Draft 기사 삭제\n');
  console.log(`📍 API URL: ${config.apiUrl}\n`);
  console.log(`⚠️  주의: 이 작업은 되돌릴 수 없습니다!\n`);

  // Draft 기사 목록 가져오기
  console.log('📋 Draft 기사 목록 조회 중...\n');

  try {
    const listResponse = await makeGhostRequest('GET', '/ghost/api/v3/admin/posts/?status=draft&limit=300');
    const drafts = listResponse.body?.posts || [];
    
    console.log(`🗑️  ${drafts.length}개 Draft 기사 발견\n`);
    console.log(`삭제 시작:\n`);

    for (const draft of drafts) {
      const title = (draft.title || '').substring(0, 40);
      console.log(`⏳ 삭제: ${title}...`);

      const deleteResponse = await makeGhostRequest(
        'DELETE',
        `/ghost/api/v3/admin/posts/${draft.id}`
      );

      if (deleteResponse.status === 204) {
        console.log(`   ✅ 삭제됨\n`);
        deletedCount++;
      } else {
        console.log(`   ❌ 오류 (${deleteResponse.status})\n`);
        errorCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

  } catch (err) {
    console.log(`❌ 오류: ${err.message}`);
    errorCount++;
  }

  // 최종 보고
  console.log('='.repeat(50));
  console.log(`\n✅ 삭제 완료!\n`);
  console.log(`📊 결과:`);
  console.log(`   삭제됨: ${deletedCount}개`);
  console.log(`   오류: ${errorCount}개\n`);

  if (deletedCount > 0) {
    console.log(`🟢 Ghost가 정리되었습니다!\n`);
    console.log(`다음: 파이프라인 재실행\n`);
  }
}

// 실행
deleteAllDrafts().catch(err => {
  console.log(`❌ 예상치 못한 오류: ${err.message}`);
  process.exit(1);
});
