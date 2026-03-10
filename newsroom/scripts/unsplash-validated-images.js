const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'insight.ubion.global';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

// 검증된 Unsplash 이미지들
const validImages = [
  'https://images.unsplash.com/photo-1526374965328-7f5ae4e8290f?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1551532336-56ac348a0f7e?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1553729784-e91953dec042?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1580485944550-73107b027a9f?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200&h=630&fit=crop&q=85&auto=format',
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

console.log('🎨 Published 기사 검증된 Unsplash 이미지 할당');
console.log('');

const getOptions = {
  hostname: GHOST_URL,
  path: '/ghost/api/admin/posts/?limit=100&filter=status:published',
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
      
      const noImage = response.posts.filter(p => !p.feature_image);
      
      console.log(`처리 대상: ${noImage.length}개 기사`);
      console.log('');
      
      let updated = 0;
      
      for (let i = 0; i < noImage.length; i++) {
        const post = noImage[i];
        
        // 이미지 선택 (순환)
        const imageUrl = validImages[i % validImages.length];
        
        console.log(`${i + 1}/${noImage.length}. "${post.title.substring(0, 45)}..."`);
        
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
                  console.log(`   ✅ 업데이트됨`);
                } else {
                  console.log(`   ❌ 실패`);
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
      console.log(`✅ 완료: ${updated}/${noImage.length}개 업데이트`);
      console.log('');
      console.log('🌐 웹사이트 새로고침 (Ctrl+Shift+R) 하면 모든 published 기사가 이미지를 가질 것입니다!');
      
    } catch (e) {
      console.log('❌ 오류:', e.message);
    }
  });
});

getReq.on('error', (e) => {
  console.error('❌ API 오류:', e.message);
});

getReq.end();
