     1|#!/usr/bin/env node
     2|/**
     3| * AI 팟캐스트 - 이중 목소리 토론
     4| * 설명: Automatically convert markdown debate to podcast
     5| * voice_map:
     6| *   민수: echo      # 남성 - 기술낙관론자
     7| *   지현: shimmer    # 여성 - 회의론자
     8| *   진행자: alloy      # 중성 - 진행자
     9| * 
    10| * 사용법:
    11| *   node full-pipeline.js <debate.md> <topic>
    12| *   
    13| * 예:
    14| *   node full-pipeline.js debates/ai-copyright-debate.md "AI와 저작권"
    15| */
    16|
    17|const path = require('path');
    18|const fs = require('fs');
    19|const { generateDualVoiceTTS } = require('./dual-voice-tts.js');
    20|const { audioToVideo } = require('./audio-to-video.js');
    21|const { authorize, uploadVideo } = require('./youtube-upload.js');
    22|
    23|// Ghost 설정
    const GHOST_URL = 'https://newsroom.ubion.global';
    25|const ADMIN_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
    26|
    27|/**
    28| * 전체 파이프라인 실행
    29| */
    30|async function runPipeline(debateFile, topic) {
    31|  console.log('\n🚀 AI 팟캐스트 파이프라인 시작\n');
    32|  console.log(`📋 주제: ${topic}\n`);
    33|  
    34|  const mdPath = path.resolve(debateFile);
    35|  const baseName = path.basename(mdPath, '.md');
    36|  const outputDir = path.dirname(mdPath);
    37|  
    38|  const mp3Path = path.join(outputDir, `${baseName}-podcast.mp3`);
    39|  const mp4Path = path.join(outputDir, `${baseName}-podcast.mp4`);
    40|  
    41|  // Step 1: 이중 목소리 TTS 생성
    42|  console.log('🎙️ Step 1/4: 이중 목소리 TTS 변환...');
    43|  await generateDualVoiceTTS(mdPath, mp3Path);
    44|  const mp3Stats = fs.statSync(mp3Path);
    45|  console.log(`   ✅ 완료! (${(mp3Stats.size / 1024 / 1024).toFixed(2)} MB)\n`);
    46|  
    47|  // Step 2: MP4 변환
    48|  console.log('🎬 Step 2/4: MP4 변환...');
    49|  await audioToVideo(mp3Path, mp4Path);
    50|  const mp4Stats = fs.statSync(mp4Path);
    51|  console.log(`   ✅ 완료! (${(mp4Stats.size / 1024 / 1024).toFixed(2)} MB)\n`);
    52|  
    53|  // Step 3: YouTube 업로드
    54|  console.log('📤 Step 3/4: YouTube 업로드...');
    55|  let youtubeResult = null;
    56|  try {
    57|    const auth = await authorize();
    58|    youtubeResult = await uploadVideo(
    59|      auth,
    60|      mp4Path,
    61|      `${topic} - AskedTech 팟캐스트`,
    62|      `기술낙관론자와 회의론자가 ${topic}를 놓고 벌이는 팟캐스트 토론.\n\nAskedTech AI 특집`
    63|    );
    64|    console.log(`   ✅ 완료!`);
    65|    console.log(`   Video ID: ${youtubeResult.videoId}`);
    66|    console.log(`   URL: ${youtubeResult.videoUrl}\n`);
    67|  } catch (error) {
    68|    console.log(`   ⚠️  YouTube 업로드 실패: ${error.message}`);
    69|    console.log(`   Ghost만 발행합니다...\n`);
    70|  }
    71|  
    72|  // Step 4: Ghost 발행
    73|  console.log('📝 Step 4/4: Ghost Draft 발행...');
    74|  const ghostResult = await publishToGhost(topic, youtubeResult?.embedUrl);
    75|  console.log(`   ✅ 완료!`);
    76|  console.log(`   Preview: ${ghostResult.previewUrl}\n`);
    77|  
    78|  console.log('🎉 전체 파이프라인 완료!\n');
    79|  console.log('📊 결과:');
    80|  console.log(`   - MP3: ${mp3Path}`);
    81|  console.log(`   - MP4: ${mp4Path}`);
    82|  if (youtubeResult) {
    83|    console.log(`   - YouTube: ${youtubeResult.videoUrl}`);
    84|  }
    85|  console.log(`   - Ghost Draft: ${ghostResult.previewUrl}`);
    86|  
    87|  return {
    88|    mp3: mp3Path,
    89|    mp4: mp4Path,
    90|    youtube: youtubeResult,
    91|    ghost: ghostResult
    92|  };
    93|}
    94|
    95|/**
    96| * Ghost에 포스트 발행
    97| */
    98|async function publishToGhost(topic, youtubeEmbed) {
    99|  const crypto = require('crypto');
   100|  
   101|  const [id, secret] = ADMIN_API_KEY.split(':');
   102|  const secretBuffer = Buffer.from(secret, 'hex');
   103|  
   104|  const header = { alg: 'HS256', typ: 'JWT', kid: id };
   105|  const now = Math.floor(Date.now() / 1000);
   106|  const payload = { iat: now, exp: now + 5 * 60, aud: '/admin/' };
   107|  
   108|  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
   109|  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
   110|  const signature = crypto.createHmac('sha256', secretBuffer)
   111|    .update(`${base64Header}.${base64Payload}`)
   112|    .digest('base64url');
   113|  
   114|  const token = `${base64Header}.${base64Payload}.${signature}`;
   115|  
   116|  // YouTube embed가 있으면 포함
   117|  let content = `<p>이번 팟캐스트에서는 <strong>${topic}</strong> 주제로 기술낙관론자와 회의론자가 격렬한 토론을 벌입니다.</p>`;
   118|  
   119|  if (youtubeEmbed) {
   120|    content += `
   121|<div style="margin: 30px 0; text-align: center;">
   122|  <iframe 
   123|    width="100%" 
   124|    height="450" 
   125|    src="${youtubeEmbed}" 
   126|    frameborder="0" 
   127|    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
   128|    allowfullscreen
   129|    style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
   130|  </iframe>
   131|</div>
   132|<p style="text-align: center; color: #666; font-size: 14px;">
   133|  🎧 YouTube에서 팟캐스트 듣기
   134|</p>
   135|`;
   136|  }
   137|  
   138|  content += `
   139|<p>두 입장의 주요 쟁점과 논리를 정리했습니다. 여러분은 어떻게 생각하시나요?</p>
   140|<hr>
   141|<p style="font-size: 13px; color: #999;">
   142|  이 팟캐스트는 AI가 생성했습니다 (AskedTech AI 특집)
   143|</p>
   144|`;
   145|  
   146|  const post = {
   147|    title: `🎙️ ${topic} (팟캐스트)`,
   148|    html: content,
   149|    status: 'draft',
   150|    featured: false,
   151|    tags: [
   152|      { name: 'AI' },
   153|      { name: '팟캐스트' },
   154|      { name: '토론' }
   155|    ],
   156|    meta_title: `${topic} - AskedTech 팟캐스트`,
   157|    meta_description: `기술낙관론자와 회의론자가 ${topic}를 놓고 벌이는 팟캐스트 토론. - AskedTech AI 특집`,
   158|    custom_excerpt: 'AI 이슈를 둘러싼 찬반 논쟁을 팟캐스트 형식으로 풀어봅니다.'
   159|  };
   160|  
   161|  const response = await fetch(`${GHOST_URL}/ghost/api/admin/posts/?source=html`, {
   162|    method: 'POST',
   163|    headers: {
   164|      'Authorization': `Ghost ${token}`,
   165|      'Content-Type': 'application/json'
   166|    },
   167|    body: JSON.stringify({ posts: [post] })
   168|  });
   169|  
   170|  if (!response.ok) {
   171|    const error = await response.text();
   172|    throw new Error(`Ghost API error: ${response.status} - ${error}`);
   173|  }
   174|  
   175|  const result = await response.json();
   176|  return {
   177|    postId: result.posts[0].id,
   178|    slug: result.posts[0].slug,
   179|    previewUrl: `${GHOST_URL}/p/${result.posts[0].slug}/`
   180|  };
   181|}
   182|
   183|/**
   184| * 메인 함수
   185| */
   186|async function main() {
   187|  const args = process.argv.slice(2);
   188|  
   189|  if (args.length < 2) {
   190|    console.log('사용법: node full-pipeline.js <debate.md> <topic>');
   191|    console.log('\n예: node full-pipeline.js debates/ai-copyright-debate.md "AI와 저작권"');
   192|    process.exit(1);
   193|  }
   194|  
   195|  const debateFile = args[0];
   196|  const topic = args[1];
   197|  
   198|  if (!fs.existsSync(debateFile)) {
   199|    console.error(`❌ 파일을 찾을 수 없음: ${debateFile}`);
   200|    process.exit(1);
   201|  }
   202|  
   203|  try {
   204|    await runPipeline(debateFile, topic);
   205|  } catch (error) {
   206|    console.error('\n❌ 파이프라인 실패:', error.message);
   207|    process.exit(1);
   208|  }
   209|}
   210|
   211|if (require.main === module) {
   212|  main();
   213|}
   214|
   215|module.exports = { runPipeline };
   216|