     1|#!/usr/bin/env node
     2|/**
     3| * 토론 → OpenAI TTS → YouTube → Ghost 전체 자동화 파이프라인
     4| * 
     5| * 사용법:
     6| *   node auto-publish-openai.js <debate-md> <topic>
     7| */
     8|
     9|const path = require('path');
    10|const fs = require('fs');
    11|const { execSync } = require('child_process');
    12|const { generateTTS, extractTextFromMarkdown } = require('./generate-debate-tts.js');
    13|const { audioToVideo } = require('./audio-to-video.js');
    14|const { authorize, uploadVideo } = require('./youtube-upload.js');
    15|const crypto = require('crypto');
    16|
    17|// Ghost 설정
    const GHOST_URL = 'https://newsroom.ubion.global';
    19|const ADMIN_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
    20|
    21|function generateGhostToken() {
    22|  const [id, secret] = ADMIN_API_KEY.split(':');
    23|  const secretBuffer = Buffer.from(secret, 'hex');
    24|  const header = { alg: 'HS256', typ: 'JWT', kid: id };
    25|  const now = Math.floor(Date.now() / 1000);
    26|  const payload = { iat: now, exp: now + 5 * 60, aud: '/admin/' };
    27|  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    28|  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    29|  const signature = crypto.createHmac('sha256', secretBuffer).update(`${base64Header}.${base64Payload}`).digest('base64url');
    30|  return `${base64Header}.${base64Payload}.${signature}`;
    31|}
    32|
    33|async function publishToGhost(title, html, youtubeEmbed, metaDescription) {
    34|  const token = generateGhostToken();
    35|  
    36|  const fullHTML = `
    37|<div style="margin: 30px 0; text-align: center;">
    38|  <iframe
    39|    width="100%"
    40|    height="450"
    41|    src="${youtubeEmbed}"
    42|    frameborder="0"
    43|    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    44|    allowfullscreen
    45|    style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
    46|  </iframe>
    47|</div>
    48|${html}
    49|  `.trim();
    50|
    51|  const post = {
    52|    title: `🎙️ ${title} (팟캐스트)`,
    53|    html: fullHTML,
    54|    status: 'draft',
    55|    featured: false,
    56|    tags: [
    57|      { name: 'AI' },
    58|      { name: '팟캐스트' },
    59|      { name: '토론' }
    60|    ],
    61|    meta_title: `${title} | AskedTech 팟캐스트`,
    62|    meta_description: metaDescription,
    63|    custom_excerpt: 'AI 이슈를 둘러싼 찬반 논쟁을 팟캐스트 형식으로 풀어봅니다.'
    64|  };
    65|
    66|  const response = await fetch(`${GHOST_URL}/ghost/api/admin/posts/?source=html`, {
    67|    method: 'POST',
    68|    headers: {
    69|      'Authorization': `Ghost ${token}`,
    70|      'Content-Type': 'application/json'
    71|    },
    72|    body: JSON.stringify({ posts: [post] })
    73|  });
    74|
    75|  if (!response.ok) {
    76|    const error = await response.text();
    77|    throw new Error(`Ghost API error: ${response.status} - ${error}`);
    78|  }
    79|
    80|  const result = await response.json();
    81|  return {
    82|    postId: result.posts[0].id,
    83|    slug: result.posts[0].slug,
    84|    previewUrl: `${GHOST_URL}/p/${result.posts[0].slug}/`
    85|  };
    86|}
    87|
    88|async function runPipeline(mdFile, topic) {
    89|  console.log('🚀 OpenAI TTS 파이프라인 시작\n');
    90|  console.log(`📋 주제: ${topic}\n`);
    91|
    92|  const mdPath = path.resolve(mdFile);
    93|  const baseName = path.basename(mdPath, '.md');
    94|  const mp3Path = path.join(path.dirname(mdPath), `${baseName}-openai.mp3`);
    95|  const mp4Path = mp3Path.replace('.mp3', '.mp4');
    96|  const htmlPath = mp3Path.replace('-openai.mp3', '.html');
    97|
    98|  // Step 1: OpenAI TTS
    99|  console.log('🎙️ Step 1/4: OpenAI TTS 변환...');
   100|  const text = extractTextFromMarkdown(mdPath);
   101|  await generateTTS(text, mp3Path);
   102|
   103|  // Step 2: MP4 변환
   104|  console.log('\n📹 Step 2/4: 오디오를 비디오로 변환...');
   105|  audioToVideo(mp3Path, mp4Path);
   106|
   107|  // Step 3: YouTube 업로드
   108|  console.log('\n📤 Step 3/4: YouTube 업로드...');
   109|  let youtubeResult;
   110|  try {
   111|    const auth = await authorize();
   112|    youtubeResult = await uploadVideo(
   113|      auth,
   114|      mp4Path,
   115|      `${topic} | AskedTech 팟캐스트`,
   116|      `기술낙관론자와 회의론자가 ${topic}를 놓고 벌이는 팟캐스트 토론.\n\nAskedTech AI 특집`
   117|    );
   118|  } catch (error) {
   119|    console.log('⚠️  YouTube 업로드 실패:', error.message);
   120|    console.log('   Ghost만 발행합니다...\n');
   121|  }
   122|
   123|  // Step 4: Ghost 발행
   124|  console.log('\n📝 Step 4/4: Ghost Draft 발행...');
   125|  const html = fs.readFileSync(htmlPath, 'utf-8');
   126|  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
   127|  const styles = styleMatch ? styleMatch[1] : '';
   128|  const containerMatch = html.match(/<div class="container">([\s\S]*?)<\/div>\s*<\/body>/);
   129|  const content = containerMatch ? containerMatch[1] : html;
   130|  
   131|  const fullHTML = `
   132|<style>${styles}</style>
   133|<div class="container">${content}</div>
   134|  `.trim();
   135|
   136|  const ghostResult = await publishToGhost(
   137|    topic,
   138|    fullHTML,
   139|    youtubeResult?.embedUrl || null,
   140|    `기술낙관론자와 회의론자가 ${topic}를 놓고 벌이는 팟캐스트 토론.`
   141|  );
   142|
   143|  console.log('\n✅ 파이프라인 완료!\n');
   144|  console.log('📊 결과:');
   145|  console.log(`   - MP3: ${mp3Path}`);
   146|  console.log(`   - MP4: ${mp4Path}`);
   147|  if (youtubeResult) {
   148|    console.log(`   - YouTube: ${youtubeResult.videoUrl}`);
   149|  }
   150|  console.log(`   - Ghost Draft: ${ghostResult.previewUrl}`);
   151|
   152|  return {
   153|    mp3Path,
   154|    mp4Path,
   155|    youtube: youtubeResult,
   156|    ghost: ghostResult
   157|  };
   158|}
   159|
   160|async function main() {
   161|  const args = process.argv.slice(2);
   162|
   163|  if (args.length < 2) {
   164|    console.log('사용법: node auto-publish-openai.js <debate.md> <topic>');
   165|    console.log('예: node auto-publish-openai.js ai-copyright-debate.md "AI 저작권"');
   166|    process.exit(1);
   167|  }
   168|
   169|  const mdFile = args[0];
   170|  const topic = args[1];
   171|
   172|  try {
   173|    await runPipeline(mdFile, topic);
   174|  } catch (error) {
   175|    console.error('\n❌ 파이프라인 실패:', error.message);
   176|    process.exit(1);
   177|  }
   178|}
   179|
   180|if (require.main === module) {
   181|  main();
   182|}
   183|
   184|module.exports = { runPipeline };
   185|