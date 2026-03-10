#!/usr/bin/env node

/**
 * Publisher Agent — Ghost CMS Draft 발행
 * 
 * 입력: /root/.openclaw/workspace/newsroom/pipeline/07-copy-edited/
 * 출력: /root/.openclaw/workspace/newsroom/pipeline/08-published/
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// === CONFIG ===
const COPY_EDITED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/07-copy-edited';
const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
const REJECTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/rejected';
const GHOST_CONFIG_FILE = '/root/.openclaw/workspace/newsroom/shared/config/ghost.json';
const USED_IMAGES_FILE = '/root/.openclaw/workspace/newsroom/shared/config/used-images.json';

// Ghost설정 로드
function loadGhostConfig() {
  const configJson = JSON.parse(fs.readFileSync(GHOST_CONFIG_FILE, 'utf8'));
  return configJson;
}

// JWT 토큰 생성 (Ghost Admin API)
function generateJWT(apiKey) {
  const [id, secret] = apiKey.split(':');
  const algorithm = 'HS256';
  const now = Math.floor(Date.now() / 1000);
  
  const header = Buffer.from(JSON.stringify({
    alg: algorithm,
    typ: 'JWT',
    kid: id
  })).toString('base64url');
  
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300, // 5분 만료
    aud: '/admin/'
  })).toString('base64url');
  
  const signature = crypto.createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(header + '.' + payload)
    .digest('base64url');
  
  return header + '.' + payload + '.' + signature;
}

// 고등교육 판단
function isFeaturedArticle(headline, tags) {
  const higherEduKeywords = [
    '대학', '대학원', '고등교육', '대입', '학부', '캠퍼스', '교수', '강의',
    'university', 'college', 'higher education', 'undergraduate', 'graduate',
    'campus', 'professor', 'faculty', 'academic'
  ];
  
  const text = (headline + ' ' + (tags || []).join(' ')).toLowerCase();
  return higherEduKeywords.some(kw => text.includes(kw));
}

// HTML 정제: AI 배지 및 숫자 카드 제거
function sanitizeHTML(html) {
  // AI 공개 배지 제거
  let cleaned = html.replace(/<div[^>]*style="[^"]*margin-bottom:\s*32px[^"]*"[^>]*>[\s\S]*?🤖[\s\S]*?<\/div>/g, '');
  
  // display: flex 형태의 숫자 카드 제거
  cleaned = cleaned.replace(/<div[^>]*style="[^"]*display:\s*flex[^"]*"[^>]*>[\s\S]*?<\/div>/g, '');
  
  // 이미 올바른 구조면 그대로 반환
  if (cleaned.includes('<!--kg-card-begin: html-->')) {
    return cleaned;
  }
  
  // 구조가 없으면 기본 래퍼로 감싸기
  return `<!--kg-card-begin: html-->\n<div style="font-family:'Noto Sans KR',Apple SD Gothic Neo,sans-serif;max-width:680px;margin:0 auto;color:#1a1a2e;font-size:17px;line-height:1.9;">\n${cleaned}\n</div>\n<!--kg-card-end: html-->`;
}

// Slug 생성: 파일명에서 날짜 prefix 제거
function generateSlug(filename) {
  // 패턴: 2026-03-05_0404_npr-ai-college-rules.json
  // → npr-ai-college-rules
  const match = filename.match(/^\d{4}-\d{2}-\d{2}_[\d_]*(.+?)\.json$/);
  return match ? match[1] : filename.replace('.json', '');
}

// Ghost API 호출
function callGhostAPI(endpoint, method, jwt, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Ghost ${jwt}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(body))
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject({
              statusCode: res.statusCode,
              error: json.errors || json
            });
          }
        } catch (e) {
          reject({ error: 'Invalid JSON response', raw: data });
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

// 재시도 로직
async function publishWithRetry(postData, jwt, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await callGhostAPI(
        'https://insight.ubion.global/ghost/api/admin/posts/?source=html',
        'POST',
        jwt,
        postData
      );
      return response;
    } catch (err) {
      console.error(`[${new Date().toISOString()}] 시도 #${attempt} 실패:`, err.error || err);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
      } else {
        throw err;
      }
    }
  }
}

// 메인 발행 함수
async function publishArticle(filePath) {
  const filename = path.basename(filePath);
  console.log(`\n[${new Date().toISOString()}] 처리 중: ${filename}`);
  
  try {
    // 1. 파일 읽기
    const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // 2. Ghost 설정 로드
    const ghostConfig = loadGhostConfig();
    const jwt = generateJWT(ghostConfig.adminApiKey);
    
    // 3. 필수 데이터 추출
    const headline = fileContent.copy_edit?.final_headline || fileContent.draft?.headline;
    const subheadline = fileContent.draft?.subheadline || '';
    let html = fileContent.copy_edit?.final_html || fileContent.draft?.html || '';
    
    // HTML 정제
    html = sanitizeHTML(html);
    
    // Ghost 태그 (ai-edu 필수)
    let tags = [{ id: '69a7a9ed659ea80001153c13' }]; // ai-edu 태그 ID
    if (fileContent.copy_edit?.ghost_tags && Array.isArray(fileContent.copy_edit.ghost_tags)) {
      tags = tags.concat(fileContent.copy_edit.ghost_tags.map(tag => 
        typeof tag === 'string' ? tag : tag.name
      ));
    } else if (fileContent.draft?.ghost_tags && Array.isArray(fileContent.draft.ghost_tags)) {
      tags = tags.concat(fileContent.draft.ghost_tags);
    }
    
    // Meta 정보
    const metaTitle = fileContent.copy_edit?.meta_suggestion?.meta_title || headline;
    const metaDescription = fileContent.copy_edit?.meta_suggestion?.meta_description || subheadline;
    
    // Slug
    const slug = generateSlug(filename);
    
    // 고등교육 여부
    const featured = isFeaturedArticle(headline, fileContent.copy_edit?.ghost_tags || fileContent.draft?.ghost_tags);
    
    // 4. Ghost Post 생성
    const postData = {
      posts: [{
        title: headline,
        html: html,
        status: 'published', // ⚠️ PUBLISHED로 즉시 발행
        featured: featured,
        tags: tags,
        meta_title: metaTitle,
        meta_description: metaDescription,
        custom_excerpt: subheadline,
        slug: slug,
        codeinjection_foot: ''
      }]
    };
    
    console.log(`  → 제목: ${headline}`);
    console.log(`  → Featured: ${featured}`);
    console.log(`  → Slug: ${slug}`);
    
    // 5. API 호출 (재시도 포함)
    const response = await publishWithRetry(postData, jwt);
    
    if (!response.posts || response.posts.length === 0) {
      throw new Error('No post in response');
    }
    
    const publishedPost = response.posts[0];
    console.log(`  ✅ 발행 성공! Ghost Post ID: ${publishedPost.id}`);
    
    // 6. 결과 파일 저장 (08-published/)
    const resultData = {
      ...fileContent,
      stage: 'published',
      publish_result: {
        ghost_post_id: publishedPost.id,
        ghost_draft_url: `https://insight.ubion.global/ghost/#/editor/post/${publishedPost.id}`,
        status: 'published',
        published_at: new Date().toISOString()
      },
      audit_log: [
        ...(fileContent.audit_log || []),
        {
          agent: 'publisher',
          action: 'published-draft',
          timestamp: new Date().toISOString(),
          note: `Ghost Post ID: ${publishedPost.id}, Draft URL: https://insight.ubion.global/ghost/#/editor/post/${publishedPost.id}`
        }
      ]
    };
    
    // 출력 디렉토리 생성
    if (!fs.existsSync(PUBLISHED_DIR)) {
      fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
    }
    
    const outputPath = path.join(PUBLISHED_DIR, filename);
    fs.writeFileSync(outputPath, JSON.stringify(resultData, null, 2));
    console.log(`  → 결과 저장: ${outputPath}`);
    
    // 7. 원본 파일 삭제
    fs.unlinkSync(filePath);
    console.log(`  → 원본 파일 삭제 완료`);
    
    return {
      success: true,
      headline: headline,
      ghostUrl: `https://insight.ubion.global/ghost/#/editor/post/${publishedPost.id}`
    };
    
  } catch (error) {
    console.error(`  ❌ 오류: ${error.message || JSON.stringify(error)}`);
    
    // 거부된 파일 저장
    if (!fs.existsSync(REJECTED_DIR)) {
      fs.mkdirSync(REJECTED_DIR, { recursive: true });
    }
    
    const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const resultData = {
      ...fileContent,
      stage: 'rejected',
      rejection_reason: error.message || JSON.stringify(error),
      rejected_at: new Date().toISOString()
    };
    
    const rejectedPath = path.join(REJECTED_DIR, filename);
    fs.writeFileSync(rejectedPath, JSON.stringify(resultData, null, 2));
    console.log(`  → 거부 파일 저장: ${rejectedPath}`);
    
    return {
      success: false,
      headline: fileContent.draft?.headline || 'Unknown',
      error: error.message
    };
  }
}

// 메인 실행
async function main() {
  console.log(`\n========================================`);
  console.log(`AskedTech Publisher Agent`);
  console.log(`시작: ${new Date().toISOString()}`);
  console.log(`========================================`);
  
  // 교열 완료 파일 검색
  if (!fs.existsSync(COPY_EDITED_DIR)) {
    console.log(`❌ 입력 디렉토리 없음: ${COPY_EDITED_DIR}`);
    process.exit(1);
  }
  
  const files = fs.readdirSync(COPY_EDITED_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  if (files.length === 0) {
    console.log(`📭 교열 완료 기사 없음`);
    process.exit(0);
  }
  
  console.log(`\n📋 발행 대상: ${files.length}개 기사\n`);
  
  // 각 파일 처리
  const results = [];
  for (const file of files) {
    const filePath = path.join(COPY_EDITED_DIR, file);
    const result = await publishArticle(filePath);
    results.push(result);
  }
  
  // 최종 보고
  console.log(`\n========================================`);
  console.log(`발행 완료 보고`);
  console.log(`========================================\n`);
  
  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);
  
  console.log(`✅ 성공: ${successes.length}개`);
  successes.forEach(r => {
    console.log(`  • ${r.headline}`);
    console.log(`    → ${r.ghostUrl}\n`);
  });
  
  if (failures.length > 0) {
    console.log(`❌ 실패: ${failures.length}개`);
    failures.forEach(r => {
      console.log(`  • ${r.headline}`);
      console.log(`    → ${r.error}\n`);
    });
  }
  
  console.log(`========================================`);
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
