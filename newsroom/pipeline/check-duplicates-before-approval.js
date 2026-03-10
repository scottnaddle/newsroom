const fs = require('fs');
const path = require('path');

// Levenshtein 거리 계산
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// 제목 정규화
function normalizeTitle(title) {
  return title.toLowerCase()
    .replace(/[^\w\s가-힣]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 유사도 계산 (%)
function similarity(a, b) {
  const norm_a = normalizeTitle(a);
  const norm_b = normalizeTitle(b);
  const maxLen = Math.max(norm_a.length, norm_b.length);
  const dist = levenshtein(norm_a, norm_b);
  return ((maxLen - dist) / maxLen) * 100;
}

// 06-desk-approved 기사 로드 (REVISE 파일 제외)
const deskApprovedDir = './06-desk-approved';
const deskArticles = fs.existsSync(deskApprovedDir) 
  ? fs.readdirSync(deskApprovedDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('REVISE_'))
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(deskApprovedDir, f), 'utf8'));
      return data.draft ? { file: f, headline: data.draft.headline, id: data.id } : null;
    })
    .filter(Boolean)
  : [];

// 08-published 기사 로드 (REVISE 파일 제외)
const publishedDir = './08-published';
const publishedArticles = fs.existsSync(publishedDir)
  ? fs.readdirSync(publishedDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('REVISE_'))
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(publishedDir, f), 'utf8'));
      return data.draft ? { file: f, headline: data.draft.headline, id: data.id } : null;
    })
    .filter(Boolean)
  : [];

// 05-fact-checked 기사 로드 (REVISE 파일 제외)
const factCheckedDir = './05-fact-checked';
const factCheckedArticles = fs.readdirSync(factCheckedDir)
  .filter(f => f.endsWith('.json') && !f.startsWith('REVISE_'))
  .map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(factCheckedDir, f), 'utf8'));
    return data.draft ? { file: f, headline: data.draft.headline, id: data.id } : null;
  })
  .filter(Boolean);

console.log('\n📊 중복 기사 감지 리포트\n');
console.log(`총 검사 기사: ${factCheckedArticles.length}개`);
console.log(`기존 발행 기사: ${publishedArticles.length}개`);
console.log(`데스크 승인 대기: ${deskArticles.length}개\n`);

let killList = [];
let flagList = [];

// 각 fact-checked 기사와 published/desk-approved 비교
factCheckedArticles.forEach(article => {
  console.log(`\n🔍 "${article.headline.substring(0, 50)}..."`);
  
  let maxSim = 0;
  let maxMatch = null;

  // published와 비교
  publishedArticles.forEach(pub => {
    const sim = similarity(article.headline, pub.headline);
    console.log(`   vs [Published] ${sim.toFixed(1)}% - "${pub.headline.substring(0, 40)}..."`);
    if (sim > maxSim) {
      maxSim = sim;
      maxMatch = { ...pub, stage: 'published' };
    }
  });

  // desk-approved와 비교
  deskArticles.forEach(desk => {
    const sim = similarity(article.headline, desk.headline);
    console.log(`   vs [Desk] ${sim.toFixed(1)}% - "${desk.headline.substring(0, 40)}..."`);
    if (sim > maxSim) {
      maxSim = sim;
      maxMatch = { ...desk, stage: 'desk-approved' };
    }
  });

  if (maxSim >= 95) {
    console.log(`   ❌ 자동 KILL (${maxSim.toFixed(1)}% 유사 - 완전 중복)\n`);
    killList.push({ file: article.file, headline: article.headline, similarity: maxSim, match: maxMatch });
  } else if (maxSim >= 85) {
    console.log(`   ⚠️ FLAG (${maxSim.toFixed(1)}% 유사 - 수동 검토 필요)\n`);
    flagList.push({ file: article.file, headline: article.headline, similarity: maxSim, match: maxMatch });
  } else {
    console.log(`   ✅ PASS (${maxSim.toFixed(1)}% - 고유 기사)\n`);
  }
});

if (killList.length > 0) {
  console.log(`\n🔴 자동 KILL 대상 (${killList.length}개):`);
  killList.forEach(item => {
    console.log(`   - ${item.file}: ${item.similarity.toFixed(1)}% 유사`);
  });
}

if (flagList.length > 0) {
  console.log(`\n🟡 수동 검토 필요 (${flagList.length}개):`);
  flagList.forEach(item => {
    console.log(`   - ${item.file}: ${item.similarity.toFixed(1)}% 유사`);
  });
}

console.log(`\n최종 결과: KILL ${killList.length}개, FLAG ${flagList.length}개, PASS ${factCheckedArticles.length - killList.length - flagList.length}개\n`);
