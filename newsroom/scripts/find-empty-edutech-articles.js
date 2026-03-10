#!/usr/bin/env node
/**
 * find-empty-edutech-articles.js
 * 
 * Ghost의 에듀테크(AI) 태그가 있는 기사 중
 * 내용이 없거나 부족한 기사들을 찾기
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const CONFIG_FILE = '/root/.openclaw/workspace/newsroom/shared/config/ghost.json';
const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const GHOST_URL = config.apiUrl;
const GHOST_API_KEY = config.adminApiKey;

// ─── JWT 생성 ──────────────────────────────────────────────────
function generateJWT() {
  const [kid, secret] = GHOST_API_KEY.split(':');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid, typ: 'JWT' })).toString('base64');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: kid,
    aud: '/admin/',
    exp: now + 300
  })).toString('base64');
  const message = [header, payload].join('.');
  const signature = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(message)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return [message, signature].join('.');
}

// ─── Ghost API 호출 ──────────────────────────────────────────
function callGhostAPI(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(GHOST_URL + path);
    
    // Query params 추가
    url.searchParams.append('include', 'authors,tags');
    url.searchParams.append('limit', '200');
    url.searchParams.append('status', 'published');

    const opts = {
      hostname: url.hostname,
      path: url.pathname + '?' + url.searchParams.toString(),
      method: 'GET',
      headers: {
        'Authorization': `Ghost ${generateJWT()}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// ─── 메인 ────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Ghost 에듀테크(AI) 기사 내용 검사 시작\n');

  try {
    // Ghost 모든 published 기사 조회
    console.log('📡 Ghost API 호출 중...');
    const response = await callGhostAPI('/ghost/api/v3/admin/posts/');

    const posts = response.posts || [];
    console.log(`✓ 총 ${posts.length}개 발행된 기사\n`);

    // 에듀테크(AI) 기사 필터링
    const edutechArticles = [];
    
    for (const post of posts) {
      const tags = post.tags || [];
      const title = post.title || '';
      
      // 태그나 제목으로 에듀테크(AI) 판단
      const isEdutechAI = tags.some(t => 
        t.name?.includes('education') || 
        t.name?.includes('edtech') ||
        t.name?.includes('AI') ||
        t.slug?.includes('education') ||
        t.slug?.includes('ai')
      ) || title.includes('교육') || title.includes('AI');

      if (isEdutechAI) {
        const html = post.html || '';
        const plainText = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        const charCount = plainText.length;

        edutechArticles.push({
          id: post.id,
          title: post.title,
          slug: post.slug,
          charCount: charCount,
          status: post.status,
          published_at: post.published_at,
          tags: tags.map(t => t.name),
          html: html,
          hasContent: charCount > 500
        });
      }
    }

    console.log(`\n📚 에듀테크(AI) 기사: ${edutechArticles.length}개\n`);

    // 내용 없는 기사 필터링
    const emptyArticles = edutechArticles.filter(a => a.charCount < 1000);
    
    console.log(`⚠️  내용 부족 기사 (1000자 미만): ${emptyArticles.length}개\n`);

    if (emptyArticles.length === 0) {
      console.log('✅ 내용 부족한 기사 없음!');
      process.exit(0);
    }

    // 정렬: 문자수 오름차순
    emptyArticles.sort((a, b) => a.charCount - b.charCount);

    // 테이블 출력
    console.log('┌─────┬────────┬──────────────────────────────────────┐');
    console.log('│ 순# │ 문자수 │ 제목                                 │');
    console.log('├─────┼────────┼──────────────────────────────────────┤');

    emptyArticles.forEach((art, idx) => {
      const title = art.title.substring(0, 35).padEnd(35);
      console.log(`│ ${String(idx + 1).padStart(3)} │ ${String(art.charCount).padStart(4)}자 │ ${title} │`);
    });

    console.log('└─────┴────────┴──────────────────────────────────────┘\n');

    // 상세 정보
    console.log('📋 상세 정보:\n');
    
    emptyArticles.slice(0, 10).forEach((art, idx) => {
      console.log(`${idx + 1}. ${art.title}`);
      console.log(`   ID: ${art.id}`);
      console.log(`   Slug: ${art.slug}`);
      console.log(`   문자수: ${art.charCount}자`);
      console.log(`   태그: ${art.tags.join(', ')}`);
      console.log(`   발행일: ${art.published_at?.substring(0, 10)}`);
      console.log('');
    });

    // JSON 저장
    const reportFile = '/root/.openclaw/workspace/newsroom/pipeline/empty-edutechai-articles.json';
    fs.writeFileSync(reportFile, JSON.stringify(emptyArticles, null, 2));
    console.log(`💾 보고서 저장: ${reportFile}`);

  } catch (err) {
    console.error(`❌ 오류: ${err.message}`);
    process.exit(1);
  }
}

main();
