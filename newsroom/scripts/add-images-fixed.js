const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'ubion.ghost.io';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

const imageMap = {
  '미국 노동부': 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',
  '세계가 앞질렀다': 'https://images.unsplash.com/photo-1450101499533-7e5f5236429b?w=1200&h=630&fit=crop&q=85&auto=format',
  '브로드컴': 'https://images.unsplash.com/photo-1526374965328-7f5ae4e8290f?w=1200&h=630&fit=crop&q=85&auto=format',
  'LG AI': 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',
  '게이오': 'https://images.unsplash.com/photo-1450101499533-7e5f5236429b?w=1200&h=630&fit=crop&q=85&auto=format',
  'AI 열풍': 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',
  '규제': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=85&auto=format',
  '국방부': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=85&auto=format',
  'OpenAI': 'https://images.unsplash.com/photo-1599720810694-cb38f64a98d0?w=1200&h=630&fit=crop&q=85&auto=format',
  '데이터센터': 'https://images.unsplash.com/photo-1599720810694-cb38f64a98d0?w=1200&h=630&fit=crop&q=85&auto=format',
  '클로드': 'https://images.unsplash.com/photo-1527134215058-f9f6cb7ceb63?w=1200&h=630&fit=crop&q=85&auto=format'
};

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

function getImageUrl(title) {
  for (const [keyword, url] of Object.entries(imageMap)) {
    if (title.includes(keyword)) {
      return url;
    }
  }
  return 'https://images.unsplash.com/photo-1580485944550-73107b027a9f?w=1200&h=630&fit=crop&q=85&auto=format';
}

const jwt = generateJWT();

console.log('📸 이미지 없는 기사에 이미지 추가');
console.log('');

const noImageIds = [
  '69a940c3e2eb440001d55d74',
  '69a940c3e2eb440001d55d7d',
  '69a93e5ce2eb440001d55d6e',
  '69a93bf5e2eb440001d55d68',
  '69a9372ae2eb440001d55d38',
  '69a93041e2eb440001d55c98',
  '69a92da7e2eb440001d55c89',
  '69a91f8de2eb440001d55c54',
  '69a91150e2eb440001d558da',
  '69a8fc74e2eb440001d558c4',
  '69a8edd6e2eb440001d5588c',
  '69a8d082e2eb440001d5586b'
];

// 먼저 기사 정보 조회
const getOptions = {
  hostname: GHOST_URL,
  path: `/ghost/api/admin/posts/?limit=100`,
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
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (!response.posts) {
        console.log('❌ posts 없음');
        return;
      }
      
      // ID 기반 매핑
      const articlesToUpdate = response.posts.filter(p => noImageIds.includes(p.id));
      
      console.log(`업데이트 대상: ${articlesToUpdate.length}개`);
      console.log('');
      
      let updated = 0;
      
      const updateArticles = (index) => {
        if (index >= articlesToUpdate.length) {
          console.log('');
          console.log(`✅ 완료: ${updated}/${articlesToUpdate.length}개 이미지 추가`);
          return;
        }
        
        const post = articlesToUpdate[index];
        const imageUrl = getImageUrl(post.title);
        
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
                console.log(`${index + 1}. ✅ "${post.title.substring(0, 40)}..."`);
              } else {
                console.log(`${index + 1}. ❌ "${post.title.substring(0, 40)}..."`);
              }
            } catch (e) {
              console.log(`${index + 1}. ⚠️  "${post.title.substring(0, 40)}..."`);
            }
            
            setTimeout(() => updateArticles(index + 1), 300);
          });
        });
        
        putReq.on('error', (e) => {
          console.log(`${index + 1}. ❌ "${post.title.substring(0, 40)}..." (${e.message})`);
          setTimeout(() => updateArticles(index + 1), 300);
        });
        
        putReq.write(JSON.stringify(updateData));
        putReq.end();
      };
      
      updateArticles(0);
      
    } catch (e) {
      console.log('❌ 오류:', e.message);
    }
  });
});

getReq.on('error', (e) => {
  console.error('❌ API 오류:', e.message);
});

getReq.end();
