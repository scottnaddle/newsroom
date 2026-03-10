#!/usr/bin/env node
/**
 * Digest Publisher — Ghost에 AI Digest 발행
 * 
 * 1. 02-drafted/ 폴더의 모든 파일 로드
 * 2. 각 파일을 Ghost Admin API로 published 상태로 발행
 * 3. 결과를 03-published/에 저장
 * 4. 처리 완료 파일을 02-drafted/에서 삭제
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
const CONFIG_FILE = path.join(WORKSPACE, 'shared/config/ghost.json');
const USED_IMAGES_FILE = path.join(WORKSPACE, 'shared/config/used-images.json');

// Ghost 설정
const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const API_URL = 'https://insight.ubion.global/ghost/api/admin';
const AI_DIGEST_TAG_ID = '69a78cc8659ea80001153beb';

// JWT 생성
function createGhostJWT() {
  const [kid, secret] = config.adminApiKey.split(':');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const signature = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(header + '.' + payload).digest('base64url');
  return header + '.' + payload + '.' + signature;
}

// Ghost API 호출 (with retry)
async function callGhostAPI(method, endpoint, body, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const token = createGhostJWT();
      const url = new URL(API_URL + endpoint);
      
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          'Authorization': `Ghost ${token}`,
          'Content-Type': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode >= 400) {
              console.error(`❌ Ghost API Error [${res.statusCode}]:`, data);
              if (remaining > 0) {
                console.log(`   ⏳ Retrying in 5s (${remaining} left)...`);
                setTimeout(() => attempt(remaining - 1), 5000);
              } else {
                reject(new Error(`Ghost API Error [${res.statusCode}]: ${data}`));
              }
            } else {
              resolve(JSON.parse(data));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (err) => {
        if (remaining > 0) {
          console.log(`   ⏳ Request failed, retrying in 5s (${remaining} left)...`);
          setTimeout(() => attempt(remaining - 1), 5000);
        } else {
          reject(err);
        }
      });

      if (body) req.write(JSON.stringify(body));
      req.end();
    };
    attempt(retries);
  });
}

// Ghost slug 생성 (영문 제목 기반)
function generateSlug(headline) {
  // 영문 제목이 없으면 한글 제목 사용
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 60);
}

// Digest 발행
async function publishDigest(digestFile) {
  const filename = path.basename(digestFile);
  console.log(`\n📄 Processing: ${filename}`);

  try {
    const data = JSON.parse(fs.readFileSync(digestFile, 'utf8'));
    const { digest, source } = data;

    // Feature image 생성
    const featureUrl = getFeatureImageUrl({
      headline: digest.headline,
      tags: digest.ghost_tags,
      recentIdsFile: USED_IMAGES_FILE,
    });

    // Ghost 태그 배열 생성 (ai-digest 필수 + 추가 태그)
    const ghostTags = [{ id: AI_DIGEST_TAG_ID }];
    const additionalTags = (digest.ghost_tags || [])
      .filter(tag => tag !== 'ai-digest')
      .map(tag => ({ name: tag }));
    ghostTags.push(...additionalTags);

    // Ghost POST 데이터
    const postData = {
      posts: [{
        title: digest.headline,
        html: digest.html,
        status: 'published',
        featured: false,
        tags: ghostTags,
        meta_title: digest.meta_title,
        meta_description: digest.meta_description,
        feature_image: featureUrl,
        codeinjection_foot: '',
      }]
    };

    console.log(`  📝 Title: ${digest.headline}`);
    console.log(`  🏷️  Tags: ${digest.ghost_tags.join(', ')}`);
    console.log(`  📸 Feature Image: ${featureUrl}`);

    // Ghost에 발행
    const response = await callGhostAPI('POST', '/posts/?source=html', postData);
    const post = response.posts[0];

    const publishResult = {
      ghost_post_id: post.id,
      ghost_url: `https://insight.ubion.global/ghost/#/editor/post/${post.id}`,
      public_url: `https://insight.ubion.global/${post.slug}/`,
      status: 'published',
      published_at: new Date().toISOString(),
    };

    console.log(`  ✅ Published: ${publishResult.public_url}`);

    // 결과 저장 (03-published)
    const publishedData = {
      ...data,
      stage: 'published',
      publish_result: publishResult,
      audit_log: [
        ...(data.audit_log || []),
        {
          agent: 'digest-publisher',
          action: 'published',
          timestamp: new Date().toISOString(),
        }
      ]
    };

    const outputFile = path.join(PUBLISHED_DIR, filename);
    fs.writeFileSync(outputFile, JSON.stringify(publishedData, null, 2));
    console.log(`  💾 Saved: ${filename}`);

    // 원본 파일 삭제
    fs.unlinkSync(digestFile);
    console.log(`  🗑️  Removed from 02-drafted`);

    return { success: true, file: filename, url: publishResult.public_url };
  } catch (error) {
    console.error(`  ❌ Failed: ${error.message}`);

    // 실패 파일을 rejected/ 로 이동
    const rejectedFile = path.join(REJECTED_DIR, path.basename(digestFile));
    const data = JSON.parse(fs.readFileSync(digestFile, 'utf8'));
    data.stage = 'rejected';
    data.rejection_reason = error.message;
    data.rejected_at = new Date().toISOString();
    data.audit_log = [
      ...(data.audit_log || []),
      {
        agent: 'digest-publisher',
        action: 'rejected',
        reason: error.message,
        timestamp: new Date().toISOString(),
      }
    ];

    fs.writeFileSync(rejectedFile, JSON.stringify(data, null, 2));
    fs.unlinkSync(digestFile);
    console.log(`  🚫 Moved to rejected/`);

    return { success: false, file: filename, error: error.message };
  }
}

// Main
async function main() {
  console.log('🚀 AI Digest Publisher');
  console.log('====================\n');

  // 디렉토리 확인/생성
  [PUBLISHED_DIR, REJECTED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // 02-drafted 파일 로드
  const draftedFiles = fs.readdirSync(DRAFTED_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(DRAFTED_DIR, f));

  if (draftedFiles.length === 0) {
    console.log('✅ 할 일 없음 — 02-drafted/ 비어있음');
    process.exit(0);
  }

  console.log(`Found ${draftedFiles.length} digest(s) to publish\n`);

  // 발행 처리
  const results = [];
  for (const file of draftedFiles) {
    const result = await publishDigest(file);
    results.push(result);
  }

  // 요약
  console.log('\n' + '='.repeat(50));
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`\n📊 Summary:`);
  console.log(`  ✅ Published: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);

  results.filter(r => r.success).forEach(r => {
    console.log(`\n  📰 ${r.file}`);
    console.log(`     → ${r.url}`);
  });

  if (failCount > 0) {
    console.log('\n  ⚠️  Failed files:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`     • ${r.file}: ${r.error}`);
    });
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
