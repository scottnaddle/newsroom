#!/usr/bin/env node
/**
 * AI 팟캐스트 - 이중 목소리 토론
 * 설명: Automatically convert markdown debate to podcast
 * voice_map:
 *   민수: echo      # 남성 - 기술낙관론자
 *   지현: shimmer    # 여성 - 회의론자
 *   진행자: alloy      # 중성 - 진행자
 * 
 * 사용법:
 *   node full-pipeline.js <debate.md> <topic>
 *   
 * 예:
 *   node full-pipeline.js debates/ai-copyright-debate.md "AI와 저작권"
 */

const path = require('path');
const fs = require('fs');
const { generateDualVoiceTTS } = require('./dual-voice-tts.js');
const { audioToVideo } = require('./audio-to-video.js');
const { authorize, uploadVideo } = require('./youtube-upload.js');

// Ghost 설정
const GHOST_URL = 'https://ubion.ghost.io';
const ADMIN_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

/**
 * 전체 파이프라인 실행
 */
async function runPipeline(debateFile, topic) {
  console.log('\n🚀 AI 팟캐스트 파이프라인 시작\n');
  console.log(`📋 주제: ${topic}\n`);
  
  const mdPath = path.resolve(debateFile);
  const baseName = path.basename(mdPath, '.md');
  const outputDir = path.dirname(mdPath);
  
  const mp3Path = path.join(outputDir, `${baseName}-podcast.mp3`);
  const mp4Path = path.join(outputDir, `${baseName}-podcast.mp4`);
  
  // Step 1: 이중 목소리 TTS 생성
  console.log('🎙️ Step 1/4: 이중 목소리 TTS 변환...');
  await generateDualVoiceTTS(mdPath, mp3Path);
  const mp3Stats = fs.statSync(mp3Path);
  console.log(`   ✅ 완료! (${(mp3Stats.size / 1024 / 1024).toFixed(2)} MB)\n`);
  
  // Step 2: MP4 변환
  console.log('🎬 Step 2/4: MP4 변환...');
  await audioToVideo(mp3Path, mp4Path);
  const mp4Stats = fs.statSync(mp4Path);
  console.log(`   ✅ 완료! (${(mp4Stats.size / 1024 / 1024).toFixed(2)} MB)\n`);
  
  // Step 3: YouTube 업로드
  console.log('📤 Step 3/4: YouTube 업로드...');
  let youtubeResult = null;
  try {
    const auth = await authorize();
    youtubeResult = await uploadVideo(
      auth,
      mp4Path,
      `${topic} - AskedTech 팟캐스트`,
      `기술낙관론자와 회의론자가 ${topic}를 놓고 벌이는 팟캐스트 토론.\n\nAskedTech AI 특집`
    );
    console.log(`   ✅ 완료!`);
    console.log(`   Video ID: ${youtubeResult.videoId}`);
    console.log(`   URL: ${youtubeResult.videoUrl}\n`);
  } catch (error) {
    console.log(`   ⚠️  YouTube 업로드 실패: ${error.message}`);
    console.log(`   Ghost만 발행합니다...\n`);
  }
  
  // Step 4: Ghost 발행
  console.log('📝 Step 4/4: Ghost Draft 발행...');
  const ghostResult = await publishToGhost(topic, youtubeResult?.embedUrl);
  console.log(`   ✅ 완료!`);
  console.log(`   Preview: ${ghostResult.previewUrl}\n`);
  
  console.log('🎉 전체 파이프라인 완료!\n');
  console.log('📊 결과:');
  console.log(`   - MP3: ${mp3Path}`);
  console.log(`   - MP4: ${mp4Path}`);
  if (youtubeResult) {
    console.log(`   - YouTube: ${youtubeResult.videoUrl}`);
  }
  console.log(`   - Ghost Draft: ${ghostResult.previewUrl}`);
  
  return {
    mp3: mp3Path,
    mp4: mp4Path,
    youtube: youtubeResult,
    ghost: ghostResult
  };
}

/**
 * Ghost에 포스트 발행
 */
async function publishToGhost(topic, youtubeEmbed) {
  const crypto = require('crypto');
  
  const [id, secret] = ADMIN_API_KEY.split(':');
  const secretBuffer = Buffer.from(secret, 'hex');
  
  const header = { alg: 'HS256', typ: 'JWT', kid: id };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 5 * 60, aud: '/admin/' };
  
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secretBuffer)
    .update(`${base64Header}.${base64Payload}`)
    .digest('base64url');
  
  const token = `${base64Header}.${base64Payload}.${signature}`;
  
  // YouTube embed가 있으면 포함
  let content = `<p>이번 팟캐스트에서는 <strong>${topic}</strong> 주제로 기술낙관론자와 회의론자가 격렬한 토론을 벌입니다.</p>`;
  
  if (youtubeEmbed) {
    content += `
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
<p style="text-align: center; color: #666; font-size: 14px;">
  🎧 YouTube에서 팟캐스트 듣기
</p>
`;
  }
  
  content += `
<p>두 입장의 주요 쟁점과 논리를 정리했습니다. 여러분은 어떻게 생각하시나요?</p>
<hr>
<p style="font-size: 13px; color: #999;">
  이 팟캐스트는 AI가 생성했습니다 (AskedTech AI 특집)
</p>
`;
  
  const post = {
    title: `🎙️ ${topic} (팟캐스트)`,
    html: content,
    status: 'draft',
    featured: false,
    tags: [
      { name: 'AI' },
      { name: '팟캐스트' },
      { name: '토론' }
    ],
    meta_title: `${topic} - AskedTech 팟캐스트`,
    meta_description: `기술낙관론자와 회의론자가 ${topic}를 놓고 벌이는 팟캐스트 토론. - AskedTech AI 특집`,
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

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('사용법: node full-pipeline.js <debate.md> <topic>');
    console.log('\n예: node full-pipeline.js debates/ai-copyright-debate.md "AI와 저작권"');
    process.exit(1);
  }
  
  const debateFile = args[0];
  const topic = args[1];
  
  if (!fs.existsSync(debateFile)) {
    console.error(`❌ 파일을 찾을 수 없음: ${debateFile}`);
    process.exit(1);
  }
  
  try {
    await runPipeline(debateFile, topic);
  } catch (error) {
    console.error('\n❌ 파이프라인 실패:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runPipeline };
