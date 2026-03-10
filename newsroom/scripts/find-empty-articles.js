#!/usr/bin/env node
/**
 * find-empty-articles.js
 * 
 * Ghost CMS의 발행된 기사 중 내용이 없거나 부족한 기사를 찾기
 * 
 * 용도: 오케스트레이터 STEP 3 미실행으로 인한 문제 기사 식별
 * 출력: 내용 부족 기사 목록 (ID, 제목, 문자수)
 */

const https = require('https');
const crypto = require('crypto');

const GHOST_URL = 'https://insight.ubion.global';
const GHOST_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

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
    url.searchParams.append('include', 'authors,tags');
    url.searchParams.append('limit', '100');

    const opts = {
      hostname: url.hostname,
      path: url.pathname + '?' + url.searchParams.toString(),
      method: 'GET',
      headers: {
        'Authorization': `Ghost ${generateJWT()}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${e.message}`));
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
  console.log('🔍 Ghost CMS 발행된 기사 내용 점검 시작\n');

  try {
    // Ghost API 호출: published 포스트 조회
    console.log('📡 Ghost API 호출 중...');
    const response = await callGhostAPI('/ghost/api/v3/admin/posts/', {
      filter: "status:published",
      limit: 200
    });

    const posts = response.posts || [];
    console.log(`✓ 총 ${posts.length}개 발행된 기사 조회\n`);

    // 내용 부족 기사 찾기
    const emptyArticles = [];
    
    for (const post of posts) {
      const html = post.html || '';
      const plainText = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const charCount = plainText.length;

      // 1000자 미만 또는 내용 거의 없음
      if (charCount < 1000) {
        emptyArticles.push({
          id: post.id,
          title: post.title,
          slug: post.slug,
          charCount: charCount,
          status: post.status,
          hasLeadBox: html.includes('border-left:4px solid'),
          hasH2: (html.match(/<h2/g) || []).length > 0,
          hasCitation: html.includes('AI가 작성했습니다'),
          url: post.canonical_url || `${GHOST_URL}/${post.slug}/`
        });
      }
    }

    // 결과 출력
    console.log(`⚠️  내용 부족 기사 (1000자 미만): ${emptyArticles.length}개\n`);

    if (emptyArticles.length === 0) {
      console.log('✅ 내용 부족한 기사 없음!');
      process.exit(0);
    }

    // 정렬: 문자수 오름차순
    emptyArticles.sort((a, b) => a.charCount - b.charCount);

    // 테이블 형식으로 출력
    console.log('┌─────┬─────────────────────────────────┬──────┬──────┬──────┬────────┐');
    console.log('│ 순# │ 제목                              │ 문자 │ 리드 │ h2   │ AI각주 │');
    console.log('├─────┼─────────────────────────────────┼──────┼──────┼──────┼────────┤');

    emptyArticles.slice(0, 15).forEach((art, idx) => {
      const title = art.title.substring(0, 30).padEnd(30);
      const lead = art.hasLeadBox ? '✓' : '✗';
      const h2 = art.hasH2 ? '✓' : '✗';
      const cite = art.hasCitation ? '✓' : '✗';
      console.log(`│ ${String(idx + 1).padStart(3)} │ ${title} │ ${String(art.charCount).padStart(4)} │ ${lead.padEnd(4)} │ ${h2.padEnd(4)} │ ${cite.padEnd(6)} │`);
    });

    console.log('└─────┴─────────────────────────────────┴──────┴──────┴──────┴────────┘\n');

    // 상세 정보 출력
    console.log('📋 상세 목록:\n');
    emptyArticles.slice(0, 20).forEach((art, idx) => {
      console.log(`${idx + 1}. [${art.charCount}자] ${art.title}`);
      console.log(`   ID: ${art.id}`);
      console.log(`   Slug: ${art.slug}`);
      console.log(`   필수요소: 리드박스=${art.hasLeadBox ? '✓' : '✗'}, H2섹션=${art.hasH2 ? '✓' : '✗'}, AI각주=${art.hasCitation ? '✓' : '✗'}`);
      console.log('');
    });

    // 요약
    console.log('═══════════════════════════════════════════');
    console.log(`📊 요약:`);
    console.log(`- 총 발행된 기사: ${posts.length}개`);
    console.log(`- 내용 부족 기사: ${emptyArticles.length}개 (${((emptyArticles.length / posts.length) * 100).toFixed(1)}%)`);
    console.log(`- 평균 부족 문자수: ${(emptyArticles.reduce((a, b) => a + b.charCount, 0) / emptyArticles.length).toFixed(0)}자`);
    
    // 미충족 요소 분석
    const noLeadBox = emptyArticles.filter(a => !a.hasLeadBox).length;
    const noH2 = emptyArticles.filter(a => !a.hasH2).length;
    const noCitation = emptyArticles.filter(a => !a.hasCitation).length;
    
    console.log(`\n🔴 미충족 요소:`);
    console.log(`- 리드박스 없음: ${noLeadBox}개`);
    console.log(`- H2 섹션 없음: ${noH2}개`);
    console.log(`- AI 각주 없음: ${noCitation}개`);

    // JSON 저장
    const fs = require('fs');
    const outputFile = '/root/.openclaw/workspace/newsroom/pipeline/empty-articles-report.json';
    fs.writeFileSync(outputFile, JSON.stringify(emptyArticles, null, 2));
    console.log(`\n💾 보고서 저장: ${outputFile}`);

  } catch (err) {
    console.error(`❌ 오류: ${err.message}`);
    process.exit(1);
  }
}

main();
