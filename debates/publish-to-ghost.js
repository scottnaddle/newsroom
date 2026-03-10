#!/usr/bin/env node
/**
 * AI 교육 토론을 Ghost Draft로 발행
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Ghost 설정
const GHOST_URL = 'https://ubion.ghost.io';
const ADMIN_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

// JWT 토큰 생성 (Ghost Admin API)
function generateGhostToken() {
  const [id, secret] = ADMIN_API_KEY.split(':');
  const secretBuffer = Buffer.from(secret, 'hex');
  
  const header = {
    alg: 'HS256',
    typ: 'JWT',
    kid: id
  };
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + 5 * 60,
    aud: '/admin/'
  };
  
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secretBuffer)
    .update(`${base64Header}.${base64Payload}`)
    .digest('base64url');
  
  return `${base64Header}.${base64Payload}.${signature}`;
}

// HTML 읽기 (body 부분만 추출)
function extractGhostHTML() {
  const htmlPath = path.join(__dirname, 'ai-education-debate.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  
  // <style> 태그와 내용 추출
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const styles = styleMatch ? styleMatch[1] : '';
  
  // <body> 내의 <div class="container">부터 추출
  const containerMatch = html.match(/<div class="container">([\s\S]*?)<\/div>\s*<\/body>/);
  let content = containerMatch ? containerMatch[1] : html;
  
  // 스타일을 인라인으로 포함
  const fullHTML = `
<style>
${styles}
</style>
<div class="container">
${content}
</div>
  `.trim();
  
  return fullHTML;
}

// Ghost에 포스트 생성
async function createDraft() {
  const token = generateGhostToken();
  const html = extractGhostHTML();
  
  const post = {
    title: '🎙️ AI 교육: 득이 될까, 실이 될까? (팟캐스트)',
    html: html,
    status: 'draft',
    featured: false,
    tags: [
      { name: 'AI 교육' },
      { name: '팟캐스트' },
      { name: '토론' }
    ],
    meta_title: 'AI 교육: 득이 될까, 실이 될까? | 기술낙관론자 vs 회의론자',
    meta_description: '기술낙관론자와 회의론자가 AI 교육의 득실을 놓고 벌이는 팟캐스트 토론. 계산기 비유부터 인지 위축까지, 4라운드 격론.',
    custom_excerpt: 'AI 교육을 둘러싼 찬반 논쟁을 팟캐스트 형식으로 풀어봅니다.'
  };
  
  try {
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
    const postId = result.posts[0].id;
    const slug = result.posts[0].slug;
    
    console.log('✅ Ghost Draft 생성 완료!');
    console.log(`   Post ID: ${postId}`);
    console.log(`   Slug: ${slug}`);
    console.log(`   Preview: ${GHOST_URL}/p/${slug}/`);
    
    return result;
  } catch (error) {
    console.error('❌ Ghost 발행 실패:', error.message);
    throw error;
  }
}

// 실행
createDraft().catch(console.error);
