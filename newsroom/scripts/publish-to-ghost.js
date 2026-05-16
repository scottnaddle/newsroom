#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { execSync } = require('child_process');

// .env 파일에서 환경변수 로드
const envFile = '/root/.openclaw/workspace/newsroom/.env';
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx);
        const value = trimmed.substring(eqIdx + 1);
        if (!process.env[key]) process.env[key] = value;
      }
    }
  });
}

const INPUT_DIR = '/root/.openclaw/workspace/newsroom/pipeline/07-copy-edited';
const OUTPUT_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
const REJECTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/rejected';
const CONFIG_FILE = '/root/.openclaw/workspace/newsroom/shared/config/ghost.json';

const { generateImageForArticle } = require('/root/newsroom-analysis/newsroom/scripts/generate-article-image.js');
const { getSmartFeatureImage } = require('/root/.openclaw/workspace/newsroom/scripts/unsplash-smart-search.js');
const { generateOGCard } = require('/root/.openclaw/workspace/newsroom/scripts/generate-og-card.js');

// ─── Crawl4AI 이미지 룩업 (실제 뉴스 사진 우선) ─────────
const CRAWL4AI_LOOKUP_PATH = '/root/.openclaw/workspace/newsroom/pipeline/crawl4ai-image-lookup.json';
let crawl4aiLookup = {};
try {
  if (fs.existsSync(CRAWL4AI_LOOKUP_PATH)) {
    crawl4aiLookup = JSON.parse(fs.readFileSync(CRAWL4AI_LOOKUP_PATH, 'utf8'));
    console.log(`  ✓ Crawl4AI 이미지 룩업 로드: ${Object.keys(crawl4aiLookup).length}개`);
  }
} catch(e) {
  console.warn(`  ⚠️ Crawl4AI 룩업 로드 실패: ${e.message}`);
}

/**
 * Crawl4AI 룩업에서 기사 원문 URL로 이미지 찾기
 * 실제 뉴스 사진이므로 텍스트 깨짐 문제 없음
 */
function getCrawl4AIImage(sourceUrl) {
  if (!sourceUrl || !crawl4aiLookup || Object.keys(crawl4aiLookup).length === 0) return null;
  // 정확한 URL 매칭
  if (crawl4aiLookup[sourceUrl]) return crawl4aiLookup[sourceUrl];
  // URL 끝부분 매칭 (쿼리 파라미터 등 차이 대응)
  for (const [key, val] of Object.entries(crawl4aiLookup)) {
    if (sourceUrl.includes(key) || key.includes(sourceUrl)) return val;
  }
  return null;
}

let results = [];
let reportLines = [];

