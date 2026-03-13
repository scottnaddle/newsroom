#!/usr/bin/env node
/**
 * Ghost에서 발행된 기사 중복성 검사
 * 사용법: node find-duplicate-articles.js
 */

const https = require('https');
const fs = require('fs');

const GHOST_CONFIG = {
  host: 'ubion.ghost.io',
  version: 'v5.0'
};

/**
 * Ghost API 요청 (Content API - 인증 불필요)
 */
function ghostRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: GHOST_CONFIG.host,
      path: `/ghost/api/${GHOST_CONFIG.version}${path}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Ghost API Error (${res.statusCode})`));
        } else {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

/**
 * 문자열 정규화 (중복 비교용)
 */
function normalize(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * 제목 유사도 계산 (Levenshtein distance)
 */
function similarity(str1, str2) {
  const s1 = normalize(str1);
  const s2 = normalize(str2);
  
  if (s1 === s2) return 1;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(s1, s2) {
  const costs = [];
  
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  
  return costs[s2.length];
}

/**
 * 중복 기사 찾기
 */
async function findDuplicates() {
  try {
    console.log('📖 Ghost에서 발행된 기사 조회 중...\n');
    
    const result = await ghostRequest('/posts/?filter=status:published&limit=500&include=tags');
    
    if (!result.posts) {
      console.log('❌ 기사가 없습니다.');
      return;
    }
    
    const articles = result.posts;
    console.log(`✅ 총 ${articles.length}개 기사 찾음\n`);
    
    // 중복 찾기
    const duplicateGroups = [];
    const checked = new Set();
    
    for (let i = 0; i < articles.length; i++) {
      if (checked.has(articles[i].id)) continue;
      
      const group = [articles[i]];
      const sim = similarity(articles[i].title, articles[i].title);
      
      for (let j = i + 1; j < articles.length; j++) {
        if (checked.has(articles[j].id)) continue;
        
        const sim2 = similarity(articles[i].title, articles[j].title);
        
        // 유사도 90% 이상이면 중복
        if (sim2 >= 0.90) {
          group.push(articles[j]);
          checked.add(articles[j].id);
        }
      }
      
      if (group.length > 1) {
        duplicateGroups.push(group);
        checked.add(articles[i].id);
      }
    }
    
    if (duplicateGroups.length === 0) {
      console.log('✅ 중복 기사가 없습니다!\n');
      return;
    }
    
    console.log(`🔴 중복 기사 발견: ${duplicateGroups.length}그룹\n`);
    console.log('═'.repeat(100));
    
    let totalDuplicates = 0;
    
    duplicateGroups.forEach((group, groupIdx) => {
      console.log(`\n그룹 ${groupIdx + 1}: ${group.length}개 중복 기사`);
      console.log('─'.repeat(100));
      
      group.forEach((article, idx) => {
        const tags = article.tags ? article.tags.map(t => t.name).join(', ') : 'N/A';
        console.log(`\n${idx === 0 ? '✓ (유지)' : '✗ (Draft로)'} [${idx + 1}] ${article.title}`);
        console.log(`   ID: ${article.id}`);
        console.log(`   발행일: ${new Date(article.published_at).toLocaleString('ko-KR')}`);
        console.log(`   카테고리: ${tags}`);
        console.log(`   URL: https://ubion.ghost.io${article.url}`);
      });
      
      totalDuplicates += group.length - 1;
    });
    
    console.log('\n═'.repeat(100));
    console.log(`\n📊 정리 결과:`);
    console.log(`   - 중복 그룹: ${duplicateGroups.length}개`);
    console.log(`   - Draft로 옮길 기사: ${totalDuplicates}개`);
    console.log(`   - 유지될 기사: ${duplicateGroups.length}개`);
    console.log(`\n💾 상세 정보 저장 중...`);
    
    // 결과 저장
    const reportData = {
      timestamp: new Date().toISOString(),
      totalArticles: articles.length,
      duplicateGroups: duplicateGroups.length,
      articlesToMove: totalDuplicates,
      groups: duplicateGroups.map((group, idx) => ({
        groupId: idx + 1,
        keep: {
          id: group[0].id,
          title: group[0].title,
          publishedAt: group[0].published_at
        },
        moveToDraft: group.slice(1).map(a => ({
          id: a.id,
          title: a.title,
          publishedAt: a.published_at,
          url: a.url
        }))
      }))
    };
    
    fs.writeFileSync(
      '/root/.openclaw/workspace/newsroom/pipeline/_status/duplicate-analysis.json',
      JSON.stringify(reportData, null, 2)
    );
    
    console.log(`✅ 분석 결과: /newsroom/pipeline/_status/duplicate-analysis.json\n`);
    
    console.log('🔧 Draft로 옮기려면 다음 명령어를 실행하세요:');
    console.log('   node move-duplicates-to-draft.js\n');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

findDuplicates().catch(console.error);
