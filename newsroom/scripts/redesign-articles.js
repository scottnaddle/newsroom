/**
 * 기존 발행 기사 디자인 일괄 재적용
 * - 한국 신문 스타일 래퍼 적용
 * - OG 카드 재생성 (node-canvas)
 * - Ghost API 업데이트
 */

const { createCanvas, registerFont } = require('canvas');
const { getFeatureImageUrl } = require('./get-feature-image.js');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 폰트 등록
registerFont('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',    { family: 'NotoKR', weight: 'bold' });
registerFont('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', { family: 'NotoKR', weight: 'normal' });

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
};
const CATEGORY_LABEL = {
  policy: '교육 정책', research: '연구·학술', industry: '산업·기업',
  opinion: '오피니언', data: '데이터',
};

function detectCategoryFromTags(tags) {
  const t = (tags||[]).join(' ').toLowerCase();
  if (t.includes('정책') || t.includes('법') || t.includes('교육부') || t.includes('의회') || t.includes('가이드라인')) return 'policy';
  if (t.includes('연구') || t.includes('학술')) return 'research';
  if (t.includes('구글') || t.includes('기업') || t.includes('에듀테크') || t.includes('산업')) return 'industry';
  return 'policy';
}

// ── HTML 파싱 헬퍼 ──
function stripTag(html, tag) {
  return html.replace(new RegExp(`<${tag}[^>]*>`, 'gi'), '').replace(new RegExp(`</${tag}>`, 'gi'), '');
}
function extractTag(html, tag) {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const results = [];
  let match;
  while ((match = m.exec(html)) !== null) results.push(match[1].trim());
  return results;
}
function cleanInner(html) {
  return html.replace(/<[^>]+>/g, '').trim();
}

// 핵심 수치 자동 추출 (숫자+단위 패턴)
function extractStats(text) {
  const patterns = [
    /(\d+(?:\.\d+)?억\s*원?)/g,
    /(\d+(?:,\d+)?만\s*명?)/g,
    /(\d+개\s*교?)/g,
    /(\d+개\s*대학?)/g,
    /(\d+%)/g,
    /(\d+년)/g,
    /(\d+억)/g,
    /([A-Z]?\d+조)/g,
  ];
  const found = new Set();
  for (const re of patterns) {
    const matches = text.match(re);
    if (matches) matches.forEach(m => found.add(m.trim()));
    if (found.size >= 4) break;
  }
  return [...found].slice(0, 3);
}

// 추출된 수치에 레이블 붙이기
function labelStats(stats, fullText) {
  return stats.map(val => {
    // 해당 수치가 등장하는 문맥에서 레이블 추정
    const idx = fullText.indexOf(val);
    if (idx < 0) return { val, label: '' };
    const ctx = fullText.substring(Math.max(0, idx - 30), idx + val.length + 30);
    // 간단한 레이블 추정
    if (ctx.includes('명')) return { val, label: '대상 인원' };
    if (ctx.includes('개교') || ctx.includes('개 교')) return { val, label: '선정 학교' };
    if (ctx.includes('개 대학') || ctx.includes('개대학')) return { val, label: '참여 대학' };
    if (ctx.includes('년')) return { val, label: '운영 기간' };
    if (ctx.includes('억') || ctx.includes('조')) return { val, label: '투자 규모' };
    if (ctx.includes('%')) return { val, label: '도입 비율' };
    return { val, label: '' };
  });
}

