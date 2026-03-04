#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const { getFeatureImageUrl } = require('/root/.openclaw/workspace/newsroom/scripts/get-feature-image.js');

const DRAFTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/02-drafted';
const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/03-published';
const USED_IMAGES_FILE = '/root/.openclaw/workspace/newsroom/shared/config/used-images.json';
const GHOST_URL = 'https://ubion.ghost.io';
const API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const TAG_ID_AI_DIGEST = '69a78cc8659ea80001153beb';

// JWT 생성
function makeJWT() {
  const [kid, secret] = API_KEY.split(':');
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const p = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(h + '.' + p).digest('base64url');
  return `${h}.${p}.${sig}`;
}

// Ghost API POST
function ghostPost(payload, retries = 3) {
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

async function publishWithRetry(payload, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await ghostPost(payload);
    } catch (err) {
      if (i < retries - 1) {
        console.error(`  재시도 ${i + 1}/${retries - 1}... (${err.message})`);
        await new Promise(r => setTimeout(r, 5000));
      } else {
        throw err;
      }
    }
  }
}

// 태그 이름 → {name} 객체 (ai-digest는 ID로)
function buildTags(ghostTags) {
  return ghostTags.map(tag => {
    if (tag === 'ai-digest') return { id: TAG_ID_AI_DIGEST };
    return { name: tag };
  });
}

async function main() {
  fs.mkdirSync(PUBLISHED_DIR, { recursive: true });

  const files = fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('02-drafted/ 파일 없음. 종료.');
    process.exit(0);
  }

  const results = [];

  for (const filename of files) {
    const filepath = path.join(DRAFTED_DIR, filename);
    const article = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const { headline, html, ghost_tags, meta_title, meta_description } = article.digest;

    console.log(`\n📰 발행 중: ${headline}`);

    // 피처 이미지 선택
    const featureImage = getFeatureImageUrl({
      headline,
      tags: ghost_tags,
      recentIdsFile: USED_IMAGES_FILE,
    });
    console.log(`  🖼  Feature: ${featureImage}`);

    // Ghost 페이로드
    const payload = {
      posts: [{
        title: headline,
        html,
        status: 'published',
        featured: false,
        tags: buildTags(ghost_tags),
        meta_title,
        meta_description,
        feature_image: featureImage,
        codeinjection_foot: '',
      }],
    };

    let result;
    try {
      result = await publishWithRetry(payload);
    } catch (err) {
      console.error(`  ❌ 발행 실패: ${err.message}`);
      // rejected/ 이동
      const rejDir = '/root/.openclaw/workspace/newsroom/pipeline/digest/rejected';
      fs.mkdirSync(rejDir, { recursive: true });
      article.stage = 'rejected';
      article.error = err.message;
      article.audit_log.push({ agent: 'digest-publisher', action: 'rejected', timestamp: new Date().toISOString() });
      fs.writeFileSync(path.join(rejDir, filename), JSON.stringify(article, null, 2));
      fs.unlinkSync(filepath);
      continue;
    }

    const post = result.posts[0];
    const publishedAt = post.published_at || new Date().toISOString();
    const publicUrl = post.url || `${GHOST_URL}/${post.slug}/`;
    const editorUrl = `${GHOST_URL}/ghost/#/editor/post/${post.id}`;

    console.log(`  ✅ 발행 완료: ${publicUrl}`);

    // 결과 파일 저장
    const published = {
      ...article,
      stage: 'published',
      publish_result: {
        ghost_post_id: post.id,
        ghost_url: editorUrl,
        public_url: publicUrl,
        status: 'published',
        published_at: publishedAt,
        feature_image: featureImage,
      },
      audit_log: [
        ...article.audit_log,
        { agent: 'digest-publisher', action: 'published', timestamp: new Date().toISOString() },
      ],
    };

    fs.writeFileSync(path.join(PUBLISHED_DIR, filename), JSON.stringify(published, null, 2));
    fs.unlinkSync(filepath);

    results.push({ headline, publicUrl });
  }

  console.log('\n\n===== 발행 완료 =====');
  for (const r of results) {
    console.log(`• ${r.headline}`);
    console.log(`  ${r.publicUrl}`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
