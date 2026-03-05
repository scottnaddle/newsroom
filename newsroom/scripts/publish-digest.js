#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { getFeatureImageUrl } = require('./get-feature-image.js');

// Configuration
const API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const GHOST_URL = 'https://ubion.ghost.io';
const AI_DIGEST_TAG_ID = '69a78cc8659ea80001153beb';
const WORKSPACE = '/root/.openclaw/workspace/newsroom';
const DRAFTED_DIR = `${WORKSPACE}/pipeline/digest/02-drafted`;
const PUBLISHED_DIR = `${WORKSPACE}/pipeline/digest/03-published`;
const REJECTED_DIR = `${WORKSPACE}/pipeline/digest/04-rejected`;
const USED_IMAGES_FILE = `${WORKSPACE}/shared/config/used-images.json`;

// Ensure directories exist
[PUBLISHED_DIR, REJECTED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// JWT Token Generation
function generateJWT() {
  const [kid, secret] = API_KEY.split(':');
  const header = Buffer.from(JSON.stringify({
    alg: 'HS256',
    typ: 'JWT',
    kid
  })).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: '/admin/'
  })).toString('base64url');

  const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'hex'));
  hmac.update(header + '.' + payload);
  const signature = hmac.digest('base64url');

  return header + '.' + payload + '.' + signature;
}

// Make HTTPS POST request
async function postToGhost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, GHOST_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Ghost ${generateJWT()}`,
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve({ raw: data });
          }
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

// Process a single draft file
async function publishDraft(filename) {
  const draftPath = path.join(DRAFTED_DIR, filename);
  const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));

  console.log(`📤 Publishing: ${draft.digest.headline}`);

  try {
    // Get feature image
    const featureImageUrl = getFeatureImageUrl({
      headline: draft.digest.headline,
      tags: draft.digest.ghost_tags,
      recentIdsFile: USED_IMAGES_FILE
    });

    // Build tags array
    const tags = [{ id: AI_DIGEST_TAG_ID }];
    if (draft.digest.ghost_tags) {
      // We'll need to add other tags, but for now just the ai-digest tag
      draft.digest.ghost_tags.forEach(tagName => {
        if (tagName !== 'ai-digest') {
          // For now, just track them in the meta
        }
      });
    }

    // Prepare Ghost post
    const ghostPost = {
      posts: [{
        title: draft.digest.headline,
        html: draft.digest.html,
        status: 'published',
        featured: false,
        tags: tags,
        meta_title: draft.digest.meta_title || draft.digest.headline,
        meta_description: draft.digest.meta_description || draft.digest.lead.substring(0, 150),
        feature_image: featureImageUrl,
        codeinjection_foot: ''
      }]
    };

    // Publish to Ghost
    const result = await postToGhost('/ghost/api/admin/posts/?source=html', ghostPost);
    
    if (!result.posts || !result.posts[0]) {
      throw new Error('No post returned from Ghost API');
    }

    const publishedPost = result.posts[0];
    
    // Prepare result file
    const resultData = {
      ...draft,
      stage: 'published',
      publish_result: {
        ghost_post_id: publishedPost.id,
        ghost_url: `${GHOST_URL}/ghost/#/editor/post/${publishedPost.id}`,
        public_url: `${GHOST_URL}/${publishedPost.slug}/`,
        status: 'published',
        published_at: publishedPost.published_at || new Date().toISOString()
      },
      audit_log: [
        ...(draft.audit_log || []),
        {
          agent: 'digest-publisher',
          action: 'published',
          timestamp: new Date().toISOString()
        }
      ]
    };

    // Save to published directory
    const publishedPath = path.join(PUBLISHED_DIR, filename);
    fs.writeFileSync(publishedPath, JSON.stringify(resultData, null, 2));

    // Delete from drafted directory
    fs.unlinkSync(draftPath);

    console.log(`✅ Published: ${draft.digest.headline}`);
    console.log(`🔗 URL: ${resultData.publish_result.public_url}`);
    
    return resultData;
  } catch (error) {
    console.error(`❌ Failed to publish ${filename}: ${error.message}`);
    
    // Move to rejected directory
    const rejectedPath = path.join(REJECTED_DIR, filename);
    const rejectedData = {
      ...draft,
      stage: 'rejected',
      error: error.message,
      rejected_at: new Date().toISOString(),
      audit_log: [
        ...(draft.audit_log || []),
        {
          agent: 'digest-publisher',
          action: 'rejected',
          timestamp: new Date().toISOString(),
          reason: error.message
        }
      ]
    };
    fs.writeFileSync(rejectedPath, JSON.stringify(rejectedData, null, 2));
    fs.unlinkSync(draftPath);
    
    return null;
  }
}

// Main execution
async function main() {
  const files = fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('No drafts to publish. Exiting.');
    process.exit(0);
  }

  console.log(`Found ${files.length} draft(s) to publish`);
  console.log('---');

  const results = [];
  for (const filename of files) {
    const result = await publishDraft(filename);
    if (result) results.push(result);
  }

  console.log('---');
  console.log(`\n📊 Summary: ${results.length}/${files.length} published`);
  
  results.forEach(r => {
    console.log(`  • ${r.digest.headline}`);
    console.log(`    ${r.publish_result.public_url}`);
  });
}

main().catch(console.error);
