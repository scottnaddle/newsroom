const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'insight.ubion.global';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const UNSPLASH_KEY = 'aQhPL39y1aOHxUIvjZLd0W3MuGLJpz46J7VwNEaVrAk';
const PIXABAY_KEY = '54902516-d932913bad0f64bb4b30c3cdf';

// 기본 이미지 풀 (백업용)
const fallbackImages = [
  'https://images.unsplash.com/photo-1526374965328-7f5ae4e8290f?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1551532336-56ac348a0f7e?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',
  'https://images.unsplash.com/photo-1553729784-e91953dec042?w=1200&h=630&fit=crop&q=85&auto=format',
];

// 기사 제목을 영문 키워드로 변환
function extractEnglishKeywords(title) {
  const keywords = {
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
  };
  
  let result = title.toLowerCase().replace(/[""'""]/g, '').substring(0, 100);
  
  for (const [korean, english] of Object.entries(keywords)) {
    if (title.includes(korean)) {
      result = english;
      break;
    }
  }
  
  return result || 'technology';
}

// Unsplash에서 검색
function searchUnsplash(query) {
  return new Promise((resolve) => {
    const url = `/api/search/photos?query=${encodeURIComponent(query)}&page=1&per_page=1&order_by=relevant`;
    
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

// Pixabay에서 검색
function searchPixabay(query) {
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

console.log('🎨 옵션 4: 조합형 이미지 (다양성 극대화)');
console.log('전략: Unsplash → Pixabay → Fallback');
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
      const sources = { unsplash: 0, pixabay: 0, fallback: 0 };
      
      for (let i = 0; i < response.posts.length; i++) {
        const post = response.posts[i];
        
        // 영문 키워드 추출
        const keyword = extractEnglishKeywords(post.title);
        
        console.log(`${i + 1}/${response.posts.length}. "${post.title.substring(0, 40)}..."`);
        console.log(`   🔑 검색어: "${keyword}"`);
        
        // 1단계: Unsplash 검색
        let imageUrl = await searchUnsplash(keyword);
        let source = 'unsplash';
        
        // 2단계: 실패하면 Pixabay
        if (!imageUrl) {
          imageUrl = await searchPixabay(keyword);
          source = 'pixabay';
        }
        
        // 3단계: 실패하면 Fallback
        if (!imageUrl) {
          imageUrl = fallbackImages[i % fallbackImages.length];
          source = 'fallback';
        }
        
        console.log(`   📸 ${source.toUpperCase()}에서 찾음`);
        
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
                  sources[source]++;
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
        
        console.log('');
        
        await new Promise(r => setTimeout(r, 300));
      }
      
      console.log(`✅ 완료: ${updated}/${response.posts.length}개 업데이트`);
      console.log('');
      console.log(`📊 이미지 소스 분포:`);
      console.log(`   🔷 Unsplash: ${sources.unsplash}개`);
      console.log(`   🟪 Pixabay: ${sources.pixabay}개`);
      console.log(`   ⭐ Fallback: ${sources.fallback}개`);
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