async function main() {
  try {
    console.log('[Publisher Agent] 시작 —', new Date().toISOString());
    
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const envVar = value.slice(2, -1);
        config[key] = process.env[envVar] || value;
      }
    }
    console.log('✓ Ghost 설정 로드 완료');

    console.log('  → 0. 기존 게시물 로드 (중복 검사)...');
    let existingPosts = [];
    try {
      const jwt = generateJWT(config.adminApiKey);
      const existing = await getFromGhost(
        `posts/?limit=80&order=published_at%20desc&fields=id,title,slug,html,published_at,mobiledoc`,
        jwt,
        config.apiUrl
      );
      existingPosts = existing.posts || [];
      console.log(`  ✓ 기존 게시물: ${existingPosts.length}개 로드 완료`);
    } catch (err) {
      console.warn(`  ⚠️ 기존 게시물 로드 실패 (중복 검사 없이 진행): ${err.message}`);
    }

    if (!fs.existsSync(INPUT_DIR)) {
      console.log('⚠️  입력 디렉토리 없음');
      return;
    }

    const files = fs.readdirSync(INPUT_DIR)
      .filter(f => f.endsWith('.json'))
      .sort();

    if (files.length === 0) {
      console.log('✓ 처리할 기사 없음');
      return;
    }

    console.log(`ℹ️  처리 대기: ${files.length}개 기사`);

    [OUTPUT_DIR, REJECTED_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    for (const filename of files) {
      const filepath = path.join(INPUT_DIR, filename);
      try {
        const draftForCheck = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        const sourceUrl = (draftForCheck.source && draftForCheck.source.url) || 
                          (draftForCheck.draft && draftForCheck.draft.references && draftForCheck.draft.references[0] && draftForCheck.draft.references[0].url);
        const headline = getField(draftForCheck, 'headline') || filename;
        
        const dupResult = checkDuplicate(sourceUrl, headline, existingPosts);
        if (dupResult.isDuplicate) {
          console.log(`⏭️  중복 건너뜀: ${headline}`);
          console.log(`   → 기존 게시물: "${dupResult.matchedTitle}" (${dupResult.matchedSlug})`);
          console.log(`   → 사유: ${dupResult.reason}`);
          results.push({ file: filename, status: 'skipped-duplicate', title: headline, reason: dupResult.reason });
          moveToRejected(filepath, `duplicate: ${dupResult.reason}`);
          continue;
        }
        
        await processArticle(filepath, config);
      } catch (err) {
        console.error(`❌ ${filename}: ${err.message}`);
        results.push({ file: filename, status: 'failed', error: err.message });
      }
    }

    console.log('\n=== 발행 결과 ===');
    const success = results.filter(r => r.status === 'published').length;
    const failed = results.filter(r => r.status === 'failed').length;
    console.log(`✓ 성공: ${success}개`);
    console.log(`❌ 실패: ${failed}개`);

    if (reportLines.length > 0) {
      console.log('\n📊 상세 보고:');
      reportLines.forEach(line => console.log(line));
    }

  } catch (err) {
    console.error('❌ 발행 에이전트 오류:', err.message);
    process.exit(1);
  }
}

function getField(obj, field) {
  if (obj.draft && obj.draft[field] !== undefined) return obj.draft[field];
  if (obj[field] !== undefined) return obj[field];
  return undefined;
}
function strOr(val, fallback) {
  return typeof val === 'string' ? val : fallback;
}

function extractLeadFromHtml(html, maxLen = 120) {
  if (!html) return '';
  const blockquoteContent = html.match(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi) || [];
  let body = html;
  for (const bq of blockquoteContent) {
    body = body.replace(bq, '');
  }
  const paraMatches = body.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  if (!paraMatches) return '';
  for (const pTag of paraMatches) {
    let text = pTag.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 10) continue;
    if (/^(📖|본 기사|원문 보기)/.test(text)) continue;
    return text.substring(0, maxLen);
  }
  return '';
}

