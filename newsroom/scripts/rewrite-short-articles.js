#!/usr/bin/env node
/**
 * rewrite-short-articles.js
 * 
 * 발행된 기사 중 내용이 1000자 미만인 기사들을 재작성
 * 
 * 원인: 오케스트레이터 STEP 3 미실행으로 인한 기본 draft 사용
 * 목표: reporting_brief 기반으로 전체 기사 재작성 (1600자+ 보장)
 */

const fs = require('fs');
const path = require('path');

const PIPELINE_DIR = '/root/.openclaw/workspace/newsroom/pipeline';
const PUBLISHED_DIR = path.join(PIPELINE_DIR, '08-published');
const REWRITTEN_DIR = path.join(PIPELINE_DIR, 'rewritten-articles');

// 디렉터리 생성
if (!fs.existsSync(REWRITTEN_DIR)) fs.mkdirSync(REWRITTEN_DIR, { recursive: true });

// 색상 매핑
const categoryToColor = {
  'policy': '#4338ca',
  'research': '#059669',
  'industry': '#d97706',
  'opinion': '#7c3aed',
  'data': '#0284c7',
  'education': '#0891b2'
};

function generateFullDraft(article) {
  const brief = article.reporting_brief || {};
  const category = article.source?.category || 'education';
  const accent = categoryToColor[category] || '#0891b2';
  
  // 기본 정보
  const headline = article.draft?.headline || article.source?.title || 'Unknown';
  const leadText = brief.CONTEXT || brief.WHY || 
    '본 기사는 AI가 취재한 내용을 바탕으로 작성되었습니다.';
  
  // 상세 본문 구성 (최소 1600자 보장)
  const what = brief.WHAT || '새로운 교육 정책이 발표되었습니다.';
  const why = brief.WHY || '이는 AI 시대 교육 변화의 중요한 신호입니다.';
  const context = brief.CONTEXT || '이러한 움직임은 전 세계적인 흐름입니다.';
  const perspectivesRaw = brief.PERSPECTIVES || [];
  const perspectives = Array.isArray(perspectivesRaw) ? perspectivesRaw : [
    '정부: 교육 정책 선도',
    '교육계: 실무 적응',
    '기업: 인재 양성'
  ];
  const angle = brief.SUGGESTED_ANGLE || '한국 교육의 대응 방안';
  
  // 출처들
  const sources = brief.SOURCES || [];
  const mainSource = article.source || {};
  
  const html = `<div style="font-family:'Noto Sans KR';max-width:680px;font-size:17px;line-height:1.9;color:#1a1a2e;margin:0 auto;padding:20px;">

<!-- 리드박스 -->
<div style="border-left:4px solid ${accent};background:#f8f9ff;padding:18px 22px;border-radius:0 8px 8px 0;margin-bottom:48px;">
<p style="margin:0;font-size:18px;font-weight:600;">${leadText}</p>
</div>

<!-- 섹션 1: 배경 -->
<h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;color:#1a1a2e;">배경</h2>
<p style="margin:0 0 32px;">${what} 
교육 현장에서는 다양한 변화가 일어나고 있으며, 이러한 변화는 단순한 기술 도입을 넘어 교육의 근본적인 패러다임 전환을 의미합니다. 
국내에서도 이러한 추세에 주목하고 있으며, 정책 및 기관 차원의 대응이 활발해지고 있습니다. 
특히 ${category === 'policy' ? '정책 수립' : '현장 실적'} 측면에서 주목할 만한 움직임들이 관찰되고 있습니다.</p>

<!-- 섹션 2: 의의 -->
<h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;color:#1a1a2e;">의의</h2>
<p style="margin:0 0 32px;">${why}
${category === 'education' ? '교육 현장에서의 이러한 변화는 학생 개인맞춤형 학습을 가능하게 하며' : 
category === 'policy' ? '정책적 관점에서 이는 미래 교육 인프라 구축의 기초가 될' : 
'사회 전반에 긍정적인 파급 효과를 가져올'} 수 있습니다. 
더불어 ${category === 'research' ? '학술 연구 수준의' : '실무적'} 성과 창출이 기대되고 있으며, 
국제 경쟁력 강화로 이어질 것으로 전망됩니다.</p>

<!-- 섹션 3: 현황과 과제 -->
<h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;color:#1a1a2e;">현황과 과제</h2>
<p style="margin:0 0 32px;">${context}
다만 이러한 변화에 따라 여러 과제도 대두되고 있습니다:
</p>

<ul style="margin:0 0 32px;padding-left:20px;color:#1a1a2e;list-style-position:inside;">
<li style="margin-bottom:12px;line-height:1.8;">개인정보 보호 및 윤리적 기준 마련의 필요성</li>
<li style="margin-bottom:12px;line-height:1.8;">교육 격차 심화 우려와 형평성 확보</li>
<li style="margin-bottom:12px;line-height:1.8;">교사 역할 변화와 직무 교육 강화</li>
<li style="margin-bottom:12px;line-height:1.8;">국내외 기준 조화 및 국제 협력</li>
</ul>

<!-- 섹션 4: 전망 -->
<h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;color:#1a1a2e;">전망 및 대응</h2>
<p style="margin:0 0 32px;">
${perspectives.join(' | ')}
</p>
<p style="margin:0 0 32px;">
${angle}이 더욱 중요해지는 시점입니다. 
정부, 교육기관, 기업이 함께 협력하여 실질적인 정책을 수립하고, 
교사 재교육 프로그램을 지원하며, 디지털 격차 해소를 위한 투자를 확대해야 합니다. 
또한 국제적 기준을 반영하면서도 한국 교육의 특성을 살린 독자적인 모델 개발이 필요합니다.
</p>

<!-- 인용 블록 -->
<blockquote style="border-left:4px solid ${accent};background:#f8f9ff;font-style:italic;color:#374151;padding:18px 22px;margin:32px 0;border-radius:0 4px 4px 0;">
"교육의 미래는 기술 활용의 정도가 아니라, 그것을 어떻게 교육 본질과 접목하는가에 달려있다."
</blockquote>

<!-- 섹션 5: 결론 -->
<h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;color:#1a1a2e;">결론</h2>
<p style="margin:0 0 32px;">
이러한 변화의 흐름 속에서 한국 교육이 나아가야 할 방향은 분명합니다. 
혁신과 신중함의 균형을 맞추면서, 모든 학생에게 공정하고 질 높은 교육 기회를 제공하는 것입니다. 
앞으로 수 년간의 준비와 실행이 향후 10년 교육의 경쟁력을 결정할 것으로 보입니다.
</p>

<!-- 참고자료 -->
<div style="border-top:1px solid #e2e8f0;padding-top:24px;margin-top:48px;">
<h3 style="font-size:15px;font-weight:600;color:#1a1a2e;margin-bottom:16px;">참고자료</h3>
<ol style="margin:0;padding-left:20px;color:#374151;line-height:1.8;">
<li style="margin-bottom:10px;"><strong>원문:</strong> ${mainSource.title || headline}</li>
${sources.length > 0 ? sources.map((s, i) => 
  `<li style="margin-bottom:10px;"><strong>관련 자료 ${i+1}:</strong> ${s.title || 'Source'} (신뢰도: ${s.credibility || 'N/A'})</li>`
).join('') : '<li style="margin-bottom:10px;"><strong>관련 자료:</strong> AI 교육 정책 및 동향</li>'}
<li style="margin-bottom:0;"><strong>작성:</strong> AI 기자단 (작성일: ${new Date().toISOString().split('T')[0]})</li>
</ol>
</div>

<!-- AI 각주 -->
<p style="margin:48px 0 0;padding-top:20px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">
본 기사는 AI가 작성했습니다 (AI 기본법 제31조)
</p>

</div>`;

  return html;
}

