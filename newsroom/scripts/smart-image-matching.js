const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'ubion.ghost.io';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

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

// 기사 제목에서 키워드 추출
function extractKeywords(title) {
  const stopwords = ['the', 'and', 'with', 'that', 'this', 'from', 'for', 'in', 'of', 'to', 'a', 'an', '의', '을', '를', '가', '이', '은', '는', '에', '에서', '으로', '로', '를', '으며'];
  
  const keywords = title
    .toLowerCase()
    .replace(/[""'""]/g, '')
    .split(/[\s,\-()…"'"''"]/g)
    .filter(w => w.length > 2 && !stopwords.includes(w))
    .slice(0, 3)
    .join(' ');
  
  return keywords || 'AI technology';
}

// Unsplash에서 키워드로 이미지 검색
function searchUnsplashImage(keywords) {
  return new Promise((resolve) => {
    const url = `/api/search/photos?query=${encodeURIComponent(keywords)}&page=1&per_page=1&order_by=relevant`;
    
    const options = {
      hostname: 'api.unsplash.com',
      path: url,
      method: 'GET',
      headers: {
        'Authorization': 'Client-ID aQhPL39y1aOHxUIvjZLd0W3MuGLJpz46J7VwNEaVrAk',
        'Accept-Version': 'v1'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.results && result.results.length > 0) {
            const photo = result.results[0];
            resolve(photo.urls.regular + '?w=1200&h=630&fit=crop&q=85&auto=format');
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    
    req.on('error', () => {
      resolve(null);
    });
    
    req.end();
  });
}

const jwt = generateJWT();

console.log('🎨 스마트 이미지 매칭: 기사 키워드 기반');
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
      
      for (let i = 0; i < response.posts.length; i++) {
        const post = response.posts[i];
        
        // 키워드 추출
        const keywords = extractKeywords(post.title);
        
        console.log(`${i + 1}/${response.posts.length}. "${post.title.substring(0, 40)}..."`);
        console.log(`   🔑 키워드: "${keywords}"`);
        
        // Unsplash에서 이미지 검색
        const imageUrl = await searchUnsplashImage(keywords);
        
        if (imageUrl) {
          console.log(`   📸 이미지 검색됨`);
          
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
                    console.log(`   ✅ 업데이트됨`);
                  } else {
                    console.log(`   ❌ 업데이트 실패`);
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
        } else {
          console.log(`   ⚠️  이미지 검색 실패`);
        }
        
        console.log('');
        
        // API rate limit 방지
        await new Promise(r => setTimeout(r, 500));
      }
      
      console.log(`✅ 완료: ${updated}/${response.posts.length}개 업데이트`);
      console.log('');
      console.log('🌐 웹사이트 새로고침 (Ctrl+Shift+R) 하면 모든 이미지가 표시됩니다!');
      
    } catch (e) {
      console.log('❌ 오류:', e.message);
    }
  });
});

getReq.on('error', (e) => {
  console.error('❌ API 오류:', e.message);
});

getReq.end();
