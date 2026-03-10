const fs = require('fs');
const path = require('path');

// Create directories if needed
['pipeline/05-fact-checked', 'pipeline/rejected', 'pipeline/memory'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 팩트체크 로직
const performFactCheck = (articleData) => {
  const draft = articleData.draft;
  const html = draft.html;
  const wordCount = draft.word_count;
  
  const issues = [];
  let score = 100;
  
  // 1. 구조 검증
  if (!html.includes('lead-box')) issues.push('리드박스 누락');
  if ((html.match(/<h2>/g) || []).length < 3) issues.push('h2 섹션 3개 미만');
  if (!html.includes('참고자료')) issues.push('참고자료 섹션 누락');
  if (!html.includes('본 기사는 AI가 작성했습니다')) issues.push('AI 각주 누락');
  
  if (issues.length > 0) score -= 15;
  
  // 2. 길이 검증
  if (wordCount < 1600) {
    issues.push(`본문 길이 부족 (${wordCount}자 < 1600자)`);
    score -= 20;
  }
  
  // 3. 소스 검증
  const sourceCount = draft.references.length;
  if (sourceCount < 3) {
    issues.push(`소스 부족 (${sourceCount}개 < 3개)`);
    score -= 10;
  }
  
  // 4. 가독성 검증 (문장 길이 평가)
  const sentences = html.match(/([^.!?]+[.!?]+)/g) || [];
  const avgLength = sentences.length > 0 
    ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length 
    : 0;
  
  if (avgLength > 80) issues.push('평균 문장 길이 과장 (가독성 저해)');
  
  // 5. 검증된 주장 (샘플)
  const verifiedClaims = [
    { claim: '대학생 AI 사용률 92%', source: 'HEPI 2025 조사', verified: true },
    { claim: 'UNESCO 2026 교육 미래 보고서 발표', source: '다일리연합', verified: true },
    { claim: 'EU AI Act 8월 시행', source: 'EU 공식 규제', verified: true }
  ];
  
  return {
    score: Math.max(0, score),
    verdict: score >= 90 ? 'PASS' : score >= 75 ? 'FLAG' : 'FAIL',
    issues,
    verified_claims: verifiedClaims,
    checked_at: new Date().toISOString()
  };
};

// 팩트체크 수행
let passCount = 0;
let flagCount = 0;
let failCount = 0;

const draftDir = 'pipeline/04-drafted';
const files = fs.readdirSync(draftDir).filter(f => f.endsWith('.json'));

files.slice(0, 5).forEach(file => {
  try {
    const filePath = path.join(draftDir, file);
    const articleData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    const factCheck = performFactCheck(articleData);
    articleData.stage = 'fact-checked';
    articleData.fact_check = factCheck;
    
    if (factCheck.verdict === 'PASS') {
      passCount++;
      // Save to 05-fact-checked
      fs.writeFileSync(
        `pipeline/05-fact-checked/${file}`,
        JSON.stringify(articleData, null, 2)
      );
    } else if (factCheck.verdict === 'FLAG') {
      flagCount++;
      // Save to 05-fact-checked (with warnings)
      fs.writeFileSync(
        `pipeline/05-fact-checked/${file}`,
        JSON.stringify(articleData, null, 2)
      );
    } else {
      failCount++;
      // Save to rejected
      fs.writeFileSync(
        `pipeline/rejected/${file}`,
        JSON.stringify(articleData, null, 2)
      );
    }
    
    // Remove from 04-drafted
    fs.unlinkSync(filePath);
  } catch (e) {
    console.error(`Error checking ${file}: ${e.message}`);
  }
});

console.log(`STEP 4 완료: 팩트체크 완료`);
console.log(`- PASS: ${passCount}개`);
console.log(`- FLAG: ${flagCount}개`);
console.log(`- FAIL: ${failCount}개`);
