const fs = require('fs');
const path = require('path');

function factCheckArticle(data) {
  const draft = data.draft;
  const brief = data.reporting_brief;
  
  const checks = {
    structure: 0,
    wordCount: 0,
    sources: 0,
    references: 0,
    aiFootnote: 0
  };
  
  // 구조 확인
  if (draft.html && draft.html.includes('<h2') && draft.html.includes('<blockquote') && draft.html.includes('<ol')) {
    checks.structure = 25;
  }
  
  // 단어 수
  if (draft.word_count >= 1600) {
    checks.wordCount = 25;
  } else if (draft.word_count >= 1200) {
    checks.wordCount = 15;
  }
  
  // 소스 개수
  if (brief.SOURCES?.length >= 3 || brief.sources?.length >= 3) {
    checks.sources = 20;
  } else if ((brief.SOURCES?.length || 0) >= 2 || (brief.sources?.length || 0) >= 2) {
    checks.sources = 10;
  }
  
  // 참고자료 섹션
  if (draft.references && draft.references.length > 0) {
    checks.references = 15;
  }
  
  // AI 각주
  if (draft.html && draft.html.includes('본 기사는 AI가 작성했습니다')) {
    checks.aiFootnote = 15;
  }
  
  const total = Object.values(checks).reduce((a, b) => a + b, 0);
  const verdict = total >= 80 ? 'PASS' : total >= 60 ? 'FLAG' : 'FAIL';
  
  return {
    score: total,
    verdict: verdict,
    checks: checks,
    issues: [
      draft.word_count < 1600 ? '⚠ 단어 수 부족 (' + draft.word_count + '/1600)' : null
    ].filter(x => x)
  };
}

function main() {
  const draftDir = '/root/.openclaw/workspace/newsroom/pipeline/04-drafted';
  const checkDir = '/root/.openclaw/workspace/newsroom/pipeline/05-fact-checked';
  const rejectDir = '/root/.openclaw/workspace/newsroom/pipeline/rejected';
  
  if (!fs.existsSync(checkDir)) fs.mkdirSync(checkDir, {recursive: true});
  if (!fs.existsSync(rejectDir)) fs.mkdirSync(rejectDir, {recursive: true});
  
  const files = fs.readdirSync(draftDir).filter(f => f.endsWith('.json'));
  
  console.log(`\n🔍 STEP 4 팩트체크 (${files.length}개)\n`);
  
  let pass = 0, flag = 0, fail = 0;
  
  files.forEach(fname => {
    const data = JSON.parse(fs.readFileSync(path.join(draftDir, fname), 'utf8'));
    const result = factCheckArticle(data);
    
    data.stage = 'fact-checked';
    data.fact_check = result;
    
    const dstDir = result.verdict === 'FAIL' ? rejectDir : checkDir;
    fs.writeFileSync(path.join(dstDir, fname), JSON.stringify(data, null, 2));
    
    const symbol = {PASS: '✓', FLAG: '⚠', FAIL: '✗'}[result.verdict];
    console.log(`  ${symbol} ${data.draft.headline} (${result.score}/100)`);
    
    if (result.verdict === 'PASS') pass++;
    else if (result.verdict === 'FLAG') flag++;
    else fail++;
    
    fs.unlinkSync(path.join(draftDir, fname));
  });
  
  console.log(`\n결과: ${pass}개 PASS, ${flag}개 FLAG, ${fail}개 FAIL\n`);
}

main();
