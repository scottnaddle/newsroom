const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'ubion.ghost.io';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const UNSPLASH_KEY = 'aQhPL39y1aOHxUIvjZLd0W3MuGLJpz46J7VwNEaVrAk';

// 한글 키워드를 영문으로 변환
const keywordMap = {
  'AI': 'artificial intelligence',
  '교육': 'education',
  '학교': 'school',
  '대학': 'university',
  '안전': 'safety',
  '윤리': 'ethics',
  '기술': 'technology',
  '칩': 'chip',
  '반도체': 'semiconductor',
  '기업': 'business',
  '투자': 'investment',
  '규제': 'regulation',
  '정책': 'policy',
  '국방': 'defense',
  '미국': 'usa',
};

function extractKeyword(title) {
  for (const [korean, english] of Object.entries(keywordMap)) {
    if (title.includes(korean)) {
      return english;
    }
  }
  return 'technology';
}

// Unsplash API 호출
function searchUnsplash(keyword) {
  return new Promise((resolve) => {
    const url = `/api/search/photos?query=${encodeURIComponent(keyword)}&page=1&per_page=1&order_by=relevant`;
    
    const options = {
      hostname: 'api.unsplash.com',
      path: url,
      method: 'GET',
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_KEY}`,
        'Accept-Version': 'v1'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.results && result.results.length > 0) {
            resolve(result.results[0].urls.regular + '?w=1200&h=630&fit=crop&q=85&auto=format');
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    
    req.on('error', () => resolve(null));
    req.end();
  });
}

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

console.log('🎨 Published 기사 Unsplash 이미지 할당');
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
        
        const keyword = extractKeyword(post.title);
        
        console.log(`${i + 1}/${noImage.length}. "${post.title.substring(0, 45)}..."`);
        console.log(`   🔑 키워드: "${keyword}"`);
        
        const imageUrl = await searchUnsplash(keyword);
        
        if (imageUrl) {
          console.log(`   📸 Unsplash에서 찾음`);
          
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
        } else {
          console.log(`   ⚠️  Unsplash 검색 실패`);
        }
        
        console.log('');
        
        await new Promise(r => setTimeout(r, 400));
      }
      
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
