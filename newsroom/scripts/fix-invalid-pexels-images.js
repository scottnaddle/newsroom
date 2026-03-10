const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'ubion.ghost.io';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

// 유효한 Unsplash 이미지 (테스트됨)
const validUnsplashImages = [
  'https://images.unsplash.com/photo-1526374965328-7f5ae4e8290f?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1599720810694-cb38f64a98d0?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=630&fit=crop&q=85&auto=format',
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

console.log('🔧 무효한 Pexels 이미지를 유효한 Unsplash로 교체');
console.log('');

// 4개 기사 ID
const articlesToFix = [
  { id: '69a93e5ce2eb440001d55d6e', title: '브로드컴' },
  { id: '69a8edd6e2eb440001d5588c', title: '데이터센터' },
  { id: '69a8d082e2eb440001d5585b', title: 'AI 안전 표준화' },
  { id: '69a8d082e2eb440001d55863', title: '규제 vs 가속주의' }
];

// Ghost 조회
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
      
      const postsToFix = response.posts.filter(p => 
        articlesToFix.some(a => a.id === p.id)
      );
      
      console.log(`수정 대상: ${postsToFix.length}개`);
      console.log('');
      
      let fixed = 0;
      
      for (let i = 0; i < postsToFix.length; i++) {
        const post = postsToFix[i];
        const newImageUrl = validUnsplashImages[i % validUnsplashImages.length];
        
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
                  console.log(`   ✅ Unsplash로 교체됨`);
                } else {
                  console.log(`   ❌ 실패`);
                }
              } catch (e) {
                console.log(`   ⚠️  오류`);
              }
              resolve();
            });
          });
          
          putReq.on('error', () => {
            console.log(`   ❌ 연결 실패`);
            resolve();
          });
          
          putReq.write(JSON.stringify(updateData));
          putReq.end();
        });
        
        await new Promise(r => setTimeout(r, 500));
      }
      
      console.log('');
      console.log(`✅ 완료: ${fixed}/${postsToFix.length}개 수정`);
      console.log('');
      console.log('🌐 웹사이트 새로고침 (Ctrl+Shift+R) 하면 이미지가 보입니다!');
      
    } catch (e) {
      console.log('❌ 오류:', e.message);
    }
  });
});

getReq.on('error', (e) => {
  console.error('❌ API 오류:', e.message);
});

getReq.end();
