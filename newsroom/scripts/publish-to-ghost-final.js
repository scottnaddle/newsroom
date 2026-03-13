#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const INPUT_DIR = '/root/.openclaw/workspace/newsroom/pipeline/07-copy-edited';
const OUTPUT_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
const REJECTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/rejected';
const CONFIG_FILE = '/root/.openclaw/workspace/newsroom/shared/config/ghost.json';

let results = [];
let reportLines = [];
let ghostConfig;

async function main() {
  try {
    console.log('[Publisher Agent] 시작 —', new Date().toISOString());
    
    // 1. 설정 로드
    ghostConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    console.log('✓ Ghost 설정 로드 완료');

    // 2. 입력 파일 확인
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
        // 3초 간격 추가 (Ghost API rate limit 회피)
        await new Promise(r => setTimeout(r, 3000));
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
      console.log('\n📊 발행 목록:');
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

  const headline = draft.final_headline || draft.draft.headline || draft.headline;
  console.log(`\n📰 ${(headline || filename).substring(0, 60)}`);

  // 데이터 검증
  if (!draft.copy_edit || !draft.copy_edit.final_html) {
    throw new Error('copy_edit.final_html 없음');
  }
  if (!draft.draft.feature_image) {
    throw new Error('draft.feature_image 없음');
  }
  if (!draft.draft.og_image) {
    throw new Error('draft.og_image 없음');
  }

  // HTML 정제
  console.log('  → HTML 정제 중...');
  let cleanHtml = cleanupHtml(draft.copy_edit.final_html);
  console.log('  ✓ HTML 정제 완료');

  // JWT 토큰 생성
  console.log('  → JWT 토큰 생성 중...');
  const jwtToken = generateJWT(ghostConfig.adminApiKey);
  console.log('  ✓ JWT 생성 완료');

  // 고등교육 여부 판단
  const tags = draft.draft.ghost_tags || [];
  const isFeatured = isHigherEducation(headline, tags);

  // Slug 생성
  const slug = generateSlug(filename);

  // Ghost 게시물 생성
  console.log('  → Ghost 게시 중...');
  let postId;
  try {
    const postData = {
      posts: [{
        title: headline,
        html: cleanHtml,
        status: 'published',
        featured: isFeatured,
        tags: [
          { id: '69a7a9ed659ea80001153c13' }, // ai-edu 태그
          ...tags.map(t => ({ name: t }))
        ],
        meta_title: draft.copy_edit.meta_suggestion?.meta_title || headline,
        meta_description: draft.copy_edit.meta_suggestion?.meta_description || '',
        custom_excerpt: draft.draft.subheadline || '',
        slug: slug,
        feature_image: draft.draft.feature_image,
        og_image: draft.draft.og_image,
        twitter_image: draft.draft.og_image,
        codeinjection_foot: ''
      }]
    };

    const response = postToGhost('posts/?source=html', postData, jwtToken);
    postId = response.posts[0].id;
    console.log(`  ✓ Ghost 게시 완료 (ID: ${postId})`);
  } catch (err) {
    console.error(`  ❌ Ghost API 오류: ${err.message}`);
    moveToRejected(filepath, `ghost-api-error: ${err.message}`);
    throw err;
  }

  // 검증: Ghost에서 다시 읽기
  console.log('  → Ghost 검증 중...');
  try {
    const getResponse = getFromGhost(`posts/${postId}/?formats=html`, jwtToken);
    const savedPost = getResponse.posts[0];

    // 손상된 문자 검사
    const damaged = savedPost.html.match(/[\uFFFD]/g);
    if (damaged && damaged.length > 0) {
      throw new Error(`인코딩 오류: ${damaged.length}개 손상된 문자`);
    }

    console.log('  ✓ Ghost 검증 완료');
  } catch (err) {
    console.error(`  ❌ 검증 실패: ${err.message}`);
    // Ghost에서 삭제
    try {
      deleteFromGhost(`posts/${postId}`, jwtToken);
      console.log('  ℹ️  Ghost에서 자동 삭제됨');
    } catch (_) {}
    moveToRejected(filepath, `validation-failed: ${err.message}`);
    throw err;
  }

  // 결과 저장
  console.log('  → 결과 저장 중...');
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
  console.log('  ✓ 결과 저장 완료');

  // 원본 파일 삭제
  fs.unlinkSync(filepath);
  console.log('  ✓ 원본 파일 삭제');

  results.push({
    file: filename,
    status: 'published',
    title: headline,
    postId
  });

  const titleShort = (headline || '').substring(0, 55);
  reportLines.push(`✅ ${titleShort}`);
  reportLines.push(`   → https://ubion.ghost.io/ghost/#/editor/post/${postId}`);
}

function cleanupHtml(html) {
  if (!html) return '';

  let cleaned = html;

  // 1. AI 공개 배지 (상단 pill) 제거
  cleaned = cleaned.replace(/<div[^>]*style="margin-bottom:32px;"[^>]*>[\s\S]*?🤖[\s\S]*?<\/div>/g, '');
  cleaned = cleaned.replace(/<span[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?🤖[\s\S]*?<\/span>/g, '');

  // 2. 수치 카드/배너 (display:flex) 제거
  cleaned = cleaned.replace(/<div[^>]*style="display:\s*flex[^>]*>[\s\S]*?<\/div>/gi, '');

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
  // 2026-03-04_10-58_edweek-1000-districts-ai-readiness-risk.json
  // → edweek-1000-districts-ai-readiness-risk
  const base = filename.replace('.json', '');
  const parts = base.split('_');
  if (parts.length >= 3) {
    return parts.slice(2).join('-');
  }
  return base;
}

function postToGhost(endpoint, data, token) {
  const url = `${ghostConfig.apiUrl}/ghost/api/admin/${endpoint}`;
  const jsonData = JSON.stringify(data);
  
  const escapedJson = jsonData
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  const cmd = `curl -s -X POST "${url}" \\
    -H "Authorization: Ghost ${token}" \\
    -H "Content-Type: application/json" \\
    -d "${escapedJson}"`;
  
  const response = execSync(cmd, { 
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30000
  });
  
  const parsed = JSON.parse(response);
  
  if (!parsed.posts || parsed.posts.length === 0) {
    throw new Error(`Ghost API 오류: ${response}`);
  }
  
  return parsed;
}

function getFromGhost(endpoint, token) {
  const url = `${ghostConfig.apiUrl}/ghost/api/admin/${endpoint}`;
  
  const cmd = `curl -s "${url}" \\
    -H "Authorization: Ghost ${token}"`;
  
  const response = execSync(cmd, { 
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30000
  });
  
  return JSON.parse(response);
}

function deleteFromGhost(endpoint, token) {
  const url = `${ghostConfig.apiUrl}/ghost/api/admin/${endpoint}`;
  
  const cmd = `curl -s -X DELETE "${url}" \\
    -H "Authorization: Ghost ${token}"`;
  
  execSync(cmd, { 
    encoding: 'utf8',
    timeout: 30000
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
