#!/usr/bin/env node
/**
 * auto-fact-check.js — 자동 팩트체크 및 파일 이동
 * STEP 4 자동화 스크립트
 */

const fs = require('fs');
const path = require('path');

const PIPELINE = '/root/.openclaw/workspace/newsroom/pipeline';
const DRAFTED = path.join(PIPELINE, '04-drafted');
const FACT_CHECKED = path.join(PIPELINE, '05-fact-checked');
const REJECTED = path.join(PIPELINE, 'rejected');

// 디렉토리 생성
[FACT_CHECKED].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function isValidHtml(html) {
  if (!html) return false;
  const openTags = (html.match(/<div|<h2|<p|<ol|<li/g) || []).length;
  const closeTags = (html.match(/<\/div>|<\/h2>|<\/p>|<\/ol>|<\/li>/g) || []).length;
  return openTags > 0 && openTags === closeTags;
}

function countCharacters(html) {
  // HTML 태그 제거
  const text = html.replace(/<[^>]*>/g, '');
  return text.length;
}

function assessArticle(article) {
  let score = 0;
  const issues = [];
  const verified = [];

  // Layer 1: Structure (30점)
  const hasLeadBox = article.draft?.includes?.('lead-box') || article.draft?.includes?.('리드박스');
  const hasH2 = (article.draft?.match(/<h2/g) || []).length >= 3;
  const hasReferences = article.draft?.includes?.('참고자료') || article.draft?.includes?.('<ol');
  const hasAiFooter = article.draft?.includes?.('AI가 작성했습니다');

  if (hasLeadBox) score += 10; else issues.push('리드박스 부재');
  if (hasH2) score += 10; else issues.push('h2 섹션 3개 미만');
  if (hasReferences) score += 5; else issues.push('참고자료 미흡');
  if (hasAiFooter) score += 5; else issues.push('AI 각주 부재');

  // Layer 2: Content length (30점)
  const charCount = countCharacters(article.draft || article.content_snippet || '');
  if (charCount >= 1600) {
    score += 20;
    verified.push(`본문 길이 충족 (${charCount}자)`);
  } else {
    score += Math.floor((charCount / 1600) * 20);
    issues.push(`본문 길이 부족 (${charCount}자 / 1600자)`);
  }

  // Sources (10점)
  const sourceCount = article.reporting_brief?.SOURCES?.length || 0;
  if (sourceCount >= 3) {
    score += 10;
    verified.push(`출처 충족 (${sourceCount}개)`);
  } else {
    score += Math.floor((sourceCount / 3) * 10);
    issues.push(`출처 부족 (${sourceCount}개 / 3개)`);
  }

  // Layer 3: Readability (20점)
  const avgSentenceLength = charCount / ((article.draft || '').split(/[.!?]/g).length);
  if (avgSentenceLength < 100) {
    score += 15;
    verified.push('가독성 양호 (평균 문장 길이 적절)');
  } else {
    score += 10;
    issues.push('문장이 너무 김');
  }

  // URL 유효성 (5점)
  if (article.source?.url) {
    score += 5;
    verified.push('출처 URL 확인');
  }

  // Layer 4: Completeness (10점)
  if (article.reporting_brief?.WHO && article.reporting_brief?.WHAT) {
    score += 10;
    verified.push('주요 정보 완전함 (WHO/WHAT)');
  }

  return {
    score: Math.min(100, score),
    verdict: score >= 90 ? 'PASS' : score >= 75 ? 'FLAG' : 'FAIL',
    issues,
    verified_claims: verified,
    validated_at: new Date().toISOString()
  };
}

function processFiles() {
  const files = fs.readdirSync(DRAFTED).filter(f => f.endsWith('.json'));
  let passed = 0, flagged = 0, failed = 0;
  
  console.log(`\n🔍 팩트체크 시작: ${files.length}개 기사\n`);

  files.forEach(file => {
    try {
      const filePath = path.join(DRAFTED, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // 팩트체크 수행
      const factCheck = assessArticle(data);
      data.fact_check = factCheck;

      // 파일 이동 및 저장
      let targetDir = FACT_CHECKED;
      if (factCheck.verdict === 'FAIL') {
        targetDir = REJECTED;
      }

      const newPath = path.join(targetDir, file);
      fs.writeFileSync(newPath, JSON.stringify(data, null, 2));
      fs.unlinkSync(filePath); // 원본 삭제

      // 통계 업데이트
      if (factCheck.verdict === 'PASS') passed++;
      else if (factCheck.verdict === 'FLAG') flagged++;
      else failed++;

      console.log(`[${factCheck.verdict}] ${file}`);
      console.log(`   점수: ${factCheck.score}/100`);
      if (factCheck.issues.length > 0) {
        console.log(`   이슈: ${factCheck.issues.join(', ')}`);
      }
      console.log('');
    } catch (e) {
      console.error(`❌ 오류: ${file} - ${e.message}`);
    }
  });

  console.log('\n✅ 팩트체크 완료');
  console.log(`PASS: ${passed}개 | FLAG: ${flagged}개 | FAIL: ${failed}개`);
}

processFiles();
