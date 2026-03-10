#!/usr/bin/env node
/**
 * 토론 → OpenAI TTS → YouTube → Ghost 전체 자동화 파이프라인
 * 
 * 사용법:
 *   node auto-publish-openai.js <debate-md> <topic>
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { generateTTS, extractTextFromMarkdown } = require('./generate-debate-tts.js');
const { audioToVideo } = require('./audio-to-video.js');
const { authorize, uploadVideo } = require('./youtube-upload.js');
const crypto = require('crypto');

// Ghost 설정
const GHOST_URL = 'https://ubion.ghost.io';
const ADMIN_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

function generateGhostToken() {
  const [id, secret] = ADMIN_API_KEY.split(':');
  const secretBuffer = Buffer.from(secret, 'hex');
  const header = { alg: 'HS256', typ: 'JWT', kid: id };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 5 * 60, aud: '/admin/' };
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secretBuffer).update(`${base64Header}.${base64Payload}`).digest('base64url');
  return `${base64Header}.${base64Payload}.${signature}`;
}

async function publishToGhost(title, html, youtubeEmbed, metaDescription) {
  const token = generateGhostToken();
  
  const fullHTML = `
<div style="margin: 30px 0; text-align: center;">
  <iframe
    width="100%"
    height="450"
    src="${youtubeEmbed}"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
    style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
  </iframe>
</div>
${html}
  `.trim();

  const post = {
    title: `🎙️ ${title} (팟캐스트)`,
    html: fullHTML,
    status: 'draft',
    featured: false,
    tags: [
      { name: 'AI' },
      { name: '팟캐스트' },
      { name: '토론' }
    ],
    meta_title: `${title} | AskedTech 팟캐스트`,
    meta_description: metaDescription,
    custom_excerpt: 'AI 이슈를 둘러싼 찬반 논쟁을 팟캐스트 형식으로 풀어봅니다.'
  };

  const response = await fetch(`${GHOST_URL}/ghost/api/admin/posts/?source=html`, {
    method: 'POST',
    headers: {
      'Authorization': `Ghost ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ posts: [post] })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ghost API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return {
    postId: result.posts[0].id,
    slug: result.posts[0].slug,
    previewUrl: `${GHOST_URL}/p/${result.posts[0].slug}/`
  };
}

async function runPipeline(mdFile, topic) {
  console.log('🚀 OpenAI TTS 파이프라인 시작\n');
  console.log(`📋 주제: ${topic}\n`);

  const mdPath = path.resolve(mdFile);
  const baseName = path.basename(mdPath, '.md');
  const mp3Path = path.join(path.dirname(mdPath), `${baseName}-openai.mp3`);
  const mp4Path = mp3Path.replace('.mp3', '.mp4');
  const htmlPath = mp3Path.replace('-openai.mp3', '.html');

  // Step 1: OpenAI TTS
  console.log('🎙️ Step 1/4: OpenAI TTS 변환...');
  const text = extractTextFromMarkdown(mdPath);
  await generateTTS(text, mp3Path);

  // Step 2: MP4 변환
  console.log('\n📹 Step 2/4: 오디오를 비디오로 변환...');
  audioToVideo(mp3Path, mp4Path);

  // Step 3: YouTube 업로드
  console.log('\n📤 Step 3/4: YouTube 업로드...');
  let youtubeResult;
  try {
    const auth = await authorize();
    youtubeResult = await uploadVideo(
      auth,
      mp4Path,
      `${topic} | AskedTech 팟캐스트`,
      `기술낙관론자와 회의론자가 ${topic}를 놓고 벌이는 팟캐스트 토론.\n\nAskedTech AI 특집`
    );
  } catch (error) {
    console.log('⚠️  YouTube 업로드 실패:', error.message);
    console.log('   Ghost만 발행합니다...\n');
  }

  // Step 4: Ghost 발행
  console.log('\n📝 Step 4/4: Ghost Draft 발행...');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const styles = styleMatch ? styleMatch[1] : '';
  const containerMatch = html.match(/<div class="container">([\s\S]*?)<\/div>\s*<\/body>/);
  const content = containerMatch ? containerMatch[1] : html;
  
  const fullHTML = `
<style>${styles}</style>
<div class="container">${content}</div>
  `.trim();

  const ghostResult = await publishToGhost(
    topic,
    fullHTML,
    youtubeResult?.embedUrl || null,
    `기술낙관론자와 회의론자가 ${topic}를 놓고 벌이는 팟캐스트 토론.`
  );

  console.log('\n✅ 파이프라인 완료!\n');
  console.log('📊 결과:');
  console.log(`   - MP3: ${mp3Path}`);
  console.log(`   - MP4: ${mp4Path}`);
  if (youtubeResult) {
    console.log(`   - YouTube: ${youtubeResult.videoUrl}`);
  }
  console.log(`   - Ghost Draft: ${ghostResult.previewUrl}`);

  return {
    mp3Path,
    mp4Path,
    youtube: youtubeResult,
    ghost: ghostResult
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('사용법: node auto-publish-openai.js <debate.md> <topic>');
    console.log('예: node auto-publish-openai.js ai-copyright-debate.md "AI 저작권"');
    process.exit(1);
  }

  const mdFile = args[0];
  const topic = args[1];

  try {
    await runPipeline(mdFile, topic);
  } catch (error) {
    console.error('\n❌ 파이프라인 실패:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runPipeline };
