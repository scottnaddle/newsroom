#!/usr/bin/env node
/**
 * Ghost CMS 발행 기사 중복 확인 및 삭제
 */

const GHOST_URL = 'https://askedtech.ghost.io';
const GHOST_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

const https = require('https');

const crypto = require('crypto');

const fs = require('fs');
const path = require('path');

const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';

const REPORTFile = '/root/.openclaw/workspace/newsroom/pipeline/GHOST_DUPLICATES_REPORT.json';

// JWT 생성
function createJWT() {
  const [id, secret] = GHOST_API_KEY.split(':');
  const header = { alg: 'HS256', typ: 'JWT', kid: id };
  const payload = { 
    iat: Math.floor(Date.now() / 1000), 
    exp: Math.floor(Date.now() / 1000) + 300, 
    aud: '/admin/' 
  };
  
  const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  const headerB64 = base64url(header);
  const payloadB64 = base64url(payload);
  const signature = crypto.createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  return `${headerB64}.${payloadB64}.${signature}`;
}

// Ghost API 호출
async function fetchGhostPosts() {
  const token = createJWT();
  const response = await fetch(`${GHOST_URL}/ghost/api/admin/posts/?limit=all&formats=mobiledoc,html`, {
    headers: {
      'Authorization': `Ghost ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Ghost API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.posts;
}

 // Levenshtein 거리
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}
 // 유사도 계산 (0-100%)
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 100;
  const distance = levenshteinDistance(str1, str2);
  return Math.round((1 - distance / maxLength) * 100);
}
 // 텍스트 정규화
function normalize(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w가-힣\s]/g, '')
    .toLowerCase()
    .trim();
}
 // 메인 실행
async function main() {
  console.log('🔍 Ghost CMS에서 기사 가져오는 중...\n');
  
  const posts = await fetchGhostPosts();
  console.log(`✅ ${posts.length}개 기사 발견\n`);
  
  // 중복 체크
  const duplicates = [];
  const checked = new Set();
  
  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      const pairKey = `${i}-${j}`;
      if (checked.has(pairKey)) continue;
      checked.add(pairKey);
      
      const title1 = normalize(posts[i].title);
      const title2 = normalize(posts[j].title);
      const titleSim = calculateSimilarity(title1, title2);
      
      // 내용 비교 (처음 500자)
      const html1 = posts[i].html || posts[i].mobiledoc || '';
      const html2 = posts[j].html || posts[j].mobiledoc || '';
      const content1 = normalize(html1.substring(0, 500));
      const content2 = normalize(html2.substring(0, 500));
      const contentSim = calculateSimilarity(content1, content2);
      
      // 평균 유사도
      const avgSim = Math.round((titleSim + contentSim) / 2);
      
      if (avgSim >= 85) {
        duplicates.push({
          post1: {
            id: posts[i].id,
            title: posts[i].title,
            url: posts[i].url,
            published: posts[i].published_at
          },
          post2: {
            id: posts[j].id,
            title: posts[j].title,
            url: posts[j].url,
            published: posts[j].published_at
          },
          titleSimilarity: titleSim,
          contentSimilarity: contentSim,
          avgSimilarity: avgSim,
          level: avgSim >= 95 ? '🔴 완전중복' : avgSim >= 85 ? '🟠 고중복' : '🟡 유사'
        });
      }
    }
  }
  
  // 결과 출력
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📊 중복성 분석 결과\n`);
  console.log(`총 기사: ${posts.length}개`);
  console.log(`발견된 중복: ${duplicates.length}쌍\n\n`);
  
  if (duplicates.length === 0) {
    console.log('✅ 중복 기사 없음! 모든 기사가 유니크합니다.\n');
    return;
  }
  
  // 레벨별 카운트
  const critical = duplicates.filter(d => d.avgSimilarity >= 95).length;
  const high = duplicates.filter(d => d.avgSimilarity >= 85 && d.avgSimilarity < 95).length;
  
  console.log(`🔴 완전중복 (95%+): ${critical}쌍`);
  console.log(`🟠 고중복 (85-94%): ${high}쌍\n`);
  
  // 상세 목록
  console.log('\n📋 상세 목록:\n');
  duplicates.forEach((dup, idx) => {
    console.log(`\n${idx + 1}. ${dup.level} (${dup.avgSimilarity}% 유사)`);
    console.log(`   기사 1: ${dup.post1.title}`);
    console.log(`   URL: ${dup.post1.url}`);
    console.log(`   ID: ${dup.post1.id}`);
    console.log(`   기사 2: ${dup.post2.title}`);
    console.log(`   URL: ${dup.post2.url}`);
    console.log(`   ID: ${dup.post2.id}`);
    console.log(`   제목: ${dup.titleSimilarity}%, 내용: ${dup.contentSimilarity}%`);
  });
  
  // 리포트 저장
  const report = {
    generatedAt: new Date().toISOString(),
    totalPosts: posts.length,
    duplicatesFound: duplicates.length,
    critical,
    high,
    duplicates: duplicates.map(d => ({
      ...d,
      recommendation: d.avgSimilarity >= 95 ? 'DELETE_ONE' : 'REVIEW_NEEDED'
    }))
  };
  
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n📄 리포트 저장됨: ${reportFile}\n`);
  
  // 삭제 옵션 제공
  if (duplicates.length > 0) {
    console.log('\n⚠️ 삭제 권장사항:');
    console.log('완전중복 (95%+)인 경우 더 나중에 발행된 버전을 유지하고 이전 버전을 삭제하는 것을 권장합니다.');
    console.log('Ghost Admin에서 삭제하려면:');
    console.log('1. Ghost Admin 접속: https://askedtech.ghost.io/ghost/');
    console.log('2. 해당 기사 편집 → Delete');
    console.log('3. 또는 아래 API로 삭제 가능:');
    console.log(`   curl -X DELETE "${GHOST_URL}/ghost/api/admin/posts/{POST_ID}/" \\`);
    console.log(`     -H "Authorization: Ghost ${createJWT()}" \\`);
  }
}

}

  
  main().catch(error => {
    console.error('❌ 오류:', error);
  });
})();

(blocked) error 발생: call will retry the tool. Use the 'node scripts/check-ghost-duplicates-v2.js'. (runtime= ~65s, yieldMs: 60000)
 background: true