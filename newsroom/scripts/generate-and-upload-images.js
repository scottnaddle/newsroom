/**
 * 발행 기사들의 feature image + OG 카드 생성 및 Ghost 업로드
 * 1. Unsplash에서 feature image 선택
 * 2. node-canvas로 OG 카드 생성
 * 3. Ghost API로 업로드
 */

const { createCanvas, registerFont } = require('canvas');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 폰트 등록
try {
  registerFont('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',    { family: 'NotoKR', weight: 'bold' });
  registerFont('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', { family: 'NotoKR', weight: 'normal' });
} catch (e) {
  console.warn('⚠️  폰트 등록 실패:', e.message);
}

// Ghost API
const apiKey = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const [kid, secret] = apiKey.split(':');

function makeToken() {
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:now,exp:now+300,aud:'/admin/'})).toString('base64url');
  return h+'.'+p+'.'+crypto.createHmac('sha256',Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
}

// 카테고리 색상
const ACCENT = {
  policy:   '#4338ca',
  research: '#059669',
  industry: '#d97706',
  opinion:  '#7c3aed',
  data:     '#0284c7',
  education: '#0891b2',
};

const CATEGORY_LABEL = {
  policy: '교육 정책',
  research: '연구·학술',
  industry: '산업·기업',
  opinion: '오피니언',
  data: '데이터',
  education: '교육·학습',
};

// 카테고리 탐지
function detectCategory(tags) {
  const t = (tags||[]).join(' ').toLowerCase();
  if (t.includes('정책') || t.includes('법') || t.includes('교육부') || t.includes('의회')) return 'policy';
  if (t.includes('연구') || t.includes('학술')) return 'research';
  if (t.includes('구글') || t.includes('기업') || t.includes('에듀테크')) return 'industry';
  if (t.includes('의견') || t.includes('칼럼')) return 'opinion';
  if (t.includes('통계') || t.includes('데이터') || t.includes('조사')) return 'data';
  return 'policy';
}

// Unsplash 이미지 선택 (고정 ID 사용)
const UNSPLASH_IMAGES = {
  policy: 'photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',
  research: 'photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=85&auto=format',
  industry: 'photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',
  opinion: 'photo-1507003211169-0a1dd7228f2d?w=1200&h=630&fit=crop&q=85&auto=format',
  data: 'photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop&q=85&auto=format',
  education: 'photo-1427504494785-3a9ca7044f45?w=1200&h=630&fit=crop&q=85&auto=format',
};

function getUnsplashUrl(category) {
  const img = UNSPLASH_IMAGES[category] || UNSPLASH_IMAGES.policy;
  return `https://images.unsplash.com/${img}`;
}

// OG 카드 생성
function wrapText(ctx, text, maxWidth) {
  const tokens = text.split(/(?<=[ …—,])|(?=[ …—,])/);
  const lines = [];
  let current = '';
  for (const token of tokens) {
    const test = current + token;
    if (ctx.measureText(test).width > maxWidth && current.trim()) {
      lines.push(current.trimEnd());
      current = token.trimStart();
    } else {
      current = test;
    }
  }
  if (current.trim()) lines.push(current.trimEnd());
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function generateOGCard({ headline, category, outputPath }) {
  const W = 1200, H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const color = ACCENT[category] || ACCENT['policy'];
  const label = CATEGORY_LABEL[category] || '교육 정책';
  const { r, g, b } = { 
    r: parseInt(color.slice(1,3),16), 
    g: parseInt(color.slice(3,5),16), 
    b: parseInt(color.slice(5,7),16) 
  };
  const today = new Date().toLocaleDateString('ko-KR', {year:'numeric',month:'2-digit',day:'2-digit'});

  // 배경
  const grad = ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0,'#f8f9ff'); 
  grad.addColorStop(1,'#eef2ff');
  ctx.fillStyle = grad; 
  ctx.fillRect(0,0,W,H);
  
  // 왼쪽 바
  ctx.fillStyle = color; 
  ctx.fillRect(0,0,10,H);
  
  // 원형 장식
  [240,160,80].forEach(rad => {
    ctx.beginPath(); 
    ctx.arc(980,315,rad,0,Math.PI*2);
    ctx.fillStyle = `rgba(${r},${g},${b},0.07)`; 
    ctx.fill();
  });
  
  // 카테고리 배지
  ctx.font = 'bold 17px NotoKR';
  const lw = ctx.measureText(label).width + 48;
  ctx.fillStyle = color; 
  roundRect(ctx, 60, 68, lw, 44, 22); 
  ctx.fill();
  ctx.fillStyle = '#fff'; 
  ctx.textBaseline='middle'; 
  ctx.textAlign='left';
  ctx.fillText(label, 84, 90);
  
  // 헤드라인
  ctx.font = 'bold 48px NotoKR'; 
  ctx.fillStyle = '#1a1a2e'; 
  ctx.textBaseline='top';
  const lines = wrapText(ctx, headline, 720).slice(0,3);
  const LINE_H = 66;
  const startY = Math.max(160, (H - lines.length*LINE_H)/2 - 10);
  lines.forEach((line, i) => ctx.fillText(line, 60, startY + i*LINE_H));
  
  // 구분선
  const sepY = startY + lines.length*LINE_H + 22;
  ctx.fillStyle = color; 
  ctx.fillRect(60, sepY, 100, 4);
  
  // 날짜
  ctx.font = '19px NotoKR'; 
  ctx.fillStyle = '#64748b'; 
  ctx.textBaseline='top';
  ctx.fillText(today, 60, sepY+18);
  
  // 사이트명
  ctx.font = 'bold 26px NotoKR'; 
  ctx.fillStyle = color;
  ctx.textAlign='right'; 
  ctx.textBaseline='bottom';
  ctx.fillText('AskedTech', W-48, H-40);

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buf);
  return outputPath;
}

