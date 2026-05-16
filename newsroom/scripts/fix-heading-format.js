const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const env = fs.readFileSync('/root/.openclaw/workspace/newsroom/.env', 'utf8');
const apiKey = env.match(/GHOST_ADMIN_API_KEY=(.+)/)[1];
const ghostUrl = new URL(env.match(/GHOST_URL=(.+)/)[1].trim());
const [id, secret] = apiKey.split(':');

function jwt() {
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:id})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:n,exp:n+300,aud:'/admin/'})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
}

function ghostReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const j = jwt();
    const opts = {
      hostname: ghostUrl.hostname,
      path: path,
      method: method,
      headers: {
        'Authorization': 'Ghost '+j,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { resolve({}); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // 1. Get all published posts
  console.log('📡 Fetching published posts...');
  const list = await ghostReq('GET', '/ghost/api/admin/posts/?limit=10&status=published');
  
  if (!list.posts || list.posts.length === 0) {
    console.log('❌ No posts found');
    return;
  }

  console.log(`📰 Found ${list.posts.length} published posts\n`);

  let fixed = 0;
  let skipped = 0;

  for (const post of list.posts) {
    const originalHtml = post.html || '';
    const pattern = /^## (.+)$/gm;

    if (!pattern.test(originalHtml)) {
      console.log(`  ⏭️  "${post.title.substring(0, 40)}..." — no ## headings`);
      skipped++;
      continue;
    }

    // Reset lastIndex since test() moved it
    pattern.lastIndex = 0;

    const newHtml = originalHtml.replace(pattern, '<h2>$1</h2>');
    
    console.log(`  🔧 Fixing "${post.title.substring(0, 40)}..."`);

    const result = await ghostReq('PUT', `/ghost/api/admin/posts/${post.id}/?source=html`, {
      posts: [{
        html: newHtml
      }]
    });

    if (result.posts && result.posts[0]) {
      console.log(`  ✅ Updated successfully!`);
      fixed++;
    } else {
      console.log(`  ❌ Update failed:`, JSON.stringify(result.errors || result));
    }
    console.log('');
  }

  console.log(`\n📊 Result: ${fixed} fixed, ${skipped} skipped, ${list.posts.length} total`);
}

main().catch(console.error);
