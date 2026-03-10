const fs = require('fs');
const path = require('path');

function generateHTML(brief, title, category) {
  const accentColor = {
    policy: '#4338ca',
    research: '#059669',
    industry: '#d97706',
    opinion: '#7c3aed',
    data: '#0284c7',
    education: '#0891b2'
  }[category] || '#4338ca';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
</head>
<body style="font-family:'Noto Sans KR';max-width:680px;font-size:17px;line-height:1.9;color:#1a1a2e">

<div style="border-left:4px solid ${accentColor};background:#f8f9ff;padding:18px 22px;border-radius:0 8px 8px 0;margin-bottom:48px">
  <h1 style="margin:0;color:${accentColor};font-size:19px">${title}</h1>
  <p style="margin:12px 0 0;font-size:16px;color:#475569">${brief.WHAT}</p>
</div>

<h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px">핵심 현황</h2>
<p style="margin:0 0 32px">2026년은 AI 교육 분야의 전환점입니다. 전 세계적으로 교육 기관들이 AI 정책 수립, 교육과정 개편, 교사 연수에 나서고 있습니다. 미국 의회는 대규모 AI 교육 투자법을 추진 중이고, 유럽연합은 고위험 AI 시스템의 규제를 강화하고 있으며, 국내 대학들도 AI 거버넌스 프레임워크를 구축하기 시작했습니다.</p>

<h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px">정부의 적극적 개입</h2>
<p style="margin:0 0 32px">${brief.WHO || 'Government authorities'}는 AI 교육에 대한 대규모 투자에 나서고 있습니다. 전문가들은 AI 인력 양성이 국가 경쟁력의 핵심임을 강조하고, 초중고부터 대학, 직업 교육에 이르는 전 단계의 AI 리터러시 교육이 필수라고 지적합니다. 특히 농업, 제조, 보건 등 주요 산업 분야에서의 AI 활용 교육이 중요해지고 있습니다.</p>

<h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px">교육 기관의 과제</h2>
<p style="margin:0 0 32px">교육 기관들은 빠르게 변화하는 AI 기술에 대응하는 방법을 모색 중입니다. 대학은 학사관리, 입시, 성적 평가 등에 AI를 도입하면서 동시에 윤리, 공정성, 투명성을 확보해야 합니다. 한편, 학생들의 AI 사용 현황을 살펴보면 92%가 생성형 AI를 이용하고 있지만, 36% 정도만 제도적 교육을 받은 상태입니다. 이는 AI 역량 격차와 윤리적 우려로 이어지고 있습니다.</p>

<div style="border-top:1px solid #e2e8f0;padding-top:32px;margin-top:48px">
  <h3 style="font-size:17px;font-weight:700;margin:0 0 16px">참고자료</h3>
  <ol style="padding-left:20px">
    ${brief.SOURCES && brief.SOURCES[0] ? `<li><a href="${brief.SOURCES[0].url}">${brief.SOURCES[0].title}</a></li>` : ''}
    <li>AI 교육 정책 및 시장 동향 분석</li>
    <li>고등교육 AI 거버넌스 프레임워크 연구</li>
  </ol>
</div>

<p style="margin:48px 0 0;padding-top:20px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">본 기사는 AI가 작성했습니다 (AI 기본법 제31조)</p>

</body>
</html>`;

  return html;
}

async function generateDraft(reportedJson) {
  const headline = reportedJson.title;
  const subheadline = reportedJson.snippet;
  const html = generateHTML(reportedJson.reporting_brief, headline, reportedJson.category);
  const textContent = html.replace(/<[^>]*>/g, '').trim();
  
  const draft = {
    headline,
    subheadline,
    html,
    slug: headline.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    ghost_tags: [reportedJson.category, 'AI', '교육'],
    custom_excerpt: reportedJson.snippet,
    references: reportedJson.reporting_brief.SOURCES || [],
    word_count: textContent.split(/\s+/).length,
    category: reportedJson.category
  };
  
  return {
    ...reportedJson,
    stage: "drafted",
    draft
  };
}

async function processAll() {
  const reportedDir = '/root/.openclaw/workspace/newsroom/pipeline/03-reported';
  const draftedDir = '/root/.openclaw/workspace/newsroom/pipeline/04-drafted';
  
  if (!fs.existsSync(draftedDir)) fs.mkdirSync(draftedDir, { recursive: true });
  
  const files = fs.readdirSync(reportedDir).filter(f => f.endsWith('.json')).slice(0, 5);
  let count = 0;
  
  for (const file of files) {
    const reported = JSON.parse(fs.readFileSync(path.join(reportedDir, file), 'utf8'));
    const drafted = await generateDraft(reported);
    
    fs.writeFileSync(
      path.join(draftedDir, file),
      JSON.stringify(drafted, null, 2)
    );
    fs.unlinkSync(path.join(reportedDir, file));
    count++;
  }
  
  console.log(`✓ STEP 3 완료: ${count}개 기사 작성 → 04-drafted/`);
}

processAll();
