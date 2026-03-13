#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

// 이미지 생성 모듈
const { getFeatureImageUrl } = require('/root/.openclaw/workspace/newsroom/scripts/get-feature-image.js');

// 경로
const inputDir = '/root/.openclaw/workspace/newsroom/pipeline/07-copy-edited/';
const outputDir = '/root/.openclaw/workspace/newsroom/pipeline/08-published/';
const rejectedDir = '/root/.openclaw/workspace/newsroom/pipeline/rejected/';
const configPath = '/root/.openclaw/workspace/newsroom/shared/config/ghost.json';
const usedImagesPath = '/root/.openclaw/workspace/newsroom/shared/config/used-images.json';

// Ghost 설정 로드
const ghostConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const [apiId, apiSecret] = ghostConfig.adminApiKey.split(':');

// JWT 토큰 생성
function generateJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: apiId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const message = header + '.' + payload;
  const sig = crypto
    .createHmac('sha256', Buffer.from(apiSecret, 'hex'))
    .update(message)
    .digest('base64url');
  return message + '.' + sig;
}

// 고등교육 여부 판단
function isFeatured(headline, tags) {
  const higherEduKeywords = [
    '대학', '대학원', '고등교육', '대입', '학부', '캠퍼스', '교수', '강의',
    'university', 'college', 'higher education', 'undergraduate', 'graduate',
    'campus', 'professor', 'faculty', 'academic', 'graduate school'
  ];
  const text = (headline + ' ' + (tags || []).join(' ')).toLowerCase();
  return higherEduKeywords.some(kw => text.includes(kw));
}

// 📝 참고: getFeatureImageUrl은 이제 외부 모듈에서 import됨 (위 참고)

// OG 카드 생성 (URL 반환, 실제로는 이미지 생성 필요)
async function generateOGCard(headline, category, date) {
  // 실제 구현에서는 generate-og-card.js 호출
  // 여기서는 기본 URL 반환
  const encoded = encodeURIComponent(`${headline}\n${date}`);
  return `https://og-card-placeholder.example.com/?title=${encoded}&category=${category}`;
}

