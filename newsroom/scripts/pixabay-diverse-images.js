const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'ubion.ghost.io';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const PIXABAY_KEY = '54902516-d932913bad0f64bb4b30c3cdf';

// 한글 키워드를 영문으로 변환
const keywordMap = {
  'AI': 'artificial intelligence',
  '교육': 'education',
  '학교': 'school',
  '대학': 'university',
  '학생': 'student',
  '정책': 'policy',
  '정부': 'government',
  '데이터': 'data',
  '기술': 'technology',
  '혁신': 'innovation',
  '칩': 'chip',
  '반도체': 'semiconductor',
  '로봇': 'robot',
  '기업': 'business',
  '투자': 'investment',
  '규제': 'regulation',
  '안전': 'safety',
  '윤리': 'ethics',
  '미국': 'united states',
  '중국': 'china',
  '한국': 'korea',
  '일본': 'japan',
};

function extractKeyword(title) {
  for (const [korean, english] of Object.entries(keywordMap)) {
    if (title.includes(korean)) {
      return english;
    }
  }
  return 'technology'; // 기본값
}

// Pixabay API 호출
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
            // 여러 개 중 하나를 무작위로 선택 (더 다양성 확보)
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

console.log('🎨 Pixabay 전용: 모든 기사 이미지 교체');
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
      
      if (!response.posts) {
        console.log('❌ posts 없음');
        return;
      }
      
      console.log(`처리 대상: ${response.posts.length}개 기사`);
      console.log('');
      
      let updated = 0;
      let failed = 0;
      
      for (let i = 0; i < response.posts.length; i++) {
        const post = response.posts[i];
        
        // 키워드 추출
        const keyword = extractKeyword(post.title);
        
        console.log(`${i + 1}/${response.posts.length}. "${post.title.substring(0, 45)}..."`);
        console.log(`   🔑 키워드: "${keyword}"`);
        
        // Pixabay 검색
        const imageUrl = await searchPixabay(keyword);
        
        if (imageUrl) {
          console.log(`   📸 Pixabay에서 찾음`);
          
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
                    failed++;
                  }
                } catch (e) {
                  console.log(`   ⚠️`);
                  failed++;
                }
                resolve();
              });
            });
            
            putReq.on('error', () => {
              console.log(`   ❌`);
              failed++;
              resolve();
            });
            
            putReq.write(JSON.stringify(updateData));
            putReq.end();
          });
        } else {
          console.log(`   ⚠️  Pixabay 검색 실패 (다른 키워드 시도)`);
          
          // 기본 키워드로 재시도
          const fallbackUrl = await searchPixabay('technology');
          
          if (fallbackUrl) {
            console.log(`   📸 대체 이미지 사용 (technology)`);
            
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
                      console.log(`   ✅ 대체 이미지 업데이트됨`);
                    } else {
                      failed++;
                    }
                  } catch (e) {
                    failed++;
                  }
                  resolve();
                });
              });
              
              putReq.on('error', () => {
                failed++;
                resolve();
              });
              
              putReq.write(JSON.stringify(updateData));
              putReq.end();
            });
          } else {
            failed++;
            console.log(`   ❌ 이미지 할당 실패`);
          }
        }
        
        console.log('');
        
        // API rate limit 방지
        await new Promise(r => setTimeout(r, 400));
      }
      
      console.log(`✅ 완료: ${updated}/${response.posts.length}개 업데이트`);
      if (failed > 0) {
        console.log(`⚠️  실패: ${failed}개`);
      }
      console.log('');
      console.log('🌐 웹사이트 새로고침 (Ctrl+Shift+R) 하면 Pixabay 이미지가 모두 보입니다!');
      
    } catch (e) {
      console.log('❌ 오류:', e.message);
    }
  });
});

getReq.on('error', (e) => {
  console.error('❌ API 오류:', e.message);
});

getReq.end();
