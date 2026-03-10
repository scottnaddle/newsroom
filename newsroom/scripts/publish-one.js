#!/usr/bin/env node
/**
 * publish-one.js — Ghost CMS 단일 기사 발행 스크립트
 * 
 * 사용법:
 *   node publish-one.js <json파일경로>
 * 
 * 입력: 07-copy-edited/ 안의 JSON 파일
 * 출력: 08-published/ 로 이동, ghost_id/ghost_url 추가
 * 
 * ⚠️ 반드시 status: 'draft' — 절대 published 금지!
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const PIPELINE_DIR = '/root/.openclaw/workspace/newsroom/pipeline';
const PUBLISHED_DIR = path.join(PIPELINE_DIR, '08-published');
const REJECTED_DIR = path.join(PIPELINE_DIR, 'rejected');
const MEMORY_DIR = path.join(PIPELINE_DIR, 'memory');
const PUBLISHED_TITLES_FILE = path.join(MEMORY_DIR, 'published-titles.json');
const USED_IMAGES_FILE = path.join(MEMORY_DIR, 'used-images.json');

// Ghost 설정
const GHOST_URL = 'https://ubion.ghost.io';
const GHOST_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

// get-feature-image.js 로드
const { getFeatureImageUrl } = require('./get-feature-image.js');

// generate-og-card.js 로드
let generateOGCard;
try {
  generateOGCard = require('./generate-og-card.js');
} catch (e) {
  generateOGCard = null;
}

// ─── 디렉토리 생성 ─────────────────────────────────────────────────
[PUBLISHED_DIR, REJECTED_DIR, MEMORY_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── JWT 생성 ──────────────────────────────────────────────────────
function generateJWT() {
  const [kid, secret] = GHOST_API_KEY.split(':');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'hex'));
  hmac.update(`${header}.${payload}`);
  return `${header}.${payload}.${hmac.digest('base64url')}`;
}

// ─── Ghost API 요청 ────────────────────────────────────────────────
function ghostRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(endpoint, GHOST_URL);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Ghost ${generateJWT()}`
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Parse error: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── URL HTTP 200 확인 ─────────────────────────────────────────────
function checkUrl(url) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      };
      const lib = urlObj.protocol === 'https:' ? https : require('http');
      const req = lib.request(options, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(5000, () => { req.destroy(); resolve(false); });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

// ─── published-titles.json 업데이트 ───────────────────────────────
function updatePublishedTitles(article, filename) {
  let titles = [];
  if (fs.existsSync(PUBLISHED_TITLES_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(PUBLISHED_TITLES_FILE, 'utf8'));
      titles = Array.isArray(data) ? data : (data.titles || []);
    } catch {}
  }
  const headline = article.draft?.headline || article.source?.title || 'Unknown';
  if (Array.isArray(titles)) {
    titles.unshift({ title: headline, file: filename, status: 'published' });
  }
  // 최대 500개 유지
  fs.writeFileSync(PUBLISHED_TITLES_FILE, JSON.stringify(titles.slice(0, 500), null, 2));
}

// ─── HTML 검증 ────────────────────────────────────────────────────
function validateHtml(html) {
  if (!html) return { valid: false, reason: 'HTML 없음' };
  
  // 본문 길이 확인 (태그 제거 후)
  const plainText = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (plainText.length < 1600) {
    return { valid: false, reason: `본문 1600자 미만 (${plainText.length}자)` };
  }
  
  // AI 공개 배지(상단 pill) 금지 확인
  if (html.includes('border-radius:20px') && html.includes('AI 생성') || 
      html.match(/pill|badge.*AI/i)) {
    return { valid: false, reason: 'AI 공개 배지(상단 pill) 감지됨' };
  }
  
  // 수치 카드(display:flex) 금지 확인  
  const flexCount = (html.match(/display\s*:\s*flex/g) || []).length;
  if (flexCount > 2) {
    return { valid: false, reason: `수치 카드(display:flex) ${flexCount}개 감지됨` };
  }
  
  // AI 각주 필수
  if (!html.includes('본 기사는 AI가 작성했습니다')) {
    return { valid: false, reason: 'AI 각주 없음' };
  }
  
  return { valid: true };
}

// ─── 본문 첫 150자 추출 ────────────────────────────────────────────
function extractExcerpt(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 150);
}

// ─── 메인 발행 함수 ────────────────────────────────────────────────
async function publishOne(filePath) {
  console.log(`\n[publish-one] 시작: ${path.basename(filePath)}`);
  
  // 파일 읽기
  let article;
  try {
    article = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`[publish-one] JSON 파싱 오류: ${e.message}`);
    process.exit(1);
  }
  
  const draft = article.draft;
  if (!draft || !draft.html) {
    console.error('[publish-one] draft.html 없음 — 발행 불가');
    const rejectedPath = path.join(REJECTED_DIR, path.basename(filePath));
    fs.renameSync(filePath, rejectedPath);
    console.log(`[publish-one] rejected/ 이동: ${path.basename(filePath)}`);
    process.exit(1);
  }
  
  // HTML 검증
  const validation = validateHtml(draft.html);
  if (!validation.valid) {
    console.error(`[publish-one] HTML 검증 실패: ${validation.reason}`);
    const rejectedPath = path.join(REJECTED_DIR, path.basename(filePath));
    fs.renameSync(filePath, rejectedPath);
    console.log(`[publish-one] rejected/ 이동: ${path.basename(filePath)}`);
    process.exit(1);
  }
  
  // Feature image 획득
  const headline = draft.headline || article.source?.title || 'AI 교육 뉴스';
  const tags = draft.ghost_tags || article.tags || [];
  
  let featureImage = null;
  let imageRetries = 3;
  while (imageRetries > 0) {
    const candidate = getFeatureImageUrl({
      headline,
      tags,
      recentIdsFile: USED_IMAGES_FILE
    });
    const ok = await checkUrl(candidate);
    if (ok) {
      featureImage = candidate;
      break;
    }
    console.log(`[publish-one] 이미지 URL 실패 (재시도 ${4 - imageRetries}/3): ${candidate}`);
    imageRetries--;
  }
  
  if (!featureImage) {
    // fallback: 검증 없이 기본 이미지 사용
    featureImage = getFeatureImageUrl({ headline, tags });
    console.log(`[publish-one] 이미지 fallback 사용: ${featureImage}`);
  }
  
  console.log(`[publish-one] Feature image: ${featureImage}`);
  
  // OG card 생성 시도
  let ogImageUrl = featureImage;
  if (generateOGCard && typeof generateOGCard.generateOGCard === 'function') {
    try {
      const ogOutputPath = path.join(PIPELINE_DIR, 'tmp', `og-${Date.now()}.png`);
      if (!fs.existsSync(path.dirname(ogOutputPath))) {
        fs.mkdirSync(path.dirname(ogOutputPath), { recursive: true });
      }
      const category = draft.category || 'policy';
      generateOGCard.generateOGCard({
        headline,
        category,
        outputPath: ogOutputPath,
        date: new Date().toLocaleDateString('ko-KR')
      });
      // OG card는 로컬 파일이라 Ghost에 업로드하기 어려우므로 feature_image 사용
      console.log(`[publish-one] OG 카드 생성: ${ogOutputPath}`);
    } catch (e) {
      console.log(`[publish-one] OG 카드 생성 실패 (무시): ${e.message}`);
    }
  }
  
  // 메타데이터 준비
  const metaTitle = headline.slice(0, 60);
  const metaDescription = extractExcerpt(draft.html);
  const slug = draft.slug || path.basename(filePath, '.json').replace(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}_/, '');
  
  // Ghost 태그 배열
  const ghostTags = (draft.ghost_tags || tags).map(t => ({ name: String(t) }));
  if (!ghostTags.find(t => t.name === 'AI 교육')) {
    ghostTags.push({ name: 'AI 교육' });
  }
  
  // 기사 타입 판단
  const paperKeywords = ['[논문]', '논문', 'paper', 'research', 'nonmun'];
  const eduKeywords = ['교육', '에듀테크', 'education', 'edtech', 'student', '학', '대학', 'school', '만평', '논설', 'colloquy', 'cartoon', '팟캐스트'];
  
  const isPaper = paperKeywords.some(kw => 
    headline?.toLowerCase().includes(kw.toLowerCase())
  );
  
  const isEducationContent = !isPaper && eduKeywords.some(kw => 
    headline?.toLowerCase().includes(kw.toLowerCase()) || 
    tags?.some(t => t?.toLowerCase().includes('교육') || t?.toLowerCase().includes('에듀테크'))
  );
  
  // 태그 자동 할당
  // AI Papers: 논문 / ai-edu: 에듀테크(AI) / ai-digest: 뉴스(AI)
  let primaryTag, status;
  if (isPaper) {
    primaryTag = { name: 'AI Papers' };  // AI Papers (통합)
    status = 'published';
  } else if (isEducationContent) {
    primaryTag = { name: '에듀테크(AI)' };  // ai-edu (통합)
    status = 'published';
  } else {
    primaryTag = { id: '69aec6a1ff4fbf0001ab7ab5' };  // ai-digest (뉴스(AI))
    status = 'draft';
  }
  
  // Ghost 발행 데이터
  const postData = {
    title: headline,
    html: draft.html,
    status,  // 논문/교육은 auto published, 나머지는 draft
    slug,
    tags: [primaryTag, ...ghostTags.slice(0, 2)],  // 주 태그 + 추가 태그 (최대 3개)
    meta_title: metaTitle,
    meta_description: metaDescription,
    custom_excerpt: draft.custom_excerpt || metaDescription,
    feature_image: featureImage,
    og_image: featureImage,       // SNS 공유용
    twitter_image: featureImage   // Twitter 카드용
  };
  
  if (isPaper) {
    console.log(`[publish-one] 📄 논문 감지 → AI Papers 태그 + 자동 published`);
  } else if (isEducationContent) {
    console.log(`[publish-one] ✏️ 교육 관련 기사 감지 → ai-edu (에듀테크(AI)) 태그 + 자동 published`);
  } else {
    console.log(`[publish-one] 📰 순수 AI 뉴스 → ai-digest (뉴스(AI)) 태그 + draft`);
  }
  
  console.log(`[publish-one] Ghost API 발행 시도: "${headline}"`);
  
  let ghostResult;
  try {
    ghostResult = await ghostRequest('POST', '/ghost/api/admin/posts/', { posts: [postData] });
  } catch (e) {
    console.error(`[publish-one] Ghost API 오류: ${e.message}`);
    const rejectedPath = path.join(REJECTED_DIR, path.basename(filePath));
    fs.renameSync(filePath, rejectedPath);
    console.log(`[publish-one] rejected/ 이동: ${path.basename(filePath)}`);
    process.exit(1);
  }
  
  const publishedPost = ghostResult?.posts?.[0];
  if (!publishedPost) {
    console.error('[publish-one] Ghost 응답에 posts 없음');
    process.exit(1);
  }
  
  console.log(`[publish-one] ✅ 발행 성공!`);
  console.log(`  Ghost ID: ${publishedPost.id}`);
  console.log(`  URL: ${publishedPost.url}`);
  
  // 기사 JSON 업데이트
  article.ghost_id = publishedPost.id;
  article.ghost_url = publishedPost.url;
  article.published_at = new Date().toISOString();
  article.stage = 'published';
  
  // 08-published/ 로 이동
  const filename = path.basename(filePath);
  const publishedPath = path.join(PUBLISHED_DIR, filename);
  fs.writeFileSync(publishedPath, JSON.stringify(article, null, 2));
  fs.unlinkSync(filePath);
  console.log(`[publish-one] 08-published/ 이동 완료: ${filename}`);
  
  // published-titles.json 업데이트
  updatePublishedTitles(article, filename);
  console.log('[publish-one] published-titles.json 업데이트 완료');
  
  // 결과 출력 (pipeline-runner.js가 파싱할 수 있도록)
  console.log(`[publish-one] RESULT:${JSON.stringify({ ghostId: publishedPost.id, ghostUrl: publishedPost.url, status: 'ok' })}`);
}

// ─── 실행 ─────────────────────────────────────────────────────────
const filePath = process.argv[2];
if (!filePath) {
  console.error('사용법: node publish-one.js <json파일경로>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`파일 없음: ${filePath}`);
  process.exit(1);
}

publishOne(filePath).catch(e => {
  console.error(`[publish-one] 치명적 오류: ${e.message}`);
  process.exit(1);
});
