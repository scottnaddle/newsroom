/**
 * draft 필드가 없거나 이미지가 없는 orphaned 기사 복구
 * 1. published_result에서 ghost_post_id 추출
 * 2. Ghost API로부터 현재 기사 정보 조회
 * 3. 이미지 생성 및 적용
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

// Unsplash 이미지 풀
const imagePool = {
  '교실_학생': [
    'photo-1427504494785-3a9ca7044f45',
    'photo-1516534775068-bb4cfe34b599',
    'photo-1513364776144-60967b0f800f',
    'photo-1564429238014-8a5b4b9b6e2b',
    'photo-1509042239860-f550ce710b93',
  ],
  '기본': [
    'photo-1552664730-d307ca884978',
    'photo-1516534775068-bb4cfe34b599',
  ]
};

function buildUnsplashUrl(photoId) {
  return `https://images.unsplash.com/${photoId}?w=1200&h=630&fit=crop&q=85&auto=format`;
}

// 메인
async function main() {
  const publishedDir = path.join(__dirname, '../pipeline/08-published');
  const files = fs.readdirSync(publishedDir).filter(f => f.endsWith('.json'));

  console.log(`\n🔧 Orphaned 기사 복구 시작...\n`);

  let fixed = 0;

  for (const file of files) {
    const filePath = path.join(publishedDir, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      continue;
    }

    // draft 필드 없는 기사들
    if (!data.draft && data.publish_result?.ghost_post_id) {
      const postId = data.publish_result.ghost_post_id;
      const headline = data.headline || 'Unknown Article';
      
      console.log(`🔍 복구 중: ${headline}`);
      
      try {
        // Ghost에서 현재 게시물 정보 조회
        const ghostData = await ghostGet(`/ghost/api/admin/posts/${postId}/`);
        const post = ghostData.posts?.[0];
        
        if (post) {
          // draft 필드 생성
          data.draft = {
            headline: post.title || headline,
            html: post.html || '',
            feature_image: post.feature_image || buildUnsplashUrl('photo-1552664730-d307ca884978'),
            og_image: post.og_image || `https://insight.ubion.global/content/images/2026/03/og-${postId}.png`,
            ghost_tags: post.tags?.map(t => t.name) || [],
          };
          
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          console.log(`   ✓ draft 필드 생성됨`);
          fixed++;
        } else {
          console.log(`   ⚠️  Ghost에서 조회 실패`);
        }
      } catch (err) {
        console.log(`   ❌ 에러: ${err.message}`);
      }
      
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\n✨ 완료! (${fixed}개 복구)\n`);
}

main().catch(console.error);
