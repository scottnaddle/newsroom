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
  const list = await ghostReq('GET', '/ghost/api/admin/posts/?limit=10&status=published');
  
  for (const post of list.posts || []) {
    const html = post.html || '';
    
    // Check for <p>##  or <p>### patterns (markdown that Ghost rendered as <p>)
    const pHeadingPattern = /<p>(#+\s+.+?)<\/p>/g;
    const pHeadings = [...html.matchAll(pHeadingPattern)];
    
    // Check for existing h2 tags
    const h2Tags = (html.match(/<h2>/g) || []).length;
    
    // Check for h3 tags
    const h3Tags = (html.match(/<h3>/g) || []).length;
    
    // Check for markdown headings that may have slipped through
    const mdHeadings = (html.match(/^#+\s/gm) || []).length;
    
    console.log(`\n📰 "${post.title.substring(0, 60)}"`);
    console.log(`   HTML length: ${html.length} chars`);
    console.log(`   <h2> tags: ${h2Tags}`);
    console.log(`   <h3> tags: ${h3Tags}`);
    console.log(`   <p># headings: ${pHeadings.length}`);
    if (pHeadings.length > 0) {
      pHeadings.forEach(m => console.log(`     → ${m[1].substring(0, 60)}`));
    }
    console.log(`   Has bold **markdown: ${html.includes('**')}`);
    console.log(`   First 200 chars:\n${html.substring(0, 200)}\n`);
  }
  
  console.log(`\n✅ Inspection complete: ${list.posts?.length || 0} posts checked`);
}

main().catch(console.error);