// Ghost API 호출
function ghostGet(path) {
  return new Promise(r => https.get({
    hostname:'insight.ubion.global', 
    path,
    headers:{'Authorization':'Ghost '+makeToken(),'Accept-Version':'v5.0'}
  }, res => { 
    let d=''; 
    res.on('data',c=>d+=c); 
    res.on('end',()=>r(JSON.parse(d))); 
  }));
}

function ghostPut(postId, body) {
  return new Promise((res,rej) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname:'insight.ubion.global',
      path:`/ghost/api/admin/posts/${postId}/?source=html`,
      method:'PUT',
      headers:{
        'Authorization':'Ghost '+makeToken(),
        'Content-Type':'application/json',
        'Accept-Version':'v5.0',
        'Content-Length':Buffer.byteLength(data)
      }
    }, r => { 
      let d=''; 
      r.on('data',c=>d+=c); 
      r.on('end',()=>res(JSON.parse(d))); 
    });
    req.on('error',rej); 
    req.write(data); 
    req.end();
  });
}

function uploadImage(filePath, filename) {
  return new Promise((res,rej) => {
    const buf = fs.readFileSync(filePath);
    const b = '----FB'+Math.random().toString(36).slice(2);
    const body = Buffer.concat([
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`),
      buf, 
      Buffer.from(`\r\n--${b}--\r\n`)
    ]);
    const req = https.request({
      hostname:'insight.ubion.global', 
      path:'/ghost/api/admin/images/upload/', 
      method:'POST',
      headers:{
        'Authorization':'Ghost '+makeToken(),
        'Accept-Version':'v5.0',
        'Content-Type':`multipart/form-data; boundary=${b}`,
        'Content-Length':body.length
      }
    }, r => { 
      let d=''; 
      r.on('data',c=>d+=c); 
      r.on('end',()=>res(JSON.parse(d).images?.[0]?.url)); 
    });
    req.on('error',rej); 
    req.write(body); 
    req.end();
  });
}

// 메인
async function main() {
  const publishedDir = path.join(__dirname, '../pipeline/08-published');
  const files = fs.readdirSync(publishedDir).filter(f => f.endsWith('.json'));

  console.log(`\n📸 이미지 생성 및 업로드 시작... (${files.length}개 기사)\n`);

  let updated = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(publishedDir, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.log(`❌ JSON 파싱 실패: ${file}`);
      failed++;
      continue;
    }

    if (!data.draft) {
      console.log(`⏭️  건너뜸: ${file} (draft 필드 없음)`);
      continue;
    }

    const { headline, ghost_tags } = data.draft;
    const postId = data.publish_result?.ghost_post_id;
    
    if (!postId || !headline) {
      console.log(`⏭️  건너뜀: ${headline || file} (ghost_post_id 또는 headline 없음)`);
      continue;
    }

    // 이미 이미지가 있으면 스킵
    const featureUrl = data.draft.feature_image;
    const ogUrl = data.draft.og_image;
    if (featureUrl && ogUrl) {
      console.log(`✅ 이미 완료: ${headline}`);
      continue;
    }

    console.log(`\n🔧 처리 중: ${headline}`);

    try {
      const category = detectCategory(ghost_tags);
      
      // 1. OG 카드 생성
      const ogPath = `/tmp/og-${postId}.png`;
      generateOGCard({ headline, category, outputPath: ogPath });
      console.log(`   ✓ OG 카드 생성`);

      // 2. OG 카드 업로드
      const newOgUrl = await uploadImage(ogPath, `og-${postId}.png`);
      console.log(`   ✓ OG 업로드: ${newOgUrl}`);

      // 3. Feature 이미지 (Unsplash)
      const newFeatureUrl = getUnsplashUrl(category);
      console.log(`   ✓ Feature 이미지 선택: ${category}`);

      // 4. Ghost 현재 상태 조회
      const current = await ghostGet(`/ghost/api/admin/posts/${postId}/`);
      const updated_at = current.posts?.[0]?.updated_at;

      // 5. Ghost 업데이트
      const result = await ghostPut(postId, {
        posts: [{
          feature_image: newFeatureUrl,
          feature_image_alt: headline,
          og_image: newOgUrl,
          twitter_image: newOgUrl,
          updated_at,
        }]
      });

      if (result.posts?.[0]) {
        // 6. 로컬 파일 업데이트
        data.draft.feature_image = newFeatureUrl;
        data.draft.og_image = newOgUrl;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        
        console.log(`   ✅ 완료`);
        updated++;
      } else {
        console.log(`   ❌ Ghost API 실패`);
        failed++;
      }

      // API 레이트 제한 회피
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.log(`   ❌ 에러: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✨ 완료! (${updated}개 업데이트, ${failed}개 실패)\n`);
}

main().catch(console.error);