async function processArticle(filepath, config) {
  const filename = path.basename(filepath);
  const draft = JSON.parse(fs.readFileSync(filepath, 'utf8'));

  const headline = getField(draft, 'headline') || filename;
  console.log(`\n📰 처리 중: ${headline}`);

  const fullBody = getField(draft, 'html') || getField(draft, 'final_html') || '';
  const bodyText = fullBody.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  
  const hangulChars = (bodyText.match(/[가-힣]/g) || []).length;
  const hangulRatio = bodyText.length > 0 ? hangulChars / bodyText.length : 0;
  if (hangulRatio < 0.15 && bodyText.length > 100) {
    console.log(`  ⚠️ 한글 비율 ${(hangulRatio*100).toFixed(0)}% → 영문 위주 콘텐츠, 건너뜀`);
    results.push({ file: filename, status: 'skipped-english-content', title: headline });
    moveToRejected(filepath, `skipped-english-content: hangul=${(hangulRatio*100).toFixed(0)}%`);
    return;
  }
  
  const headlineWords = headline.split(/\s+/);
  const lastWord = headlineWords[headlineWords.length - 1] || '';
  if (/^[a-zA-Z]{1,3}$/.test(lastWord) && headlineWords.length > 1) {
    console.log(`  ⚠️ 헤드라인 마지막 단어가 잘렸을 수 있음: "...${lastWord}"`);
  }

  console.log('  → 1. Feature 이미지 선정 (실제 사진 우선 → AI 최후)...');
  let featureUrl;

  // 0) 기사 원문 URL 추출 (Crawl4AI 룩업용)
  const sourceUrl = (draft.source && draft.source.url) || 
                    (draft.draft && draft.draft.references && draft.draft.references[0] && draft.draft.references[0].url);

  // 1) Crawl4AI 실제 뉴스 사진 (텍스트 깨짐 0% — 최우선)
  const crawl4aiUrl = getCrawl4AIImage(sourceUrl);
  if (crawl4aiUrl) {
    featureUrl = crawl4aiUrl;
    console.log(`  ✓ Crawl4AI 실제 사진 사용: ${featureUrl.substring(0, 60)}...`);
  }

  // 2) Pending cache 확인
  const PENDING_CACHE = '/root/.openclaw/workspace/newsroom/.imgcache/pending.json';
  if (!featureUrl) {
    try {
      if (fs.existsSync(PENDING_CACHE)) {
        const cache = JSON.parse(fs.readFileSync(PENDING_CACHE, 'utf8'));
        if (cache[headline]) {
          featureUrl = cache[headline];
          console.log(`  💾 캐시 이미지 사용: ${featureUrl.substring(0, 60)}...`);
        }
      }
    } catch(e) {}
  }

  // 3) Unsplash 실제 사진 (텍스트 깨짐 없음)
  if (!featureUrl) {
    const tags = getField(draft, 'ghost_tags') || [];
    const bodyText = getField(draft, 'html') || getField(draft, 'final_html') || '';
    try {
      const unsplashUrl = await getSmartFeatureImage({
        headline: headline,
        bodyHtml: getField(draft, 'html') || getField(draft, 'final_html'),
        tags: getField(draft, 'ghost_tags') || []
      });
      if (unsplashUrl) {
        featureUrl = unsplashUrl;
        console.log(`  ✓ Unsplash 실제 사진 사용: ${featureUrl.substring(0, 60)}...`);
      }
    } catch (err) {
      console.warn(`  ⚠️ Unsplash 검색 실패: ${err.message.substring(0, 100)}`);
    }
  }

  // 4) FLUX AI 이미지 (최후의 수단, 텍스트 억제 강화 프롬프트)
  if (!featureUrl) {
    const tags = getField(draft, 'ghost_tags') || [];
    const bodyText = getField(draft, 'html') || getField(draft, 'final_html') || '';
    for (let attempt = 1; attempt <= 1; attempt++) {
      try {
        const result = await generateImageForArticle({
          headline: headline,
          bodyHtml: bodyText,
          tags: tags,
          mode: 'news'
        });
        featureUrl = result.url;
        console.log(`  ✓ AI 이미지 생성 (FLUX): ${result.url.substring(0, 60)}...`);
        break;
      } catch (err) {
        console.warn(`  ⚠️ FLUX 생성 실패: ${err.message.substring(0, 100)}`);
      }
    }
  }

  // 5) Fallback 이미지
  const GHOST_FALLBACKS = [
    'https://newsroom.ubion.global/content/images/2026/05/fallback.jpg',
    'https://newsroom.ubion.global/content/images/2026/05/fallback-2.jpg',
    'https://newsroom.ubion.global/content/images/2026/05/fallback-3.jpg',
    'https://newsroom.ubion.global/content/images/2026/05/fallback-4.jpg',
    'https://newsroom.ubion.global/content/images/2026/05/fallback-5.jpg'
  ];
  if (!featureUrl) {
    featureUrl = GHOST_FALLBACKS[Math.floor(Math.random() * GHOST_FALLBACKS.length)];
    console.log(`  ⚠️ Fallback 이미지 사용`);
  }

  console.log(`  ✓ Feature image: ${featureUrl.substring(0, 60)}...`);

  console.log('  → 2. OG 카드 생성...');
  let ogCardUrl;
  const tmpOGPath = `/tmp/og-card-${Date.now()}.png`;
  try {
    ogCardUrl = await generateOGCard({
      headline: headline,
      category: (getField(draft, 'ghost_tags') || [])[0] || 'policy',
      outputPath: tmpOGPath,
      date: new Date().toLocaleDateString('ko-KR')
    });

    if (!ogCardUrl) {
      throw new Error('OG 카드 생성 실패 (null)');
    }
    console.log(`  ✓ OG 카드 생성 완료`);
  } catch (err) {
    console.error(`  ❌ OG 카드 생성 실패: ${err.message}`);
    moveToRejected(filepath, `og-card-failed: ${err.message}`);
    throw err;
  }

  let ogImageUrl;
  try {
    console.log('  → 3. OG 카드 Ghost 업로드...');
    ogImageUrl = await uploadImageToGhost(tmpOGPath, config);
    console.log(`  ✓ Ghost 업로드 완료`);
  } catch (err) {
    console.error(`  ❌ OG 업로드 실패: ${err.message}`);
    moveToRejected(filepath, `og-upload-failed: ${err.message}`);
    throw err;
  }

  // ★ 핵심 변경: HTML 정제 + 통일 포맷 변환 ★
  console.log('  → 4. HTML 정제 + 통일 포맷 변환...');
  let rawHtml = getField(draft, 'final_html') || getField(draft, 'html');
  let cleanHtml = cleanupHtml(rawHtml);
  
  // 5/13 Chinese article style format으로 최종 변환
  cleanHtml = convertToUnifiedFormat(cleanHtml);
  console.log('  ✓ HTML 정제 + 변환 완료');

  console.log('  → 5. JWT 토큰 생성...');
  const jwtToken = generateJWT(config.adminApiKey);
  console.log('  ✓ JWT 생성 완료');

  const isFeatured = isHigherEducation(headline, getField(draft, 'ghost_tags') || []);
  const slug = generateSlug(filename);

  console.log('  → 6. Ghost 게시물 생성...');
  let postId;
  
  const leadText = extractLeadFromHtml(cleanHtml);
  const ghostTitle = headline;
  const ghostExcerpt = getField(draft, 'subheadline') || leadText || '';
  const ghostMetaDesc = (draft.meta_suggestion && draft.meta_suggestion.meta_description) || leadText || '';
  
  try {
    const postData = {
      posts: [{
        title: ghostTitle,
        html: cleanHtml,
        status: 'published',
        visibility: 'public',
        featured: isFeatured,
        tags: (getField(draft, 'ghost_tags') || []),
        meta_title: (draft.meta_suggestion && draft.meta_suggestion.meta_title) || headline,
        meta_description: ghostMetaDesc,
        custom_excerpt: ghostExcerpt,
        slug: slug,
        feature_image: featureUrl,
        og_image: ogImageUrl && ogImageUrl.startsWith('http') ? ogImageUrl : undefined,
        twitter_image: ogImageUrl && ogImageUrl.startsWith('http') ? ogImageUrl : undefined,
        codeinjection_foot: ''
      }]
    };

    const response = await postToGhost(
      'posts/?source=html',
      postData,
      jwtToken,
      config.apiUrl
    );

    postId = response.posts[0].id;
    console.log(`  ✓ Ghost 게시물 생성: ${postId}`);
  } catch (err) {
    console.error(`  ❌ Ghost 게시 실패: ${err.message}`);
    moveToRejected(filepath, `ghost-publish-failed: ${err.message}`);
    throw err;
  }

  console.log('  → 7. Ghost 검증...');
  try {
    const getResponse = await getFromGhost(
      `posts/${postId}/?formats=html`,
      jwtToken,
      config.apiUrl
    );
    const savedPost = getResponse.posts[0];
    const damaged = savedPost.html.match(/[\uFFFD]/g);
    if (damaged && damaged.length > 0) {
      console.warn(`  ⚠️ 인코딩 경고: ${damaged.length}개 손상된 문자 (계속 진행)`);
    }
    console.log(`  ✓ 검증 완료 (OK)`);
  } catch (err) {
    console.error(`  ❌ 검증 실패: ${err.message}`);
    console.warn(`  ⚠️ 검증 실패했지만 발행은 유지합니다.`);
  }

  console.log('  → 8. 결과 저장...');
  const result = {
    ...draft,
    stage: 'published',
    publish_result: {
      ghost_post_id: postId,
      ghost_edit_url: `https://ubion.ghost.io/ghost/#/editor/post/${postId}`,
      status: 'published',
      published_at: new Date().toISOString()
    },
    audit_log: [
      ...(draft.audit_log || []),
      {
        agent: 'publisher',
        action: 'published',
        timestamp: new Date().toISOString(),
        note: `Ghost post ID: ${postId}`
      }
    ]
  };

  const outputPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`  ✓ 저장: ${path.basename(outputPath)}`);

  fs.unlinkSync(filepath);
  console.log(`  ✓ 원본 삭제`);

  results.push({
    file: filename,
    status: 'published',
    title: headline,
    postId
  });

  reportLines.push(`✅ ${headline}`);
  reportLines.push(`   Ghost: https://ubion.ghost.io/ghost/#/editor/post/${postId}`);
}