// ── 경향신문 스타일 HTML 생성 ──
function applyDesign({ html, title, tags, accent }) {
  const color = accent || ACCENT['policy'];

  // 1. 기존 article 태그 / ai-disclosure 제거
  let body = html
    .replace(/<!--kg-card-begin: html-->/g, '')
    .replace(/<!--kg-card-end: html-->/g, '')
    .replace(/<article[^>]*>/gi, '')
    .replace(/<\/article>/gi, '')
    .replace(/<p[^>]*class="ai-disclosure"[^>]*>[\s\S]*?<\/p>/gi, '')
    .trim();

  // 2. 리드 문단 추출 (첫 번째 <strong> 포함 p)
  const leadMatch = body.match(/<p[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>/i);
  let leadHtml = '';
  if (leadMatch) {
    leadHtml = cleanInner(leadMatch[1]);
    body = body.replace(leadMatch[0], '').trim();
  } else {
    // 첫 p 태그를 리드로
    const firstP = body.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (firstP) {
      leadHtml = cleanInner(firstP[1]);
      body = body.replace(firstP[0], '').trim();
    }
  }

  // 3. h2 스타일링
  body = body.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, inner) =>
    `<h2 style="font-size:19px;font-weight:700;color:#111;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;">${inner}</h2>`
  );

  // 5. p 스타일링
  body = body.replace(/<p(?![^>]*style)([^>]*)>/gi, '<p$1 style="margin:0 0 36px;">');

  // 6. blockquote 스타일링
  body = body.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) =>
    `<blockquote style="border-left:4px solid ${color};padding:18px 24px;margin:0 0 44px;background:#f8f9ff;border-radius:0 6px 6px 0;">${inner}</blockquote>`
  );

  // 7. 최종 HTML 조립
  return `<!--kg-card-begin: html-->
<div style="font-family:'Noto Sans KR',Apple SD Gothic Neo,sans-serif;max-width:680px;margin:0 auto;color:#111;font-size:17px;line-height:1.9;">

  <!-- AI 공개 배지 -->
  <div style="margin-bottom:32px;">
    <span style="display:inline-flex;align-items:center;gap:6px;background:#eef2ff;border:1px solid #c7d2fe;padding:5px 12px;border-radius:20px;font-size:13px;color:${color};font-weight:500;">
      🤖 AI 생성 콘텐츠 · AI 기본법 제31조
    </span>
  </div>

  <!-- 리드 문단 -->
  <div style="border-left:4px solid ${color};padding:16px 20px;background:#f8f9ff;border-radius:0 6px 6px 0;margin-bottom:44px;">
    <p style="margin:0;font-size:17px;line-height:1.85;color:#1a1a2e;">${leadHtml}</p>
  </div>

  ${body}

</div>
<!--kg-card-end: html-->`;
}

function adjustColor(hex, amount) {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1,3),16)+amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3,5),16)+amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5,7),16)+amount));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ── OG 카드 생성 ──
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
  const { r, g, b } = { r: parseInt(color.slice(1,3),16), g: parseInt(color.slice(3,5),16), b: parseInt(color.slice(5,7),16) };
  const today = new Date().toLocaleDateString('ko-KR', {year:'numeric',month:'2-digit',day:'2-digit'});

  // 배경
  const grad = ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0,'#f8f9ff'); grad.addColorStop(1,'#eef2ff');
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
  // 왼쪽 바
  ctx.fillStyle = color; ctx.fillRect(0,0,10,H);
  // 원형 장식
  [240,160,80].forEach(rad => {
    ctx.beginPath(); ctx.arc(980,315,rad,0,Math.PI*2);
    ctx.fillStyle = `rgba(${r},${g},${b},0.07)`; ctx.fill();
  });
  // 카테고리 배지
  ctx.font = 'bold 17px NotoKR';
  const lw = ctx.measureText(label).width + 48;
  ctx.fillStyle = color; roundRect(ctx, 60, 68, lw, 44, 22); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline='middle'; ctx.textAlign='left';
  ctx.fillText(label, 84, 90);
  // 헤드라인
  ctx.font = 'bold 48px NotoKR'; ctx.fillStyle = '#1a1a2e'; ctx.textBaseline='top';
  const lines = wrapText(ctx, headline, 720).slice(0,3);
  const LINE_H = 66;
  const startY = Math.max(160, (H - lines.length*LINE_H)/2 - 10);
  lines.forEach((line, i) => ctx.fillText(line, 60, startY + i*LINE_H));
  // 구분선
  const sepY = startY + lines.length*LINE_H + 22;
  ctx.fillStyle = color; ctx.fillRect(60, sepY, 100, 4);
  // 날짜
  ctx.font = '19px NotoKR'; ctx.fillStyle = '#64748b'; ctx.textBaseline='top';
  ctx.fillText(today, 60, sepY+18);
  // 사이트명
  ctx.font = 'bold 26px NotoKR'; ctx.fillStyle = color;
  ctx.textAlign='right'; ctx.textBaseline='bottom';
  ctx.fillText('AskedTech', W-48, H-40);

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buf);
  return outputPath;
}

