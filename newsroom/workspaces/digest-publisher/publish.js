#!/usr/bin/env node
/**
 * Digest Publisher — Ghost Admin API 발행 스크립트
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const DRAFTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/02-drafted';
const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/03-published';
const REJECTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/rejected';
const USED_IMAGES_FILE = '/root/.openclaw/workspace/newsroom/shared/config/used-images.json';
const GHOST_URL = 'https://ubion.ghost.io';
const API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const AI_DIGEST_TAG_ID = '69a78cc8659ea80001153beb';

const { getFeatureImageUrl } = require('/root/.openclaw/workspace/newsroom/scripts/get-feature-image.js');

function makeJWT() {
  const [kid, secret] = API_KEY.split(':');
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const p = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(h + '.' + p).digest('base64url');
  return `${h}.${p}.${sig}`;
}

function postToGhost(payload) {
  return new Promise((resolve, reject) => {
    const token = makeJWT();
    const body = JSON.stringify(payload);
    const url = new URL(`${GHOST_URL}/ghost/api/admin/posts/?source=html`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Ghost API error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function publishFile(filePath) {
  const filename = path.basename(filePath);
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const digest = raw.digest;

  // 피처 이미지 선택
  const featureUrl = getFeatureImageUrl({
    headline: digest.headline,
    tags: digest.ghost_tags,
    recentIdsFile: USED_IMAGES_FILE,
  });

  // 태그 구성: ai-digest 필수 + 추가 태그
  const additionalTags = (digest.ghost_tags || [])
    .filter(t => t !== 'ai-digest')
    .map(name => ({ name }));
  const tags = [{ id: AI_DIGEST_TAG_ID }, ...additionalTags];

  const payload = {
    posts: [{
      title: digest.headline,
      html: digest.html,
      status: 'published',
      featured: false,
      tags,
      meta_title: digest.meta_title,
      meta_description: digest.meta_description,
      feature_image: featureUrl,
      codeinjection_foot: '',
    }],
  };

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await postToGhost(payload);
      const post = result.posts[0];
      const now = new Date().toISOString();

      const publishedData = {
        ...raw,
        stage: 'published',
        publish_result: {
          ghost_post_id: post.id,
          ghost_url: `${GHOST_URL}/ghost/#/editor/post/${post.id}`,
          public_url: post.url || `${GHOST_URL}/${post.slug}/`,
          status: 'published',
          published_at: post.published_at || now,
          feature_image: featureUrl,
        },
        audit_log: [
          ...(raw.audit_log || []),
          { agent: 'digest-publisher', action: 'published', timestamp: now },
        ],
      };

      // 03-published/ 저장
      fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
      const outPath = path.join(PUBLISHED_DIR, filename);
      fs.writeFileSync(outPath, JSON.stringify(publishedData, null, 2));

      // 02-drafted/ 삭제
      fs.unlinkSync(filePath);

      return {
        success: true,
        headline: digest.headline,
        url: publishedData.publish_result.public_url,
        ghost_url: publishedData.publish_result.ghost_url,
        feature_image: featureUrl,
      };
    } catch (err) {
      lastError = err;
      console.error(`  [attempt ${attempt}/3] 실패: ${err.message}`);
      if (attempt < 3) await sleep(5000);
    }
  }

  // 3회 실패 → rejected/
  fs.mkdirSync(REJECTED_DIR, { recursive: true });
  const rejectedData = {
    ...raw,
    stage: 'rejected',
    error: lastError.message,
    audit_log: [
      ...(raw.audit_log || []),
      { agent: 'digest-publisher', action: 'rejected', timestamp: new Date().toISOString(), error: lastError.message },
    ],
  };
  fs.writeFileSync(path.join(REJECTED_DIR, filename), JSON.stringify(rejectedData, null, 2));
  fs.unlinkSync(filePath);

  return { success: false, headline: digest.headline, error: lastError.message };
}

async function main() {
  const files = fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('발행할 파일 없음. 종료.');
    process.exit(0);
  }

  console.log(`발행 대상: ${files.length}개 파일\n`);

  const results = [];
  for (const file of files) {
    const filePath = path.join(DRAFTED_DIR, file);
    console.log(`발행 중: ${file}`);
    const result = await publishFile(filePath);
    results.push(result);
    if (result.success) {
      console.log(`  ✅ 성공: ${result.headline}`);
      console.log(`     URL: ${result.url}`);
    } else {
      console.log(`  ❌ 실패: ${result.headline} — ${result.error}`);
    }
    console.log();
  }

  console.log('\n=== 발행 결과 요약 ===');
  const ok = results.filter(r => r.success);
  const fail = results.filter(r => !r.success);
  console.log(`성공: ${ok.length} / 전체: ${results.length}`);
  for (const r of ok) {
    console.log(`  📰 ${r.headline}`);
    console.log(`     🔗 ${r.url}`);
  }
  if (fail.length > 0) {
    console.log('\n실패:');
    for (const r of fail) {
      console.log(`  ❌ ${r.headline}: ${r.error}`);
    }
  }

  // JSON 출력 (파이프용)
  process.stdout.write('\n__RESULTS_JSON__\n');
  process.stdout.write(JSON.stringify(results) + '\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
