#!/usr/bin/env node
/**
 * Editor-Desk 중복 검증 스크립트
 * 목적: 06-desk-approved로 이동하기 전에 중복 기사 감지
 * 사용: node check-duplicates-before-approval.js
 */

const fs = require('fs');
const path = require('path');

const DESK_APPROVED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/06-desk-approved';
const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
const REJECTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/rejected';

/**
 * 문자열 유사도 계산 (Levenshtein 거리)
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 100;

  const editDistance = getEditDistance(longer, shorter);
  return ((longer.length - editDistance) / longer.length) * 100;
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
 * 제목 정규화 (비교용)
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\w가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function checkDuplicates() {
  try {
    console.log('🔍 Editor-Desk 중복 검증 시작\n');

    // 1. 06-desk-approved의 기사들 읽기
    const approvedFiles = fs.readdirSync(DESK_APPROVED_DIR)
      .filter(f => f.endsWith('.json'));

    console.log(`📋 검증할 기사: ${approvedFiles.length}개\n`);

    // 2. 이미 발행된 기사들 로드
    const publishedArticles = [];
    const publishedFiles = fs.readdirSync(PUBLISHED_DIR)
      .filter(f => f.endsWith('.json'));

    for (const file of publishedFiles) {
      const filepath = path.join(PUBLISHED_DIR, file);
      const article = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      publishedArticles.push({
        title: article.draft?.headline || '',
        file: file,
        html: article.draft?.html || ''
      });
    }

    console.log(`📚 이미 발행된 기사: ${publishedArticles.length}개\n`);

    // 3. 각 approved 기사를 검증
    let problems = [];
    let rejections = [];

    for (const filename of approvedFiles) {
      const filepath = path.join(DESK_APPROVED_DIR, filename);
      const article = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      
      const currentTitle = article.draft?.headline || '';
      const currentHtml = article.draft?.html || '';
      const normalizedCurrent = normalizeTitle(currentTitle);

      console.log(`📄 검증: ${currentTitle}`);

      // 발행된 기사와 비교
      let isDuplicate = false;
      let duplicateOf = null;

      for (const published of publishedArticles) {
        const normalizedPublished = normalizeTitle(published.title);
        const titleSimilarity = calculateSimilarity(normalizedCurrent, normalizedPublished);

        if (titleSimilarity >= 85) {
          console.log(`   ⚠️  유사도 ${titleSimilarity.toFixed(1)}% - ${published.title}`);

          if (titleSimilarity >= 95) {
            console.log(`   ❌ KILL: 완전 중복 기사`);
            isDuplicate = true;
            duplicateOf = published.file;
            rejections.push({
              filename: filename,
              title: currentTitle,
              reason: '완전 중복 기사',
              duplicateOf: duplicateOf,
              similarity: titleSimilarity
            });
            break;
          } else {
            problems.push({
              filename: filename,
              title: currentTitle,
              similarity: titleSimilarity,
              duplicateOf: published.file,
              duplicateTitle: published.title
            });
          }
        }
      }

      if (!isDuplicate) {
        console.log(`   ✅ 고유한 기사`);
      }
      console.log();
    }

    // 4. 결과 리포트
    console.log('═'.repeat(100) + '\n');
    console.log('📊 검증 결과\n');

    if (rejections.length > 0) {
      console.log(`❌ 자동 KILL (완전 중복): ${rejections.length}개\n`);
      for (const item of rejections) {
        console.log(`   - ${item.title}`);
        console.log(`     중복 대상: ${item.duplicateOf}`);
        console.log(`     유사도: ${item.similarity.toFixed(1)}%\n`);

        // 실제로 파일 이동
        const sourcePath = path.join(DESK_APPROVED_DIR, item.filename);
        const destPath = path.join(REJECTED_DIR, item.filename);

        try {
          fs.renameSync(sourcePath, destPath);
          console.log(`   ✅ rejected/로 이동됨\n`);
        } catch (e) {
          console.log(`   ⚠️  이동 실패: ${e.message}\n`);
        }
      }
    } else {
      console.log('✅ 자동 KILL 대상 없음\n');
    }

    if (problems.length > 0) {
      console.log(`⚠️  주의 (85-94% 유사): ${problems.length}개`);
      console.log('   → 편집자 수동 검토 필요\n');
      for (const item of problems) {
        console.log(`   - ${item.title}`);
        console.log(`     유사 기사: ${item.duplicateTitle}`);
        console.log(`     유사도: ${item.similarity.toFixed(1)}%`);
        console.log(`     권고: 다른 각도가 있는가 확인 후 유지/삭제 결정\n`);
      }
    }

    // 5. 로그 저장
    const logPath = path.join(
      '/root/.openclaw/workspace/newsroom/pipeline/_status',
      `duplicate-check-${new Date().toISOString().split('T')[0]}.json`
    );

    fs.writeFileSync(logPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      articlesChecked: approvedFiles.length,
      rejections: rejections.length,
      warnings: problems.length,
      details: {
        autoKilled: rejections,
        needsReview: problems
      }
    }, null, 2));

    console.log(`\n💾 로그 저장: ${logPath}`);

  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

checkDuplicates();
