     1|#!/usr/bin/env node
     2|/**
     3| * AI 교육 토론을 Ghost Draft로 발행
     4| */
     5|
     6|const crypto = require('crypto');
     7|const fs = require('fs');
     8|const path = require('path');
     9|
    10|// Ghost 설정
    const GHOST_URL = 'https://newsroom.ubion.global';
    12|const ADMIN_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
    13|
    14|// JWT 토큰 생성 (Ghost Admin API)
    15|function generateGhostToken() {
    16|  const [id, secret] = ADMIN_API_KEY.split(':');
    17|  const secretBuffer = Buffer.from(secret, 'hex');
    18|  
    19|  const header = {
    20|    alg: 'HS256',
    21|    typ: 'JWT',
    22|    kid: id
    23|  };
    24|  
    25|  const now = Math.floor(Date.now() / 1000);
    26|  const payload = {
    27|    iat: now,
    28|    exp: now + 5 * 60,
    29|    aud: '/admin/'
    30|  };
    31|  
    32|  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    33|  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    34|  const signature = crypto
    35|    .createHmac('sha256', secretBuffer)
    36|    .update(`${base64Header}.${base64Payload}`)
    37|    .digest('base64url');
    38|  
    39|  return `${base64Header}.${base64Payload}.${signature}`;
    40|}
    41|
    42|// HTML 읽기 (body 부분만 추출)
    43|function extractGhostHTML() {
    44|  const htmlPath = path.join(__dirname, 'ai-education-debate.html');
    45|  const html = fs.readFileSync(htmlPath, 'utf-8');
    46|  
    47|  // <style> 태그와 내용 추출
    48|  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    49|  const styles = styleMatch ? styleMatch[1] : '';
    50|  
    51|  // <body> 내의 <div class="container">부터 추출
    52|  const containerMatch = html.match(/<div class="container">([\s\S]*?)<\/div>\s*<\/body>/);
    53|  let content = containerMatch ? containerMatch[1] : html;
    54|  
    55|  // 스타일을 인라인으로 포함
    56|  const fullHTML = `
    57|<style>
    58|${styles}
    59|</style>
    60|<div class="container">
    61|${content}
    62|</div>
    63|  `.trim();
    64|  
    65|  return fullHTML;
    66|}
    67|
    68|// Ghost에 포스트 생성
    69|async function createDraft() {
    70|  const token = generateGhostToken();
    71|  const html = extractGhostHTML();
    72|  
    73|  const post = {
    74|    title: '🎙️ AI 교육: 득이 될까, 실이 될까? (팟캐스트)',
    75|    html: html,
    76|    status: 'draft',
    77|    featured: false,
    78|    tags: [
    79|      { name: 'AI 교육' },
    80|      { name: '팟캐스트' },
    81|      { name: '토론' }
    82|    ],
    83|    meta_title: 'AI 교육: 득이 될까, 실이 될까? | 기술낙관론자 vs 회의론자',
    84|    meta_description: '기술낙관론자와 회의론자가 AI 교육의 득실을 놓고 벌이는 팟캐스트 토론. 계산기 비유부터 인지 위축까지, 4라운드 격론.',
    85|    custom_excerpt: 'AI 교육을 둘러싼 찬반 논쟁을 팟캐스트 형식으로 풀어봅니다.'
    86|  };
    87|  
    88|  try {
    89|    const response = await fetch(`${GHOST_URL}/ghost/api/admin/posts/?source=html`, {
    90|      method: 'POST',
    91|      headers: {
    92|        'Authorization': `Ghost ${token}`,
    93|        'Content-Type': 'application/json'
    94|      },
    95|      body: JSON.stringify({ posts: [post] })
    96|    });
    97|    
    98|    if (!response.ok) {
    99|      const error = await response.text();
   100|      throw new Error(`Ghost API error: ${response.status} - ${error}`);
   101|    }
   102|    
   103|    const result = await response.json();
   104|    const postId = result.posts[0].id;
   105|    const slug = result.posts[0].slug;
   106|    
   107|    console.log('✅ Ghost Draft 생성 완료!');
   108|    console.log(`   Post ID: ${postId}`);
   109|    console.log(`   Slug: ${slug}`);
   110|    console.log(`   Preview: ${GHOST_URL}/p/${slug}/`);
   111|    
   112|    return result;
   113|  } catch (error) {
   114|    console.error('❌ Ghost 발행 실패:', error.message);
   115|    throw error;
   116|  }
   117|}
   118|
   119|// 실행
   120|createDraft().catch(console.error);
   121|