// HTML 정제: AI 배지와 수치 카드 제거, 올바른 구조 유지
function cleanHTML(html) {
  let cleaned = html;
  
  // AI 공개 배지 제거 (상단 pill)
  cleaned = cleaned.replace(/<div style="margin-bottom:32px;"><span[^>]*>🤖 AI 생성[^<]*<\/span><\/div>/g, '');
  cleaned = cleaned.replace(/<div[^>]*style="[^"]*AI[^"]*"[^>]*>[\s\S]*?<\/div>/g, '');
  
  // 수치 카드/배너 제거 (display:flex 포함)
  cleaned = cleaned.replace(/<div style="display:flex;gap:14px[^>]*>[\s\S]*?<\/div>/g, '');
  
  // 빈 줄 정리
  cleaned = cleaned.replace(/\n\n\n+/g, '\n\n');
  
  return cleaned;
}

// 파일명에서 slug 생성 (날짜 prefix 제거)
function generateSlug(filename) {
  // 예: 2026-03-05_21-06_ai-ethics-policy-universities.json → ai-ethics-policy-universities
  const name = filename.replace(/\.json$/, '');
  const parts = name.split('_');
  // 처음 2개는 날짜와 시간, 나머지가 실제 slug
  return parts.slice(2).join('_');
}

// Ghost에 게시
async function publishToGhost(post, filename) {
  const jwt = generateJWT();
  const slug = generateSlug(filename);
  
  const tags = [
    { id: '69a7a9ed659ea80001153c13' }, // ai-edu 태그 필수
    ...post.draft.ghost_tags.map(tag => ({ name: tag }))
  ];
  
  // 피처 이미지 선택 (카테고리별 검증된 풀 사용)
  const featureImageUrl = getFeatureImageUrl({
    headline: post.draft.headline,
    tags: post.draft.ghost_tags,
    recentIdsFile: usedImagesPath
  });
  
  // HTML 정규화: 이미지 URL의 쿼리 파라미터가 손상되지 않도록
  // (Ghost API는 ?source=html 사용 시 & → &amp; 변환이 안 되도록 처리해야 함)
  let htmlContent = post.draft.html;
  // 혹시 이미 &amp;로 escape된 경우 원상복구
  if (htmlContent.includes('&amp;')) {
    htmlContent = htmlContent.replace(/&amp;/g, '&');
  }

  const payload = {
    posts: [{
      title: post.draft.headline,
      html: htmlContent,
      status: 'published',
      featured: isFeatured(post.draft.headline, post.draft.ghost_tags),
      tags: tags,
      meta_title: post.draft.headline,
      meta_description: post.draft.subheadline,
      custom_excerpt: post.draft.subheadline,
      slug: slug,
      feature_image: featureImageUrl,
      og_image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85',
      twitter_image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85',
      codeinjection_foot: ''
    }]
  };
  
  // Ghost API 호출 (https 모듈 사용 — curl의 쉘 이스케이프 문제 회피)
  const https = require('https');
  
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'ubion.ghost.io',
      path: '/ghost/api/admin/posts/?source=html',
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${jwt}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.errors) {
            reject(new Error(`Ghost API error: ${response.errors.map(e => e.message).join(', ')}`));
          } else {
            resolve(response.posts[0]);
          }
        } catch (e) {
          reject(new Error(`Failed to parse Ghost response: ${e.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 검증: Ghost에서 다시 읽어서 손상된 문자 확인
async function validateGhostPost(postId, jwt) {
  const curlCmd = `curl -s -X GET \
    "https://ubion.ghost.io/ghost/api/admin/posts/${postId}/?formats=html" \
    -H "Authorization: Ghost ${jwt}"`;
  
  try {
    const { stdout } = await execPromise(curlCmd);
    const response = JSON.parse(stdout);
    
    if (response.errors) {
      throw new Error(`Validation failed: ${response.errors.map(e => e.message).join(', ')}`);
    }
    
    const html = response.posts[0].html;
    const damaged = html.match(/[\uFFFD]/g);
    
    if (damaged && damaged.length > 0) {
      throw new Error(`Encoding error: ${damaged.length} corrupted characters detected`);
    }
    
    return true;
  } catch (error) {
    throw new Error(`Ghost validation error: ${error.message}`);
  }
}

// 📋 HTML 검증 함수 (내용 부족 기사 거부)
function validateHTMLContent(html, headline) {
  const cleanText = html.replace(/<[^>]*>/g, '').trim();
  const wordCount = cleanText.split(/\s+/).length;
  
  // 최소 기준
  const minChars = 1500;  // 1500자 이상
  const minWords = 200;   // 200단어 이상
  
  const errors = [];
  
  if (html.length < minChars) {
    errors.push(`HTML이 너무 짧음 (${html.length}자 < ${minChars}자)`);
  }
  
  if (wordCount < minWords) {
    errors.push(`본문 단어 수 부족 (${wordCount}단어 < ${minWords}단어)`);
  }
  
  // 주요 섹션 확인
  const hasTitle = html.includes(headline) || cleanText.includes(headline);
  const hasBody = cleanText.length > 500;
  
  if (!hasBody) {
    errors.push('본문 내용 거의 없음');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    stats: { htmlLength: html.length, wordCount, hasTitle, hasBody }
  };
}

// 메인 발행 함수
async function publishArticle(filename) {
  console.log(`\n[발행] 처리 중: ${filename}`);
  
  try {
    // 1. 파일 읽기
    const filepath = path.join(inputDir, filename);
    const article = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    
    // 1-1. HTML 검증 (NEW)
    const htmlValidation = validateHTMLContent(article.draft.html, article.draft.headline);
    if (!htmlValidation.valid) {
      throw new Error(`HTML 검증 실패: ${htmlValidation.errors.join('; ')}`);
    }
    console.log(`✅ HTML 검증 완료 (${htmlValidation.stats.htmlLength}자, ${htmlValidation.stats.wordCount}단어)`);
    
    // 2. HTML 정제
    article.draft.html = cleanHTML(article.draft.html);
    
    // 3. Ghost에 발행
    const ghostPost = await publishToGhost(article, filename);
    console.log(`✅ Ghost 발행 성공 (ID: ${ghostPost.id})`);
    
    // 4. 검증
    const jwt = generateJWT();
    await validateGhostPost(ghostPost.id, jwt);
    console.log(`✅ Ghost 검증 완료`);
    
    // 5. 결과 파일 저장
    const publishedArticle = {
      ...article,
      stage: 'published',
      publish_result: {
        ghost_post_id: ghostPost.id,
        ghost_draft_url: `https://ubion.ghost.io/ghost/#/editor/post/${ghostPost.id}`,
        status: 'published',
        published_at: new Date().toISOString()
      },
      audit_log: [
        ...article.audit_log,
        {
          agent: 'publisher',
          action: 'published-draft',
          timestamp: new Date().toISOString(),
          note: `Ghost draft URL: https://ubion.ghost.io/ghost/#/editor/post/${ghostPost.id}`
        }
      ]
    };
    
    // 출력 디렉토리 생성
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, JSON.stringify(publishedArticle, null, 2));
    console.log(`✅ 결과 저장: ${outputPath}`);
    
    // 6. 원본 파일 삭제
    fs.unlinkSync(filepath);
    console.log(`✅ 원본 파일 삭제: ${filename}`);
    
    return { success: true, ghostPostId: ghostPost.id };
  } catch (error) {
    console.error(`❌ 오류: ${error.message}`);
    
    // 실패 파일을 rejected 디렉토리로 이동
    if (!fs.existsSync(rejectedDir)) fs.mkdirSync(rejectedDir, { recursive: true });
    
    const filepath = path.join(inputDir, filename);
    if (fs.existsSync(filepath)) {
      const rejectedPath = path.join(rejectedDir, filename);
      fs.renameSync(filepath, rejectedPath);
      console.log(`⚠️  거부됨: ${rejectedPath}`);
    }
    
    return { success: false, error: error.message };
  }
}

// 메인 실행
async function main() {
  console.log('🤖 발행 에이전트 시작...');
  
  // 07-copy-edited/ 디렉토리 확인
  if (!fs.existsSync(inputDir)) {
    console.log('⚠️  입력 디렉토리 없음:', inputDir);
    process.exit(0);
  }
  
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.log('ℹ️  처리할 파일 없음');
    process.exit(0);
  }
  
  console.log(`📦 처리할 파일: ${files.length}개\n`);
  
  let successCount = 0;
  const results = [];
  
  for (const filename of files) {
    const result = await publishArticle(filename);
    results.push({ filename, ...result });
    
    if (result.success) {
      successCount++;
    }
  }
  
  // 결과 보고
  console.log(`\n📊 발행 완료:`);
  console.log(`✅ 성공: ${successCount}/${files.length}`);
  
  for (const result of results) {
    if (result.success) {
      console.log(`  → ${result.filename}`);
    } else {
      console.log(`  ❌ ${result.filename}: ${result.error}`);
    }
  }
}

main().catch(console.error);
