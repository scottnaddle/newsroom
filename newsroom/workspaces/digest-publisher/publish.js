const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

const DRAFTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/02-drafted';
const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/03-published';
const API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const TAG_ID = '69a78cc8659ea80001153beb';
const { getFeatureImageUrl } = require('/root/.openclaw/workspace/newsroom/scripts/get-feature-image.js');
const USED_IMAGES_FILE = '/root/.openclaw/workspace/newsroom/shared/config/used-images.json';

const [kid, secret] = API_KEY.split(':');

function makeToken() {
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:now,exp:now+300,aud:'/admin/'})).toString('base64url');
  const sig = crypto.createHmac('sha256',Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+sig;
}

function postToGhost(postData) {
  return new Promise((resolve, reject) => {
    const token = makeToken();
    const body = JSON.stringify({ posts: [postData] });
    const options = {
      hostname: 'ubion.ghost.io',
      path: '/ghost/api/admin/posts/?source=html',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Ghost ' + token,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function publishWithRetry(postData, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await postToGhost(postData);
    if (res.status === 201) return res;
    console.error(`Attempt ${i+1} failed (${res.status}), retrying...`);
    if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 5000));
  }
  return null;
}

async function main() {
  fs.mkdirSync(PUBLISHED_DIR, { recursive: true });

  const files = fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('NO_FILES');
    return;
  }

  const published = [];
  const failed = [];

  for (const filename of files) {
    const filePath = path.join(DRAFTED_DIR, filename);
    const articleData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const d = articleData.digest;

    const featureImage = getFeatureImageUrl({
      headline: d.headline,
      tags: d.ghost_tags,
      recentIdsFile: USED_IMAGES_FILE
    });

    const tags = [{ id: TAG_ID }];
    for (const t of d.ghost_tags) {
      if (t !== 'ai-digest') tags.push({ name: t });
    }

    const postData = {
      title: d.headline,
      html: d.html,
      status: 'published',
      featured: false,
      tags,
      meta_title: d.meta_title,
      meta_description: d.meta_description,
      feature_image: featureImage,
      codeinjection_foot: ''
    };

    console.error(`Publishing: ${d.headline}`);
    const res = await publishWithRetry(postData);

    if (res && res.status === 201) {
      const post = res.body.posts[0];
      const now = new Date().toISOString();

      articleData.stage = 'published';
      articleData.publish_result = {
        ghost_post_id: post.id,
        ghost_url: `https://ubion.ghost.io/ghost/#/editor/post/${post.id}`,
        public_url: post.url,
        status: 'published',
        published_at: now
      };
      articleData.audit_log = [
        ...(articleData.audit_log || []),
        { agent: 'digest-publisher', action: 'published', timestamp: now }
      ];

      const outPath = path.join(PUBLISHED_DIR, filename);
      fs.writeFileSync(outPath, JSON.stringify(articleData, null, 2));
      fs.unlinkSync(filePath);

      published.push({ title: d.headline, url: post.url });
      console.log(`OK: ${d.headline} => ${post.url}`);
    } else {
      console.error(`FAILED: ${filename}`);
      failed.push(filename);
    }
  }

  console.log('\n=== RESULT ===');
  for (const p of published) {
    console.log(`✅ ${p.title}`);
    console.log(`   ${p.url}`);
  }
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.join(', ')}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
