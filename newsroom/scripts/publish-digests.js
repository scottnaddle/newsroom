#!/usr/bin/env node
/**
 * Digest Publisher — Publishes all files in 02-drafted/ to Ghost CMS
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getFeatureImageUrl } = require('./get-feature-image.js');

const GHOST_URL = 'https://insight.ubion.global';
const API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const AI_DIGEST_TAG_ID = '69a78cc8659ea80001153beb';
const DRAFTED_DIR = path.join(__dirname, '../pipeline/digest/02-drafted');
const PUBLISHED_DIR = path.join(__dirname, '../pipeline/digest/03-published');
const USED_IMAGES_FILE = path.join(__dirname, '../shared/config/used-images.json');

function makeJWT() {
  const [kid, secret] = API_KEY.split(':');
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const p = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(h + '.' + p).digest('base64url');
  return h + '.' + p + '.' + sig;
}

// Tag name -> Ghost tag object mapping
const TAG_MAP = {
  'ai-digest': { id: AI_DIGEST_TAG_ID },
  'ai': { name: 'AI' },
  'regulation': { name: 'Regulation' },
  'technology': { name: 'Technology' },
};

function buildTags(ghostTags) {
  // Always include ai-digest tag first
  const tags = [{ id: AI_DIGEST_TAG_ID }];
  for (const t of ghostTags) {
    if (t === 'ai-digest') continue; // already added
    if (TAG_MAP[t]) {
      tags.push(TAG_MAP[t]);
    } else {
      tags.push({ name: t });
    }
  }
  return tags;
}

async function publishPost(data, token) {
  const featureUrl = getFeatureImageUrl({
    headline: data.digest.headline,
    tags: data.digest.ghost_tags,
    recentIdsFile: USED_IMAGES_FILE,
  });

  const body = {
    posts: [{
      title: data.digest.headline,
      html: data.digest.html,
      status: 'published',
      featured: false,
      tags: buildTags(data.digest.ghost_tags),
      meta_title: data.digest.meta_title,
      meta_description: data.digest.meta_description,
      feature_image: featureUrl,
      codeinjection_foot: '',
    }],
  };

  const url = `${GHOST_URL}/ghost/api/admin/posts/?source=html`;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Ghost ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const result = await res.json();
      return result.posts[0];
    } catch (err) {
      console.error(`  Attempt ${attempt}/3 failed: ${err.message}`);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 5000));
        // Refresh token for retry
        token = makeJWT();
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  // Ensure directories exist
  fs.mkdirSync(PUBLISHED_DIR, { recursive: true });

  const files = fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No files in 02-drafted/. Nothing to publish.');
    process.exit(0);
  }

  console.log(`Found ${files.length} draft(s) to publish.\n`);
  const results = [];

  for (const file of files) {
    const filePath = path.join(DRAFTED_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`Publishing: ${data.digest.headline}`);

    const token = makeJWT();
    try {
      const post = await publishPost(data, token);
      
      // Build published data
      const publishedData = {
        ...data,
        stage: 'published',
        publish_result: {
          ghost_post_id: post.id,
          ghost_url: `${GHOST_URL}/ghost/#/editor/post/${post.id}`,
          public_url: post.url || `${GHOST_URL}/${post.slug}/`,
          status: post.status,
          published_at: post.published_at,
        },
        audit_log: [
          ...data.audit_log,
          {
            agent: 'digest-publisher',
            action: 'published',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      // Save to 03-published/
      fs.writeFileSync(path.join(PUBLISHED_DIR, file), JSON.stringify(publishedData, null, 2));
      
      // Remove from 02-drafted/
      fs.unlinkSync(filePath);

      const publicUrl = post.url || `${GHOST_URL}/${post.slug}/`;
      console.log(`  ✅ Published: ${publicUrl}\n`);
      results.push({ title: data.digest.headline, url: publicUrl, id: post.id });
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}\n`);
      results.push({ title: data.digest.headline, error: err.message });
    }
  }

  console.log('\n=== SUMMARY ===');
  for (const r of results) {
    if (r.error) {
      console.log(`❌ ${r.title} — ERROR: ${r.error}`);
    } else {
      console.log(`✅ ${r.title}`);
      console.log(`   ${r.url}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