// ── Ghost API 호출 ──
function ghostGet(path) {
  return new Promise(r => https.get({
    hostname:'insight.ubion.global', path,
    headers:{'Authorization':'Ghost '+makeToken(),'Accept-Version':'v5.0'}
  }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>r(JSON.parse(d))); }));
}

function ghostPut(postId, body) {
  return new Promise((res,rej) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname:'insight.ubion.global',
      path:`/ghost/api/admin/posts/${postId}/?source=html`,
      method:'PUT',
      headers:{'Authorization':'Ghost '+makeToken(),'Content-Type':'application/json',
        'Accept-Version':'v5.0','Content-Length':Buffer.byteLength(data)}
    }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d))); });
    req.on('error',rej); req.write(data); req.end();
  });
}

function uploadImage(filePath, filename) {
  return new Promise((res,rej) => {
    const buf = fs.readFileSync(filePath);
    const b = '----FB'+Math.random().toString(36).slice(2);
    const body = Buffer.concat([
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`),
      buf, Buffer.from(`\r\n--${b}--\r\n`)
    ]);
    const req = https.request({
      hostname:'insight.ubion.global', path:'/ghost/api/admin/images/upload/', method:'POST',
      headers:{'Authorization':'Ghost '+makeToken(),'Accept-Version':'v5.0',
        'Content-Type':`multipart/form-data; boundary=${b}`,'Content-Length':body.length}
    }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d).images?.[0]?.url)); });
    req.on('error',rej); req.write(body); req.end();
  });
}

// ── 메인 ──
async function main() {
  const pipelineDir = path.join(__dirname, '../pipeline/08-published');
  const files = fs.readdirSync(pipelineDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const pipelineData = JSON.parse(fs.readFileSync(path.join(pipelineDir, file)));
    const draft = pipelineData.draft;
    const postId = pipelineData.publish_result?.ghost_post_id;
    if (!postId || !draft) { console.log(`⏭  건너뜀: ${file}`); continue; }

    // 기준 포스트(AI기본법)는 이미 디자인 적용됨 — 스킵
    if (postId === '69a57d84e9865e00011c1cf0') { console.log(`✅ 기준 포스트 스킵: ${draft.headline}`); continue; }

    console.log(`\n🔧 처리 중: ${draft.headline}`);

    // 카테고리 탐지
    const tags = draft.ghost_tags || [];
    const category = detectCategoryFromTags(tags);
    const accent = ACCENT[category];

    // 1. 디자인 재적용
    const newHtml = applyDesign({ html: draft.html || '', title: draft.headline, tags, accent });

    // 2. OG 카드 생성
    const ogPath = `/tmp/og-${postId}.png`;
    generateOGCard({ headline: draft.headline, category, outputPath: ogPath });

    // 3. OG 카드 업로드
    const ogUrl = await uploadImage(ogPath, `og-${postId}.png`);
    console.log(`   OG 업로드: ${ogUrl}`);

    // 4. Feature 이미지 (Unsplash)
    const featureUrl = getFeatureImageUrl({
      headline: draft.headline, tags,
      recentIdsFile: path.join(__dirname, '../shared/config/used-images.json')
    });

    // 5. Ghost post 현재 updated_at 가져오기
    const current = await ghostGet(`/ghost/api/admin/posts/${postId}/`);
    const updated_at = current.posts?.[0]?.updated_at;

    // 6. Ghost 업데이트
    const result = await ghostPut(postId, {
      posts: [{
        html: newHtml,
        feature_image: featureUrl,
        feature_image_alt: draft.headline,
        og_image: ogUrl,
        twitter_image: ogUrl,
        updated_at,
      }]
    });

    if (result.posts?.[0]) {
      console.log(`   ✅ 완료: ${result.posts[0].url}`);
    } else {
      console.log(`   ❌ 실패:`, JSON.stringify(result).substring(0, 100));
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n🎉 전체 완료!');
}

main().catch(console.error);
