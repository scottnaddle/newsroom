#!/usr/bin/env node

/**
 * Ghost 기사 완전 복구
 * 1. Draft → Published로 변경 (편집 잠금 해제)
 * 2. 로컬 HTML로 내용 업데이트
 * 3. 완료!
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
let changedToDraft = 0;
let changedToPublished = 0;
let contentUpdated = 0;
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
async function restoreArticles() {
  console.log('🚀 Ghost 기사 완전 복구 시작\n');
  console.log(`📍 API URL: ${config.apiUrl}\n`);

  const publishedDir = path.join(__dirname, '../pipeline/08-published');
  
  // 1단계: 로컬 파일 정리
  console.log('📋 Step 1: Draft → Published로 상태 변경\n');
  
  try {
    const draftResponse = await makeGhostRequest('GET', '/ghost/api/v3/admin/posts/?status=draft&limit=200');
    const draftPosts = draftResponse.body?.posts || [];
    
    console.log(`📊 Draft 기사: ${draftPosts.length}개\n`);

    for (const post of draftPosts) {
      const title = (post.title || '').substring(0, 40);
      console.log(`⏳ Published로 변경: ${title}...`);

      const updateResponse = await makeGhostRequest(
        'PUT',
        `/ghost/api/v3/admin/posts/${post.id}/?formats=html`,
        {
          posts: [{
            id: post.id,
            status: 'published',
            updated_at: post.updated_at
          }]
        }
      );

      if (updateResponse.status === 200) {
        console.log(`   ✅ Published로 변경됨\n`);
        changedToPublished++;
      } else {
        console.log(`   ❌ 오류 (${updateResponse.status})\n`);
        errorCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

  } catch (err) {
    console.log(`❌ 오류: ${err.message}`);
    errorCount++;
  }

  // 2단계: 로컬 HTML로 내용 업데이트
  console.log('\n📝 Step 2: 로컬 HTML로 내용 업데이트\n');

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
      console.log(`📝 업데이트: ${title}...`);

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
        console.log(`   ✅ 내용 업데이트됨\n`);
        contentUpdated++;
      } else {
        console.log(`   ⚠️  오류 (${updateResponse.status})\n`);
        errorCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (err) {
      // 조용히 스킵
    }
  }

  // 최종 보고
  console.log('='.repeat(50));
  console.log(`\n✅ 복구 완료!\n`);
  console.log(`📊 결과:`);
  console.log(`   Published로 변경: ${changedToPublished}개`);
  console.log(`   내용 업데이트: ${contentUpdated}개`);
  console.log(`   오류: ${errorCount}개\n`);

  if (contentUpdated > 0) {
    console.log(`🎉 ${contentUpdated}개 기사가 내용과 함께 Ghost에 복원되었습니다!\n`);
    console.log(`확인: https://ubion.ghost.io`);
  }
}

// 실행
restoreArticles().catch(err => {
  console.log(`❌ 예상치 못한 오류: ${err.message}`);
  process.exit(1);
});
