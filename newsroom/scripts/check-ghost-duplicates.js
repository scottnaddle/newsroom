#!/usr/bin/env node
/**
 * Ghost CMS 발행 기사 중복성 검사
 * - 모든 발행된 기사 가져오기
 * - 제목/내용 유사도 계산
 * - 중복 기사 리포트
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Ghost API 설정
const GHOST_URL = 'https://askedtech.ghost.io';
const GHOST_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

// JWT 생성
function createJWT() {
  const [id, secret] = GHOST_API_KEY.split(':');
  const header = { alg: 'HS256', typ: 'JWT', kid: id };
  const payload = { iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, aud: '/admin/' };
  
  const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const headerB64 = base64url(header);
  const payloadB64 = base64url(payload);
  const signature = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${headerB64}.${payloadB64}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
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

// Levenshtein 거리 계산
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
  console.log('📊 Ghost CMS 발행 기사 중복성 검사\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 1. Ghost에서 모든 기사 가져오기
  console.log('🔄 Ghost에서 기사 가져오는 중...');
  const posts = await fetchGhostPosts();
  console.log(`✅ 총 ${posts.length}개 기사 발견\n`);
  
  if (posts.length === 0) {
    console.log('발행된 기사가 없습니다.');
    return;
  }
  
  // 2. 유사도 매트릭스 계산
  console.log('🔍 유사도 계산 중...\n');
  const duplicates = [];
  let checked = 0;
  
  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      const post1 = posts[i];
      const post2 = posts[j];
      
      const title1 = normalize(post1.title);
      const title2 = normalize(post2.title);
      const titleSimilarity = calculateSimilarity(title1, title2);
      
      // 내용 일부 비교 (처음 500자)
      const content1 = normalize((post1.html || post1.mobiledoc || '').substring(0, 500));
      const content2 = normalize((post2.html || post2.mobiledoc || '').substring(0, 500));
      const contentSimilarity = calculateSimilarity(content1, content2);
      
      // 평균 유사도
      const avgSimilarity = Math.round((titleSimilarity + contentSimilarity) / 2);
      
      if (avgSimilarity >= 70) {
        duplicates.push({
          post1: {
            id: post1.id,
            title: post1.title,
            url: post1.url,
            published: post1.published_at
          },
          post2: {
            id: post2.id,
            title: post2.title,
            url: post2.url,
            published: post2.published_at
          },
          titleSimilarity,
          contentSimilarity,
          avgSimilarity,
          level: avgSimilarity >= 95 ? '🔴 완전중복' : avgSimilarity >= 85 ? '🟠 고중복' : '🟡 유사'
        });
      }
      
      checked++;
      if (checked % 100 === 0) {
        console.log(`  ${checked}/${posts.length * (posts.length - 1) / 2} 쌍 비교 완료...`);
      }
    }
  }
  
  // 3. 결과 정렬 (유사도 높은 순)
  duplicates.sort((a, b) => b.avgSimilarity - a.avgSimilarity);
  
  // 4. 리포트 출력
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📊 중복성 분석 결과\n`);
  console.log(`총 검사 쌍: ${posts.length * (posts.length - 1) / 2}개`);
  console.log(`발견된 중복: ${duplicates.length}쌍\n`);
  
  if (duplicates.length === 0) {
    console.log('✅ 중복 기사 없음! 모든 기사가 유니크합니다.\n');
    return;
  }
  
  // 레벨별 카운트
  const critical = duplicates.filter(d => d.avgSimilarity >= 95).length;
  const high = duplicates.filter(d => d.avgSimilarity >= 85 && d.avgSimilarity < 95).length;
  const medium = duplicates.filter(d => d.avgSimilarity >= 70 && d.avgSimilarity < 85).length;
  
  console.log(`🔴 완전중복 (95%+): ${critical}쌍`);
  console.log(`🟠 고중복 (85-94%): ${high}쌍`);
  console.log(`🟡 유사 (70-84%): ${medium}쌍\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 상세 목록:\n');
  
  duplicates.slice(0, 20).forEach((dup, idx) => {
    console.log(`${idx + 1}. ${dup.level} (${dup.avgSimilarity}% 유사)`);
    console.log(`   📰 기사 A: ${dup.post1.title}`);
    console.log(`      URL: ${dup.post1.url}`);
    console.log(`      발행: ${new Date(dup.post1.published).toLocaleDateString('ko-KR')}`);
    console.log(`   📰 기사 B: ${dup.post2.title}`);
    console.log(`      URL: ${dup.post2.url}`);
    console.log(`      발행: ${new Date(dup.post2.published).toLocaleDateString('ko-KR')}`);
    console.log(`   📊 제목 유사도: ${dup.titleSimilarity}%, 내용 유사도: ${dup.contentSimilarity}%\n`);
  });
  
  if (duplicates.length > 20) {
    console.log(`... 그 외 ${duplicates.length - 20}쌍 더 있음\n`);
  }
  
  // 5. JSON으로 저장
  const reportPath = '/root/.openclaw/workspace/newsroom/pipeline/GHOST_DUPLICATES_REPORT.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalPosts: posts.length,
    totalPairsChecked: posts.length * (posts.length - 1) / 2,
    duplicatesFound: duplicates.length,
    critical,
    high,
    medium,
    duplicates: duplicates.map(d => ({
      ...d,
      recommendation: d.avgSimilarity >= 95 ? 'DELETE_ONE' : d.avgSimilarity >= 85 ? 'REVIEW_NEEDED' : 'MONITOR'
    }))
  }, null, 2));
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`📄 전체 리포트 저장됨: ${reportPath}\n`);
}

main().catch(console.error);
