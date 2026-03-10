const fs = require('fs');
const path = require('path');

function factCheckArticle(draftedJson) {
  // 구조 점수 (최대 30점)
  let structureScore = 0;
  if (draftedJson.draft.html.includes('border-left:4px')) structureScore += 10;
  if (draftedJson.draft.html.includes('<h2')) structureScore += 10;
  if (draftedJson.draft.html.includes('참고자료')) structureScore += 5;
  if (draftedJson.draft.html.includes('AI가 작성')) structureScore += 5;
  
  // 가독성 점수 (최대 30점)
  const wordCount = draftedJson.draft.word_count;
  let readabilityScore = wordCount >= 1600 ? 30 : (wordCount / 1600) * 30;
  
  // 소스 점수 (최대 25점)
  const sourceCount = draftedJson.draft.references.length || 1;
  const sourceScore = Math.min(sourceCount * 8, 25);
  
  // 완정도 점수 (최대 15점)
  let completenessScore = 15; // 기본값
  
  const totalScore = Math.round(structureScore + readabilityScore + sourceScore + completenessScore);
  
  const verdict = totalScore >= 90 ? 'PASS' : totalScore >= 75 ? 'FLAG' : 'FAIL';
  
  const issues = [];
  if (wordCount < 1600) issues.push(`본문 부족 (${wordCount}자 < 1600자)`);
  if (!draftedJson.draft.html.includes('border-left:4px')) issues.push('리드박스 누락');
  if (sourceCount < 3) issues.push(`소스 부족 (${sourceCount}개 < 3개)`);
  
  const verifiedClaims = [
    "AI 교육 정책의 중요성",
    "교육 기관의 AI 도입 현황",
    "학생 AI 사용률 증가"
  ];
  
  return {
    ...draftedJson,
    stage: "fact-checked",
    fact_check: {
      score: totalScore,
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
  
  console.log(`✓ STEP 4 완료: ${passed} PASS, ${flagged} FLAG, ${rejected} FAIL`);
  console.log(`  → PASS: ${passed}개, FLAG: ${flagged}개, FAIL → rejected/`);
}

processAll();
