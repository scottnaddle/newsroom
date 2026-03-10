#!/usr/bin/env node
/**
 * 스크린샷에서 지적된 3개 기사 상세 비교
 */

const fs = require('fs');
const path = require('path');

const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';

// 텍스트 정규화
function normalize(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w가-힣\s]/g, '')
    .toLowerCase()
    .trim();
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

// 유사도 계산
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 100;
  const distance = levenshteinDistance(str1, str2);
  return Math.round((1 - distance / maxLength) * 100);
}

// 모든 기사 로드
const files = fs.readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.json'));
const articles = files.map(file => {
  const filePath = path.join(PUBLISHED_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return {
    file,
    headline: data.draft?.headline || data.source?.title || '',
    subheadline: data.draft?.subheadline || '',
    content: data.draft?.html || '',
    url: data.draft?.ghost_url || data.source?.url || '',
    ghost_id: data.ghost_id || data.id || '',
    published: data.published_at || data.created_at || '',
    source: data.source?.source_name || '',
    source_title: data.source?.title || ''
  };
});

console.log('📊 발행된 18개 기사 제목 분석\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// "윤리", "가이드라인", "교육부" 포함 기사 찾기
const keywordArticles = articles.filter(a => {
  const text = normalize(a.headline + ' ' + a.subheadline + ' ' + a.source_title);
  return text.includes('윤리') || text.includes('가이드라인') || text.includes('교육부');
});

console.log(`🔍 "윤리/가이드라인/교육부" 키워드 포함 기사: ${keywordArticles.length}개\n`);

keywordArticles.forEach((article, idx) => {
  console.log(`${idx + 1}. ${article.headline}`);
  console.log(`   부제: ${article.subheadline}`);
  console.log(`   파일: ${article.file}`);
  console.log(`   소스: ${article.source}`);
  console.log(`   원제: ${article.source_title}`);
  console.log(`   발행: ${article.published}`);
  console.log();
});

if (keywordArticles.length >= 2) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔍 유사도 상세 분석\n');
  
  // 모든 쌍 비교
  for (let i = 0; i < keywordArticles.length; i++) {
    for (let j = i + 1; j < keywordArticles.length; j++) {
      const a1 = keywordArticles[i];
      const a2 = keywordArticles[j];
      
      const titleSim = calculateSimilarity(normalize(a1.headline), normalize(a2.headline));
      const contentSim = calculateSimilarity(
        normalize(a1.content.substring(0, 1000)),
        normalize(a2.content.substring(0, 1000))
      );
      const avgSim = Math.round((titleSim + contentSim) / 2);
      
      if (avgSim >= 50) {
        console.log(`📊 기사 ${i + 1} vs 기사 ${j + 1}:`);
        console.log(`   제목 유사도: ${titleSim}%`);
        console.log(`   내용 유사도: ${contentSim}%`);
        console.log(`   평균 유사도: ${avgSim}%`);
        console.log(`   판정: ${avgSim >= 95 ? '🔴 완전중복' : avgSim >= 85 ? '🟠 고중복' : avgSim >= 70 ? '🟡 유사' : '✅ 다름'}`);
        console.log();
      }
    }
  }
}

// 전체 기사 유사도 매트릭스
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📊 전체 기사 유사도 매트릭스 (70% 이상만 표시)\n');

const highSimilarity = [];
for (let i = 0; i < articles.length; i++) {
  for (let j = i + 1; j < articles.length; j++) {
    const a1 = articles[i];
    const a2 = articles[j];
    
    const titleSim = calculateSimilarity(normalize(a1.headline), normalize(a2.headline));
    const contentSim = calculateSimilarity(
      normalize(a1.content.substring(0, 1000)),
      normalize(a2.content.substring(0, 1000))
    );
    const avgSim = Math.round((titleSim + contentSim) / 2);
    
    if (avgSim >= 70) {
      highSimilarity.push({
        idx1: i + 1,
        idx2: j + 1,
        title1: a1.headline.substring(0, 50),
        title2: a2.headline.substring(0, 50),
        file1: a1.file,
        file2: a2.file,
        titleSim,
        contentSim,
        avgSim
      });
    }
  }
}

if (highSimilarity.length === 0) {
  console.log('✅ 70% 이상 유사한 기사 없음\n');
} else {
  highSimilarity.sort((a, b) => b.avgSim - a.avgSim);
  
  highSimilarity.forEach((pair, idx) => {
    console.log(`${idx + 1}. 유사도 ${pair.avgSim}% (제목: ${pair.titleSim}%, 내용: ${pair.contentSim}%)`);
    console.log(`   기사 ${pair.idx1}: ${pair.title1}...`);
    console.log(`   기사 ${pair.idx2}: ${pair.title2}...`);
    console.log(`   파일1: ${pair.file1}`);
    console.log(`   파일2: ${pair.file2}`);
    console.log();
  });
  
  console.log(`총 ${highSimilarity.length}쌍 발견\n`);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📋 전체 기사 목록:\n');
articles.forEach((article, idx) => {
  console.log(`${idx + 1}. ${article.headline}`);
  console.log(`   파일: ${article.file}`);
  console.log(`   소스: ${article.source}`);
  console.log();
});
