const https = require('https');
const crypto = require('crypto');
const { createCanvas } = require('canvas');

const GHOST_URL = 'ubion.ghost.io';
const GHOST_KEY = '69a41252e9865e00011c166a';
const GHOST_SECRET = 'e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

// 카테고리별 accent 색상
const categoryColors = {
  'education': '#0891b2',
  'policy': '#4338ca',
  'industry': '#d97706',
  'research': '#059669',
  'opinion': '#7c3aed',
  'data': '#0284c7',
  'default': '#1f2937'
};

function getCategoryFromTags(tags) {
  if (!tags || tags.length === 0) return 'default';
  const tagNames = tags.map(t => t.name.toLowerCase());
  if (tagNames.some(t => t.includes('education') || t.includes('교육'))) return 'education';
  if (tagNames.some(t => t.includes('policy') || t.includes('정책'))) return 'policy';
  if (tagNames.some(t => t.includes('industry') || t.includes('industry'))) return 'industry';
  return 'default';
}

function generateOGCard(title, categoryColor) {
  const canvas = createCanvas(1200, 630);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = categoryColor;
  ctx.fillRect(0, 0, 1200, 630);
  
  const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, categoryColor);
  gradient.addColorStop(1, '#000000');
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(0, 0, 1200, 630);
  
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillRect(60, 120, 1080, 390);
  
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 48px "Noto Sans CJK KR"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const maxWidth = 1000;
  const words = title.split(/\s+/);
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  
  const displayLines = lines.slice(0, 3);
  const lineHeight = 60;
  const startY = 250;
  
  displayLines.forEach((line, i) => {
    ctx.fillText(line, 600, startY + i * lineHeight);
  });
  
  ctx.fillStyle = categoryColor;
  ctx.fillRect(60, 60, 30, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AI', 75, 75);
  
  return canvas.toBuffer('image/png');
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

function uploadToGhost(imageBuffer, filename) {
  return new Promise((resolve) => {
    const jwt = generateJWT();
    
    const boundary = '----FormBoundary' + Date.now();
    const body = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: image/png\r\n\r\n`;
    
    const footer = `\r\n--${boundary}--\r\n`;
    
    const options = {
      hostname: GHOST_URL,
      path: '/ghost/api/admin/images/upload/',
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${jwt}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body) + imageBuffer.length + Buffer.byteLength(footer)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.images && result.images.length > 0) {
            resolve(result.images[0].url);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    
    req.on('error', () => resolve(null));
    
    req.write(body);
    req.write(imageBuffer);
    req.write(footer);
    req.end();
  });
}

const jwt = generateJWT();

console.log('🎨 Published 기사: 누락된 이미지 생성');
console.log('');

const getOptions = {
  hostname: GHOST_URL,
  path: '/ghost/api/admin/posts/?limit=100&filter=status:published&include=tags',
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
      
      let processed = 0;
      
      for (let i = 0; i < noImage.length; i++) {
        const post = noImage[i];
        
        const category = getCategoryFromTags(post.tags);
        const categoryColor = categoryColors[category];
        
        console.log(`${i + 1}/${noImage.length}. [${category.toUpperCase()}]`);
        console.log(`   "${post.title.substring(0, 40)}..."`);
        
        const imageBuffer = generateOGCard(post.title, categoryColor);
        const imageUrl = await uploadToGhost(imageBuffer, `og-card-published-${post.id}.png`);
        
        if (imageUrl) {
          console.log(`   📸 OG 카드 생성 및 업로드됨`);
          
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
                    processed++;
                    console.log(`   ✅ 할당됨`);
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
          console.log(`   ❌ 생성 또는 업로드 실패`);
        }
        
        console.log('');
        
        await new Promise(r => setTimeout(r, 200));
      }
      
      console.log(`✅ 완료: ${processed}/${noImage.length}개 기사`);
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
