#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');

const DRAFTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/02-drafted';
const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/03-published';
const REJECTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/rejected';
const USED_IMAGES_FILE = '/root/.openclaw/workspace/newsroom/shared/config/used-images.json';
const { getFeatureImageUrl } = require('/root/.openclaw/workspace/newsroom/scripts/get-feature-image.js');

const API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const GHOST_URL = 'https://ubion.ghost.io';
const AI_DIGEST_TAG_ID = '69a78cc8659ea80001153beb';

function makeJWT() {
  const [kid, secret] = API_KEY.split(':');
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const p = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(h + '.' + p).digest('base64url');
  return `${h}.${p}.${sig}`;
}

function ghostPost(payload) {
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
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function publishFile(filePath) {
  const filename = path.basename(filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const digest = JSON.parse(raw);
  const d = digest.digest;

  // 피처 이미지
  const featureUrl = getFeatureImageUrl({
    headline: d.headline,
    tags: d.ghost_tags,
    recentIdsFile: USED_IMAGES_FILE,
  });

  // 태그 구성: ai-digest 우선, 나머지 이름으로
  const tags = [{ id: AI_DIGEST_TAG_ID }];
  for (const t of (d.ghost_tags || [])) {
    if (t !== 'ai-digest') tags.push({ name: t });
  }

  const payload = {
    posts: [{
      title: d.headline,
      html: d.html,
      status: 'published',
      featured: false,
      tags,
      meta_title: d.meta_title,
      meta_description: d.meta_description,
      feature_image: featureUrl,
      codeinjection_foot: '',
    }],
  };

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await ghostPost(payload);
      const post = result.posts[0];
      const now = new Date().toISOString();
      const updated = {
        ...digest,
        stage: 'published',
        publish_result: {
          ghost_post_id: post.id,
          ghost_url: `${GHOST_URL}/ghost/#/editor/post/${post.id}`,
          public_url: post.url,
          status: post.status,
          published_at: post.published_at || now,
        },
        audit_log: [
          ...(digest.audit_log || []),
          { agent: 'digest-publisher', action: 'published', timestamp: now },
        ],
      };
      // 03-published 저장
      if (!fs.existsSync(PUBLISHED_DIR)) fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
      fs.writeFileSync(path.join(PUBLISHED_DIR, filename), JSON.stringify(updated, null, 2));
      // 02-drafted 삭제
      fs.unlinkSync(filePath);
      return { ok: true, headline: d.headline, url: post.url };
    } catch (err) {
      lastErr = err;
      console.error(`  [attempt ${attempt}/3] 실패: ${err.message}`);
      if (attempt < 3) await sleep(5000);
    }
  }

  // 3회 실패 → rejected
  if (!fs.existsSync(REJECTED_DIR)) fs.mkdirSync(REJECTED_DIR, { recursive: true });
  const rejectedData = {
    ...digest,
    stage: 'rejected',
    error: lastErr?.message,
    audit_log: [
      ...(digest.audit_log || []),
      { agent: 'digest-publisher', action: 'rejected', error: lastErr?.message, timestamp: new Date().toISOString() },
    ],
  };
  fs.writeFileSync(path.join(REJECTED_DIR, filename), JSON.stringify(rejectedData, null, 2));
  fs.unlinkSync(filePath);
  return { ok: false, headline: d.headline, error: lastErr?.message };
}

async function main() {
  const files = fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('EMPTY: 02-drafted/ 에 처리할 파일 없음. 종료.');
    process.exit(0);
  }

  const results = [];
  for (const f of files) {
    console.log(`발행 중: ${f}`);
    const res = await publishFile(path.join(DRAFTED_DIR, f));
    results.push(res);
    console.log(res.ok ? `  ✅ ${res.url}` : `  ❌ 실패: ${res.error}`);
  }

  console.log('\n=== 발행 결과 ===');
  for (const r of results) {
    if (r.ok) console.log(`✅ ${r.headline}\n   ${r.url}`);
    else console.log(`❌ [실패] ${r.headline}\n   ${r.error}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
