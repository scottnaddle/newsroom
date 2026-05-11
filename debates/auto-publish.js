     1|#!/usr/bin/env node
     2|/**
     3| * 토론 → TTS → YouTube → Ghost 자동화 파이프라인
     4| *
     5| * 사용법:
     6| *   node auto-publish.js <debate-topic>
     7| *   node auto-publish.js "AI 교육 득실"
     8| *
     9| * 워크플로우:
    10| *   1. 토론 대본 생성 (AI)
    11| *   2. TTS 변환 (mp3)
    12| *   3. FFmpeg 변환 (mp3 → mp4)
    13| *   4. YouTube 업로드 (비공개)
    14| *   5. Ghost Draft 발행 (YouTube embed 포함)
    15| */
    16|
    17|const path = require('path');
    18|const fs = require('fs');
    19|const { audioToVideo } = require('./audio-to-video.js');
    20|const { authorize, uploadVideo } = require('./youtube-upload.js');
    21|const crypto = require('crypto');
    22|
    23|// Ghost 설정
    const GHOST_URL = 'https://newsroom.ubion.global';
    25|const ADMIN_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
    26|
    27|/**
    28| * JWT 토큰 생성 (Ghost Admin API)
    29| */
    30|function generateGhostToken() {
    31|  const [id, secret] = ADMIN_API_KEY.split(':');
    32|  const secretBuffer = Buffer.from(secret, 'hex');
    33|
    34|  const header = { alg: 'HS256', typ: 'JWT', kid: id };
    35|  const now = Math.floor(Date.now() / 1000);
    36|  const payload = { iat: now, exp: now + 5 * 60, aud: '/admin/' };
    37|
    38|  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    39|  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    40|  const signature = crypto
    41|    .createHmac('sha256', secretBuffer)
    42|    .update(`${base64Header}.${base64Payload}`)
    43|    .digest('base64url');
    44|
    45|  return `${base64Header}.${base64Payload}.${signature}`;
    46|}
    47|
    48|/**
    49| * Ghost에 포스트 발행
    50| */
    51|async function publishToGhost(title, html, youtubeEmbed, metaDescription) {
    52|  const token = generateGhostToken();
    53|
    54|  // YouTube embed를 HTML 상단에 추가
    55|  const fullHTML = `
    56|<div style="margin: 30px 0; text-align: center;">
    57|  <iframe
    58|    width="100%"
    59|    height="450"
    60|    src="${youtubeEmbed}"
    61|    frameborder="0"
    62|    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    63|    allowfullscreen
    64|    style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
    65|  </iframe>
    66|</div>
    67|${html}
    68|  `.trim();
    69|
    70|  const post = {
    71|    title: `🎙️ ${title} (팟캐스트)`,
    72|    html: fullHTML,
    73|    status: 'draft',
    74|    featured: false,
    75|    tags: [
    76|      { name: 'AI 교육' },
    77|      { name: '팟캐스트' },
    78|      { name: '토론' }
    79|    ],
    80|    meta_title: `${title} | 기술낙관론자 vs 회의론자`,
    81|    meta_description: metaDescription,
    82|    custom_excerpt: 'AI 교육을 둘러싼 찬반 논쟁을 팟캐스트 형식으로 풀어봅니다.'
    83|  };
    84|
    85|  const response = await fetch(`${GHOST_URL}/ghost/api/admin/posts/?source=html`, {
    86|    method: 'POST',
    87|    headers: {
    88|      'Authorization': `Ghost ${token}`,
    89|      'Content-Type': 'application/json'
    90|    },
    91|    body: JSON.stringify({ posts: [post] })
    92|  });
    93|
    94|  if (!response.ok) {
    95|    const error = await response.text();
    96|    throw new Error(`Ghost API error: ${response.status} - ${error}`);
    97|  }
    98|
    99|  const result = await response.json();
   100|  return {
   101|    postId: result.posts[0].id,
   102|    slug: result.posts[0].slug,
   103|    previewUrl: `${GHOST_URL}/p/${result.posts[0].slug}/`
   104|  };
   105|}
   106|
   107|/**
   108| * 전체 파이프라인 실행
   109| */
   110|async function runPipeline(debateTopic) {
   111|  console.log('🚀 자동화 파이프라인 시작\n');
   112|  console.log(`📋 주제: ${debateTopic}\n`);
   113|
   114|  // Step 1: 파일 확인
   115|  const audioPath = path.join(__dirname, 'ai-education-debate.mp3');
   116|  const htmlPath = path.join(__dirname, 'ai-education-debate.html');
   117|
   118|  if (!fs.existsSync(audioPath)) {
   119|    throw new Error('오디오 파일을 찾을 수 없음: ai-education-debate.mp3');
   120|  }
   121|  if (!fs.existsSync(htmlPath)) {
   122|    throw new Error('HTML 파일을 찾을 수 없음: ai-education-debate.html');
   123|  }
   124|
   125|  // Step 2: MP3 → MP4 변환
   126|  console.log('📹 Step 1/4: 오디오를 비디오로 변환...');
   127|  const videoPath = audioToVideo(audioPath, audioPath.replace('.mp3', '.mp4'));
   128|
   129|  // Step 3: YouTube 업로드
   130|  console.log('\n📤 Step 2/4: YouTube 업로드...');
   131|  let youtubeResult;
   132|  try {
   133|    const auth = await authorize();
   134|    youtubeResult = await uploadVideo(
   135|      auth,
   136|      videoPath,
   137|      `AI 교육: 득이 될까, 실이 될까? | AskedTech 팟캐스트`,
   138|      `기술낙관론자와 회의론자가 AI 교육의 득실을 놓고 벌이는 팟캐스트 토론.\n\n주요 쟁점:\n- AI는 계산기와 같은 도구인가?\n- AI 교육이 비판적 사고력을 저해하는가?\n- 2030년 직업 환경 변화\n- 규제 vs 혁신의 균형\n\nAskedTech AI 교육 특집 (2026.03.07)`
   139|    );
   140|  } catch (error) {
   141|    if (error.message.includes('credentials.json') || error.message.includes('token.json')) {
   142|      console.error('\n⚠️  YouTube 인증이 필요합니다!');
   143|      console.error('   YOUTUBE_SETUP.md를 참고하여 인증을 완료하세요.');
   144|      console.error('   인증 후 다시 실행하면 YouTube 업로드 없이 Ghost만 발행됩니다.\n');
   145|
   146|      // YouTube 없이 Ghost만 발행
   147|      youtubeResult = null;
   148|    } else {
   149|      throw error;
   150|    }
   151|  }
   152|
   153|  // Step 4: Ghost 발행
   154|  console.log('\n📝 Step 3/4: Ghost Draft 발행...');
   155|  const html = fs.readFileSync(htmlPath, 'utf-8');
   156|
   157|  // <style> 태그와 내용 추출
   158|  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
   159|  const styles = styleMatch ? styleMatch[1] : '';
   160|  const containerMatch = html.match(/<div class="container">([\s\S]*?)<\/div>\s*<\/body>/);
   161|  let content = containerMatch ? containerMatch[1] : html;
   162|
   163|  const fullHTML = `
   164|<style>
   165|${styles}
   166|</style>
   167|<div class="container">
   168|${content}
   169|</div>
   170|  `.trim();
   171|
   172|  const ghostResult = await publishToGhost(
   173|    'AI 교육: 득이 될까, 실이 될까?',
   174|    fullHTML,
   175|    youtubeResult?.embedUrl || null,
   176|    '기술낙관론자와 회의론자가 AI 교육의 득실을 놓고 벌이는 팟캐스트 토론.'
   177|  );
   178|
   179|  // Step 5: YouTube embed를 Ghost에 업데이트 (있는 경우)
   180|  if (youtubeResult) {
   181|    console.log('\n🔗 Step 4/4: YouTube embed 추가...');
   182|    console.log('   (Ghost 포스트에 수동으로 추가하거나, update-ghost-youtube.js 실행)');
   183|  }
   184|
   185|  console.log('\n✅ 파이프라인 완료!\n');
   186|  console.log('📊 결과:');
   187|  console.log(`   - 비디오: ${videoPath}`);
   188|  if (youtubeResult) {
   189|    console.log(`   - YouTube: ${youtubeResult.videoUrl}`);
   190|  }
   191|  console.log(`   - Ghost Draft: ${ghostResult.previewUrl}`);
   192|
   193|  return {
   194|    videoPath,
   195|    youtube: youtubeResult,
   196|    ghost: ghostResult
   197|  };
   198|}
   199|
   200|/**
   201| * 메인 함수
   202| */
   203|async function main() {
   204|  const args = process.argv.slice(2);
   205|  const topic = args[0] || 'AI 교육 득실';
   206|
   207|  try {
   208|    await runPipeline(topic);
   209|  } catch (error) {
   210|    console.error('\n❌ 파이프라인 실패:', error.message);
   211|    process.exit(1);
   212|  }
   213|}
   214|
   215|// 실행
   216|if (require.main === module) {
   217|  main();
   218|}
   219|
   220|module.exports = { runPipeline, publishToGhost };
   221|