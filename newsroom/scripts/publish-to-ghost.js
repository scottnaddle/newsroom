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

// 필수 모듈 로드
const { generateImageForArticle } = require('/root/newsroom-analysis/newsroom/scripts/generate-article-image.js');
const { getSmartFeatureImage } = require('/root/.openclaw/workspace/newsroom/scripts/unsplash-smart-search.js');
const { generateOGCard } = require('/root/.openclaw/workspace/newsroom/scripts/generate-og-card.js');

let results = [];
let reportLines = [];

async function main() {
  try {
    console.log('[Publisher Agent] 시작 —', new Date().toISOString());
    
    // 1. 설정 로드
    // 설정에서 환경변수 치환 (${VAR_NAME} → process.env.VAR_NAME)
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const envVar = value.slice(2, -1);
        config[key] = process.env[envVar] || value;
      }
    }
    console.log('✓ Ghost 설정 로드 완료');

    // 1b. 기존 Ghost 게시물 캐싱 (중복 검사용)
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

    // 2. 07-copy-edited/ 파일 확인
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

    // 3. 디렉토리 생성
    [OUTPUT_DIR, REJECTED_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    // 4. 각 파일 처리
    for (const filename of files) {
      const filepath = path.join(INPUT_DIR, filename);
      try {
        // 중복 검사 먼저 수행
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
          // Skip - do not publish, remove from input dir
          moveToRejected(filepath, `duplicate: ${dupResult.reason}`);
          continue;
        }
        
        await processArticle(filepath, config);
      } catch (err) {
        console.error(`❌ ${filename}: ${err.message}`);
        results.push({ file: filename, status: 'failed', error: err.message });
      }
    }

    // 5. 결과 보고
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

// Helper: get value from either top-level or nested draft.draft (format compatibility)
function getField(draft, field) {
  // New format: { draft: { field } }
  if (draft.draft && draft.draft[field] !== undefined) return draft.draft[field];
  // Old format: { field } (top-level)
  if (draft[field] !== undefined) return draft[field];
  return undefined;
}
function strOr(val, fallback) {
  return typeof val === 'string' ? val : fallback;
}

