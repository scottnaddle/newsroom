#!/usr/bin/env node
/**
 * 일일 AI 교육 만평 생성기
 * Nano Banana Pro (Gemini 3 Pro Image) + ImageMagick 텍스트 오버레이
 * 
 * 사용: node generate-cartoon.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const GEMINI_KEY = 'AIzaSyDvH5WMJww3-hxjfGJ0yexIQxKQk48KVS0';
const GHOST_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const NEWSROOM_DIR = '/root/.openclaw/workspace/newsroom';
const CARTOON_DIR = path.join(NEWSROOM_DIR, 'pipeline/cartoon');
const NOTO_FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';

// Ghost JWT
const [kid, secret] = GHOST_API_KEY.split(':');
function makeToken() {
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:now,exp:now+300,aud:'/admin/'})).toString('base64url');
  return h+'.'+p+'.'+crypto.createHmac('sha256',Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
}

function ghostReq(method, reqPath, body) {
  return new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname:'ubion.ghost.io', path:reqPath, method,
      headers:{'Authorization':'Ghost '+makeToken(),'Accept-Version':'v5.0',
        ...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{})}
    }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{try{res(JSON.parse(d));}catch(e){res(null);}}); });
    req.on('error', rej); if (data) req.write(data); req.end();
  });
}

// Gemini 이미지 생성
function generateImage(prompt) {
  return new Promise((res, rej) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch(e) { res(null); } });
    });
    req.on('error', rej); req.write(body); req.end();
  });
}

// Ghost에 이미지 업로드
function uploadImage(filePath, filename) {
  return new Promise((res, rej) => {
    const fileData = fs.readFileSync(filePath);
    const boundary = '----FormBoundary' + Math.random().toString(36).substr(2);
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`),
      fileData,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    const req = https.request({
      hostname:'ubion.ghost.io', path:'/ghost/api/admin/images/upload/', method:'POST',
      headers:{
        'Authorization':'Ghost '+makeToken(),'Accept-Version':'v5.0',
        'Content-Type':`multipart/form-data; boundary=${boundary}`,
        'Content-Length':body.length
      }
    }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{try{res(JSON.parse(d));}catch(e){res(null);}}); });
    req.on('error', rej); req.write(body); req.end();
  });
}

// 오늘 발행된 기사에서 만평 주제 선정
function selectTopic() {
  const today = new Date().toISOString().slice(0,10);
  const pubDir = path.join(NEWSROOM_DIR, 'pipeline/08-published');
  const files = fs.readdirSync(pubDir)
    .filter(f => f.startsWith(today) || f.startsWith(yesterday()))
    .slice(0, 8);
  
  const articles = files.map(f => {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(pubDir, f)));
      return d.draft?.headline || d.copy_edit?.final_headline || '';
    } catch(e) { return ''; }
  }).filter(Boolean);
  
  return articles;
}

function yesterday() {
  const d = new Date(); d.setDate(d.getDate()-1);
  return d.toISOString().slice(0,10);
}

// 텍스트 오버레이 (ImageMagick)
function addTextOverlay(inputPath, outputPath, caption, speechBubble) {
  const font = fs.existsSync(NOTO_FONT) ? NOTO_FONT : 'NanumGothic';
  
  // 캡션 하단 추가
  const captionCmd = [
    'convert', inputPath,
    '-gravity', 'South',
    '-font', font,
    '-pointsize', '28',
    '-fill', 'black',
    '-undercolor', 'white',
    '-annotate', '+0+20', `"${caption}"`,
    outputPath
  ].join(' ');
  
  try {
    execSync(captionCmd, { stdio: 'pipe' });
    console.log('텍스트 오버레이 완료:', outputPath);
    return true;
  } catch(e) {
    console.log('ImageMagick 오류, 원본 사용:', e.message?.substring(0,100));
    fs.copyFileSync(inputPath, outputPath);
    return false;
  }
}

async function main() {
  const today = new Date().toISOString().slice(0,10);
  const cartoonFile = path.join(CARTOON_DIR, `${today}.json`);
  
  // 디렉터리 생성
  if (!fs.existsSync(CARTOON_DIR)) fs.mkdirSync(CARTOON_DIR, { recursive: true });
  
  // 오늘 이미 발행했으면 종료
  if (fs.existsSync(cartoonFile)) {
    console.log('오늘 만평 이미 발행됨. 종료.');
    return;
  }
  
  // 오늘 기사 주제 수집
  const articles = selectTopic();
  console.log(`오늘 기사 ${articles.length}개 발견`);
  if (articles.length < 2) {
    console.log('기사 부족 (2개 미만). 종료.');
    return;
  }
  
  // Gemini로 만평 프롬프트 생성
  const topicList = articles.slice(0,5).map((a,i) => `${i+1}. ${a}`).join('\n');
  
  // 1단계: Gemini에게 만평 기획 요청
  const planPrompt = `You are a Korean editorial cartoonist. Based on today's AI education news headlines, design ONE editorial cartoon (만평).

Today's headlines:
${topicList}

Design a single-panel satirical cartoon. Respond in this exact JSON format:
{
  "selectedTopic": "which headline you chose",
  "imagePrompt": "detailed English prompt for image generation (NO Korean text in image, leave speech bubbles blank)",
  "captionKorean": "bottom caption in Korean (max 30 chars)",
  "speechBubbleKorean": "main character speech bubble in Korean (max 20 chars)",
  "altText": "Korean description of the cartoon for accessibility"
}`;

  const planResp = await generateImage(planPrompt);
  let plan;
  try {
    const text = planResp?.candidates?.[0]?.content?.parts?.find(p=>p.text)?.text || '';
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    plan = JSON.parse(jsonMatch[0]);
    console.log('만평 기획:', plan.selectedTopic);
  } catch(e) {
    // 기본 기획
    plan = {
      selectedTopic: articles[0],
      imagePrompt: `Korean newspaper editorial cartoon, single panel, black and white ink line art. Scene based on AI education in Korea. Teacher or professor looking confused while students use AI technology. Leave any speech bubbles completely blank/white. Style: newspaper editorial cartoon, clean ink drawing.`,
      captionKorean: articles[0].substring(0, 28) + (articles[0].length > 28 ? '…' : ''),
      speechBubbleKorean: 'AI가 해줬어요!',
      altText: `오늘의 AI 교육 만평: ${articles[0]}`
    };
  }
  
  // 2단계: 이미지 생성 (텍스트 없이)
  console.log('이미지 생성 중...');
  const imgResp = await generateImage(plan.imagePrompt + '\n\nIMPORTANT: Do NOT include any text, Korean characters, or speech bubbles with text in the image. Leave all speech bubble areas as empty white spaces.');
  
  const imgPart = imgResp?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imgPart) {
    console.log('이미지 생성 실패:', JSON.stringify(imgResp)?.substring(0,200));
    return;
  }
  
  // 이미지 저장
  const rawPath = path.join(NEWSROOM_DIR, 'tmp', `cartoon-${today}-raw.png`);
  const finalPath = path.join(NEWSROOM_DIR, 'tmp', `cartoon-${today}.png`);
  fs.mkdirSync(path.join(NEWSROOM_DIR, 'tmp'), { recursive: true });
  fs.writeFileSync(rawPath, Buffer.from(imgPart.inlineData.data, 'base64'));
  console.log('이미지 저장:', rawPath);
  
  // 3단계: 한국어 캡션 오버레이
  addTextOverlay(rawPath, finalPath, plan.captionKorean, plan.speechBubbleKorean);
  
  // 4단계: Ghost에 이미지 업로드
  console.log('Ghost 이미지 업로드 중...');
  const uploadResp = await uploadImage(finalPath, `cartoon-${today}.png`);
  const imageUrl = uploadResp?.images?.[0]?.url;
  if (!imageUrl) {
    console.log('업로드 실패:', JSON.stringify(uploadResp)?.substring(0,200));
    return;
  }
  console.log('업로드 완료:', imageUrl);
  
  // 5단계: Ghost 포스트 발행
  const postTitle = `만평: ${plan.captionKorean}`;
  const postHtml = `<div style="font-family:'Noto Sans KR',sans-serif;max-width:680px;margin:0 auto;text-align:center;">
  <p style="margin:0 0 16px;">
    <span style="display:inline-block;background:#1a1a2e;color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:4px;">✏️ 오늘의 만평</span>
  </p>
  <img src="${imageUrl}" alt="${plan.altText}" style="max-width:100%;border:1px solid #e2e8f0;border-radius:8px;" />
  <p style="margin:16px 0 8px;font-size:18px;font-weight:700;color:#1a1a2e;">${plan.captionKorean}</p>
  <p style="margin:0 0 24px;font-size:15px;color:#64748b;">오늘의 AI 교육 뉴스를 풍자한 만평입니다.</p>
  <p style="margin:0 0 0;font-size:13px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:12px;">관련 기사: ${plan.selectedTopic}</p>
  <p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">본 만평은 AI가 생성했습니다 (AI 기본법 제31조)</p>
</div>`;

  const lexical = JSON.stringify({
    root: { children: [{ type:'html', version:1, html: postHtml }],
      direction:'ltr', format:'', indent:0, type:'root', version:1 }
  });

  const postResp = await ghostReq('POST', '/ghost/api/admin/posts/', {
    posts: [{
      title: postTitle,
      lexical,
      status: 'published',
      featured: false,
      feature_image: imageUrl,
      feature_image_alt: plan.altText,
      slug: `cartoon-${today}`,
      tags: [
        { name: '만평', slug: 'cartoon' },
        { id: '69a7a9ed659ea80001153c13' }
      ],
      custom_excerpt: `오늘의 AI 교육 만평 — ${plan.captionKorean}`
    }]
  });

  const post = postResp?.posts?.[0];
  if (!post) {
    console.log('포스트 발행 실패:', JSON.stringify(postResp)?.substring(0,300));
    return;
  }
  
  console.log('✅ 만평 발행 완료!');
  console.log('제목:', post.title);
  console.log('URL:', post.url);
  
  // 6단계: 기록 저장
  fs.writeFileSync(cartoonFile, JSON.stringify({
    published_at: new Date().toISOString(),
    title: postTitle,
    caption: plan.captionKorean,
    topic: plan.selectedTopic,
    ghost_post_id: post.id,
    ghost_url: post.url,
    image_url: imageUrl
  }, null, 2));
}

main().catch(console.error);