/**
 * cleanupHtml — HTML 정제 (기존 AI 배지 제거 + 인라인 스타일 제거)
 */
function cleanupHtml(html) {
  if (!html) return '';

  let cleaned = html.replace(/<div[^>]*style="margin-bottom:32px;"[^>]*>[\s\S]*?🤖[\s\S]*?<\/div>/g, '');
  cleaned = cleaned.replace(/<div[^>]*style="display:flex"[^>]*>[\s\S]*?<\/div>/g, '');

  return cleaned;
}

/**
 * convertToUnifiedFormat — 5/13 Chinese article 스타일 통일 포맷 변환
 * 
 * Target format:
 *   <blockquote>간결한 리드 문장</blockquote>
 *   <p>본문 문단 1</p>
 *   <p>본문 문단 2</p>
 *   ...
 *   <p>원문 보기: <a href="URL">URL</a></p>
 *   <p>본 기사는 AI로 작성되었습니다...</p>
 */
function convertToUnifiedFormat(html) {
  if (!html) return '';
  let result = html;

  // 1. 모든 태그에서 인라인 스타일 제거 (가장 포괄적인 정규식)
  //    style="..." 또는 style='...' 를 모든 태그에서 제거
  result = result.replace(/\s+style="[^"]*"/gi, '');
  result = result.replace(/\s+style='[^']*'/gi, '');

  // 2. blockquote 내부의 <br><br><strong>제목</strong> 패턴 제거 + 모든 내부 태그 제거
  //    → blockquote는 단순 한 줄 텍스트만 유지 (5/13 Chinese article 스타일)
  result = result.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (match, content) => {
    let clean = content
      // 내부의 모든 HTML 태그 제거
      .replace(/<[^>]+>/gi, '')
      // 연속 공백 정리
      .replace(/\s+/g, ' ')
      .trim();
    return `<blockquote>${clean}</blockquote>`;
  });

  // 3. 출처 링크 변환: 📖 <a href="URL">원문 보기</a> → 원문 보기: <a href="URL">URL</a>
  result = result.replace(
    /📖\s*<a\s+href="([^"]*)"[^>]*>원문\s*보기<\/a>/gi,
    (match, url) => `원문 보기: <a href="${url}">${url}</a>`
  );
  result = result.replace(
    /📖\s*<a\s+href='([^']*)'[^>]*>원문\s*보기<\/a>/gi,
    (match, url) => `원문 보기: <a href="${url}">${url}</a>`
  );

  // 4. 남은 📖 문자 제거
  result = result.replace(/📖/g, '');
  
  // 5. rel 속성 제거 (Ghost 기본)
  result = result.replace(/\s+rel="[^"]*"/gi, '');
  result = result.replace(/\s+rel='[^']*'/gi, '');

  // 6. 연속 공백 정리
  result = result.replace(/\s{2,}/g, ' ');

  // 7. <p> 태그 사이의 불필요한 개행 정리
  result = result.replace(/>\s+</g, '>\n<');

  return result;
}

