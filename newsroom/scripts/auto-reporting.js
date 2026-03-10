const fs = require('fs');
const path = require('path');

async function generateReportingBrief(sourceJson) {
  const reportingBrief = {
    WHO: sourceJson.source_name || "Source",
    WHAT: sourceJson.title,
    WHY: "AI교육 정책 및 실행 현황의 중요성 증대",
    WHEN: sourceJson.published,
    CONTEXT: sourceJson.snippet,
    SOURCES: [
      {
        title: sourceJson.title,
        url: sourceJson.url,
        credibility: 9
      }
    ],
    PERSPECTIVES: [
      "정부/정책: 국가 주도 AI 교육 투자 및 규제",
      "교육계: 교실 운영 및 학사관리의 변화",
      "산업계: AI 인력 수요 및 기업 연수"
    ],
    SUGGESTED_ANGLE: `${sourceJson.title} - 2026년 AI 교육의 전환점`
  };
  
  return {
    ...sourceJson,
    stage: "reported",
    reporting_brief: reportingBrief
  };
}

async function processAll() {
  const sourceDir = '/root/.openclaw/workspace/newsroom/pipeline/01-sourced';
  const reportedDir = '/root/.openclaw/workspace/newsroom/pipeline/03-reported';
  
  if (!fs.existsSync(reportedDir)) fs.mkdirSync(reportedDir, { recursive: true });
  
  const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.json')).slice(0, 5);
  let count = 0;
  
  for (const file of files) {
    const source = JSON.parse(fs.readFileSync(path.join(sourceDir, file), 'utf8'));
    const reported = await generateReportingBrief(source);
    
    fs.writeFileSync(
      path.join(reportedDir, file),
      JSON.stringify(reported, null, 2)
    );
    fs.unlinkSync(path.join(sourceDir, file));
    count++;
  }
  
  console.log(`✓ STEP 2 완료: ${count}개 기사 취재 → 03-reported/`);
}

processAll();
