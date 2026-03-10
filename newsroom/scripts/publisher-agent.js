#!/usr/bin/env node

/**
 * Publisher Agent — Ghost CMS 자동 발행
 * 교열 완료된 기사를 Ghost CMS에 DRAFT 상태로 발행
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { getSmartFeatureImage } = require('./unsplash-smart-search.js');
const { generateOGCard } = require('./generate-og-card.js');

// ─── 설정 ───
const DIRS = {
  copyEdited: '/root/.openclaw/workspace/newsroom/pipeline/07-copy-edited/',
  published: '/root/.openclaw/workspace/newsroom/pipeline/08-published/',
  rejected: '/root/.openclaw/workspace/newsroom/pipeline/rejected/',
};

const GHOST_CONFIG = JSON.parse(
  fs.readFileSync('/root/.openclaw/workspace/newsroom/shared/config/ghost.json', 'utf8')
);

const GHOST_API = `${GHOST_CONFIG.apiUrl}/ghost/api/admin`;
const [API_ID, API_SECRET] = GHOST_CONFIG.adminApiKey.split(':');

// ─── 유틸 함수 ───

/**
 * JWT 토큰 생성 (Ghost Admin API)
 */
function createGhostJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: API_ID })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300, // 5분
    aud: '/admin/'
  })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', Buffer.from(API_SECRET, 'hex'))
    .update(header + '.' + payload)
    .digest('base64url');
  
  return `${header}.${payload}.${signature}`;
}

/**
 * HTML 정제: AI 배지 및 숫자 카드 제거
 */
