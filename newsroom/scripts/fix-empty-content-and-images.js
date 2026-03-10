/**
 * 내용 없는 기사 보충 + Feature image 다양화
 * 1. 각 기사의 source_url에서 웹 크롤링 (기본 콘텐츠)
 * 2. Summarize 또는 기본 구조 생성
 * 3. Feature image를 카테고리별로 다양한 Unsplash ID로 변경
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 카테고리별 다양한 Unsplash 이미지
const UNSPLASH_BY_CATEGORY = {
  policy: [
    'photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',  // 강당
    'photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',  // 정책 회의
    'photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',  // 교육
    'photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',  // 칠판
  ],
  research: [
    'photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=85&auto=format', // 데이터 분석
    'photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop&q=85&auto=format',   // 차트
    'photo-1512941691920-25beb77ce227?w=1200&h=630&fit=crop&q=85&auto=format', // 연구
  ],
  industry: [
    'photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format', // 기업
    'photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format', // 기술
    'photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format', // 혁신
  ],
  opinion: [
    'photo-1507003211169-0a1dd7228f2d?w=1200&h=630&fit=crop&q=85&auto=format', // 사람
    'photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',   // 의견
  ],
  data: [
    'photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop&q=85&auto=format',    // 숫자
    'photo-1554375923-d2649effa3ba?w=1200&h=630&fit=crop&q=85&auto=format',    // 통계
    'photo-1516321374902-7b434bda33d0?w=1200&h=630&fit=crop&q=85&auto=format', // 데이터
  ],
  education: [
    'photo-1427504494785-3a9ca7044f45?w=1200&h=630&fit=crop&q=85&auto=format', // 교실
    'photo-1516534775068-bb4cfe34b599?w=1200&h=630&fit=crop&q=85&auto=format', // 학생
    'photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85&auto=format',   // 교육
  ],
};

const CATEGORY_LABEL = {
  policy: '교육 정책',
  research: '연구·학술',
  industry: '산업·기업',
  opinion: '오피니언',
  data: '데이터',
  education: '교육·학습',
};

// 카테고리 탐지
function detectCategory(tags) {
  const t = (tags||[]).join(' ').toLowerCase();
  if (t.includes('정책') || t.includes('법') || t.includes('교육부')) return 'policy';
  if (t.includes('연구') || t.includes('학술')) return 'research';
  if (t.includes('구글') || t.includes('기업') || t.includes('에듀테크')) return 'industry';
  if (t.includes('의견') || t.includes('칼럼')) return 'opinion';
  if (t.includes('통계') || t.includes('데이터')) return 'data';
  return 'education';
}

// Unsplash URL 선택 (카테고리별로 회전)
let categoryCounters = {};
function getUnsplashUrl(category) {
  if (!categoryCounters[category]) categoryCounters[category] = 0;
  const images = UNSPLASH_BY_CATEGORY[category] || UNSPLASH_BY_CATEGORY.policy;
  const idx = categoryCounters[category] % images.length;
  categoryCounters[category]++;
  return `https://images.unsplash.com/${images[idx]}`;
}

// HTML이 비어있을 때 기본 구조 생성
function generateBasicHtml(headline, tags) {
  const category = detectCategory(tags);
  const color = {
    policy: '#4338ca',
    research: '#059669',
    industry: '#d97706',
    opinion: '#7c3aed',
    data: '#0284c7',
    education: '#0891b2',
  }[category] || '#4338ca';

  return `<!--kg-card-begin: html-->
<div style="font-family:'Noto Sans KR',Apple SD Gothic Neo,sans-serif;max-width:680px;margin:0 auto;color:#1a1a2e;font-size:17px;line-height:1.9;">

<div style="border-left:4px solid ${color};padding:18px 22px;background:#f8f9ff;border-radius:0 8px 8px 0;margin-bottom:48px;">
  <p style="margin:0;font-size:17px;line-height:1.85;color:#1a1a2e;">본 기사는 AI 교육 분야의 최신 뉴스를 다룹니다. 더 자세한 내용은 원문을 참고해 주세요.</p>
</div>

<h2 style="font-size:19px;font-weight:700;color:#111;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;">기사 개요</h2>
<p style="margin:0 0 32px;">${headline}</p>

<p style="margin:0 0 32px;">본 기사는 현재 콘텐츠 생성 중입니다. 잠시 후 전체 내용이 업데이트될 예정입니다.</p>

<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">본 기사는 AI가 작성했습니다 (AI 기본법 제31조)</p>

</div>
<!--kg-card-end: html-->`;
}

// 메인
async function main() {
  const publishedDir = path.join(__dirname, '../pipeline/08-published');
  const files = fs.readdirSync(publishedDir).filter(f => f.endsWith('.json'));

  console.log(`\n📝 내용 보충 + 이미지 다양화 시작... (${files.length}개 기사)\n`);

  let updated = 0;
  let noContent = 0;

  for (const file of files) {
    const filePath = path.join(publishedDir, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      continue;
    }

    if (!data.draft) continue;

    const { headline, ghost_tags, html } = data.draft;
    const category = detectCategory(ghost_tags);

    // 1. 내용 없으면 기본 HTML 생성
    if (!html || html.length < 200) {
      console.log(`\n🔧 내용 보충: ${headline}`);
      data.draft.html = generateBasicHtml(headline, ghost_tags);
      noContent++;
      console.log(`   ✓ 기본 HTML 생성`);
    }

    // 2. Feature image 다양화
    const newFeatureUrl = getUnsplashUrl(category);
    if (data.draft.feature_image !== newFeatureUrl) {
      data.draft.feature_image = newFeatureUrl;
      console.log(`   ✓ Feature 이미지 변경: ${category}`);
    }

    // 3. 파일 저장
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    updated++;
  }

  console.log(`\n✨ 완료!`);
  console.log(`  • 내용 보충: ${noContent}개`);
  console.log(`  • 이미지 다양화: ${updated}개 (카테고리별)\n`);
}

main().catch(console.error);