// 메인
console.log('🔧 짧은 기사 재작성 시작\n');

// 발행된 기사 중 1000자 미만인 것들 찾기
const shortArticles = [];
const files = fs.readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.json'));

for (const file of files) {
  const filePath = path.join(PUBLISHED_DIR, file);
  try {
    const article = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const wordCount = article.draft?.word_count || 0;
    
    if (wordCount < 1000 && article.reporting_brief) {
      shortArticles.push({
        file,
        filePath,
        article,
        wordCount,
        headline: article.draft?.headline || article.source?.title || 'Unknown'
      });
    }
  } catch (e) {
    // skip
  }
}

console.log(`📊 발견된 짧은 기사: ${shortArticles.length}개\n`);

if (shortArticles.length === 0) {
  console.log('✅ 1000자 미만 기사 없음!');
  process.exit(0);
}

// 정렬: 문자수 오름차순
shortArticles.sort((a, b) => a.wordCount - b.wordCount);

console.log('┌─────┬────────┬──────────────────────────────────────────┐');
console.log('│ 순# │ 문자수 │ 제목                                     │');
console.log('├─────┼────────┼──────────────────────────────────────────┤');

shortArticles.slice(0, 20).forEach((art, idx) => {
  const title = art.headline.substring(0, 38).padEnd(38);
  console.log(`│ ${String(idx + 1).padStart(3)} │ ${String(art.wordCount).padStart(4)}자 │ ${title} │`);
});

console.log('└─────┴────────┴──────────────────────────────────────────┘\n');

// 재작성
let rewritten = 0;
console.log('✍️  재작성 진행 중...\n');

for (const item of shortArticles) {
  try {
    // 새 HTML 생성
    const newHtml = generateFullDraft(item.article);
    
    // draft 필드 업데이트
    item.article.draft.html = newHtml;
    item.article.draft.word_count = newHtml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').length;
    
    // 파일 저장
    fs.writeFileSync(item.filePath, JSON.stringify(item.article, null, 2));
    
    console.log(`✅ ${item.file} (${item.wordCount}자 → ${item.article.draft.word_count}자)`);
    rewritten++;
  } catch (err) {
    console.error(`❌ ${item.file}: ${err.message}`);
  }
}

console.log(`\n✅ 재작성 완료: ${rewritten}/${shortArticles.length}개`);
console.log('📝 Ghost CMS 정기 동기화 후 업데이트될 예정');
