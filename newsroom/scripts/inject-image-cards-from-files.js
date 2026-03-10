const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'ubion.ghost.io';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

const publishedDir = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
const imageCard = `<figure class="kg-card kg-image-card kg-width-full">
  <img src="https://images.unsplash.com/photo-1580485944550-73107b027a9f?w=1200&h=630&fit=crop&q=85&auto=format" class="kg-image" alt="AI와 교육">
  <figcaption>AI 기술과 교육의 만남</figcaption>
</figure>`;

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

console.log('🖼️ 로컬 파일의 HTML에 이미지 카드 추가');
console.log('');

// 08-published의 모든 JSON 파일 읽기
const files = fs.readdirSync(publishedDir).filter(f => f.endsWith('.json'));

console.log(`스캔: ${files.length}개 파일`);
console.log('');

let modified = 0;
let noImage = 0;

files.forEach((file, index) => {
  const filePath = path.join(publishedDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  if (!data.draft || !data.draft.html) {
    return;
  }
  
  const html = data.draft.html;
  
  // 이미지 카드 확인
  if (!html.includes('kg-image-card')) {
    noImage++;
    
    // 리드박스 직후에 이미지 카드 삽입
    let newHtml = html;
    
    if (html.includes('<!--kg-card-end: html-->')) {
      newHtml = html.replace(
        '<!--kg-card-end: html-->',
        `<!--kg-card-end: html-->\n${imageCard}`
      );
    } else {
      newHtml = html.replace(
        /<\/div>\s*$/,
        `</div>\n${imageCard}`
      );
    }
    
    // 로컬 파일 업데이트
    data.draft.html = newHtml;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    console.log(`${noImage}. ✅ "${data.draft.headline.substring(0, 40)}..."`);
    modified++;
  }
});

console.log('');
console.log(`✅ 로컬 파일 ${modified}개 수정 완료`);
console.log('');
console.log('이제 이 파일들을 Ghost에 업로드해야 합니다.');
console.log('명령어: node /root/.openclaw/workspace/newsroom/scripts/sync-to-ghost.js');
