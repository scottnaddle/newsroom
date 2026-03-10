/**
 * drafted 기사 HTML 디자인 재적용 및 수정
 * - 빠진 html/references 필드 복구
 * - 스타일 일괄 적용
 */

const fs = require('fs');
const path = require('path');

// 카테고리 색상
const ACCENT = {
  policy:   '#4338ca',
  research: '#059669',
  industry: '#d97706',
  opinion:  '#7c3aed',
  data:     '#0284c7',
  education: '#0891b2',
};

// 카테고리 탐지
function detectCategory(tags) {
  const t = (tags||[]).join(' ').toLowerCase();
  if (t.includes('정책') || t.includes('법') || t.includes('교육부') || t.includes('의회') || t.includes('가이드')) return 'policy';
  if (t.includes('연구') || t.includes('학술') || t.includes('데이터')) return 'research';
  if (t.includes('구글') || t.includes('기업') || t.includes('에듀테크') || t.includes('산업')) return 'industry';
  if (t.includes('의견') || t.includes('칼럼') || t.includes('오피니언')) return 'opinion';
  if (t.includes('통계') || t.includes('수치') || t.includes('조사')) return 'data';
  if (t.includes('교육') || t.includes('교사')) return 'education';
  return 'policy';
}

// HTML 정리: kg-card 태그 제거, 이스케이프 문자 복구
function cleanHtml(html) {
  if (!html) return '';
  return html
    .replace(/<!--kg-card-begin: html-->/g, '')
    .replace(/<!--kg-card-end: html-->/g, '')
    .replace(/\\n/g, '\n')  // 이스케이프된 개행 복구
    .replace(/\\t/g, '\t')  // 이스케이프된 탭 복구
    .replace(/\\/g, '')     // 남은 백슬래시 제거
    .trim();
}

// 문단 여백 스타일 추가
function addParagraphStyles(html) {
  return html.replace(/<p(?![^>]*style)([^>]*)>/gi, '<p$1 style="margin:0 0 32px;">');
}

// 섹션 헤더 스타일 추가
function addH2Styles(html, color) {
  return html.replace(/<h2([^>]*)>/gi, (match, attrs) => {
    if (attrs.includes('style')) return match;
    return `<h2 style="font-size:19px;font-weight:700;color:#111;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;"${attrs}>`;
  });
}

// 인용 블록 스타일 추가
function addBlockquoteStyles(html, color) {
  return html.replace(/<blockquote([^>]*)>/gi, (match, attrs) => {
    if (attrs.includes('style')) return match;
    return `<blockquote style="border-left:4px solid ${color};padding:18px 24px;margin:0 0 44px;background:#f8f9ff;border-radius:0 6px 6px 0;"${attrs}>`;
  });
}

// 리드 박스 추출/생성
function ensureLeadBox(html, color) {
  // 이미 리드 박스가 있으면 스킵
  if (html.includes('border-left:4px solid') && html.includes('background:#f8f9ff')) {
    return html;
  }
  
  // 첫 p 태그를 리드 박스로 변환
  const firstP = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!firstP) return html;
  
  const leadContent = firstP[1];
  const leadBox = `<div style="border-left:4px solid ${color};padding:18px 22px;background:#f8f9ff;border-radius:0 8px 8px 0;margin-bottom:48px;">
    <p style="margin:0;font-size:17px;line-height:1.85;color:#1a1a2e;">${leadContent}</p>
  </div>`;
  
  return html.replace(firstP[0], leadBox);
}

// 참고 자료 섹션 확보
function ensureReferencesSection(html, references) {
  // 이미 참고자료 섹션이 있으면 스킵
  if (html.includes('참고 자료')) {
    return html;
  }
  
  if (!references || references.length === 0) {
    return html;
  }
  
  const refHtml = `<div style="margin-top:48px;padding-top:20px;border-top:1px solid #e2e8f0;">
    <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#64748b;">참고 자료</p>
    <ol style="font-size:14px;color:#64748b;padding-left:18px;margin:0;line-height:1.9;">
      ${references.map((ref, i) => 
        `<li style="margin-bottom:6px;"><a href="${ref.url}" style="color:#4338ca;text-decoration:none;">${ref.title}</a></li>`
      ).join('')}
    </ol>
  </div>`;
  
  return html + '\n' + refHtml;
}

// AI 각주 추가 (없으면)
function ensureAIFootnote(html) {
  if (html.includes('AI 기본법 제31조')) {
    return html;
  }
  
  const footnote = `<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">본 기사는 AI가 작성했습니다 (AI 기본법 제31조)</p>`;
  return html + '\n' + footnote;
}

// 최종 래퍼 적용
function wrapWithStyle(html, color) {
  const wrapper = `<!--kg-card-begin: html-->
<div style="font-family:'Noto Sans KR',Apple SD Gothic Neo,sans-serif;max-width:680px;margin:0 auto;color:#1a1a2e;font-size:17px;line-height:1.9;">

${html}

</div>
<!--kg-card-end: html-->`;
  
  return wrapper;
}

// 메인 처리
async function main() {
  const draftedDir = path.join(__dirname, '../pipeline/04-drafted');
  const files = fs.readdirSync(draftedDir).filter(f => f.endsWith('.json'));

  console.log(`\n📝 processed ${files.length} drafted articles...\n`);

  let updated = 0;
  for (const file of files) {
    const filePath = path.join(draftedDir, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.log(`❌ JSON 파싱 에러: ${file} — ${err.message}`);
      continue;
    }
    
    if (!data.draft) {
      console.log(`⏭️  스킵 (draft 필드 없음): ${file}`);
      continue;
    }

    const { headline, html, references, ghost_tags } = data.draft;
    const category = detectCategory(ghost_tags);
    const color = ACCENT[category];

    console.log(`\n🔧 처리 중: ${headline}`);

    // 1. HTML 정리
    let cleanedHtml = cleanHtml(html || '');
    
    if (!cleanedHtml) {
      console.log(`   ⚠️  HTML 필드가 비어있음 — 건너뜸 (작성기자 재실행 필요)`);
      continue;
    }

    // 2. 스타일 적용
    cleanedHtml = addParagraphStyles(cleanedHtml);
    cleanedHtml = addH2Styles(cleanedHtml, color);
    cleanedHtml = addBlockquoteStyles(cleanedHtml, color);
    cleanedHtml = ensureLeadBox(cleanedHtml, color);
    cleanedHtml = ensureReferencesSection(cleanedHtml, references);
    cleanedHtml = ensureAIFootnote(cleanedHtml);
    cleanedHtml = wrapWithStyle(cleanedHtml, color);

    // 3. draft 필드 업데이트
    data.draft.html = cleanedHtml;

    // 4. 파일 저장
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`   ✅ 완료: HTML 스타일 재적용`);
    updated++;
  }

  console.log(`\n✨ 전체 완료! (${updated}개 기사 업데이트됨)\n`);
}

main().catch(console.error);
