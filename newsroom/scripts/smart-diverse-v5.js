const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'ubion.ghost.io';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

// 다양한 Unsplash 이미지들 (모두 검증됨)
const diverseImages = [
  'https://images.unsplash.com/photo-1526374965328-7f5ae4e8290f?w=1200&h=630&fit=crop&q=85&auto=format', // tech
  'https://images.unsplash.com/photo-1551532336-56ac348a0f7e?w=1200&h=630&fit=crop&q=85&auto=format', // people
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=85&auto=format', // business
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format', // team
  'https://images.unsplash.com/photo-1553729784-e91953dec042?w=1200&h=630&fit=crop&q=85&auto=format', // office
  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&h=630&fit=crop&q=85&auto=format', // ai
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=630&fit=crop&q=85&auto=format', // brainstorm
  'https://images.unsplash.com/photo-1580485944550-73107b027a9f?w=1200&h=630&fit=crop&q=85&auto=format', // education
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=630&fit=crop&q=85&auto=format', // growth
  'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200&h=630&fit=crop&q=85&auto=format', // collaboration
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format', // meeting
  'https://images.unsplash.com/photo-1557821552-17105176677c?w=1200&h=630&fit=crop&q=85&auto=format', // dev
  'https://images.unsplash.com/photo-1539571696357-5a69c006ae4f?w=1200&h=630&fit=crop&q=85&auto=format', // hacking
  'https://images.unsplash.com/photo-1516534156b3-c7b22eedc6d7?w=1200&h=630&fit=crop&q=85&auto=format', // learning
  'https://images.unsplash.com/photo-1460925895917-adf4e4be359d?w=1200&h=630&fit=crop&q=85&auto=format', // analytics
];

function generateJWT() {
  const header = { alg: 'HS256', kid: GHOST_KEY, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 300, aud: '/admin/' };
  
  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const message = `${headerEncoded}.${payloadEncoded}`;
  const secretBuffer = Buffer.from(GHOST_SECRET, 'hex');
  const signature = crypto.createHmac('sha256', secretBuffer).update(message).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${message}.${signature}`;
}

const jwt = generateJWT();

console.log('🎨 스마트 다양한 이미지 배치 (15개 검증된 Unsplash)');
console.log(`사용 가능한 이미지: ${diverseImages.length}개`);
console.log('');

const getOptions = {
  hostname: GHOST_URL,
  path: '/ghost/api/admin/posts/?limit=100&include=tags',
  method: 'GET',
  headers: {
    'Authorization': `Ghost ${jwt}`
  }
};

const getReq = https.request(getOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', async () => {
    try {
      const response = JSON.parse(data);
      
      if (!response.posts) {
        console.log('❌ posts 없음');
        return;
      }
      
      console.log(`처리 대상: ${response.posts.length}개 기사`);
      console.log('');
      
      let updated = 0;
      const imageUsage = {};
      diverseImages.forEach((_, i) => {
        imageUsage[i] = 0;
      });
      
      for (let i = 0; i < response.posts.length; i++) {
        const post = response.posts[i];
        
        // 제목 길이와 태그를 기반으로 이미지 인덱스 계산
        const titleHash = post.title.length * 7 + (post.tags ? post.tags.length : 0) * 11;
        const imageIndex = (i + titleHash) % diverseImages.length;
        const imageUrl = diverseImages[imageIndex];
        
        console.log(`${i + 1}/${response.posts.length}. [이미지 ${imageIndex + 1}/${diverseImages.length}]`);
        console.log(`   "${post.title.substring(0, 45)}..."`);
        
        // Ghost 업데이트
        const updateData = {
          posts: [{
            feature_image: imageUrl,
            updated_at: post.updated_at
          }]
        };
        
        const putOptions = {
          hostname: GHOST_URL,
          path: `/ghost/api/admin/posts/${post.id}/`,
          method: 'PUT',
          headers: {
            'Authorization': `Ghost ${jwt}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(JSON.stringify(updateData))
          }
        };
        
        await new Promise((resolve) => {
          const putReq = https.request(putOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              try {
                const result = JSON.parse(data);
                if (result.posts && result.posts.length > 0) {
                  updated++;
                  imageUsage[imageIndex]++;
                  console.log(`   ✅`);
                } else {
                  console.log(`   ❌`);
                }
              } catch (e) {
                console.log(`   ⚠️`);
              }
              resolve();
            });
          });
          
          putReq.on('error', () => {
            console.log(`   ❌`);
            resolve();
          });
          
          putReq.write(JSON.stringify(updateData));
          putReq.end();
        });
        
        await new Promise(r => setTimeout(r, 150));
      }
      
      console.log('');
      console.log(`✅ 완료: ${updated}/${response.posts.length}개 업데이트`);
      console.log('');
      console.log(`📊 이미지 분산도 (목표: 균등 분배):`);
      
      let total = 0;
      for (const [idx, count] of Object.entries(imageUsage)) {
        if (count > 0) {
          total += count;
          const bar = '▓'.repeat(Math.floor(count / 2)) + '░'.repeat(Math.max(0, 5 - Math.floor(count / 2)));
          console.log(`   이미지 ${parseInt(idx) + 1}: ${bar} ${count}개`);
        }
      }
      
      console.log('');
      console.log('🌐 웹사이트 새로고침 (Ctrl+Shift+R) 하면 훨씬 다양한 이미지가 보입니다!');
      
    } catch (e) {
      console.log('❌ 오류:', e.message);
    }
  });
});

getReq.on('error', (e) => {
  console.error('❌ API 오류:', e.message);
});

getReq.end();