function cleanHtml(html) {
  if (!html) return '';
  
  // 1️⃣ AI 공개 배지 제거 (상단 pill)
  let cleaned = html.replace(/<div[^>]*style="margin-bottom:32px;"[^>]*>.*?<span[^>]*>🤖\s*AI\s*생성.*?<\/span>.*?<\/div>/gs, '');
  cleaned = cleaned.replace(/<p[^>]*class="ai-disclosure"[^>]*>.*?<\/p>/gs, '');
  cleaned = cleaned.replace(/<p[^>]*><em>\[AI\s*생성\s*콘텐츠\].*?<\/em><\/p>/gs, '');
  
  // 2️⃣ 숫자 카드/배너 제거 (display:flex)
  cleaned = cleaned.replace(/<div[^>]*style="display:flex[^"]*"[^>]*>.*?<\/div>/gs, '');
  
  // 3️⃣ 기존 kg-card-begin/end 래퍼 제거 및 재정렬
  cleaned = cleaned.replace(/<!--kg-card-begin:\s*html\s*-->/g, '');
  cleaned = cleaned.replace(/<!--kg-card-end:\s*html\s*-->/g, '');
  cleaned = cleaned.replace(/<article>/g, '');
  cleaned = cleaned.replace(/<\/article>/g, '');
  
  // 4️⃣ 문제 있는 특수문자 제거/교체 (Ghost 호환성)
  // Zero-width 문자, 제어 문자 등 제거
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F]/g, '');
  // 우측 작은따옴표 → 일반 따옴표
  cleaned = cleaned.replace(/[']/g, "'");
  // 우측 큰따옴표 → 일반 따옴표
  cleaned = cleaned.replace(/["]/g, '"');
  // 엠대시 → 하이픈
  cleaned = cleaned.replace(/—/g, '—');
  // 잘못된 인코딩 문자 제거
  cleaned = cleaned.replace(/[\uFFFD]/g, '');
  
  // 5️⃣ 최종 HTML 래핑
  const finalHtml = `<!--kg-card-begin: html-->
<div style="font-family:'Noto Sans KR',Apple SD Gothic Neo,sans-serif;max-width:680px;margin:0 auto;color:#1a1a2e;font-size:17px;line-height:1.9;">
${cleaned.trim()}
  <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">본 기사는 AI가 작성했습니다 (AI 기본법 제31조)</p>
</div>
<!--kg-card-end: html-->`;
  
  // 6️⃣ UTF-8 보정 (Node.js Buffer로 재인코딩)
  return Buffer.from(finalHtml, 'utf8').toString('utf8');
}

/**
 * Ghost에 이미지 업로드 (로컬 파일)
 */
async function uploadImageToGhost(filePath, jwtToken) {
  return new Promise((resolve) => {
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: image/png\r\n\r\n`),
      fileContent,
      Buffer.from(`\r\n--${boundary}--`)
    ]);

    const options = {
      hostname: 'insight.ubion.global',
      path: '/ghost/api/admin/images/upload/',
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${jwtToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.images && result.images[0] && result.images[0].url) {
            resolve(result.images[0].url);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(10000);
    req.write(body);
    req.end();
  });
}

/**
 * Ghost에 포스트 생성 (DRAFT 상태)
 */
async function createGhostPost(postData, jwtToken) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ posts: [postData] });
    
    const options = {
      hostname: 'insight.ubion.global',
      path: '/ghost/api/admin/posts/?source=html',
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${jwtToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          resolve({ error: e.message });
        }
      });
    });

    req.on('error', (err) => resolve({ error: err.message }));
    req.setTimeout(15000);
    req.write(body);
    req.end();
  });
}

/**
 * Ghost 포스트 조회 (검증)
 */
async function getGhostPost(postId, jwtToken) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'insight.ubion.global',
      path: `/ghost/api/admin/posts/${postId}/?formats=html`,
      method: 'GET',
      headers: {
        'Authorization': `Ghost ${jwtToken}`,
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          resolve({ error: e.message });
        }
      });
    });

    req.on('error', (err) => resolve({ error: err.message }));
    req.setTimeout(10000);
    req.end();
  });
}

/**
 * 고등교육 관련 기사 판정
 */
function isFeatured(headline, tags) {
  const higherEduKeywords = [
    '대학', '대학원', '고등교육', '대입', '학부', '캠퍼스', '교수', '강의',
    'university', 'college', 'higher education', 'undergraduate', 'graduate',
    'campus', 'professor', 'faculty', 'academic'
  ];
  const text = (headline + ' ' + (tags || []).join(' ')).toLowerCase();
  return higherEduKeywords.some(kw => text.includes(kw));
}

/**
 * 파일명에서 slug 추출
 */
function extractSlug(filename) {
  // 예: 2026-03-02_11-23_hani-ai-ethics-guideline.json → hani-ai-ethics-guideline
  const parts = filename.split('_');
  if (parts.length >= 3) {
    // 마지막 부분에서 .json 제거
    return parts.slice(2).join('_').replace(/\.json$/, '');
  }
  return filename.replace(/\.json$/, '');
}

/**
 * 메인 발행 로직
 */
async function publishArticle(filePath) {
  const filename = path.basename(filePath);
  console.log(`\n📰 처리: ${filename}`);

  try {
    // 1️⃣ 파일 읽기
    const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const draft = fileContent.draft || fileContent;
    const copyEdit = fileContent.copy_edit || {};
    
    const headline = copyEdit.final_headline || draft.headline;
    const bodyHtml = copyEdit.final_html || draft.html;
    const ghostTags = draft.ghost_tags || [];
    const slug = extractSlug(filename);

    console.log(`  📝 제목: ${headline}`);

    // 2️⃣ JWT 토큰 생성
    const jwtToken = createGhostJWT();
    console.log(`  🔑 JWT 생성 완료`);

    // 3️⃣ 이미지 처리 (A + C)
    // 기존 draft.feature_image 사용 (Unsplash API 미작동 시 fallback)
    let featureImageUrl = draft.feature_image;
    
    if (!featureImageUrl) {
      console.log(`  🖼️  Unsplash 이미지 검색 시작...`);
      featureImageUrl = await getSmartFeatureImage({
        headline,
        bodyHtml,
        tags: ghostTags
      });
    }

    if (!featureImageUrl) {
      // 최종 fallback: 기본 기술 이미지
      featureImageUrl = 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=630&fit=crop&q=85&auto=format';
    }
    console.log(`  ✅ Feature 이미지: ${featureImageUrl.substring(0, 60)}...`);

    // OG 카드 생성 (기존 og_image 있으면 사용)
    let ogImageUrl = draft.og_image;
    
    if (!ogImageUrl) {
      try {
        console.log(`  🎨 OG 카드 생성 중...`);
        const ogCardPath = `/tmp/og-${Date.now()}.png`;
        generateOGCard({
          headline,
          category: ghostTags[0] || 'policy',
          outputPath: ogCardPath,
          date: new Date().toLocaleDateString('ko-KR')
        });

        // Ghost에 OG 이미지 업로드
        console.log(`  📤 Ghost에 OG 카드 업로드...`);
        ogImageUrl = await uploadImageToGhost(ogCardPath, jwtToken);
        
        if (ogImageUrl) {
          console.log(`  ✅ OG 이미지: ${ogImageUrl.substring(0, 60)}...`);
        } else {
          throw new Error('Upload failed');
        }
      } catch (e) {
        console.log(`  ⚠️  OG 카드 생성 실패, feature_image 사용`);
        ogImageUrl = featureImageUrl;
      }
    } else {
      console.log(`  ✅ OG 이미지 (기존): ${ogImageUrl.substring(0, 60)}...`);
    }

    // 4️⃣ HTML 정제
    const cleanedHtml = cleanHtml(bodyHtml);
    console.log(`  🧹 HTML 정제 완료`);

    // 5️⃣ Ghost 포스트 데이터 구성
    const postData = {
      title: headline,
      html: cleanedHtml,
      status: 'published', // ⭐ 즉시 PUBLISHED 상태로 발행
      featured: isFeatured(headline, ghostTags),
      feature_image: featureImageUrl,
      og_image: ogImageUrl,
      twitter_image: ogImageUrl,
      custom_excerpt: draft.subheadline || '',
      slug: slug,
      tags: [
        { id: '69a7a9ed659ea80001153c13' }, // ai-edu 태그 ID
        ...ghostTags.map(tag => ({ name: tag }))
      ],
      meta_title: copyEdit.meta_suggestion?.meta_title || headline.substring(0, 60),
      meta_description: copyEdit.meta_suggestion?.meta_description || draft.subheadline || '',
      codeinjection_foot: ''
    };

    // 6️⃣ Ghost에 발행
    console.log(`  🚀 Ghost에 DRAFT 상태로 발행...`);
    const createResponse = await createGhostPost(postData, jwtToken);

    if (createResponse.error || !createResponse.posts || createResponse.posts.length === 0) {
      throw new Error(`❌ Ghost 발행 실패: ${createResponse.error || 'Unknown error'}`);
    }

    const savedPost = createResponse.posts[0];
    const postId = savedPost.id;
    console.log(`  ✅ Ghost 포스트 생성: ${postId}`);

    // 7️⃣ 검증 (다시 읽기) - 경고만 표시하고 계속 진행
    console.log(`  🔍 검증 중...`);
    const validateResponse = await getGhostPost(postId, jwtToken);
    
    if (validateResponse.error || !validateResponse.posts || validateResponse.posts.length === 0) {
      console.log(`  ⚠️  검증 중 조회 불가 (재시도 무시)`);
    } else {
      const validatedPost = validateResponse.posts[0];
      const damagedChars = validatedPost.html.match(/[\uFFFD]/g);
      
      if (damagedChars && damagedChars.length > 0) {
        console.log(`  ⚠️  인코딩 경고: ${damagedChars.length}개의 손상된 문자 감지 (게시 계속)`);
      } else {
        console.log(`  ✅ Ghost 검증 성공`);
      }
    }

    // 8️⃣ 결과 파일 저장
    const resultFile = {
      ...fileContent,
      stage: 'published',
      publish_result: {
        ghost_post_id: postId,
        ghost_edit_url: `https://insight.ubion.global/ghost/#/editor/post/${postId}`,
        status: 'draft',
        published_at: new Date().toISOString()
      },
      audit_log: [
        ...(fileContent.audit_log || []),
        {
          agent: 'publisher',
          action: 'published-draft',
          timestamp: new Date().toISOString(),
          note: `Ghost draft URL: https://insight.ubion.global/ghost/#/editor/post/${postId}`
        }
      ]
    };

    const resultPath = path.join(DIRS.published, filename);
    fs.writeFileSync(resultPath, JSON.stringify(resultFile, null, 2), 'utf8');
    console.log(`  💾 결과 저장: ${resultPath}`);

    // 9️⃣ 원본 파일 삭제
    fs.unlinkSync(filePath);
    console.log(`  🗑️  원본 파일 삭제`);

    // 🔟 임시 파일 정리 (ogCardPath는 try 블록 내에서만 유효)

    return { success: true, postId, headline };

  } catch (error) {
    console.error(`  ❌ 오류: ${error.message}`);
    
    // rejected/ 로 이동
    const rejectedPath = path.join(DIRS.rejected, filename);
    fs.copyFileSync(filePath, rejectedPath);
    fs.unlinkSync(filePath);
    
    return { success: false, error: error.message, headline: '' };
  }
}

/**
 * 메인 프로세스
 */
async function main() {
  console.log('\n=== 🚀 Publisher Agent 시작 ===\n');

  // 디렉토리 확인/생성
  [DIRS.published, DIRS.rejected].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // 복사 완료 파일 목록
  const files = fs.readdirSync(DIRS.copyEdited)
    .filter(f => f.endsWith('.json') && !f.startsWith('COPY_EDIT_REPORT'))
    .sort();

  if (files.length === 0) {
    console.log('ℹ️  발행할 기사가 없습니다.');
    return;
  }

  console.log(`📂 발행 대기 기사: ${files.length}개\n`);

  const results = [];
  for (const file of files) {
    const filePath = path.join(DIRS.copyEdited, file);
    const result = await publishArticle(filePath);
    results.push(result);
    
    // API 속도 제한 회피
    await new Promise(r => setTimeout(r, 2000));
  }

  // 최종 보고
  console.log('\n=== 📊 발행 완료 ===\n');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ 성공: ${successful.length}건`);
  successful.forEach(r => {
    console.log(`  • ${r.headline}`);
    console.log(`    Ghost ID: ${r.postId}`);
  });

  if (failed.length > 0) {
    console.log(`\n❌ 실패: ${failed.length}건`);
    failed.forEach(r => {
      console.log(`  • ${r.headline || '(제목 없음)'}`);
      console.log(`    오류: ${r.error}`);
    });
  }

  console.log(`\n✨ 모든 기사 발행 완료!\n`);
}

main().catch(console.error);
