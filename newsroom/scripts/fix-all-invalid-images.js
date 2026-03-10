const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'ubion.ghost.io';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

// Ghost에 실제 저장되어 작동하는 이미지들
const workingImages = [
  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1580485944550-73107b027a9f?w=1200&h=630&fit=crop&q=85&auto=format',
];

// 알려진 404 패턴
const known404Patterns = [
  'photo-1526374965328',
  'photo-1599720810694',
  'photo-1452587925148',
  'photo-1517694712202',
  'photo-8145808',
  'photo-3183150',
  'photo-3861969',
  'photo-3307956',
  'photo-3876132',
  'photo-8566473'
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

console.log('🔧 모든 무효한 이미지를 유효한 이미지로 교체');
console.log('');

const getOptions = {
  hostname: GHOST_URL,
  path: '/ghost/api/admin/posts/?limit=100',
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
      
      // 무효한 이미지를 가진 기사 필터링
      const invalid = response.posts.filter(post => {
        if (!post.feature_image) return false;
        return known404Patterns.some(pattern => post.feature_image.includes(pattern));
      });
      
      console.log(`수정 대상: ${invalid.length}개`);
      console.log('');
      
      let fixed = 0;
      
      for (let i = 0; i < invalid.length; i++) {
        const post = invalid[i];
        const newImageUrl = workingImages[i % workingImages.length];
        
        console.log(`${i + 1}. "${post.title.substring(0, 40)}..."`);
        
        const updateData = {
          posts: [{
            feature_image: newImageUrl,
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
                  fixed++;
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
        
        await new Promise(r => setTimeout(r, 300));
      }
      
      console.log('');
      console.log(`✅ 완료: ${fixed}/${invalid.length}개 수정`);
      console.log('');
      console.log('🌐 웹사이트 새로고침 (Ctrl+Shift+R) 하면 모든 이미지가 보입니다!');
      
    } catch (e) {
      console.log('❌ 오류:', e.message);
    }
  });
});

getReq.on('error', (e) => {
  console.error('❌ API 오류:', e.message);
});

getReq.end();
