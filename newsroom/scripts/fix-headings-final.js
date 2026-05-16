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
  console.log('📡 Fetching published posts with HTML...\n');
  const list = await ghostReq('GET', '/ghost/api/admin/posts/?limit=10&status=published&formats=html');

  let fixed = 0, alreadyOk = 0, errors = 0;

  for (const post of list.posts || []) {
    const html = post.html || '';
    
    // Convert <p>## ...</p> to <h2>...</h2>
    const pHeadingRegex = /<p>#{2,4}\s+(.+?)<\/p>/g;
    const matches = html.match(pHeadingRegex);
    
    if (!matches) {
      console.log(`⏭️  "${post.title.substring(0, 50)}" — no ## headings to fix`);
      alreadyOk++;
      continue;
    }

    const newHtml = html.replace(pHeadingRegex, '<h2>$1</h2>');

    console.log(`🔧 "${post.title.substring(0, 50)}"`);
    console.log(`   Found ${matches.length} <p># headings → <h2>`);

    // Update via Ghost Admin API
    const result = await ghostReq('PUT', `/ghost/api/admin/posts/${post.id}/?source=html`, {
      posts: [{ html: newHtml }]
    });

    if (result.posts && result.posts[0]) {
      console.log(`   ✅ Updated successfully!\n`);
      fixed++;
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(result.errors || result)}\n`);
      errors++;
    }
  }

  console.log(`\n📊 Result: ${fixed} fixed ✅ | ${alreadyOk} already fine | ${errors} errors ❌`);
}

main().catch(console.error);
