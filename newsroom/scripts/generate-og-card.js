/**
 * OG 카드 생성기 — AskedTech 뉴스룸
 * node-canvas (Cairo 기반) + NotoSansCJK → 한국어 완벽 렌더링
 */

const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');

// 한국어 폰트 등록 (시스템 NotoSansCJK)
registerFont('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',    { family: 'NotoKR', weight: 'bold' });
registerFont('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', { family: 'NotoKR', weight: 'normal' });

const CATEGORY_STYLES = {
  'policy':   { bg: '#4338ca', label: '교육 정책' },
  'research': { bg: '#059669', label: '연구·학술' },
  'industry': { bg: '#d97706', label: '산업·기업' },
  'opinion':  { bg: '#7c3aed', label: '오피니언'  },
  'data':     { bg: '#0284c7', label: '데이터'    },
};

/** hex → RGB */
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}

/**
 * 한국어 단어 단위 줄바꿈
 * '·' 복합어 분리 금지, '…' '—' ' ' 기준으로만 줄바꿈
 */
function wrapText(ctx, text, maxWidth) {
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

/** 둥근 사각형 (node-canvas는 roundRect 없음) */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function generateOGCard({ headline, category = 'policy', outputPath, date }) {
  const W = 1200, H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES['policy'];
  const { r, g, b } = hexToRgb(style.bg);
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
  [240, 160, 80].forEach(radius => {
    ctx.beginPath();
    ctx.arc(980, 315, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},0.07)`;
    ctx.fill();
  });
  ctx.restore();

  // ── 카테고리 배지 ──
  ctx.font = 'bold 17px NotoKR';
  const labelW = ctx.measureText(style.label).width + 48;
  ctx.fillStyle = style.bg;
  roundRect(ctx, 60, 68, labelW, 44, 22);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(style.label, 84, 90);

  // ── 헤드라인 ──
  ctx.font = 'bold 48px NotoKR';
  ctx.fillStyle = '#1a1a2e';
  ctx.textBaseline = 'top';
  const lines = wrapText(ctx, headline, 720).slice(0, 3);
  const LINE_H = 66;
  const startY = Math.max(160, (H - lines.length * LINE_H) / 2 - 10);
  lines.forEach((line, i) => ctx.fillText(line, 60, startY + i * LINE_H));

  // ── 구분선 ──
  const sepY = startY + lines.length * LINE_H + 22;
  ctx.fillStyle = style.bg;
  ctx.fillRect(60, sepY, 100, 4);

  // ── 날짜 ──
  ctx.font = '19px NotoKR';
  ctx.fillStyle = '#64748b';
  ctx.textBaseline = 'top';
  ctx.fillText(dateStr, 60, sepY + 18);

  // ── 사이트명 ──
  ctx.font = 'bold 26px NotoKR';
  ctx.fillStyle = style.bg;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('AskedTech', W - 48, H - 40);

  // ── AI 공개 ──
  ctx.font = '15px NotoKR';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('AI Generated · AI 기본법 제31조', W - 48, H - 66);

  // ── 저장 ──
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ OG 카드 생성: ${outputPath} (${(buffer.length/1024).toFixed(1)}KB)`);
  return outputPath;
}

if (require.main === module) {
  const [,, headline, category, outputPath, date] = process.argv;
  if (!headline || !outputPath) {
    console.error('Usage: node generate-og-card.js "제목" "category" "/output.png" "2026.03.02"');
    process.exit(1);
  }
  generateOGCard({ headline, category: category || 'policy', outputPath, date });
}

module.exports = { generateOGCard, CATEGORY_STYLES };
