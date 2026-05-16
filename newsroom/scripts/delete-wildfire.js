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

function ghostReq(method, path) {
  return new Promise((resolve) => {
    const j = jwt();
    const req = https.request({
      hostname: ghostUrl.hostname,
      path: path,
      method: method,
      headers: { 'Authorization': 'Ghost ' + j }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve({}); }
      });
    });
    req.on('error', () => resolve({}));
    req.end();
  });
}

async function main() {
  // Get all ai-paper posts
  const list = await ghostReq('GET', '/ghost/api/admin/posts/?limit=50&filter=tag%3Aai-paper&formats=html');
  const posts = list.posts || [];
  console.log('Found ' + posts.length + ' ai-paper posts\n');
  
  // Delete wildfire article
  for (const p of posts) {
    const containsWildfire = p.title.includes('산불') || p.title.includes('위험 평가');
    if (containsWildfire) {
      console.log('🗑️ Deleting: ' + p.title);
      const result = await ghostReq('DELETE', '/ghost/api/admin/posts/' + p.id + '/');
      if (result.errors) {
        console.log('   ❌ Error: ' + result.errors[0].message);
      } else {
        console.log('   ✅ Deleted!');
      }
    } else {
      console.log('✅ Keeping: ' + p.title.substring(0, 40));
    }
  }
  
  // Verify remaining
  console.log('\n--- Verification ---');
  const remaining = await ghostReq('GET', '/ghost/api/admin/posts/?limit=50&filter=tag%3Aai-paper');
  console.log('Remaining ai-paper posts: ' + (remaining.posts?.length || 0));
  if (remaining.posts) {
    for (const p of remaining.posts) {
      console.log('  📄 ' + p.title.substring(0, 40));
    }
  }
}

main().catch(e => console.log('ERR: ' + e.message));
