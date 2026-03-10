#!/usr/bin/env node
/**
 * 로컬 파이프라인에서 발행된 기사 중복성 검사
 * 사용법: node find-duplicates-local.js
 */

const fs = require('fs');
const path = require('path');

const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';

/**
 * 문자열 정규화 (중복 비교용)
 */
function normalize(str) {
  if (!str) return '';
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
  
  if (!s1 || !s2) return 0;
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
    console.log('📖 로컬 파이프라인에서 발행된 기사 조회 중...\n');
    
    // 파일 읽기
    const files = fs.readdirSync(PUBLISHED_DIR)
      .filter(f => f.endsWith('.json'));
    
    if (files.length === 0) {
      console.log('❌ 발행된 기사가 없습니다.');
      return;
    }
    
    console.log(`✅ 총 ${files.length}개 기사 찾음\n`);
    
    // 기사 로드
    const articles = [];
    files.forEach(file => {
      try {
        const content = JSON.parse(
          fs.readFileSync(path.join(PUBLISHED_DIR, file), 'utf8')
        );
        
        articles.push({
          filename: file,
          id: content.id,
          headline: content.draft?.headline || '제목 없음',
          ghost_tags: content.draft?.ghost_tags || [],
          article_type: content.draft?.article_type || 'education',
          publish_result: content.publish_result || {},
          created_at: content.created_at
        });
      } catch (e) {
        console.error(`파일 로드 오류 (${file}):`, e.message);
      }
    });
    
    console.log(`🔍 기사 분석 중...\n`);
    
    // 중복 찾기
    const duplicateGroups = [];
    const checked = new Set();
    
    for (let i = 0; i < articles.length; i++) {
      if (checked.has(articles[i].id)) continue;
      
      const group = [articles[i]];
      
      for (let j = i + 1; j < articles.length; j++) {
        if (checked.has(articles[j].id)) continue;
        
        const sim = similarity(articles[i].headline, articles[j].headline);
        
        // 유사도 85% 이상이면 중복
        if (sim >= 0.85) {
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
    console.log('═'.repeat(120));
    
    let totalDuplicates = 0;
    
    duplicateGroups.forEach((group, groupIdx) => {
      console.log(`\n그룹 ${groupIdx + 1}: ${group.length}개 중복 기사`);
      console.log('─'.repeat(120));
      
      // 생성 시간 기준으로 정렬 (가장 오래된 것을 유지)
      group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      group.forEach((article, idx) => {
        const date = new Date(article.created_at).toLocaleString('ko-KR');
        const tags = article.ghost_tags.join(', ') || 'N/A';
        
        console.log(`\n${idx === 0 ? '✓ (유지)' : '✗ (Draft로)'} [${idx + 1}] ${article.headline}`);
        console.log(`   파일: ${article.filename}`);
        console.log(`   ID: ${article.id}`);
        console.log(`   생성일: ${date}`);
        console.log(`   태그: ${tags}`);
        console.log(`   타입: ${article.article_type}`);
      });
      
      totalDuplicates += group.length - 1;
    });
    
    console.log('\n═'.repeat(120));
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
      groups: duplicateGroups.map((group, idx) => {
        group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return {
          groupId: idx + 1,
          keep: {
            id: group[0].id,
            filename: group[0].filename,
            headline: group[0].headline,
            createdAt: group[0].created_at
          },
          moveToDraft: group.slice(1).map(a => ({
            id: a.id,
            filename: a.filename,
            headline: a.headline,
            createdAt: a.created_at
          }))
        };
      })
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
