#!/usr/bin/env node

/**
 * Ghost의 빈 기사를 로컬 JSON의 draft.html로 업데이트
 * 로컬에는 완벽한 HTML 내용이 있음 → Ghost에 동기화
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
let updatedCount = 0;
let errorCount = 0;
const results = {
  updated: [],
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

// 메인 프로세스
async function fixGhostContent() {
  console.log('🚀 Ghost 빈 기사를 로컬 content로 업데이트 시작\n');
  console.log(`📍 API URL: ${config.apiUrl}`);
  console.log(`🔑 API Key ID: ${keyId}\n`);

  const publishedDir = path.join(__dirname, '../pipeline/08-published');
  
  // 로컬 파일 읽기
  let files;
  try {
    files = fs.readdirSync(publishedDir).filter(f => f.endsWith('.json'));
  } catch (err) {
    console.log('❌ 발행된 기사 폴더를 찾을 수 없습니다.');
    process.exit(1);
  }

  console.log(`📄 로컬 기사 파일: ${files.length}개\n`);
  console.log(`📝 처리 중...\n`);

  for (const file of files) {
    const filePath = path.join(publishedDir, file);
    
    try {
      // 로컬 파일 읽기
      const localData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // ghost_id가 없으면 스킵
      if (!localData.ghost_id) {
        console.log(`⏭️  ${file} (ghost_id 없음, 스킵)`);
        results.skipped.push(file);
        continue;
      }

      // 로컬에 HTML이 없으면 스킵
      if (!localData.draft || !localData.draft.html) {
        console.log(`⏭️  ${file} (로컬 HTML 없음, 스킵)`);
        results.skipped.push(file);
        continue;
      }

      const title = (localData.draft.headline || localData.title || file).substring(0, 40);
      console.log(`📝 업데이트: ${title}...`);

      // Ghost 기사 업데이트
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
            updated_at: localData.updated_at || new Date().toISOString()
          }]
        }
      );

      if (updateResponse.status === 200) {
        console.log(`   ✅ 업데이트 완료\n`);
        updatedCount++;
        results.updated.push({
          file,
          ghostId: localData.ghost_id,
          title: title,
          htmlLength: localData.draft.html.length
        });
      } else {
        console.log(`   ❌ 오류 (${updateResponse.status})\n`);
        errorCount++;
        results.error.push({
          file,
          ghostId: localData.ghost_id,
          error: updateResponse.body?.errors?.[0]?.message || `HTTP ${updateResponse.status}`
        });
      }

      // API 레이트 제한 회피
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err) {
      console.log(`   ❌ 오류: ${err.message}\n`);
      errorCount++;
      results.error.push({
        file,
        error: err.message
      });
    }
  }

  // 최종 보고
  console.log('='.repeat(50));
  console.log(`\n✅ 처리 완료\n`);
  console.log(`📊 결과:`);
  console.log(`   업데이트됨: ${updatedCount}개`);
  console.log(`   오류: ${errorCount}개`);
  console.log(`   스킵: ${results.skipped.length}개\n`);

  if (updatedCount > 0) {
    console.log(`🎉 ${updatedCount}개 기사가 Ghost에 업데이트되었습니다!\n`);
  }

  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount}개 기사 업데이트 실패:\n`);
    results.error.slice(0, 10).forEach(err => {
      console.log(`   - ${err.file}: ${err.error}`);
    });
  }

  // 결과 파일 저장
  const reportPath = path.join(__dirname, '../pipeline/ghost-content-fix-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    api: config.apiUrl,
    updated: updatedCount,
    errors: errorCount,
    skipped: results.skipped.length,
    results: results
  }, null, 2));

  console.log(`📄 상세 보고서: ${reportPath}`);
}

// 실행
fixGhostContent().catch(err => {
  console.log(`❌ 예상치 못한 오류: ${err.message}`);
  process.exit(1);
});
