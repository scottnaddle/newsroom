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
      hostname: ghostUrl.hostname, path: path, method: method,
      headers: { 'Authorization': 'Ghost ' + j }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    });
    req.on('error', () => resolve({}));
    req.end();
  });
}

async function main() {
  const list = await ghostReq('GET', '/ghost/api/admin/posts/?limit=50&filter=tag%3Aai-paper');
  const posts = list.posts || [];
  console.log('Deleting ' + posts.length + ' posts...');
  
  for (const p of posts) {
    const result = await ghostReq('DELETE', '/ghost/api/admin/posts/' + p.id + '/');
    if (result.errors) {
      console.log('❌ ' + p.title.substring(0, 40) + ': ' + result.errors[0].message);
    } else {
      console.log('✅ DELETED: ' + p.title.substring(0, 40));
    }
  }
  
  const remaining = await ghostReq('GET', '/ghost/api/admin/posts/?limit=50&filter=tag%3Aai-paper');
  console.log('\nRemaining ai-paper: ' + (remaining.posts?.length || 0));
}

main().catch(e => console.log('ERR: ' + e.message));