function generateJWT(apiKey) {
  const [id, secret] = apiKey.split(':');
  
  const header = Buffer.from(JSON.stringify({
    alg: 'HS256',
    typ: 'JWT',
    kid: id
  })).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: '/admin/'
  })).toString('base64url');

  const sig = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(header + '.' + payload)
    .digest('base64url');

  return header + '.' + payload + '.' + sig;
}

function isHigherEducation(headline, tags) {
  const featuredTags = ['시평', 'editorial', '테크브리핑', 'tech-brief', 'ai-tech-brief'];
  const tagText = (tags || []).join(' ').toLowerCase();
  for (const ft of featuredTags) {
    if (tagText.includes(ft)) return true;
  }
  return false;
}

function generateSlug(filename) {
  const base = filename.replace('.json', '');
  const parts = base.split('_');
  if (parts.length >= 3) {
    return parts.slice(2).join('-');
  }
  return base;
}

async function postToGhost(endpoint, data, token, apiUrl) {
  const url = `${apiUrl}/ghost/api/admin/${endpoint}`;
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.errors) {
            reject(new Error(parsed.errors.map(e => e.message).join(', ')));
            return;
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error(`JSON parse error: ${responseData.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function getFromGhost(endpoint, token, apiUrl) {
  const url = `${apiUrl}/ghost/api/admin/${endpoint}`;
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.errors) {
            reject(new Error(parsed.errors.map(e => e.message).join(', ')));
            return;
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error(`JSON parse error: ${responseData.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function uploadImageToGhost(imagePath, config) {
  const fs = require('fs');
  const jwt = generateJWT(config.adminApiKey);
  const url = `${config.apiUrl}/ghost/api/admin/images/upload/`;
  
  return new Promise((resolve, reject) => {
    const boundary = `----FormBoundary${Math.random().toString(36).substring(2)}`;
    const fileBuffer = fs.readFileSync(imagePath);
    const fileName = path.basename(imagePath);
    
    let bodyParts = [];
    bodyParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: image/png\r\n\r\n`);
    bodyParts.push(fileBuffer);
    bodyParts.push(`\r\n--${boundary}--\r\n`);
    
    const bodyBuffer = Buffer.concat(
      bodyParts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p, 'utf8'))
    );

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${jwt}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          const imageUrl = parsed.images && parsed.images[0] && parsed.images[0].url;
          if (imageUrl) {
            resolve(imageUrl);
          } else {
            reject(new Error('No image URL in response'));
          }
        } catch (e) {
          reject(new Error(`JSON parse error: ${responseData.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

function checkDuplicate(sourceUrl, headline, existingPosts) {
  if (!sourceUrl && !headline) return { isDuplicate: false };
  
  for (const post of existingPosts) {
    if (sourceUrl && post.html && post.html.includes(sourceUrl)) {
      return { isDuplicate: true, matchedTitle: post.title, matchedSlug: post.slug, reason: '동일 출처 URL' };
    }
    
    if (headline && post.title) {
      const words = headline.toLowerCase().split(/\s+/);
      const postWords = post.title.toLowerCase().split(/\s+/);
      const common = words.filter(w => postWords.includes(w)).length;
      const maxLen = Math.max(words.length, postWords.length);
      if (maxLen > 0 && common / maxLen > 0.7 && headline.length > 5) {
        return { isDuplicate: true, matchedTitle: post.title, matchedSlug: post.slug, reason: '유사한 제목' };
      }
    }
  }
  
  return { isDuplicate: false };
}

function moveToRejected(filepath, reason) {
  if (!fs.existsSync(REJECTED_DIR)) {
    fs.mkdirSync(REJECTED_DIR, { recursive: true });
  }
  const filename = path.basename(filepath);
  const rejectPath = path.join(REJECTED_DIR, filename);
  
  const content = JSON.parse(fs.readFileSync(filepath, 'utf8') || '{}');
  content.rejection_reason = reason;
  content.rejected_at = new Date().toISOString();
  fs.writeFileSync(rejectPath, JSON.stringify(content, null, 2));
  
  fs.unlinkSync(filepath);
  console.log(`  → rejected: ${reason}`);
}

main().catch(console.error);
