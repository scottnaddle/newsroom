const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getFeatureImageUrl } = require('/root/.openclaw/workspace/newsroom/scripts/get-feature-image.js');

const DRAFTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/02-drafted';
const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/03-published';
const USED_IMAGES_FILE = '/root/.openclaw/workspace/newsroom/shared/config/used-images.json';
const GHOST_URL = 'https://insight.ubion.global';
const API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const TAG_ID = '69a78cc8659ea80001153beb';

function makeJWT() {
  const [kid, secret] = API_KEY.split(':');
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:now,exp:now+300,aud:'/admin/'})).toString('base64url');
  const sig = crypto.createHmac('sha256', Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+sig;
}

async function publishPost(data, featureImage, retries = 3) {
  const { digest } = data;
  
  // Build tags array: ai-digest first, then additional tags (skip ai-digest duplicate)
  const extraTags = (digest.ghost_tags || [])
    .filter(t => t !== 'ai-digest')
    .map(t => ({ name: t }));
  
  const postBody = {
    posts: [{
      title: digest.headline,
      html: digest.html,
      status: 'published',
      featured: false,
      tags: [{ id: TAG_ID }, ...extraTags],
      meta_title: digest.meta_title,
      meta_description: digest.meta_description,
      feature_image: featureImage,
      codeinjection_foot: ''
    }]
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const token = makeJWT();
      const res = await fetch(`${GHOST_URL}/ghost/api/admin/posts/?source=html`, {
        method: 'POST',
        headers: {
          'Authorization': `Ghost ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postBody)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const result = await res.json();
      const post = result.posts[0];
      return {
        ghost_post_id: post.id,
        ghost_url: `${GHOST_URL}/ghost/#/editor/post/${post.id}`,
        public_url: post.url,
        status: post.status,
        published_at: post.published_at
      };
    } catch (err) {
      console.error(`  Attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 5000));
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  // Ensure published dir exists
  if (!fs.existsSync(PUBLISHED_DIR)) fs.mkdirSync(PUBLISHED_DIR, { recursive: true });

  const files = fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No drafted files found. Exiting.');
    process.exit(0);
  }

  console.log(`Found ${files.length} drafted file(s). Publishing...\n`);
  const results = [];

  for (const file of files) {
    const filePath = path.join(DRAFTED_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const { digest } = data;

    console.log(`📝 ${digest.headline}`);

    // Get feature image
    const featureImage = getFeatureImageUrl({
      headline: digest.headline,
      tags: digest.ghost_tags,
      recentIdsFile: USED_IMAGES_FILE
    });
    console.log(`  🖼  Feature image: ${featureImage}`);

    try {
      const publishResult = await publishPost(data, featureImage);
      console.log(`  ✅ Published: ${publishResult.public_url}`);

      // Update data object
      const now = new Date().toISOString();
      const updatedData = {
        ...data,
        stage: 'published',
        publish_result: publishResult,
        audit_log: [
          ...(data.audit_log || []),
          { agent: 'digest-publisher', action: 'published', timestamp: now }
        ]
      };

      // Save to 03-published
      const destPath = path.join(PUBLISHED_DIR, file);
      fs.writeFileSync(destPath, JSON.stringify(updatedData, null, 2));

      // Remove from 02-drafted
      fs.unlinkSync(filePath);

      results.push({ title: digest.headline, url: publishResult.public_url, success: true });
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
      // Move to rejected
      const rejectedDir = '/root/.openclaw/workspace/newsroom/pipeline/digest/rejected';
      if (!fs.existsSync(rejectedDir)) fs.mkdirSync(rejectedDir, { recursive: true });
      const rejectedData = {
        ...data,
        stage: 'rejected',
        error: err.message,
        audit_log: [
          ...(data.audit_log || []),
          { agent: 'digest-publisher', action: 'rejected', error: err.message, timestamp: new Date().toISOString() }
        ]
      };
      fs.writeFileSync(path.join(rejectedDir, file), JSON.stringify(rejectedData, null, 2));
      fs.unlinkSync(filePath);
      results.push({ title: digest.headline, url: null, success: false, error: err.message });
    }

    console.log('');
  }

  console.log('\n=== PUBLISH SUMMARY ===');
  for (const r of results) {
    if (r.success) {
      console.log(`✅ ${r.title}`);
      console.log(`   ${r.url}`);
    } else {
      console.log(`❌ ${r.title} — ${r.error}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
