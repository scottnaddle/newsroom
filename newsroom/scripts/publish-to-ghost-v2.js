#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const https = require('https');

const INPUT_DIR = '/root/.openclaw/workspace/newsroom/pipeline/07-copy-edited';
const OUTPUT_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
const REJECTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/rejected';
const CONFIG_FILE = '/root/.openclaw/workspace/newsroom/shared/config/ghost.json';

// 필수 모듈 로드
const { getSmartFeatureImage } = require('/root/.openclaw/workspace/newsroom/scripts/unsplash-smart-search.js');
const { generateOGCard } = require('/root/.openclaw/workspace/newsroom/scripts/generate-og-card.js');

let results = [];
let reportLines = [];
let ghostConfig;

async function main() {
  try {
    console.log('[Publisher Agent] 시작 —', new Date().toISOString());
    
    // 1. 설정 로드
    ghostConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    console.log('✓ Ghost 설정 로드 완료');

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
        await processArticle(filepath);
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

async function processArticle(filepath) {
  const filename = path.basename(filepath);
  const draft = JSON.parse(fs.readFileSync(filepath, 'utf8'));

  console.log(`\n📰 처리 중: ${(draft.headline || filename).substring(0, 60)}`);

  // A. Unsplash 스마트 이미지 검색
  console.log('  → 1. Unsplash 이미지 검색...');
  let featureUrl;
  try {
    featureUrl = await getSmartFeatureImage({
      headline: draft.headline,
      bodyHtml: draft.final_html || draft.html,
      tags: draft.ghost_tags || []
    });
    
    if (!featureUrl) {
      throw new Error('Unsplash 이미지 검색 실패 (null)');
    }
    console.log(`  ✓ 이미지 검색 완료`);
  } catch (err) {
    console.error(`  ❌ 이미지 검색 실패: ${err.message}`);
    moveToRejected(filepath, `image-search-failed: ${err.message}`);
    throw err;
  }

  // C. OG 카드 생성
  console.log('  → 2. OG 카드 생성...');
  let ogCardPath;
  const tmpOGPath = `/tmp/og-card-${Date.now()}.png`;
  try {
    ogCardPath = generateOGCard({
      headline: draft.headline,
      category: draft.ghost_tags?.[0] || 'policy',
      outputPath: tmpOGPath,
      date: new Date().toLocaleDateString('ko-KR')
    });

    if (!ogCardPath || !fs.existsSync(ogCardPath)) {
      throw new Error('OG 카드 생성 실패');
    }
    console.log(`  ✓ OG 카드 생성 완료`);
  } catch (err) {
    console.error(`  ❌ OG 카드 생성 실패: ${err.message}`);
    moveToRejected(filepath, `og-card-failed: ${err.message}`);
    throw err;
  }

  // OG 카드를 Ghost에 업로드
  console.log('  → 3. OG 카드 Ghost 업로드...');
  let ogImageUrl;
  try {
    const jwtToken = generateJWT(ghostConfig.adminApiKey);
    ogImageUrl = await uploadImageToGhost(ogCardPath, jwtToken);
    console.log(`  ✓ Ghost 업로드 완료`);
  } catch (err) {
    console.error(`  ❌ OG 업로드 실패: ${err.message}`);
    moveToRejected(filepath, `og-upload-failed: ${err.message}`);
    throw err;
  }

  // HTML 정제
  console.log('  → 4. HTML 정제...');
  let cleanHtml = cleanupHtml(draft.final_html || draft.html);
  console.log('  ✓ HTML 정제 완료');

  // JWT 토큰 생성
  console.log('  → 5. JWT 토큰 생성...');
  const jwtToken = generateJWT(ghostConfig.adminApiKey);
  console.log('  ✓ JWT 생성 완료');

  // 고등교육 여부 판단
  const isFeatured = isHigherEducation(draft.headline, draft.ghost_tags || []);

  // Slug 생성
  const slug = generateSlug(filename);

  // Ghost 게시물 생성
  console.log('  → 6. Ghost 게시물 생성...');
  let postId;
  try {
    const postData = {
      posts: [{
        title: draft.final_headline || draft.headline,
        html: cleanHtml,
        status: 'published',
        featured: isFeatured,
        tags: [
          { id: '69a7a9ed659ea80001153c13' }, // ai-edu 태그 (ID)
          ...(draft.ghost_tags || []).map(t => ({ name: t }))
        ],
        meta_title: draft.meta_suggestion?.meta_title || draft.headline,
        meta_description: draft.meta_suggestion?.meta_description || '',
        custom_excerpt: draft.subheadline || '',
        slug: slug,
        feature_image: featureUrl,
        og_image: ogImageUrl,
        twitter_image: ogImageUrl,
        codeinjection_foot: ''
      }]
    };

    const response = postToGhost(
      'posts/?source=html',
      postData,
      jwtToken
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
    const getResponse = getFromGhost(
      `posts/${postId}/?formats=html`,
      jwtToken
    );
    const savedPost = getResponse.posts[0];

    // 손상된 문자 검사
    const damaged = savedPost.html.match(/[\uFFFD]/g);
    if (damaged && damaged.length > 0) {
      throw new Error(`인코딩 오류: ${damaged.length}개 손상된 문자`);
    }

    console.log(`  ✓ 검증 완료 (OK)`);
  } catch (err) {
    console.error(`  ❌ 검증 실패: ${err.message}`);
    // Ghost에서 삭제
    try {
      deleteFromGhost(`posts/${postId}`, jwtToken);
    } catch (_) {}
    moveToRejected(filepath, `validation-failed: ${err.message}`);
    throw err;
  }

  // 08-published/에 결과 저장
  console.log('  → 8. 결과 저장...');
  const result = {
    ...draft,
    stage: 'published',
    publish_result: {
      ghost_post_id: postId,
      ghost_edit_url: `https://insight.ubion.global/ghost/#/editor/post/${postId}`,
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
    title: draft.headline,
    postId
  });

  const titleShort = (draft.headline || '').substring(0, 50);
  reportLines.push(`✅ ${titleShort}`);
  reportLines.push(`   https://insight.ubion.global/ghost/#/editor/post/${postId}`);
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
  const keywords = [
    '대학', '대학원', '고등교육', '대입', '학부', '캠퍼스', '교수', '강의',
    'university', 'college', 'higher education', 'undergraduate', 'graduate',
    'campus', 'professor', 'faculty', 'academic'
  ];

  const text = (headline + ' ' + tags.join(' ')).toLowerCase();
  return keywords.some(kw => text.includes(kw));
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

function postToGhost(endpoint, data, token) {
  const url = `${ghostConfig.apiUrl}/ghost/api/admin/${endpoint}`;
  const jsonData = JSON.stringify(data);
  
  // curl로 POST 요청
  const cmd = `curl -s -X POST "${url}" \\
    -H "Authorization: Ghost ${token}" \\
    -H "Content-Type: application/json" \\
    -d '${jsonData.replace(/'/g, "'\\''")}'`;
  
  const response = execSync(cmd, { 
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  
  return JSON.parse(response);
}

function getFromGhost(endpoint, token) {
  const url = `${ghostConfig.apiUrl}/ghost/api/admin/${endpoint}`;
  const cmd = `curl -s "${url}" \\
    -H "Authorization: Ghost ${token}"`;
  
  const response = execSync(cmd, { 
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  
  return JSON.parse(response);
}

function deleteFromGhost(endpoint, token) {
  const url = `${ghostConfig.apiUrl}/ghost/api/admin/${endpoint}`;
  const cmd = `curl -s -X DELETE "${url}" \\
    -H "Authorization: Ghost ${token}"`;
  
  execSync(cmd, { encoding: 'utf8' });
}

async function uploadImageToGhost(imagePath, token) {
  // Ghost Images API를 사용하여 이미지 업로드
  // 일단 로컬 경로를 Ghost에 업로드할 수 있도록 시도
  
  return new Promise((resolve, reject) => {
    const fileBuffer = fs.readFileSync(imagePath);
    const filename = path.basename(imagePath);
    
    // multipart/form-data로 이미지 업로드
    const boundary = '----FormBoundary' + Date.now();
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--`)
    ]);
    
    const url = new URL(`${ghostConfig.apiUrl}/ghost/api/admin/images/upload/`);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.images && result.images.length > 0) {
            resolve(result.images[0].url);
          } else {
            reject(new Error('Ghost image upload failed'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(body);
    req.end();
  });
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
