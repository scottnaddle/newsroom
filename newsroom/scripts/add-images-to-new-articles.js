const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'insight.ubion.global';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const PIXABAY_KEY = '54902516-d932913bad0f64bb4b30c3cdf';

// Pexels 이미지 직접 URL
const pexelsImages = [
  'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop',
  'https://images.pexels.com/photos/3307956/pexels-photo-3307956.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop',
  'https://images.pexels.com/photos/8145808/pexels-photo-8145808.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop',
  'https://images.pexels.com/photos/3876132/pexels-photo-3876132.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop',
  'https://images.pexels.com/photos/8566473/pexels-photo-8566473.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop',
  'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&fit=crop',
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

// Pixabay API 호출
function getPixabayImage(query) {
  return new Promise((resolve) => {
    const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=1&safesearch=true`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.hits && result.hits.length > 0) {
            resolve(result.hits[0].webformatURL);
          } else {
            resolve(pexelsImages[Math.floor(Math.random() * pexelsImages.length)]);
          }
        } catch (e) {
          resolve(pexelsImages[Math.floor(Math.random() * pexelsImages.length)]);
        }
      });
    }).on('error', () => {
      resolve(pexelsImages[Math.floor(Math.random() * pexelsImages.length)]);
    });
  });
}

const jwt = generateJWT();

console.log('🎨 새로운 이미지 없는 기사에 이미지 추가');
console.log('');

// 이미지 없는 4개 기사
const articlesToUpdate = [
  { id: '69a93e5ce2eb440001d55d6e', title: '브로드컴 AI 칩', source: 'pexels' },
  { id: '69a8edd6e2eb440001d5588c', title: '데이터센터 비용', source: 'pixabay' },
  { id: '69a8d082e2eb440001d5585b', title: 'AI 안전 표준화', source: 'pexels' },
  { id: '69a8d082e2eb440001d55863', title: 'AI 규제 vs 가속주의', source: 'pixabay' }
];

// Ghost 기사 조회
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
      
      if (!response.posts) {
        console.log('❌ posts 없음');
        return;
      }
      
      const postsToUpdate = response.posts.filter(p => 
        articlesToUpdate.some(a => a.id === p.id)
      );
      
      console.log(`업데이트 대상: ${postsToUpdate.length}개`);
      console.log('');
      
      let updated = 0;
      
      for (let i = 0; i < postsToUpdate.length; i++) {
        const post = postsToUpdate[i];
        const config = articlesToUpdate.find(a => a.id === post.id);
        
        let imageUrl;
        if (config.source === 'pexels') {
          imageUrl = pexelsImages[Math.floor(Math.random() * pexelsImages.length)];
          console.log(`${i + 1}. 🟦 Pexels: "${post.title.substring(0, 40)}..."`);
        } else {
          imageUrl = await getPixabayImage(config.title);
          console.log(`${i + 1}. 🟪 Pixabay: "${post.title.substring(0, 40)}..."`);
        }
        
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
                  console.log(`   ✅ 성공`);
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
      console.log(`✅ 완료: ${updated}/${postsToUpdate.length}개 업데이트`);
      
    } catch (e) {
      console.log('❌ 오류:', e.message);
    }
  });
});

getReq.on('error', (e) => {
  console.error('❌ API 오류:', e.message);
});

getReq.end();
