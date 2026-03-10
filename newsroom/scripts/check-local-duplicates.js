#!/usr/bin/env node
/**
 * 로컬 발행 기사 중복성 검사
 * - 08-published 폴더의 모든 JSON 파일 검사
 * - 제목/내용 유사도 계산
 * - 중복 기사 리포트
 */

const fs = require('fs');
const path = require('path');

const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';

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
  console.log('📊 발행 기사 중복성 검사\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 1. 모든 JSON 파일 로드
  console.log('🔄 발행된 기사 로드 중...');
  const files = fs.readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.json'));
  console.log(`✅ 총 ${files.length}개 기사 발견\n`);
  
  if (files.length === 0) {
    console.log('발행된 기사가 없습니다.');
    return;
  }
  
  // 2. 기사 데이터 로드
  const articles = files.map(file => {
    const filePath = path.join(PUBLISHED_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      file,
      title: data.title || '',
      content: data.html || data.content || '',
      url: data.url || '',
      published: data.published_at || data.created_at || '',
      ghost_id: data.ghost_id || data.id || ''
    };
  });
  
  // 3. 유사도 매트릭스 계산
  console.log('🔍 유사도 계산 중...\n');
  const duplicates = [];
  let checked = 0;
  
  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      const article1 = articles[i];
      const article2 = articles[j];
      
      const title1 = normalize(article1.title);
      const title2 = normalize(article2.title);
      const titleSimilarity = calculateSimilarity(title1, title2);
      
      // 내용 일부 비교 (처음 1000자)
      const content1 = normalize(article1.content.substring(0, 1000));
      const content2 = normalize(article2.content.substring(0, 1000));
      const contentSimilarity = calculateSimilarity(content1, content2);
      
      // 평균 유사도
      const avgSimilarity = Math.round((titleSimilarity + contentSimilarity) / 2);
      
      if (avgSimilarity >= 70) {
        duplicates.push({
          article1: {
            file: article1.file,
            title: article1.title,
            url: article1.url,
            ghost_id: article1.ghost_id,
            published: article1.published
          },
          article2: {
            file: article2.file,
            title: article2.title,
            url: article2.url,
            ghost_id: article2.ghost_id,
            published: article2.published
          },
          titleSimilarity,
          contentSimilarity,
          avgSimilarity,
          level: avgSimilarity >= 95 ? '🔴 완전중복' : avgSimilarity >= 85 ? '🟠 고중복' : '🟡 유사'
        });
      }
      
      checked++;
      if (checked % 50 === 0) {
        console.log(`  ${checked}/${articles.length * (articles.length - 1) / 2} 쌍 비교 완료...`);
      }
    }
  }
  
  // 4. 결과 정렬 (유사도 높은 순)
  duplicates.sort((a, b) => b.avgSimilarity - a.avgSimilarity);
  
  // 5. 리포트 출력
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📊 중복성 분석 결과\n`);
  console.log(`총 검사 쌍: ${articles.length * (articles.length - 1) / 2}개`);
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
  
  duplicates.forEach((dup, idx) => {
    console.log(`${idx + 1}. ${dup.level} (${dup.avgSimilarity}% 유사)`);
    console.log(`   📰 기사 A: ${dup.article1.title}`);
    console.log(`      파일: ${dup.article1.file}`);
    console.log(`      URL: ${dup.article1.url || 'N/A'}`);
    console.log(`      Ghost ID: ${dup.article1.ghost_id || 'N/A'}`);
    console.log(`   📰 기사 B: ${dup.article2.title}`);
    console.log(`      파일: ${dup.article2.file}`);
    console.log(`      URL: ${dup.article2.url || 'N/A'}`);
    console.log(`      Ghost ID: ${dup.article2.ghost_id || 'N/A'}`);
    console.log(`   📊 제목 유사도: ${dup.titleSimilarity}%, 내용 유사도: ${dup.contentSimilarity}%\n`);
  });
  
  // 6. JSON으로 저장
  const reportPath = '/root/.openclaw/workspace/newsroom/pipeline/LOCAL_DUPLICATES_REPORT.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalArticles: articles.length,
    totalPairsChecked: articles.length * (articles.length - 1) / 2,
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
  
  // 7. 권장사항
  if (critical > 0) {
    console.log('⚠️ 조치 권장사항:\n');
    console.log('🔴 완전중복 기사는 Ghost에서 하나를 삭제하는 것을 권장합니다.');
    console.log('   - 보통 더 나중에 발행된 버전을 유지합니다.\n');
  }
}

main().catch(console.error);