async function processArticle(filepath, config) {
  const filename = path.basename(filepath);
  const draft = JSON.parse(fs.readFileSync(filepath, 'utf8'));

  const headline = getField(draft, 'headline') || filename;
  console.log(`\n📰 처리 중: ${headline}`);

  // A. AI 기사 이미지 생성 (국가/지역 컨텍스트 반영)
  console.log('  → 1. AI 이미지 생성 (ComfyUI + FLUX)...');
  let featureUrl;
  const GHOST_FALLBACKS = [
    'https://newsroom.ubion.global/content/images/2026/05/fallback.jpg',
    'https://newsroom.ubion.global/content/images/2026/05/fallback-2.jpg',
    'https://newsroom.ubion.global/content/images/2026/05/fallback-3.jpg',
    'https://newsroom.ubion.global/content/images/2026/05/fallback-4.jpg',
    'https://newsroom.ubion.global/content/images/2026/05/fallback-5.jpg'
  ];
  
  try {
    const bodyText = getField(draft, 'html') || getField(draft, 'final_html') || '';
    const tags = getField(draft, 'ghost_tags') || [];
    const result = await generateImageForArticle({
      headline: headline,
      bodyHtml: bodyText,
      tags: tags,
      mode: 'news'
    });
    featureUrl = result.url;
    console.log(`  ✓ AI 이미지 생성 완료: ${result.url.substring(0, 60)}... (${result.context.country})`);
  } catch (err) {
    console.error(`  ⚠️ AI 이미지 생성 실패 (폴백 이미지 사용): ${err.message}`);
    // Unsplash 폴백
    try {
      featureUrl = await getSmartFeatureImage({
        headline: headline,
        bodyHtml: getField(draft, 'html') || getField(draft, 'final_html'),
        tags: getField(draft, 'ghost_tags') || []
      });
      if (!featureUrl) featureUrl = GHOST_FALLBACKS[Math.floor(Math.random() * GHOST_FALLBACKS.length)];
    } catch (err2) {
      console.error(`  ⚠️ Unsplash 폴백도 실패: ${err2.message}`);
      featureUrl = GHOST_FALLBACKS[Math.floor(Math.random() * GHOST_FALLBACKS.length)];
    }
  }

  // AI 생성 이미지는 이미 Ghost에 업로드되어 있음
  // (generateImageForArticle 내부에서 자동 업로드)
  console.log(`  ✓ Feature image: ${featureUrl.substring(0, 60)}...`);

  // C. OG 카드 생성
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

  // OG 카드를 Ghost에 업로드
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

  // HTML 정제
  console.log('  → 4. HTML 정제...');
  let cleanHtml = cleanupHtml(getField(draft, 'final_html') || getField(draft, 'html'));
  console.log('  ✓ HTML 정제 완료');

  // JWT 토큰 생성
  console.log('  → 5. JWT 토큰 생성...');
  const jwtToken = generateJWT(config.adminApiKey);
  console.log('  ✓ JWT 생성 완료');

  // 고등교육 여부 판단
  const isFeatured = isHigherEducation(headline, getField(draft, 'ghost_tags') || []);

  // Slug 생성
  const slug = generateSlug(filename);

  // Ghost 게시물 생성
  console.log('  → 6. Ghost 게시물 생성...');
  let postId;
  try {
    const postData = {
      posts: [{
        title: getField(draft, 'subheadline') || headline,
        html: cleanHtml,
        status: 'published',
        featured: isFeatured,
        tags: (getField(draft, 'ghost_tags') || []),
        meta_title: (draft.meta_suggestion && draft.meta_suggestion.meta_title) || headline,
        meta_description: (draft.meta_suggestion && draft.meta_suggestion.meta_description) || '',
        custom_excerpt: getField(draft, 'subheadline') || '',
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

  // 검증: Ghost에서 다시 읽기
  console.log('  → 7. Ghost 검증...');
  try {
    const getResponse = await getFromGhost(
      `posts/${postId}/?formats=html`,
      jwtToken,
      config.apiUrl
    );
    const savedPost = getResponse.posts[0];

    // 손상된 문자 검사 (경고만, 발행은 진행)
    const damaged = savedPost.html.match(/[\uFFFD]/g);
    if (damaged && damaged.length > 0) {
      console.warn(`  ⚠️ 인코딩 경고: ${damaged.length}개 손상된 문자 (계속 진행)`);
    }

    console.log(`  ✓ 검증 완료 (OK)`);
  } catch (err) {
    console.error(`  ❌ 검증 실패: ${err.message}`);
    // Ghost에서 삭제하지 않고 경고만
    console.warn(`  ⚠️ 검증 실패했지만 발행은 유지합니다.`);
  }

  // 08-published/에 결과 저장
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

  // 원본 파일 삭제
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

function cleanupHtml(html) {
  if (!html) return '';

  // AI 공개 배지 제거
  let cleaned = html.replace(/<div[^>]*style="margin-bottom:32px;"[^>]*>[\s\S]*?🤖[\s\S]*?<\/div>/g, '');

  // 수치 카드/배너 (display:flex) 제거
  cleaned = cleaned.replace(/<div[^>]*style="display:flex[^>]*>[\s\S]*?<\/div>/g, '');

  return cleaned;
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
  // 시평(editorial)과 테크브리핑(tech briefing)은 항상 featured
  const featuredTags = ['시평', 'editorial', '테크브리핑', 'tech-brief', 'ai-tech-brief'];
  const tagText = (tags || []).join(' ').toLowerCase();
  for (const ft of featuredTags) {
    if (tagText.includes(ft)) return true;
  }
  // 그 외 일반 기사는 featured false
  return false;
}

function generateSlug(filename) {
  // 파일명: 2026-03-04_10-58_edweek-1000-districts-ai-readiness-risk.json
  // slug: edweek-1000-districts-ai-readiness-risk
  const base = filename.replace('.json', '');
  const parts = base.split('_');
  // 처음 부분(날짜)들을 제거하고 나머지 사용
  if (parts.length >= 3) {
    return parts.slice(2).join('-');
  }
  return base;
}

async function postToGhost(endpoint, data, token, apiUrl) {
  const url = `${apiUrl}/ghost/api/admin/${endpoint}`;
  
  // Use Node.js https instead of curl for better reliability
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.errors && parsed.errors.length > 0) {
            reject(new Error(`Ghost API error: ${parsed.errors[0].message}`));
          } else if (!parsed.posts) {
            reject(new Error(`Ghost API returned no posts: ${body.substring(0, 200)}`));
          } else {
            resolve(parsed);
          }
        } catch(e) {
          reject(new Error(`JSON parse failed: ${body.substring(0, 200)}`));
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
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch(e) {
          reject(new Error(`JSON parse failed: ${body.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function deleteFromGhost(endpoint, token, apiUrl) {
  const url = `${apiUrl}/ghost/api/admin/${endpoint}`;
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'DELETE',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch(e) {
          resolve({}); // DELETE returns empty on success
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function uploadImageToGhost(imagePath, config) {
  // Ghost Images API로 이미지 업로드 (multipart/form-data)
  const url = `${config.apiUrl}/ghost/api/admin/images/upload/`;
  const token = generateJWT(config.adminApiKey);
  
  const boundary = '----GhostImageUpload' + Math.random().toString(36).slice(2);
  const imgData = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase() || '.jpg';
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const filename = `article-img-${Date.now()}${ext}`;

  const bodyParts = [];
  bodyParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`);
  bodyParts.push(imgData);
  bodyParts.push(`\r\n--${boundary}--\r\n`);

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(Buffer.concat([
          Buffer.from(bodyParts[0]),
          Buffer.from(bodyParts[1]),
          Buffer.from(bodyParts[2])
        ]))
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.images && parsed.images[0] && parsed.images[0].url) {
            resolve(parsed.images[0].url);
          } else {
            reject(new Error(`Ghost upload failed: ${body.substring(0, 200)}`));
          }
        } catch(e) {
          reject(new Error(`Ghost upload parse error: ${body.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    
    // Write multipart body
    req.write(Buffer.from(bodyParts[0]));
    req.write(Buffer.from(bodyParts[1]));
    req.write(Buffer.from(bodyParts[2]));
    req.end();
  });
}

/**
 * 중복 기사 검사
 * - 같은 source URL이 이미 발행되었는지 확인
 * - headline 유사도 검사 (영문 title, 한국어 headline)
 */
function checkDuplicate(sourceUrl, headline, existingPosts) {
  if (!existingPosts || existingPosts.length === 0) {
    return { isDuplicate: false };
  }
  
  // 1. Source URL 기반 검사 (가장 엄격)
  if (sourceUrl) {
    // 원본 URL에서 기사 ID 또는 핵심 경로 추출
    const urlKey = sourceUrl.replace(/https?:\/\//, '').replace(/www\./, '').split('?')[0].replace(/\/$/,'');
    
    for (const post of existingPosts) {
      const postHtml = post.html || '';
      // Ghost 게시물 HTML에 source URL이 포함되어 있는지 확인
      if (postHtml.includes(urlKey) || postHtml.includes(encodeURI(urlKey))) {
        return {
          isDuplicate: true,
          matchedTitle: post.title,
          matchedSlug: post.slug,
          reason: `동일 source URL (${urlKey.substring(0, 60)})`
        };
      }
    }
  }
  
  // 2. 헤드라인 유사도 검사
  if (headline) {
    // 핵심 키워드 추출 (장소 + 주제)
    const keywords = extractDupKeywords(headline);
    if (keywords.length >= 2) {
      for (const post of existingPosts) {
        const postTitle = post.title || '';
        const matchCount = keywords.filter(kw => postTitle.includes(kw)).length;
        // 70% 이상 키워드 일치 = 중복
        if (matchCount >= Math.ceil(keywords.length * 0.7)) {
          return {
            isDuplicate: true,
            matchedTitle: post.title,
            matchedSlug: post.slug,
            reason: `headline 유사 (${matchCount}/${keywords.length} 키워드 일치: ${keywords.join(', ')})`
          };
        }
      }
    }
  }
  
  return { isDuplicate: false };
}

/**
 * headline에서 중복 검사용 핵심 키워드 추출
 * 예: "뉴욕타임스 AI 특화고 학부모 반발" → ["뉴욕타임스", "AI", "특화고", "학부모", "반발"]
 */
function extractDupKeywords(headline) {
  // 불용어
  const stopwords = ['의', '에', '와', '을', '를', '이', '가', '은', '는', '들', '및', '에서', '에게', '으로', '하다'];
  
  // Headline을 단어 단위로 분리
  const words = headline
    .replace(/[^가-힣a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopwords.includes(w));
  
  // 빈도 기반 중요 단어 선정
  const important = words.filter(w => w.length >= 3 || /[A-Z]/.test(w));
  return important.length >= 2 ? important : words;
}
function moveToRejected(filepath, reason) {
  const filename = path.basename(filepath);
  const rejectedPath = path.join(REJECTED_DIR, filename);
  const draft = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  draft.rejection_reason = reason;
  draft.rejected_at = new Date().toISOString();
  fs.writeFileSync(rejectedPath, JSON.stringify(draft, null, 2));
}

main().catch(console.error);
