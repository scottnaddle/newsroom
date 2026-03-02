/**
 * OG 카드 생성기 — AskedTech 뉴스룸
 * 기사 헤드라인 + 카테고리로 1200x630 PNG 생성
 * 
 * 사용법: node generate-og-card.js '제목' '카테고리' '/output/path.png'
 */

const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');

// 한국어 폰트 등록
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',    'NotoSansBold');
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 'NotoSansRegular');

const CATEGORY_STYLES = {
  'policy':   { bg: '#4338ca', label: '교육 정책' },
  'research': { bg: '#059669', label: '연구·학술' },
  'industry': { bg: '#d97706', label: '산업·기업' },
  'opinion':  { bg: '#7c3aed', label: '오피니언'  },
  'data':     { bg: '#0284c7', label: '데이터'    },
};

/**
 * 한국어 단어 단위 줄바꿈
 * — 공백·구두점 앞에서만 줄바꿈 (음절 중간 분리 방지)
 */
function wrapKorean(ctx, text, maxWidth) {
  // 구분자 기준으로 토큰 분리 — '·'는 제외 (복합어 결합자이므로 분리 금지)
  const tokens = text.split(/(?<=[ …—,])|(?=[ …—,])/);
  const lines = [];
  let current = '';

  for (const token of tokens) {
    const test = current + token;
    if (ctx.measureText(test).width > maxWidth && current.trim()) {
      lines.push(current.trimEnd());
      current = token.trimStart();
    } else {
      current = test;
    }
  }
  if (current.trim()) lines.push(current.trimEnd());
  return lines;
}

function generateOGCard({ headline, category = 'policy', outputPath, date }) {
  const W = 1200, H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES['policy'];
  const dateStr = date || new Date().toLocaleDateString('ko-KR',
    { year: 'numeric', month: '2-digit', day: '2-digit' });

  // ── 배경 그라데이션 ──
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#f8f9ff');
  grad.addColorStop(1, '#eef2ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ── 왼쪽 컬러 바 ──
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, 10, H);

  // ── 우측 원형 장식 ──
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = style.bg;
  [240, 160, 80].forEach(r => {
    ctx.beginPath(); ctx.arc(980, 315, r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();

  // ── 카테고리 배지 ──
  ctx.font = '600 17px NotoSansBold';
  const labelW = ctx.measureText(style.label).width + 48;
  ctx.fillStyle = style.bg;
  ctx.beginPath();
  ctx.roundRect(60, 68, labelW, 44, 22);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(style.label, 60 + 24, 68 + 22);

  // ── 헤드라인 (단어 단위 줄바꿈) ──
  ctx.font = 'bold 48px NotoSansBold';
  ctx.fillStyle = '#1a1a2e';
  ctx.textBaseline = 'top';

  const MAX_TEXT_WIDTH = 720; // 우측 원형과 겹치지 않도록
  const lines = wrapKorean(ctx, headline, MAX_TEXT_WIDTH).slice(0, 3);
  const LINE_H = 66;
  const totalH = lines.length * LINE_H;
  // 카드 세로 중앙 기준 (배지 아래 영역)
  const startY = Math.max(160, (H - totalH) / 2 - 10);

  lines.forEach((line, i) => {
    ctx.fillText(line, 60, startY + i * LINE_H);
  });

  // ── 구분선 ──
  const sepY = startY + lines.length * LINE_H + 22;
  ctx.fillStyle = style.bg;
  ctx.fillRect(60, sepY, 100, 4);

  // ── 날짜 ──
  ctx.font = '400 19px NotoSansRegular';
  ctx.fillStyle = '#64748b';
  ctx.textBaseline = 'top';
  ctx.fillText(dateStr, 60, sepY + 18);

  // ── 사이트명 ──
  ctx.font = 'bold 26px NotoSansBold';
  ctx.fillStyle = style.bg;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('AskedTech', W - 48, H - 40);

  // ── AI 공개 ──
  ctx.font = '400 15px NotoSansRegular';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('AI Generated · AI 기본법 제31조', W - 48, H - 68);

  // ── 저장 ──
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ OG 카드 생성: ${outputPath} (${(buffer.length/1024).toFixed(1)}KB)`);
  return outputPath;
}

// CLI 실행
if (require.main === module) {
  const [,, headline, category, outputPath, date] = process.argv;
  if (!headline || !outputPath) {
    console.error('Usage: node generate-og-card.js "제목" "category" "/output.png" "2026.03.02"');
    process.exit(1);
  }
  generateOGCard({ headline, category: category || 'policy', outputPath, date });
}

module.exports = { generateOGCard, CATEGORY_STYLES };
