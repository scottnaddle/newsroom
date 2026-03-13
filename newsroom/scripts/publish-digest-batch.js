#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GHOST_URL = 'https://ubion.ghost.io';
const API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const AI_DIGEST_TAG_ID = '69a78cc8659ea80001153beb';
const DRAFTED_DIR = path.join(__dirname, '..', 'pipeline', 'digest', '02-drafted');
const PUBLISHED_DIR = path.join(__dirname, '..', 'pipeline', 'digest', '03-published');
const REJECTED_DIR = path.join(__dirname, '..', 'pipeline', 'digest', 'rejected');

// Ensure output dirs exist
[PUBLISHED_DIR, REJECTED_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// Feature image helper
const { getFeatureImageUrl } = require(path.join(__dirname, 'get-feature-image.js'));
const USED_IMAGES_FILE = path.join(__dirname, '..', 'shared', 'config', 'used-images.json');

function makeToken() {
  const [kid, secret] = API_KEY.split(':');
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const p = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(h + '.' + p).digest('base64url');
  return h + '.' + p + '.' + sig;
}

async function publishPost(data, filename) {
  const token = makeToken();
  const digest = data.digest;

  // Get feature image
  let featureImageUrl = '';
  try {
    featureImageUrl = getFeatureImageUrl({
      headline: digest.headline,
      tags: digest.ghost_tags,
      recentIdsFile: USED_IMAGES_FILE
    });
  } catch (e) {
    console.warn(`  ⚠ Feature image failed: ${e.message}`);
  }

  // Build tags array: always include ai-digest tag by ID, plus additional tags by name
  const tags = [{ id: AI_DIGEST_TAG_ID }];
  if (digest.ghost_tags) {
    digest.ghost_tags
      .filter(t => t !== 'ai-digest')
      .forEach(t => tags.push({ name: t }));
  }

  const postBody = {
    posts: [{
      title: digest.headline,
      html: digest.html,
      status: 'published',
      featured: false,
      tags: tags,
      meta_title: digest.meta_title || '',
      meta_description: digest.meta_description || '',
      feature_image: featureImageUrl || undefined,
      codeinjection_foot: ''
    }]
  };

  // Retry up to 3 times
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(`${GHOST_URL}/ghost/api/admin/posts/?source=html`, {
        method: 'POST',
        headers: {
          'Authorization': `Ghost ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postBody)
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errText}`);
      }

      const result = await resp.json();
      const post = result.posts[0];

      // Build published record
      const publishedData = {
        ...data,
        stage: 'published',
        publish_result: {
          ghost_post_id: post.id,
          ghost_url: `${GHOST_URL}/ghost/#/editor/post/${post.id}`,
          public_url: post.url || `${GHOST_URL}/${post.slug}/`,
          status: post.status,
          published_at: post.published_at
        },
        audit_log: [
          ...(data.audit_log || []),
          {
            agent: 'digest-publisher',
            action: 'published',
            timestamp: new Date().toISOString()
          }
        ]
      };

      // Save to 03-published
      const outPath = path.join(PUBLISHED_DIR, filename);
      fs.writeFileSync(outPath, JSON.stringify(publishedData, null, 2));

      // Remove from 02-drafted
      fs.unlinkSync(path.join(DRAFTED_DIR, filename));

      return { success: true, title: digest.headline, url: post.url || `${GHOST_URL}/${post.slug}/`, id: post.id };
    } catch (err) {
      lastErr = err;
      console.warn(`  ⚠ Attempt ${attempt}/3 failed: ${err.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 5000));
    }
  }

  // All retries failed — move to rejected
  const rejectedData = {
    ...data,
    stage: 'rejected',
    error: lastErr.message,
    audit_log: [
      ...(data.audit_log || []),
      {
        agent: 'digest-publisher',
        action: 'rejected',
        reason: lastErr.message,
        timestamp: new Date().toISOString()
      }
    ]
  };
  fs.writeFileSync(path.join(REJECTED_DIR, filename), JSON.stringify(rejectedData, null, 2));
  fs.unlinkSync(path.join(DRAFTED_DIR, filename));

  return { success: false, title: digest.headline, error: lastErr.message };
}

async function main() {
  const files = fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No files to publish.');
    return;
  }

  console.log(`📰 Publishing ${files.length} digest(s)...\n`);
  const results = [];

  for (const file of files) {
    console.log(`▶ ${file}`);
    const data = JSON.parse(fs.readFileSync(path.join(DRAFTED_DIR, file), 'utf8'));
    const result = await publishPost(data, file);
    results.push(result);

    if (result.success) {
      console.log(`  ✅ Published: ${result.title}`);
      console.log(`  🔗 ${result.url}\n`);
    } else {
      console.log(`  ❌ Failed: ${result.title}`);
      console.log(`  Error: ${result.error}\n`);
    }
  }

  console.log('--- Summary ---');
  const ok = results.filter(r => r.success).length;
  const fail = results.filter(r => !r.success).length;
  console.log(`✅ ${ok} published, ❌ ${fail} failed`);

  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
