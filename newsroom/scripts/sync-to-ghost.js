/**
 * 로컬 파일의 변경사항을 Ghost CMS에 동기화
 * - HTML 변경
 * - Feature 이미지 변경
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Ghost API
const apiKey = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const [kid, secret] = apiKey.split(':');

function makeToken() {
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:now,exp:now+300,aud:'/admin/'})).toString('base64url');
  return h+'.'+p+'.'+crypto.createHmac('sha256',Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
}

function ghostGet(path) {
  return new Promise(r => https.get({
    hostname:'insight.ubion.global', 
    path,
    headers:{'Authorization':'Ghost '+makeToken(),'Accept-Version':'v5.0'}
  }, res => { 
    let d=''; 
    res.on('data',c=>d+=c); 
    res.on('end',()=>r(JSON.parse(d))); 
  }));
}

function ghostPut(postId, body) {
  return new Promise((res,rej) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname:'insight.ubion.global',
      path:`/ghost/api/admin/posts/${postId}/?source=html`,
      method:'PUT',
      headers:{
        'Authorization':'Ghost '+makeToken(),
        'Content-Type':'application/json',
        'Accept-Version':'v5.0',
        'Content-Length':Buffer.byteLength(data)
      }
    }, r => { 
      let d=''; 
      r.on('data',c=>d+=c); 
      r.on('end',()=>res(JSON.parse(d))); 
    });
    req.on('error',rej); 
    req.write(data); 
    req.end();
  });
}

// 메인
async function main() {
  const publishedDir = path.join(__dirname, '../pipeline/08-published');
  const files = fs.readdirSync(publishedDir).filter(f => f.endsWith('.json'));

  console.log(`\n🔄 Ghost 동기화 시작... (${files.length}개 기사)\n`);

  let updated = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(publishedDir, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      continue;
    }

    if (!data.draft) continue;

    const { headline, html, feature_image } = data.draft;
    const postId = data.publish_result?.ghost_post_id;
    
    if (!postId || !headline) {
      continue;
    }

    try {
      // Ghost 현재 상태 조회
      const current = await ghostGet(`/ghost/api/admin/posts/${postId}/`);
      const post = current.posts?.[0];
      if (!post) {
        console.log(`⏭️  건너뜸: ${headline} (Ghost에서 찾을 수 없음)`);
        continue;
      }

      const updated_at = post.updated_at;

      // Ghost 업데이트
      const result = await ghostPut(postId, {
        posts: [{
          html: html || post.html,
          feature_image: feature_image || post.feature_image,
          feature_image_alt: headline,
          updated_at,
        }]
      });

      if (result.posts?.[0]) {
        console.log(`✅ 완료: ${headline}`);
        updated++;
      } else {
        console.log(`❌ 실패: ${headline}`);
        failed++;
      }

      // API 레이트 제한 회피
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.log(`❌ 에러: ${headline} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✨ 완료! (${updated}개 업데이트, ${failed}개 실패)\n`);
}

main().catch(console.error);
