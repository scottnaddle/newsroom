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
  // Get published posts WITH html format
  const list = await ghostReq('GET', '/ghost/api/admin/posts/?limit=10&status=published&formats=html');
  
  console.log(`📰 Found ${list.posts?.length || 0} posts\n`);
  
  for (const post of list.posts || []) {
    const html = post.html || '';
    console.log(`\n━━━ ${post.title.substring(0, 50)} ━━━`);
    console.log(`HTML length: ${html.length} chars`);
    
    // Check for <p># heading (Ghost rendering markdown ## as <p>)
    const pHeadingRegex = /<p>#{2,4}\s+.+?<\/p>/g;
    const pHeadings = html.match(pHeadingRegex) || [];
    
    const h2Count = (html.match(/<h2>/g) || []).length;
    const h3Count = (html.match(/<h3>/g) || []).length;
    
    console.log(`<h2>: ${h2Count}, <h3>: ${h3Count}, <p># headings: ${pHeadings.length}`);
    
    if (pHeadings.length > 0) {
      console.log('⚠️  <p># headings found:');
      pHeadings.forEach(h => console.log(`   → ${h}`));
    }
    
    // Show first 300 chars
    console.log(`\n📄 Preview:\n${html.substring(0, 300)}\n`);
  }
}

main().catch(console.error);
