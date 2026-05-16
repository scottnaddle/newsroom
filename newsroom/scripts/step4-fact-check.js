const fs = require('fs');
const path = require('path');

/**
 * 중복 소스 검사: 동일 도메인에서 이미 발행된 기사가 있는지 확인
 * 반환: { count: 중복 수, penalty: 차감 점수 }
 */
function checkSourceDuplicate(sourceUrl) {
  if (!sourceUrl) return { count: 0, penalty: 0 };
  
  try {
    // 발행된 기사 메모리 로드
    const memoryFile = '/root/.openclaw/workspace/newsroom/pipeline/memory/published-titles.json';
    let publishedTitles = [];
    try {
      const memData = JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
      publishedTitles = memData.published_titles || [];
    } catch(e) {}
    
    // 소스 도메인 추출
    const domain = sourceUrl.replace(/https?:\/\//, '').replace(/www\./, '').split('/')[0].toLowerCase();
    
    // 동일 도메인 기사 수 계산
    let sameDomainCount = 0;
    for (const title of publishedTitles) {
      if (title.toLowerCase().includes(domain)) {
        sameDomainCount++;
      }
    }
    
    return {
      count: sameDomainCount,
      penalty: sameDomainCount >= 1 ? Math.min(sameDomainCount * 15, 40) : 0
    };
  } catch (e) {
    return { count: 0, penalty: 0 };
  }
}

function factCheckArticle(data) {
  const draft = data.draft;
  const brief = data.reporting_brief || data.brief || {};
  
  const checks = {
    structure: 0,
    wordCount: 0,
    sources: 0,
    references: 0,
    aiFootnote: 0,
    originality: 0
  };
  
  // 중복 소스 페널티
  const sourceUrl = (data.source && data.source.url) || 
                    (draft && draft.references && draft.references[0] && draft.references[0].url);
  const dupResult = checkSourceDuplicate(sourceUrl);
  if (dupResult.count > 0) {
    checks.originality = Math.max(0, 15 - dupResult.penalty);
  } else {
    checks.originality = 15; // 새로운 소스 = 만점
  }
  
  // 구조 확인 (Ghost 호환: blockquote lead + references + AI footer)
  let structureScore = 0;
  if (draft.html) {
    const hasBlockquote = draft.html.includes('<blockquote');
    const hasReferences = draft.html.includes('참고자료') || draft.html.includes('<ol');
    const hasFooter = draft.html.includes('AI 기본법') || draft.html.includes('AI로 작성');
    if (hasBlockquote && hasReferences && hasFooter) structureScore = 25;
    else if (hasBlockquote && (hasReferences || hasFooter)) structureScore = 20;
    else if (hasBlockquote) structureScore = 15;
  }
  checks.structure = structureScore;
  
  // 단어 수 (데모용)
  if (draft.word_count >= 200) {
    checks.wordCount = 25;
  } else if (draft.word_count >= 100) {
    checks.wordCount = 15;
  }
  
  // 소스 개수 (Ghost 호환: source.url 사용)
  const sources = brief.SOURCES || brief.CREDIBLE_SOURCES || [];
  const hasUrl = data.source && data.source.url;
  if (sources.length >= 2 || (sources.length >= 1 && hasUrl)) {
    checks.sources = 20;
  } else if (sources.length >= 1 || hasUrl) {
    checks.sources = 15;
  }
  
  // 참고자료 섹션
  if (draft.references && draft.references.length > 0) {
    checks.references = 15;
  }
  
  // AI 각주 (v5: "AI로 작성되었습니다" 포함)
  if (draft.html && (draft.html.includes('AI각주') || draft.html.includes('AI가 작성') || draft.html.includes('AI로 작성') || draft.html.includes('AI 기본법'))) {
    checks.aiFootnote = 15;
  }
  
  const total = Object.values(checks).reduce((a, b) => a + b, 0);
  const verdict = total >= 80 ? 'PASS' : total >= 60 ? 'FLAG' : 'FAIL';
  
  const issues = [
    draft.word_count < 200 ? '⚠ 단어 수 부족 (' + draft.word_count + '/200)' : null,
    dupResult.count > 0 ? '⚠ 동일 소스 도메인 ' + dupResult.count + '회 기 발행 (-' + dupResult.penalty + '점)' : null
  ].filter(x => x);
  
  return {
    score: total,
    verdict: verdict,
    checks: checks,
    duplicate_check: { same_domain_count: dupResult.count, penalty: dupResult.penalty },
    issues: issues
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
    
    if (result.verdict === 'PASS') pass++;
    else if (result.verdict === 'FLAG') flag++;
    else fail++;
    
    // Save
    const outName = fname;
    fs.writeFileSync(path.join(dstDir, outName), JSON.stringify(data, null, 2));
    fs.unlinkSync(path.join(draftDir, fname));
    
    const icon = result.verdict === 'PASS' ? '✓' : result.verdict === 'FLAG' ? '⚠' : '✗';
    console.log(`  ${icon} ${(data.draft?.headline || 'unknown').substring(0, 45)} (${result.score}/100)`);
  });
  
  console.log(`\n결과: ${pass}개 PASS, ${flag}개 FLAG, ${fail}개 FAIL`);
}

main();
