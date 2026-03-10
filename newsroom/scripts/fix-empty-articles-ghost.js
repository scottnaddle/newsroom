#!/usr/bin/env node
/**
 * fix-empty-articles-ghost.js
 * 
 * Ghost에 발행된 내용 없는 기사들을 식별하고 로컬 정보와 매핑
 * 
 * 문제: Ghost에는 구 버전(내용 없음), 로컬에는 신 버전(재작성)이 있음
 * 해결책: ghost_id 기반으로 매핑하여 수동 업데이트 가이드 제공
 */

const fs = require('fs');
const path = require('path');

const PIPELINE_DIR = '/root/.openclaw/workspace/newsroom/pipeline';
const PUBLISHED_DIR = path.join(PIPELINE_DIR, '08-published');

// 알려진 내용 없는 Ghost 기사들 (스캇이 제시한 URL 기반)
const KNOWN_EMPTY_URLS = [
  'university-ai-governance-2026-eu-compliance',
  'global-ai-education-governance-2026-korea-implications'
];

// 로컬 발행 기사 중에서 해당하는 기사 찾기
function findLocalArticles() {
  const articles = [];
  
  const files = fs.readdirSync(PUBLISHED_DIR)
    .filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const art = JSON.parse(fs.readFileSync(path.join(PUBLISHED_DIR, file), 'utf8'));
      const ghostUrl = art.ghost_url || '';
      
      // URL slug와 매칭
      for (const slugPattern of KNOWN_EMPTY_URLS) {
        if (ghostUrl.includes(slugPattern)) {
          articles.push({
            file,
            ghostId: art.ghost_id,
            ghostUrl: art.ghost_url,
            headline: art.draft?.headline,
            htmlLength: (art.draft?.html || '').length,
            wordCount: art.draft?.word_count || 0
          });
          break;
        }
      }
    } catch (e) {
      // skip
    }
  }
  
  return articles;
}

// Ghost URL slug로 로컬 기사 찾기
function findBySlug(slug) {
  const files = fs.readdirSync(PUBLISHED_DIR)
    .filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const art = JSON.parse(fs.readFileSync(path.join(PUBLISHED_DIR, file), 'utf8'));
      if (art.ghost_url && art.ghost_url.includes(slug)) {
        return {
          file,
          ghostId: art.ghost_id,
          headline: art.draft?.headline,
          html: art.draft?.html,
          htmlLength: (art.draft?.html || '').length
        };
      }
    } catch (e) {
      // skip
    }
  }
  
  return null;
}

// 메인
console.log('🔍 Ghost 내용 없는 기사 복구 가이드\n');

const emptyArticles = findLocalArticles();

console.log(`✓ 발견된 기사: ${emptyArticles.length}개\n`);

if (emptyArticles.length === 0) {
  console.log('제공하신 URL의 기사를 로컬에서 찾지 못했습니다.');
  console.log('다른 내용 없는 기사들을 검색 중...\n');
  
  // 모든 발행 기사 중 1000자 미만 찾기
  const shortArticles = [];
  const files = fs.readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const art = JSON.parse(fs.readFileSync(path.join(PUBLISHED_DIR, file), 'utf8'));
      const wordCount = art.draft?.word_count || 0;
      if (wordCount < 1000 && art.ghost_id && art.ghost_url) {
        shortArticles.push({
          file,
          ghostId: art.ghost_id,
          ghostUrl: art.ghost_url,
          headline: art.draft?.headline,
          wordCount: wordCount
        });
      }
    } catch (e) {
      // skip
    }
  }

  if (shortArticles.length === 0) {
    console.log('✅ 로컬 1000자 미만 기사 없음!');
    console.log('🔄 Ghost에 있는 구 기사들은 수동으로 업데이트 필요');
    process.exit(0);
  }

  console.log(`⚠️  로컬에서 발견된 1000자 미만 기사: ${shortArticles.length}개\n`);
  
  // 테이블 출력
  console.log('┌──────────────────────────────────────────────────────────────────┬────────┐');
  console.log('│ Ghost URL (slug)                                                 │ 문자수 │');
  console.log('├──────────────────────────────────────────────────────────────────┼────────┤');

  shortArticles.slice(0, 15).forEach(art => {
    const slug = (art.ghostUrl.split('/').filter(s => s)[3] || '').substring(0, 60).padEnd(60);
    console.log(`│ ${slug} │ ${String(art.wordCount).padStart(4)}자 │`);
  });

  console.log('└──────────────────────────────────────────────────────────────────┴────────┘\n');

  console.log('📝 상세 정보 (상위 5개):\n');
  
  shortArticles.slice(0, 5).forEach((art, idx) => {
    console.log(`${idx + 1}. ${art.headline}`);
    console.log(`   Ghost URL: ${art.ghostUrl}`);
    console.log(`   Ghost ID: ${art.ghostId}`);
    console.log(`   로컬 파일: ${art.file}`);
    console.log(`   현재 문자수: ${art.wordCount}자`);
    console.log('');
  });

} else {
  console.log('📋 매칭된 기사:\n');
  
  emptyArticles.forEach((art, idx) => {
    console.log(`${idx + 1}. ${art.headline}`);
    console.log(`   Ghost URL: ${art.ghostUrl}`);
    console.log(`   Ghost ID: ${art.ghostId}`);
    console.log(`   로컬 파일: ${art.file}`);
    console.log(`   로컬 HTML: ${art.htmlLength}자 (${art.wordCount} 단어)`);
    console.log('');
  });
}

console.log('═════════════════════════════════════════════════════════════');
console.log('🔧 수동 복구 방법:\n');
console.log('1. Ghost Admin 접속: https://insight.ubion.global/ghost/');
console.log('2. 각 기사 선택 → Edit');
console.log('3. HTML 에디터에서 전체 내용 삭제 후 로컬 버전의 HTML 복붙');
console.log('4. Status를 "draft"로 변경');
console.log('5. Save 클릭');
console.log('\n또는:');
console.log('📌 API 토큰 갱신 후 sync-published-to-ghost.js 사용');
console.log('   (현재 Ghost API 토큰이 invalid 상태)');
