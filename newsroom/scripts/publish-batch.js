#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Ghost config
const ghostConfig = JSON.parse(fs.readFileSync('/root/.openclaw/workspace/newsroom/shared/config/ghost.json', 'utf8'));
const API_URL = ghostConfig.apiUrl;
const [kid, secretHex] = ghostConfig.adminApiKey.split(':');

function makeJWT() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid, typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: '/admin/'
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function checkUrl(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'HEAD', timeout: 10000 }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function ghostPost(postData, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ posts: [postData] });
    const url = new URL(`${API_URL}/ghost/api/admin/posts/`);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Ghost API ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function stripHtmlTags(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function main() {
  const srcDir = '/root/.openclaw/workspace/newsroom/pipeline/07-copy-edited';
  const dstDir = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
  const rejDir = path.join(srcDir, 'rejected');

  fs.mkdirSync(dstDir, { recursive: true });
  fs.mkdirSync(rejDir, { recursive: true });

  const files = fs.readdirSync(srcDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('.'))
    .sort()
    .slice(0, 3);

  console.log(`Found ${files.length} articles to publish`);

  const token = makeJWT();
  let published = 0;
  let rejected = 0;

  for (const file of files) {
    const filePath = path.join(srcDir, file);
    const article = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const draft = article.draft;
    console.log(`\n--- Processing: ${file}`);
    console.log(`  Headline: ${draft.headline}`);

    // Validation
    const plainText = stripHtmlTags(draft.html);
    const charCount = plainText.length;
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;

    console.log(`  Char count: ${charCount}, Word count: ${wordCount}`);

    if (charCount < 500) {
      console.log(`  ❌ REJECTED: plain text < 500 chars (${charCount})`);
      article.rejection_reason = `plain text ${charCount} chars < 500`;
      fs.writeFileSync(path.join(rejDir, file), JSON.stringify(article, null, 2));
      fs.unlinkSync(filePath);
      rejected++;
      continue;
    }

    if (draft.html.length < 1500) {
      console.log(`  ❌ REJECTED: HTML < 1500 chars (${draft.html.length})`);
      article.rejection_reason = `HTML ${draft.html.length} chars < 1500`;
      fs.writeFileSync(path.join(rejDir, file), JSON.stringify(article, null, 2));
      fs.unlinkSync(filePath);
      rejected++;
      continue;
    }

    if (wordCount < 200) {
      console.log(`  ❌ REJECTED: word count < 200 (${wordCount})`);
      article.rejection_reason = `word count ${wordCount} < 200`;
      fs.writeFileSync(path.join(rejDir, file), JSON.stringify(article, null, 2));
      fs.unlinkSync(filePath);
      rejected++;
      continue;
    }

    // Check feature image
    // Extract first image from html
    const imgMatch = draft.html.match(/src="(https:\/\/images\.unsplash\.com[^"]+)"/);
    let featureImage = null;
    if (imgMatch) {
      const imgUrl = imgMatch[1];
      console.log(`  Checking image: ${imgUrl}`);
      const imgOk = await checkUrl(imgUrl);
      if (imgOk) {
        featureImage = imgUrl;
        console.log(`  ✅ Image OK`);
      } else {
        console.log(`  ⚠️ Image not reachable, skipping feature_image`);
      }
    }

    // Build post data
    const metaDesc = plainText.slice(0, 150);
    const postData = {
      title: draft.headline,
      html: draft.html,
      status: 'draft',
      tags: draft.ghost_tags.map(t => ({ name: t })),
      meta_title: draft.headline.slice(0, 60),
      meta_description: draft.meta_description || metaDesc
    };
    if (featureImage) {
      postData.feature_image = featureImage;
    }

    try {
      const result = await ghostPost(postData, token);
      const post = result.posts[0];
      console.log(`  ✅ Published as DRAFT: ${post.id}`);
      console.log(`  URL: ${post.url}`);

      article.stage = 'published';
      article.ghost_id = post.id;
      article.ghost_url = post.url;
      article.published_at = new Date().toISOString();

      fs.writeFileSync(path.join(dstDir, file), JSON.stringify(article, null, 2));
      fs.unlinkSync(filePath);
      published++;
    } catch (err) {
      console.log(`  ❌ FAILED: ${err.message}`);
      article.rejection_reason = `Ghost API error: ${err.message}`;
      fs.writeFileSync(path.join(rejDir, file), JSON.stringify(article, null, 2));
      fs.unlinkSync(filePath);
      rejected++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Published: ${published}, Rejected: ${rejected}`);
  process.exit(published > 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
