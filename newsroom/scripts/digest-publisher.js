#!/usr/bin/env node
/**
 * Digest Publisher — Ghost CMS에 즉시 published 상태로 AI Digest 발행
 * 
 * 입력: /root/.openclaw/workspace/newsroom/pipeline/digest/02-drafted/
 * 출력: /root/.openclaw/workspace/newsroom/pipeline/digest/03-published/
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { getFeatureImageUrl } = require('./get-feature-image.js');

const WORKSPACE = '/root/.openclaw/workspace/newsroom';
const DRAFTED_DIR = path.join(WORKSPACE, 'pipeline/digest/02-drafted');
const PUBLISHED_DIR = path.join(WORKSPACE, 'pipeline/digest/03-published');
const REJECTED_DIR = path.join(WORKSPACE, 'pipeline/digest/rejected');

// Ghost 설정
const ghostConfig = JSON.parse(fs.readFileSync(path.join(WORKSPACE, 'shared/config/ghost.json'), 'utf8'));
const GHOST_CONFIG = {
  apiUrl: ghostConfig.apiUrl,
  adminApiKey: ghostConfig.adminApiKey,
  aiDigestTagId: '69a78cc8659ea80001153beb'
};

// JWT 토큰 생성
function generateGhostJWT() {
  const [kid, secret] = GHOST_CONFIG.adminApiKey.split(':');
  
  const header = Buffer.from(JSON.stringify({
    alg: 'HS256',
    typ: 'JWT',
    kid: kid
  })).toString('base64url');
  
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: '/admin/'
  })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(header + '.' + payload)
    .digest('base64url');
  
  return header + '.' + payload + '.' + signature;
}

// Ghost API 호출 (재시도 포함)
async function callGhostAPI(method, endpoint, data, retries = 3) {
  const token = generateGhostJWT();
  const url = new URL(endpoint, GHOST_CONFIG.apiUrl);
  
  const options = {
    method: method,
    headers: {
      'Authorization': `Ghost ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const makeRequest = () => {
      const req = https.request(url, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(body));
            } else if (retries > 0 && res.statusCode >= 500) {
              console.log(`  ⏳ Retry (${retries} left)...`);
              setTimeout(makeRequest, 5000);
              retries--;
            } else {
              reject(new Error(`Ghost API error ${res.statusCode}: ${body}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (err) => {
        if (retries > 0) {
          console.log(`  ⏳ Retry (${retries} left)...`);
          setTimeout(makeRequest, 5000);
          retries--;
        } else {
          reject(err);
        }
      });

      if (data) req.write(JSON.stringify(data));
      req.end();
    };

    makeRequest();
  });
}

// Slug 생성
function generateSlug(headline) {
  return headline
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
}

// Draft 발행
async function publishDigest(draftFile) {
  const filename = path.basename(draftFile);
  const digest = JSON.parse(fs.readFileSync(draftFile, 'utf8'));
  
  console.log(`📝 발행 중: ${digest.digest.headline}`);

  try {
    // 피처 이미지 URL 생성
    const featureImageUrl = getFeatureImageUrl({
      headline: digest.digest.headline,
      tags: digest.digest.ghost_tags,
      recentIdsFile: path.join(WORKSPACE, 'shared/config/used-images.json')
    });

    // Ghost 포스트 데이터 생성
    const slug = generateSlug(digest.digest.headline);
    const ghostPost = {
      title: digest.digest.headline,
      html: digest.digest.html,
      slug: slug,
      status: 'published',
      featured: false,
      tags: [
        { id: GHOST_CONFIG.aiDigestTagId },
        ...digest.digest.ghost_tags
          .filter(t => t !== 'ai-digest')
          .map(t => ({ name: t }))
      ],
      meta_title: digest.digest.meta_title || digest.digest.headline,
      meta_description: digest.digest.meta_description || digest.digest.lead,
      feature_image: featureImageUrl,
      codeinjection_foot: ''
    };

    // Ghost API에 발행
    const response = await callGhostAPI(
      'POST',
      '/ghost/api/admin/posts/?source=html',
      { posts: [ghostPost] }
    );

    const ghostPost_ = response.posts[0];
    const publishedAt = new Date().toISOString();

    // 결과 저장
    const resultData = {
      ...digest,
      stage: 'published',
      publish_result: {
        ghost_post_id: ghostPost_.id,
        ghost_url: `${GHOST_CONFIG.apiUrl}/ghost/#/editor/post/${ghostPost_.id}`,
        public_url: `${GHOST_CONFIG.apiUrl}/${ghostPost_.slug}/`,
        status: 'published',
        published_at: publishedAt
      },
      audit_log: [
        ...digest.audit_log,
        {
          agent: 'digest-publisher',
          action: 'published',
          timestamp: publishedAt
        }
      ]
    };

    // 03-published/에 저장
    const outputFile = path.join(PUBLISHED_DIR, filename);
    fs.writeFileSync(outputFile, JSON.stringify(resultData, null, 2));

    // 02-drafted/에서 삭제
    fs.unlinkSync(draftFile);

    console.log(`✅ 발행 완료: ${resultData.publish_result.public_url}`);
    return { success: true, title: digest.digest.headline, url: resultData.publish_result.public_url };

  } catch (error) {
    console.error(`❌ 발행 실패: ${error.message}`);
    
    // rejected/로 이동
    const resultData = {
      ...digest,
      stage: 'rejected',
      error: {
        agent: 'digest-publisher',
        action: 'publish_failed',
        timestamp: new Date().toISOString(),
        error_message: error.message
      },
      audit_log: [
        ...digest.audit_log,
        {
          agent: 'digest-publisher',
          action: 'publish_failed',
          timestamp: new Date().toISOString(),
          details: error.message
        }
      ]
    };

    const rejectedFile = path.join(REJECTED_DIR, filename);
    fs.writeFileSync(rejectedFile, JSON.stringify(resultData, null, 2));
    fs.unlinkSync(draftFile);

    return { success: false, title: digest.digest.headline, error: error.message };
  }
}

// 메인
async function main() {
  // 디렉토리 생성
  [PUBLISHED_DIR, REJECTED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Draft 파일 수집
  const draftFiles = fs.readdirSync(DRAFTED_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(DRAFTED_DIR, f))
    .sort();

  if (draftFiles.length === 0) {
    console.log('할 일 없음 — digest/02-drafted 비어있음');
    process.exit(0);
  }

  console.log(`\n🚀 Digest Publisher 시작 (총 ${draftFiles.length}개 발행)\n`);

  const results = [];
  for (const file of draftFiles) {
    const result = await publishDigest(file);
    results.push(result);
  }

  // 요약 출력
  console.log('\n📊 발행 완료 요약');
  console.log('─'.repeat(60));
  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${r.title}`);
    if (r.url) console.log(`   ${r.url}`);
    if (r.error) console.log(`   오류: ${r.error}`);
  });

  const successCount = results.filter(r => r.success).length;
  console.log('─'.repeat(60));
  console.log(`\n총 ${results.length}개 중 ${successCount}개 발행 완료`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
