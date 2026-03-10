#!/usr/bin/env node
/**
 * validate-html.js — HTML 품질 검증 (LLM 불필요)
 * 
 * 사용법: node validate-html.js <json-file-path>
 * 
 * 검증 항목:
 * 1. 리드박스 존재
 * 2. h2 섹션 수
 * 3. 참고자료 섹션
 * 4. AI 각주
 * 5. 수치 카드 없음
 * 6. AI 공개 배지 없음
 * 7. 본문 길이 (글자 수, 단어 수)
 * 
 * Exit 0 = 통과, Exit 1 = 실패
 */

const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node validate-html.js <json-file>');
  process.exit(2);
}

try {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const html = data.draft?.html || data.html || '';
  
  if (!html) {
    console.log(JSON.stringify({ valid: false, error: 'HTML 필드 없음' }));
    process.exit(1);
  }

  const textContent = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const charCount = textContent.length;
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
  // 한국어 단어 수 보정 (글자 수 / 3.5 ≈ 한국어 단어 수)
  const koWordCount = Math.round(charCount / 3.5);

  const checks = {
    hasLeadBox: /border-left:\s*4px\s+solid/.test(html),
    h2Count: (html.match(/<h2[\s>]/g) || []).length,
    hasReferences: /참고\s*자료/.test(html) || /참고자료/.test(html),
    hasAiFooter: /AI가 작성했습니다/.test(html) || /AI 기본법/.test(html),
    hasNumericalCard: /display:\s*flex/.test(html) && /font-size:\s*3[0-9]px/.test(html),
    hasAiBadge: /AI\s*(공개|생성|작성)\s*(배지|뱃지)/.test(html) || 
                (/pill|badge/.test(html) && /position:\s*(absolute|fixed)/.test(html)),
    charCount,
    wordCount,
    koWordCount
  };

  const issues = [];

  if (!checks.hasLeadBox) issues.push('리드박스 없음');
  if (checks.h2Count < 2) issues.push(`h2 섹션 부족 (${checks.h2Count}개, 최소 2개)`);
  if (!checks.hasReferences) issues.push('참고자료 섹션 없음');
  if (!checks.hasAiFooter) issues.push('AI 각주 없음');
  if (checks.hasNumericalCard) issues.push('금지된 수치 카드 발견');
  if (checks.hasAiBadge) issues.push('금지된 AI 공개 배지 발견');
  if (checks.charCount < 1500) issues.push(`본문 너무 짧음 (${checks.charCount}자, 최소 1500자)`);
  if (checks.koWordCount < 200) issues.push(`단어 수 부족 (약 ${checks.koWordCount}단어, 최소 200단어)`);

  const valid = issues.length === 0;

  console.log(JSON.stringify({
    valid,
    checks,
    issues,
    file: filePath
  }));

  process.exit(valid ? 0 : 1);
} catch (e) {
  console.log(JSON.stringify({ valid: false, error: e.message }));
  process.exit(1);
}
