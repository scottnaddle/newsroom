const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'ubion.ghost.io';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const PIXABAY_KEY = '54902516-d932913bad0f64bb4b30c3cdf';

// 중요 키워드 (높은 우선순위)
const importantKeywords = {
  'AI': 'artificial intelligence',
  '교육': 'education learning',
  '학교': 'school students',
  '대학': 'university',
  '규제': 'regulation policy',
  '안전': 'safety security',
  '윤리': 'ethics moral',
  '기술': 'technology innovation',
  '로봇': 'robot automation',
  '데이터': 'data analysis',
  '칩': 'chip semiconductor',
  '투자': 'investment funding',
  '정책': 'policy government',
  '국방': 'defense military',
  '미국': 'usa america',
  '중국': 'china',
  '일본': 'japan',
  '한국': 'korea',
};

// HTML에서 텍스트 추출 및 키워드 분석
function extractKeywordsFromContent(html, title) {
  if (!html) {
    // HTML 없으면 제목에서 추출
    for (const [korean, english] of Object.entries(importantKeywords)) {
      if (title.includes(korean)) {
        return english;
      }
    }
    return 'technology';
  }

  // HTML에서 태그 제거
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .substring(0, 1000); // 처음 1000자만 사용

  // 키워드 매칭 (우선순위순)
  for (const [korean, english] of Object.entries(importantKeywords)) {
    // 제목과 내용 모두 확인
    if (title.includes(korean) || text.includes(korean)) {
      return english;
    }
  }

  // 기본값
  return 'technology';
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

// Pixabay 검색
function searchPixabay(keyword) {
  return new Promise((resolve) => {
    const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(keyword)}&image_type=photo&per_page=3&safesearch=true&order=popular`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.hits && result.hits.length > 0) {
            const randomIndex = Math.floor(Math.random() * result.hits.length);
            resolve(result.hits[randomIndex].webformatURL);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

const jwt = generateJWT();

console.log('🎨 기사 내용 기반 Pixabay 이미지 재할당');
console.log('');

const getOptions = {
  hostname: GHOST_URL,
  path: '/ghost/api/admin/posts/?limit=100&fields=id,title,html,feature_image,updated_at',
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
      let deleted = 0;

      for (let i = 0; i < response.posts.length; i++) {
        const post = response.posts[i];
        
        // 1단계: 기사 내용에서 키워드 추출
        const keyword = extractKeywordsFromContent(post.html, post.title);
        
        console.log(`${i + 1}/${response.posts.length}. "${post.title.substring(0, 45)}..."`);
        console.log(`   🔑 추출 키워드: "${keyword}"`);
        
        // 2단계: Pixabay 검색
        const imageUrl = await searchPixabay(keyword);
        
        if (imageUrl) {
          console.log(`   📸 Pixabay에서 찾음`);
          
          // 3단계: Ghost 업데이트 (이미지 할당)
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
          console.log(`   ⚠️  검색 실패, technology로 재시도`);
          
          // 재시도
          const fallbackUrl = await searchPixabay('technology');
          
          if (fallbackUrl) {
            console.log(`   📸 대체 이미지 할당`);
            
            const updateData = {
              posts: [{
                feature_image: fallbackUrl,
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
                      console.log(`   ✅ 대체 이미지 할당됨`);
                    }
                  } catch (e) {}
                  resolve();
                });
              });
              
              putReq.on('error', () => {
                resolve();
              });
              
              putReq.write(JSON.stringify(updateData));
              putReq.end();
            });
          }
        }
        
        console.log('');
        
        await new Promise(r => setTimeout(r, 300));
      }
      
      console.log(`✅ 완료: ${updated}/${response.posts.length}개 기사 업데이트`);
      console.log('');
      console.log('🌐 웹사이트 새로고침 (Ctrl+Shift+R) 하면 기사 내용에 맞는 Pixabay 이미지가 보입니다!');
      
    } catch (e) {
      console.log('❌ 오류:', e.message);
    }
  });
});

getReq.on('error', (e) => {
  console.error('❌ API 오류:', e.message);
});

getReq.end();
