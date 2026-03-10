#!/usr/bin/env node
/**
 * 토론 → TTS → YouTube → Ghost 자동화 파이프라인
 *
 * 사용법:
 *   node auto-publish.js <debate-topic>
 *   node auto-publish.js "AI 교육 득실"
 *
 * 워크플로우:
 *   1. 토론 대본 생성 (AI)
 *   2. TTS 변환 (mp3)
 *   3. FFmpeg 변환 (mp3 → mp4)
 *   4. YouTube 업로드 (비공개)
 *   5. Ghost Draft 발행 (YouTube embed 포함)
 */

const path = require('path');
const fs = require('fs');
const { audioToVideo } = require('./audio-to-video.js');
const { authorize, uploadVideo } = require('./youtube-upload.js');
const crypto = require('crypto');

// Ghost 설정
const GHOST_URL = 'https://ubion.ghost.io';
const ADMIN_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

/**
 * JWT 토큰 생성 (Ghost Admin API)
 */
function generateGhostToken() {
  const [id, secret] = ADMIN_API_KEY.split(':');
  const secretBuffer = Buffer.from(secret, 'hex');

  const header = { alg: 'HS256', typ: 'JWT', kid: id };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 5 * 60, aud: '/admin/' };

  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secretBuffer)
    .update(`${base64Header}.${base64Payload}`)
    .digest('base64url');

  return `${base64Header}.${base64Payload}.${signature}`;
}

/**
 * Ghost에 포스트 발행
 */
async function publishToGhost(title, html, youtubeEmbed, metaDescription) {
  const token = generateGhostToken();

  // YouTube embed를 HTML 상단에 추가
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
      { name: 'AI 교육' },
      { name: '팟캐스트' },
      { name: '토론' }
    ],
    meta_title: `${title} | 기술낙관론자 vs 회의론자`,
    meta_description: metaDescription,
    custom_excerpt: 'AI 교육을 둘러싼 찬반 논쟁을 팟캐스트 형식으로 풀어봅니다.'
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

/**
 * 전체 파이프라인 실행
 */
async function runPipeline(debateTopic) {
  console.log('🚀 자동화 파이프라인 시작\n');
  console.log(`📋 주제: ${debateTopic}\n`);

  // Step 1: 파일 확인
  const audioPath = path.join(__dirname, 'ai-education-debate.mp3');
  const htmlPath = path.join(__dirname, 'ai-education-debate.html');

  if (!fs.existsSync(audioPath)) {
    throw new Error('오디오 파일을 찾을 수 없음: ai-education-debate.mp3');
  }
  if (!fs.existsSync(htmlPath)) {
    throw new Error('HTML 파일을 찾을 수 없음: ai-education-debate.html');
  }

  // Step 2: MP3 → MP4 변환
  console.log('📹 Step 1/4: 오디오를 비디오로 변환...');
  const videoPath = audioToVideo(audioPath, audioPath.replace('.mp3', '.mp4'));

  // Step 3: YouTube 업로드
  console.log('\n📤 Step 2/4: YouTube 업로드...');
  let youtubeResult;
  try {
    const auth = await authorize();
    youtubeResult = await uploadVideo(
      auth,
      videoPath,
      `AI 교육: 득이 될까, 실이 될까? | AskedTech 팟캐스트`,
      `기술낙관론자와 회의론자가 AI 교육의 득실을 놓고 벌이는 팟캐스트 토론.\n\n주요 쟁점:\n- AI는 계산기와 같은 도구인가?\n- AI 교육이 비판적 사고력을 저해하는가?\n- 2030년 직업 환경 변화\n- 규제 vs 혁신의 균형\n\nAskedTech AI 교육 특집 (2026.03.07)`
    );
  } catch (error) {
    if (error.message.includes('credentials.json') || error.message.includes('token.json')) {
      console.error('\n⚠️  YouTube 인증이 필요합니다!');
      console.error('   YOUTUBE_SETUP.md를 참고하여 인증을 완료하세요.');
      console.error('   인증 후 다시 실행하면 YouTube 업로드 없이 Ghost만 발행됩니다.\n');

      // YouTube 없이 Ghost만 발행
      youtubeResult = null;
    } else {
      throw error;
    }
  }

  // Step 4: Ghost 발행
  console.log('\n📝 Step 3/4: Ghost Draft 발행...');
  const html = fs.readFileSync(htmlPath, 'utf-8');

  // <style> 태그와 내용 추출
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const styles = styleMatch ? styleMatch[1] : '';
  const containerMatch = html.match(/<div class="container">([\s\S]*?)<\/div>\s*<\/body>/);
  let content = containerMatch ? containerMatch[1] : html;

  const fullHTML = `
<style>
${styles}
</style>
<div class="container">
${content}
</div>
  `.trim();

  const ghostResult = await publishToGhost(
    'AI 교육: 득이 될까, 실이 될까?',
    fullHTML,
    youtubeResult?.embedUrl || null,
    '기술낙관론자와 회의론자가 AI 교육의 득실을 놓고 벌이는 팟캐스트 토론.'
  );

  // Step 5: YouTube embed를 Ghost에 업데이트 (있는 경우)
  if (youtubeResult) {
    console.log('\n🔗 Step 4/4: YouTube embed 추가...');
    console.log('   (Ghost 포스트에 수동으로 추가하거나, update-ghost-youtube.js 실행)');
  }

  console.log('\n✅ 파이프라인 완료!\n');
  console.log('📊 결과:');
  console.log(`   - 비디오: ${videoPath}`);
  if (youtubeResult) {
    console.log(`   - YouTube: ${youtubeResult.videoUrl}`);
  }
  console.log(`   - Ghost Draft: ${ghostResult.previewUrl}`);

  return {
    videoPath,
    youtube: youtubeResult,
    ghost: ghostResult
  };
}

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);
  const topic = args[0] || 'AI 교육 득실';

  try {
    await runPipeline(topic);
  } catch (error) {
    console.error('\n❌ 파이프라인 실패:', error.message);
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  main();
}

module.exports = { runPipeline, publishToGhost };
