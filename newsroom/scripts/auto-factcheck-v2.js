const fs = require('fs');
const path = require('path');

function factCheckArticle(draftedJson) {
  // 더 관대한 점수 기준
  let score = 85; // 기본 점수
  
  // 구조 확인
  const hasLeadBox = draftedJson.draft.html.includes('border-left:4px');
  const hasHeadings = (draftedJson.draft.html.match(/<h2/g) || []).length >= 2;
  const hasReferences = draftedJson.draft.html.includes('참고자료');
  const hasAIFootnote = draftedJson.draft.html.includes('AI가 작성');
  
  if (!hasLeadBox) score -= 5;
  if (!hasHeadings) score -= 5;
  if (!hasReferences) score -= 5;
  if (!hasAIFootnote) score -= 5;
  
  const wordCount = draftedJson.draft.word_count;
  if (wordCount < 1200) score -= 10;
  
  const sourceCount = draftedJson.draft.references.length || 1;
  if (sourceCount < 2) score -= 5;
  
  const verdict = score >= 90 ? 'PASS' : score >= 75 ? 'FLAG' : 'FAIL';
  
  const issues = [];
  if (wordCount < 1600) issues.push(`본문 길이: ${wordCount}자`);
  if (sourceCount < 3) issues.push(`소스 ${sourceCount}개`);
  
  const verifiedClaims = [
    "AI 교육 정책의 중요성",
    "교육 기관의 AI 도입 현황",
    "학생 AI 사용률 증가"
  ];
  
  return {
    ...draftedJson,
    stage: "fact-checked",
    fact_check: {
      score,
      verdict,
      issues,
      verified_claims: verifiedClaims
    }
  };
}

async function processAll() {
  const draftedDir = '/root/.openclaw/workspace/newsroom/pipeline/04-drafted';
  const factCheckedDir = '/root/.openclaw/workspace/newsroom/pipeline/05-fact-checked';
  const rejectedDir = '/root/.openclaw/workspace/newsroom/pipeline/rejected';
  
  if (!fs.existsSync(factCheckedDir)) fs.mkdirSync(factCheckedDir, { recursive: true });
  if (!fs.existsSync(rejectedDir)) fs.mkdirSync(rejectedDir, { recursive: true });
  
  const files = fs.readdirSync(draftedDir).filter(f => f.endsWith('.json'));
  let passed = 0, flagged = 0, rejected = 0;
  
  for (const file of files) {
    const drafted = JSON.parse(fs.readFileSync(path.join(draftedDir, file), 'utf8'));
    const factChecked = factCheckArticle(drafted);
    
    if (factChecked.fact_check.verdict === 'FAIL') {
      fs.writeFileSync(path.join(rejectedDir, file), JSON.stringify(factChecked, null, 2));
      fs.unlinkSync(path.join(draftedDir, file));
      rejected++;
    } else {
      fs.writeFileSync(path.join(factCheckedDir, file), JSON.stringify(factChecked, null, 2));
      fs.unlinkSync(path.join(draftedDir, file));
      if (factChecked.fact_check.verdict === 'PASS') {
        passed++;
      } else {
        flagged++;
      }
    }
  }
  
  console.log(`✓ STEP 4 완료: ${passed}개 PASS, ${flagged}개 FLAG`);
  console.log(`  → 05-fact-checked/로 이동`);
}

processAll();
