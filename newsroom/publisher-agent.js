#!/usr/bin/env node
/**
 * Publisher Agent: 교열 완료 기사 → Ghost CMS 발행
 * 역할: PUBLISHED 상태로 즉시 게시
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============ CONFIG ============
const PIPELINE_BASE = '/root/.openclaw/workspace/newsroom/pipeline';
const INPUT_DIR = path.join(PIPELINE_BASE, '07-copy-edited');
const OUTPUT_DIR = path.join(PIPELINE_BASE, '08-published');
const REJECTED_DIR = path.join(PIPELINE_BASE, 'rejected');
const CONFIG_FILE = '/root/.openclaw/workspace/newsroom/shared/config/ghost.json';

// Ghost API
const { apiUrl, adminApiKey } = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const GHOST_URL = apiUrl;
const API_KEY = adminApiKey;
const ADMIN_API_URL = `${GHOST_URL}/ghost/api/admin`;

// ============ UTILITIES ============
function log(msg, level = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${msg}`);
}

function generateJWT(apiKey) {
  const [id, secret] = apiKey.split(':');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function getSlugFromFilename(filename) {
  // 예: 2026-03-06_0437_lg-ai-graduate-school.json → lg-ai-graduate-school
  const match = filename.match(/^\d{4}-\d{2}-\d{2}_\d{4}_(.+)\.json$/);
  return match ? match[1] : filename.replace('.json', '');
}

function getHigherEdKeywords() {
  return [
    '대학', '대학원', '고등교육', '대입', '학부', '캠퍼스', '교수', '강의',
    'university', 'college', 'higher education', 'undergraduate', 'graduate',
    'campus', 'professor', 'faculty', 'academic'
  ];
}

function isFeaturedArticle(headline, tags = []) {
  const keywords = getHigherEdKeywords();
  const text = `${headline} ${(tags || []).join(' ')}`.toLowerCase();
  return keywords.some(kw => text.includes(kw));
}

function extractImageFromHtml(html) {
  // HTML에서 첫 번째 img src 추출
  const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i;
  const match = html.match(imgRegex);
  return match ? match[1] : null;
}

async function getUnsplashImage(headline, bodyHtml, tags) {
  try {
    log(`📷 Unsplash 이미지 검색: "${headline}"`);
    
    // 1. draft.html에서 기존 이미지 추출 시도
    const existingImage = extractImageFromHtml(bodyHtml);
    if (existingImage) {
      log(`✅ draft.html에서 이미지 추출: ${existingImage}`);
      return existingImage;
    }
    
    // 2. Unsplash API 호출 (API 키 설정된 경우)
    log('⚠️  draft.html에 이미지 없음, Unsplash 검색 시도');
    const { getSmartFeatureImage } = require('/root/.openclaw/workspace/newsroom/scripts/unsplash-smart-search.js');
    const imageUrl = await getSmartFeatureImage({ headline, bodyHtml, tags });
    
    if (!imageUrl) {
      log('❌ Unsplash 이미지 검색 실패, 기본 이미지 사용', 'warn');
      // 3. 대체: 기본 기술 이미지
      return 'https://images.unsplash.com/photo-1516321318423-f06f70674e90?w=1200&h=630&fit=crop&q=85&auto=format';
    }
    log(`✅ Unsplash 이미지 획득: ${imageUrl}`);
    return imageUrl;
  } catch (err) {
    log(`⚠️  Unsplash 이미지 처리 오류: ${err.message}, 기본 이미지 사용`);
    return 'https://images.unsplash.com/photo-1516321318423-f06f70674e90?w=1200&h=630&fit=crop&q=85&auto=format';
  }
}

async function generateOGCard(headline, category, date) {
  try {
    log(`🎨 OG 카드 생성: "${headline}"`);
    
    // generate-og-card.js 시도
    try {
      const { generateOGCard } = require('/root/.openclaw/workspace/newsroom/scripts/generate-og-card.js');
      const outputPath = `/tmp/og-card-${Date.now()}.png`;
      const cardUrl = await generateOGCard({ headline, category, outputPath, date });
      
      if (cardUrl) {
        log(`✅ OG 카드 생성 완료: ${cardUrl}`);
        return cardUrl;
      }
    } catch (scriptErr) {
      log(`⚠️  OG 카드 생성 실패: ${scriptErr.message}`, 'warn');
    }
    
    // 대체: 기본 기술 OG 이미지 URL
    log('⚠️  OG 카드 생성 스킵, 기본 이미지 사용');
    return 'https://images.unsplash.com/photo-1516321318423-f06f70674e90?w=1200&h=630&fit=crop&q=85&auto=format';
  } catch (err) {
    log(`⚠️  OG 카드 처리 오류: ${err.message}, 기본 이미지 사용`);
    return 'https://images.unsplash.com/photo-1516321318423-f06f70674e90?w=1200&h=630&fit=crop&q=85&auto=format';
  }
}

async function uploadImageToGhost(imageUrl, jwt) {
  try {
    log(`📤 Ghost에 이미지 업로드: ${imageUrl}`);
    
    // Ghost Images API 호출
    const response = await fetch(`${ADMIN_API_URL}/images/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${jwt}`,
      },
      body: imageUrl // URL 직접 전달 또는 파일 업로드
    });
    
    if (!response.ok) {
      log(`❌ Ghost 이미지 업로드 실패: ${response.statusText}`, 'error');
      return imageUrl; // Fallback: URL 그대로 사용
    }
    
    const result = await response.json();
    return result.images?.[0]?.url || imageUrl;
  } catch (err) {
    log(`⚠️  Ghost 이미지 업로드 오류 (URL 직접 사용): ${err.message}`);
    return imageUrl;
  }
}

function cleanHTMLContent(html) {
  // 1. AI 공개 배지 제거
  let cleaned = html.replace(/<div[^>]*>[\s]*<span[^>]*>🤖\s+AI[^<]*<\/span>[\s]*<\/div>/gi, '');
  
  // 2. 수치 카드/배너 제거 (display:flex 형태)
  cleaned = cleaned.replace(/<div[^>]*style="[^"]*display\s*:\s*flex[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // 3. 기본 구조 검증
  if (!cleaned.includes('<!--kg-card-begin: html-->')) {
    log('⚠️  HTML 구조 변경 필요', 'warn');
  }
  
  return cleaned;
}

async function publishToGhost(draft, copyEdit, jwt, filename) {
  try {
    log(`🚀 Ghost 발행 준비: "${draft.headline}"`);
    
    // 이미지 처리
    const featureUrl = await getUnsplashImage(draft.headline, copyEdit.final_html || draft.html, draft.ghost_tags);
    if (!featureUrl) {
      throw new Error('Feature image search failed');
    }
    
    const category = draft.ghost_tags?.[0] || 'policy';
    const ogCardUrl = await generateOGCard(draft.headline, category, new Date().toLocaleDateString('ko-KR'));
    if (!ogCardUrl) {
      throw new Error('OG card generation failed');
    }
    
    // HTML 정제
    const htmlContent = copyEdit.final_html || draft.html;
    const cleanedHtml = cleanHTMLContent(htmlContent);
    
    // Ghost 요청 본문
    const postData = {
      posts: [{
        title: copyEdit.final_headline || draft.headline,
        html: cleanedHtml,
        status: 'published',
        featured: isFeaturedArticle(draft.headline, draft.ghost_tags),
        tags: [
          { id: '69a7a9ed659ea80001153c13' }, // ai-edu 태그 (필수)
          ...((draft.ghost_tags || []).map(tag => ({ name: tag })))
        ],
        meta_title: copyEdit.meta_suggestion?.meta_title || draft.headline.substring(0, 70),
        meta_description: copyEdit.meta_suggestion?.meta_description || draft.subheadline,
        custom_excerpt: draft.subheadline,
        slug: getSlugFromFilename(filename),
        feature_image: featureUrl,
        og_image: ogCardUrl,
        twitter_image: ogCardUrl,
        codeinjection_foot: ''
      }]
    };
    
    log(`📝 Ghost POST 요청: ${JSON.stringify(postData, null, 2)}`);
    
    // Ghost API 호출
    const response = await fetch(`${ADMIN_API_URL}/posts/?source=html`, {
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`❌ Ghost API 오류: ${response.statusText} - ${errorText}`, 'error');
      throw new Error(`Ghost API error: ${response.statusText}`);
    }
    
    const result = await response.json();
    const postId = result.posts[0].id;
    const postUrl = `${GHOST_URL}/ghost/#/editor/post/${postId}`;
    
    log(`✅ Ghost 발행 성공: POST ID ${postId}`);
    log(`🔗 Ghost 편집 URL: ${postUrl}`);
    
    // 검증: Ghost에서 다시 조회
    const getResponse = await fetch(`${ADMIN_API_URL}/posts/${postId}/?formats=html`, {
      headers: {
        'Authorization': `Ghost ${jwt}`
      }
    });
    
    if (!getResponse.ok) {
      throw new Error(`Failed to validate post: ${getResponse.statusText}`);
    }
    
    const savedPost = await getResponse.json();
    const damaged = savedPost.posts[0].html.match(/[\uFFFD]/g);
    
    if (damaged && damaged.length > 0) {
      log(`❌ 인코딩 오류 감지: ${damaged.length}개 손상된 문자`, 'error');
      throw new Error('Ghost encoding error detected');
    }
    
    log(`✅ Ghost 검증 통과`);
    
    return {
      ghost_post_id: postId,
      ghost_draft_url: postUrl,
      status: 'published',
      published_at: new Date().toISOString(),
      feature_image: featureUrl,
      og_image: ogCardUrl
    };
  } catch (err) {
    log(`❌ Ghost 발행 오류: ${err.message}`, 'error');
    throw err;
  }
}

async function processArticle(filename) {
  const inputFile = path.join(INPUT_DIR, filename);
  log(`\n${'='.repeat(60)}`);
  log(`📰 기사 처리: ${filename}`);
  log(`${'='.repeat(60)}`);
  
  try {
    // 파일 읽기
    const content = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const { draft, copy_edit: copyEdit } = content;
    
    // JWT 토큰 생성
    const jwt = generateJWT(API_KEY);
    
    // Ghost 발행
    const publishResult = await publishToGhost(draft, copyEdit || {}, jwt, filename);
    
    // 결과 파일 저장
    const resultContent = {
      ...content,
      stage: 'published',
      publish_result: publishResult,
      audit_log: [
        ...(content.audit_log || []),
        {
          agent: 'publisher',
          action: 'published',
          timestamp: new Date().toISOString(),
          note: `Ghost published: ${publishResult.ghost_draft_url}`
        }
      ]
    };
    
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    const outputFile = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(outputFile, JSON.stringify(resultContent, null, 2), 'utf8');
    log(`💾 결과 저장: ${outputFile}`);
    
    // 원본 파일 삭제
    fs.unlinkSync(inputFile);
    log(`🗑️  원본 파일 삭제: ${inputFile}`);
    
    log(`\n✅ 기사 발행 완료: ${draft.headline}`);
    return { success: true, headline: draft.headline, postId: publishResult.ghost_post_id };
  } catch (err) {
    log(`\n❌ 기사 처리 실패: ${err.message}`, 'error');
    
    // rejected/ 이동
    if (!fs.existsSync(REJECTED_DIR)) {
      fs.mkdirSync(REJECTED_DIR, { recursive: true });
    }
    
    const rejectedFile = path.join(REJECTED_DIR, filename);
    fs.copyFileSync(inputFile, rejectedFile);
    fs.unlinkSync(inputFile);
    
    log(`📁 파일 이동: ${rejectedFile}`);
    return { success: false, headline: filename, error: err.message };
  }
}

async function main() {
  log('🚀 Publisher Agent 시작');
  
  // 입력 디렉토리 확인
  if (!fs.existsSync(INPUT_DIR)) {
    log(`❌ 입력 디렉토리 없음: ${INPUT_DIR}`, 'error');
    process.exit(1);
  }
  
  let files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.json'));
  
  // 오늘(2026-03-06) 자정 이후 파일만 필터링 (크론 작업용)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0]; // 2026-03-06
  
  files = files.filter(f => {
    const dateMatch = f.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      return dateMatch[1] === todayStr;
    }
    return false;
  });
  
  if (files.length === 0) {
    log(`⚠️  오늘(${todayStr}) 처리할 파일이 없습니다. HEARTBEAT_OK`);
    process.exit(0);
  }
  
  log(`\n📋 처리할 파일: ${files.length}개 (${todayStr})`);
  files.forEach(f => log(`  - ${f}`));
  
  const results = [];
  for (const file of files) {
    const result = await processArticle(file);
    results.push(result);
    
    // API 레이트 제한 회피
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 최종 보고
  log(`\n${'='.repeat(60)}`);
  log(`📊 최종 보고 (총 ${files.length}개 처리)`);
  log(`${'='.repeat(60)}`);
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  log(`✅ 성공: ${successful.length}개`);
  successful.forEach(r => {
    log(`  - ${r.headline} (Post ID: ${r.postId})`);
  });
  
  if (failed.length > 0) {
    log(`\n❌ 실패: ${failed.length}개`, 'error');
    failed.forEach(r => {
      log(`  - ${r.headline} (${r.error})`, 'error');
    });
  }
  
  log(`\n🎉 Publisher Agent 완료`);
}

main().catch(err => {
  log(`🔥 치명적 오류: ${err.message}`, 'error');
  console.error(err);
  process.exit(1);
});
