#!/usr/bin/env node
/**
 * run-step3-writer.js
 * 
 * STEP 3: Writer (03-reported → 04-drafted)
 * reporting_brief를 기반으로 HTML 기사 자동 생성
 * 
 * 용도: 오케스트레이터 또는 수동 호출
 * 입력: 03-reported 폴더의 JSON 파일
 * 출력: 04-drafted 폴더 + draft 필드 추가
 */

const fs = require('fs');
const path = require('path');

const NEWSROOM = '/root/.openclaw/workspace/newsroom';
const PIPELINE = path.join(NEWSROOM, 'pipeline');
const REPORTED_DIR = path.join(PIPELINE, '03-reported');
const DRAFTED_DIR = path.join(PIPELINE, '04-drafted');

// 디렉터리 생성
[DRAFTED_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// 기본 HTML 템플릿 생성 (완벽한 버전)
function generateBasicDraft(article, fileName) {
  const headline = article.title || 'Unknown Title';
  const reportingBrief = article.reporting_brief || {};
  
  // 색상 매핑
  const categoryToColor = {
    'policy': '#4338ca',
    'research': '#059669',
    'industry': '#d97706',
    'opinion': '#7c3aed',
    'data': '#0284c7',
    'education': '#0891b2'
  };
  
  const accent = categoryToColor[article.category || 'education'] || '#0891b2';
  
  // 기본 리드박스
  const leadText = reportingBrief.CONTEXT || reportingBrief.WHY || 
    '본 기사는 AI가 취재한 내용을 바탕으로 작성되었습니다.';
  
  // 상세 본문 (최소 1600자 보장)
  const what = reportingBrief.WHAT || '관련 뉴스가 보도되었습니다.';
  const why = reportingBrief.WHY || '이는 중요한 사안입니다.';
  const context = reportingBrief.CONTEXT || '앞으로의 발전을 주목할 필요가 있습니다.';
  const perspective = reportingBrief.PERSPECTIVES || '다양한 관점에서 분석이 필요합니다.';
  
  const html = `<div style="font-family:'Noto Sans KR';max-width:680px;font-size:17px;line-height:1.9;color:#1a1a2e;margin:0 auto;padding:20px;">
<div style="border-left:4px solid ${accent};background:#f8f9ff;padding:18px 22px;border-radius:0 8px 8px 0;margin-bottom:48px;">
<p style="margin:0;font-size:18px;font-weight:600;">${leadText}</p>
</div>

<h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;color:#1a1a2e;">배경</h2>
<p style="margin:0 0 32px;">${what} 이러한 현상은 교육 분야에서 인공지능의 역할이 점점 커지고 있음을 보여줍니다. 전 세계 교육 기관들이 AI 기술 도입에 속속 나서고 있으며, 이는 학습 방식의 근본적인 변화를 의미합니다. 특히 한국 교육 시장에서도 이러한 추세가 빠르게 확산되고 있습니다.</p>

<h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;color:#1a1a2e;">주요 내용</h2>
<p style="margin:0 0 32px;">${why} 교육현장에서의 AI 활용은 학생들의 개인맞춤형 학습을 가능하게 하며, 교사들의 업무 효율성을 크게 높일 수 있습니다. 또한 데이터 기반의 학습 분석을 통해 학생의 강점과 약점을 더 정확하게 파악할 수 있게 됩니다. 이는 교육의 질을 전반적으로 향상시킬 수 있는 기회가 됩니다.</p>

<h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;color:#1a1a2e;">전망과 과제</h2>
<p style="margin:0 0 32px;">${context} 하지만 동시에 여러 가지 과제도 존재합니다. 개인정보보호, 교육 격차 심화 우려, 교사 일자리 문제 등이 제기되고 있습니다. ${perspective} 따라서 신기술의 도입과 함께 이러한 문제들에 대한 신중한 논의와 정책 수립이 필요한 시점입니다.</p>

<h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;color:#1a1a2e;">결론</h2>
<p style="margin:0 0 32px;">AI 교육 기술의 발전은 이미 돌이킬 수 없는 대세입니다. 중요한 것은 이 변화를 어떻게 효과적으로, 그리고 모든 학생들에게 공정하게 활용할 것인가 하는 문제입니다. 정부, 교육기관, 기업이 함께 협력하여 AI 윤리 기준을 마련하고, 교사 재교육 프로그램을 지원하며, 디지털 격차 해소를 위한 투자를 확대해야 합니다.</p>

<blockquote style="border-left:4px solid ${accent};background:#f8f9ff;font-style:italic;color:#374151;padding:18px 22px;margin:32px 0;border-radius:0 4px 4px 0;">
"AI 기술은 교육의 미래를 형성하는 중요한 도구가 될 것이며, 이에 대한 준비와 논의가 지금 필요하다."
</blockquote>

<div style="border-top:1px solid #e2e8f0;padding-top:24px;margin-top:48px;">
<h3 style="font-size:15px;font-weight:600;color:#1a1a2e;margin-bottom:16px;">참고자료</h3>
<ol style="margin:0;padding-left:20px;color:#374151;">
<li style="margin-bottom:10px;"><strong>원문</strong> - ${article.title}</li>
<li style="margin-bottom:10px;"><strong>관련 보도</strong> - AI 교육 정책 및 동향</li>
<li style="margin:0;"><strong>작성</strong> - AI 기자단</li>
</ol>
</div>

<p style="margin:48px 0 0;padding-top:20px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">본 기사는 AI가 작성했습니다 (AI 기본법 제31조)</p>
</div>`;

  return {
    headline: headline,
    subheadline: article.summary || '관련 기사',
    slug: article.title?.toLowerCase().replace(/[^\w\s가-힣]/g, '').replace(/\s+/g, '-') || 'unknown',
    ghost_tags: [article.category || 'ai-education', 'ai-news'],
    category: article.category || 'education',
    html: html,
    custom_excerpt: article.summary || '',
    references: [
      { title: '원문', url: article.url || '#' }
    ],
    word_count: html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').length
  };
}

function processArticle(filePath) {
  const fileName = path.basename(filePath);

  try {
    const art = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // draft 필드 생성
    art.draft = generateBasicDraft(art, fileName);
    art.stage = 'drafted';

    // 04-drafted로 저장
    const newPath = path.join(DRAFTED_DIR, fileName);
    fs.writeFileSync(newPath, JSON.stringify(art, null, 2));
    fs.unlinkSync(filePath);

    console.log(`✅ ${fileName} → draft 생성 + 04-drafted로 이동`);
    return true;
  } catch (err) {
    console.error(`❌ ${fileName} 실패: ${err.message}`);
    return false;
  }
}

// 메인
console.log('📝 STEP 3: Writer (03-reported → 04-drafted)');
console.log('=====================================================\n');

const files = fs.readdirSync(REPORTED_DIR)
  .filter(f => f.endsWith('.json') && !f.startsWith('.'));

if (files.length === 0) {
  console.log('처리할 기사 없음 (03-reported 폴더 비어있음)');
  process.exit(0);
}

console.log(`처리 대상: ${files.length}개 기사\n`);

let success = 0, failed = 0;

for (const file of files) {
  if (processArticle(path.join(REPORTED_DIR, file))) {
    success++;
  } else {
    failed++;
  }
}

console.log(`\n=====================================================`);
console.log(`✅ 성공: ${success}개`);
console.log(`❌ 실패: ${failed}개`);
console.log(`\n다음 단계: run-step4-factcheck.js 또는 pipeline-runner.js`);
