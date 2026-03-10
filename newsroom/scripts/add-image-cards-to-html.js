const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'insight.ubion.global';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const IMAGE_URL = 'https://images.unsplash.com/photo-1580485944550-73107b027a9f?w=1200&h=630&fit=crop&q=85&auto=format';

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

const imageCard = `<figure class="kg-card kg-image-card kg-width-full">
  <img src="${IMAGE_URL}" class="kg-image" alt="AI와 교육">
  <figcaption>AI 기술과 교육의 만남</figcaption>
</figure>`;

console.log('🖼️ HTML에 이미지 카드 추가');
console.log('');

// 1단계: Ghost에서 기사 목록 조회
const jwt = generateJWT();
const getOptions = {
  hostname: GHOST_URL,
  path: '/ghost/api/admin/posts/?limit=100&formats=html',
  method: 'GET',
  headers: {
    'Authorization': `Ghost ${jwt}`
  }
};

const req = https.request(getOptions, (res) => {
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
      
      console.log(`스캔: ${response.posts.length}개`);
      console.log('');
      
      // 이미지 카드 없는 기사 필터링
      const noImageCard = response.posts.filter(post => {
        return post.html && !post.html.includes('kg-image-card');
      });
      
      console.log(`이미지 카드 없음: ${noImageCard.length}개`);
      console.log('');
      
      if (noImageCard.length === 0) {
        console.log('✅ 모든 기사에 이미지 카드가 있습니다!');
        return;
      }
      
      console.log('수정 중...'); 
      console.log('');
      
      let fixed = 0;
      
      const fixArticles = (index) => {
        if (index >= noImageCard.length) {
          console.log('');
          console.log(`✅ 완료: ${fixed}/${noImageCard.length}개 수정`);
          return;
        }
        
        const post = noImageCard[index];
        let newHtml = post.html;
        
        // 이미지 카드를 리드박스 직후에 삽입
        // <!--kg-card-end: html--> 찾기 (리드박스 끝)
        if (newHtml.includes('<!--kg-card-end: html-->')) {
          newHtml = newHtml.replace(
            '<!--kg-card-end: html-->',
            `<!--kg-card-end: html-->\n${imageCard}`
          );
        } else {
          // 또는 첫 번째 <div>의 닫는 부분 다음에 삽입
          const divMatch = newHtml.match(/<\/div>\s*<!--kg-card-end: html-->/);
          if (divMatch) {
            newHtml = newHtml.replace(
              divMatch[0],
              `</div>\n${imageCard}\n<!--kg-card-end: html-->`
            );
          }
        }
        
        // Ghost 업데이트
        const updateData = {
          posts: [{
            html: newHtml,
            updated_at: post.updated_at
          }]
        };
        
        const putOptions = {
          hostname: GHOST_URL,
          path: `/ghost/api/admin/posts/${post.id}/?source=html`,
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
                fixed++;
                console.log(`${index + 1}. ✅ "${post.title.substring(0, 40)}..."`);
              } else {
                console.log(`${index + 1}. ❌ "${post.title.substring(0, 40)}..."`);
              }
            } catch (e) {
              console.log(`${index + 1}. ⚠️  "${post.title.substring(0, 40)}..."`);
            }
            
            setTimeout(() => fixArticles(index + 1), 300);
          });
        });
        
        putReq.on('error', (e) => {
          console.log(`${index + 1}. ❌ "${post.title.substring(0, 40)}..."`);
          setTimeout(() => fixArticles(index + 1), 300);
        });
        
        putReq.write(JSON.stringify(updateData));
        putReq.end();
      };
      
      fixArticles(0);
      
    } catch (e) {
      console.log('❌ 오류:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ API 오류:', e.message);
});

req.end();
