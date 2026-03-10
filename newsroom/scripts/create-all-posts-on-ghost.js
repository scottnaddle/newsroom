#!/usr/bin/env node

/**
 * 로컬 뉴스룸 기사 76개를 Ghost CMS에 새로 생성
 * Option A: 깨끗한 시작, 모든 기사를 ubion.ghost.io에 새로 만듦
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
let processedCount = 0;
let successCount = 0;
let failureCount = 0;
const results = {
  success: [],
  failure: [],
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

// 기사를 Ghost 형식으로 변환
function convertToGhostPost(article) {
  // HTML 내용 추출
  let html = '';
  if (article.draft && article.draft.content) {
    html = article.draft.content;
  }

  // 제목 (또는 첫 50자)
  const title = article.title || 
    (article.draft && article.draft.title) ||
    (html.replace(/<[^>]*>/g, '').substring(0, 50) + '...') ||
    'Untitled Article';

  // 메타 설명 (excerpt)
  const excerpt = article.draft && article.draft.excerpt ? 
    article.draft.excerpt.substring(0, 300) : 
    (html.replace(/<[^>]*>/g, '').substring(0, 300) || '');

  // 카테고리 기반 태그
  const tags = [];
  if (article.category) {
    tags.push({
      name: article.category,
      visibility: 'public'
    });
  }

  // Feature image
  const featureImage = article.og_image || 
    (article.draft && article.draft.feature_image) || 
    null;

  return {
    title: title.substring(0, 255),
    html: html || '<p>Content not available</p>',
    custom_excerpt: excerpt,
    feature_image: featureImage,
    tags: tags,
    status: 'published', // 발행 상태
    visibility: 'public',
    published_at: article.published_at || new Date().toISOString()
  };
}

// 파일에서 기사 로드
function loadArticlesFromFile(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(data) ? data : [data];
  } catch (err) {
    return [];
  }
}

// 메인 프로세스
async function publishAllArticles() {
  console.log('🚀 Ghost CMS에 뉴스룸 기사 생성 시작\n');
  console.log(`📍 API URL: ${config.apiUrl}`);
  console.log(`🔑 API Key ID: ${keyId}\n`);

  const publishedDir = path.join(__dirname, '../pipeline/08-published');
  
  // 발행된 기사 폴더에서 JSON 파일 읽기
  let files;
  try {
    files = fs.readdirSync(publishedDir).filter(f => f.endsWith('.json'));
  } catch (err) {
    console.log('❌ 발행된 기사 폴더를 찾을 수 없습니다.');
    console.log(`   경로: ${publishedDir}`);
    process.exit(1);
  }

  console.log(`📄 발견된 기사 파일: ${files.length}개\n`);

  // 각 기사 처리
  for (const file of files) {
    const filePath = path.join(publishedDir, file);
    processedCount++;

    try {
      const articles = loadArticlesFromFile(filePath);
      
      if (!articles || articles.length === 0) {
        console.log(`⏭️  ${file} (내용 없음, 스킵)`);
        results.skipped.push(file);
        continue;
      }

      const article = articles[0];
      
      // 기존 ghost_id가 있으면 건너뛰기 (이미 발행됨)
      if (article.ghost_id) {
        console.log(`⏭️  ${file} (ghost_id 있음, 스킵)`);
        results.skipped.push(file);
        continue;
      }

      // Ghost 형식으로 변환
      const ghostPost = convertToGhostPost(article);

      // Ghost에 생성
      console.log(`📝 생성 중: ${ghostPost.title.substring(0, 40)}...`);
      
      const response = await makeGhostRequest('POST', '/ghost/api/v3/admin/posts/', {
        posts: [ghostPost]
      });

      if (response.status === 201 && response.body?.posts?.[0]) {
        const createdPost = response.body.posts[0];
        
        // 로컬 파일에 ghost_id 업데이트
        article.ghost_id = createdPost.id;
        article.ghost_url = createdPost.url;
        article.publish_result = {
          status: 'published',
          ghost_id: createdPost.id,
          url: createdPost.url,
          timestamp: new Date().toISOString()
        };

        fs.writeFileSync(filePath, JSON.stringify(article, null, 2));

        successCount++;
        results.success.push({
          file,
          title: ghostPost.title,
          ghostId: createdPost.id,
          url: createdPost.url
        });

        console.log(`   ✅ 생성됨 (ID: ${createdPost.id})`);
      } else if (response.status === 422) {
        // 검증 오류
        console.log(`   ⚠️  검증 오류 (422): ${response.body?.errors?.[0]?.message || 'Unknown'}`);
        results.failure.push({
          file,
          error: response.body?.errors?.[0]?.message || 'Validation error',
          status: 422
        });
        failureCount++;
      } else {
        // 기타 오류
        console.log(`   ❌ 오류 (${response.status}): ${response.body?.errors?.[0]?.message || 'Unknown error'}`);
        results.failure.push({
          file,
          error: response.body?.errors?.[0]?.message || `HTTP ${response.status}`,
          status: response.status
        });
        failureCount++;
      }

      // API 레이트 제한 회피
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err) {
      console.log(`   ❌ 요청 실패: ${err.message}`);
      results.failure.push({
        file,
        error: err.message
      });
      failureCount++;
    }
  }

  // 최종 보고
  console.log('\n' + '='.repeat(50));
  console.log(`\n✅ 처리 완료\n`);
  console.log(`📊 결과:`);
  console.log(`   성공: ${successCount}개`);
  console.log(`   실패: ${failureCount}개`);
  console.log(`   스킵: ${results.skipped.length}개`);
  console.log(`   합계: ${processedCount}개\n`);

  if (successCount > 0) {
    console.log(`🎉 ${successCount}개 기사가 Ghost에 생성되었습니다!\n`);
    console.log(`📍 확인: ${config.apiUrl}`);
  }

  if (failureCount > 0) {
    console.log(`\n⚠️  ${failureCount}개 기사 생성 실패:`);
    results.failure.forEach(f => {
      console.log(`   - ${f.file}: ${f.error}`);
    });
  }

  // 결과 파일 저장
  const reportPath = path.join(__dirname, '../pipeline/ghost-creation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    api: config.apiUrl,
    processed: processedCount,
    success: successCount,
    failure: failureCount,
    skipped: results.skipped.length,
    results: results
  }, null, 2));

  console.log(`\n📄 상세 보고서: ${reportPath}`);
}

// 실행
publishAllArticles().catch(err => {
  console.log(`❌ 치명적 오류: ${err.message}`);
  process.exit(1);
});
