const fs = require('fs');
const path = require('path');

// SOUL.md의 7가지 체크리스트 구현

function normalizeTitle(title) {
  return title.toLowerCase()
    .replace(/[^\w\s가-힣]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateSimilarity(a, b) {
  const norm_a = normalizeTitle(a);
  const norm_b = normalizeTitle(b);
  const maxLen = Math.max(norm_a.length, norm_b.length);
  let matches = 0;
  for (let i = 0; i < Math.min(norm_a.length, norm_b.length); i++) {
    if (norm_a[i] === norm_b[i]) matches++;
  }
  return (matches / maxLen) * 100;
}

function stripHTML(html) {
  return html.replace(/<[^>]*>/g, ' ').trim();
}

function checkArticle(filePath, fileName) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const article = data.draft || {};
  const html = article.html || '';
  const plainText = stripHTML(html);
  
  const result = {
    id: data.id || 'unknown',
    fileName: fileName,
    headline: article.headline || 'N/A',
    confidence: data.quality_report?.overall_confidence || 0,
    verdict: data.quality_report?.verdict || 'UNKNOWN',
    issues: [],
    passes: [],
    final_verdict: 'UNKNOWN'
  };

  // ✅ 1. 제목-내용 일치도 검사
  const likelyMatch = calculateSimilarity(article.headline || '', plainText.substring(0, 200));
  if (likelyMatch >= 80) {
    result.passes.push('✅ 1. 제목-내용 일치도: ' + likelyMatch.toFixed(1) + '%');
  } else if (likelyMatch >= 50) {
    result.issues.push(`🚩 1. 제목-내용 불일치: ${likelyMatch.toFixed(1)}% (500자 리드 검증 필요)`);
  } else {
    result.issues.push(`❌ 1. 제목-내용 심각 불일치: ${likelyMatch.toFixed(1)}%`);
  }

  // ✅ 2. 이미지 링크 유효성
  const imgUrls = (html.match(/src="([^"]*unsplash[^"]*)"/g) || []);
  const hasImage = imgUrls.length > 0;
  if (hasImage) {
    // curl로 확인할 수 없으니 URL 형식만 검증
    if (imgUrls.some(url => url.includes('404') || url.includes('/tmp/'))) {
      result.issues.push('❌ 2. 이미지 손상 또는 임시 경로 발견');
    } else {
      result.passes.push('✅ 2. 이미지 URL 형식 정상');
    }
  } else {
    result.issues.push('🚩 2. 이미지 없음 (feature_image 필요)');
  }

  // ✅ 3. HTML escape 검증
  const ampCount = (html.match(/&amp;/g) || []).length;
  if (ampCount === 0) {
    result.passes.push('✅ 3. HTML escape 없음');
  } else if (ampCount < 3) {
    result.issues.push(`🚩 3. HTML escape 발견: ${ampCount}개 (소수)`);
  } else {
    result.issues.push(`❌ 3. HTML escape 심각: ${ampCount}개 이상`);
  }

  // ✅ 4. 본문 내용 검증
  const htmlLen = html.length;
  const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
  
  if (htmlLen < 1500) {
    result.issues.push(`❌ 4. HTML 너무 짧음: ${htmlLen}자 (최소 1500자)`);
  } else {
    result.passes.push(`✅ 4a. HTML 길이 충분: ${htmlLen}자`);
  }

  if (wordCount < 200) {
    result.issues.push(`❌ 4b. 단어 수 부족: ${wordCount}단어 (최소 200)`);
  } else {
    result.passes.push(`✅ 4b. 단어 수 충분: ${wordCount}단어`);
  }

  if (plainText.length < 500) {
    result.issues.push(`❌ 4c. 본문 너무 짧음: ${plainText.length}자 (최소 500자)`);
  } else {
    result.passes.push(`✅ 4c. 본문 길이 충분: ${plainText.length}자`);
  }

  // ✅ 5. 메타데이터 완정도
  const feature_image = article.feature_image;
  const og_image = article.og_image;
  const meta_title = article.meta_title;
  const meta_desc = article.meta_description;

  if (!feature_image && !og_image) {
    result.issues.push('🚩 5. 메타데이터 부족: og_image/feature_image 없음');
  } else if (feature_image?.includes('/tmp/')) {
    result.issues.push('❌ 5. 이미지 경로 오류: /tmp/ 임시 경로');
  } else {
    result.passes.push('✅ 5. 메타데이터 구조 정상');
  }

  // ✅ 6. AI 배지 검증
  const hasAIBadge = html.includes('🤖 AI 생성') || html.includes('🤖 AI생성');
  if (hasAIBadge) {
    result.issues.push('❌ 6. AI 배지(상단 pill) 발견 - 제거 필수');
  } else {
    result.passes.push('✅ 6. AI 배지 없음 (또는 정상 위치)');
  }

  // ✅ 7. 팩트체크 신뢰도 재확인
  if (data.quality_report?.overall_confidence < 75) {
    result.issues.push(`❌ 7. 팩트체크 신뢰도 낮음: ${data.quality_report.overall_confidence} (< 75)`);
  } else if (data.quality_report?.overall_confidence >= 90) {
    result.passes.push(`✅ 7. 팩트체크 신뢰도 높음: ${data.quality_report.overall_confidence} (≥ 90)`);
  } else {
    result.passes.push(`✅ 7. 팩트체크 신뢰도 적절: ${data.quality_report.overall_confidence}`);
  }

  // 최종 판정
  if (result.issues.length === 0) {
    result.final_verdict = 'APPROVE (06-desk-approved)';
  } else if (result.issues.filter(i => i.startsWith('❌')).length >= 3) {
    result.final_verdict = 'REJECT (rejected/)';
  } else if (result.issues.filter(i => i.startsWith('❌')).length === 0 && result.issues.length > 0) {
    result.final_verdict = 'REQUEST-REVISION (작성기자 수정)';
  } else {
    result.final_verdict = 'UNKNOWN';
  }

  return result;
}

// 메인 실행
console.log('\n📋 COMPREHENSIVE DESK VALIDATION\n');
console.log('=' .repeat(80));

const factCheckDir = '05-fact-checked';
const files = fs.readdirSync(factCheckDir).filter(f => f.endsWith('.json'));

const allResults = [];
const summary = { approve: 0, reject: 0, revise: 0 };

files.forEach(file => {
  try {
    const result = checkArticle(path.join(factCheckDir, file), file);
    allResults.push(result);

    console.log(`\n🔍 ${result.headline}`);
    console.log(`   ID: ${result.id}`);
    console.log(`   신뢰도: ${result.confidence}, 팩트체크 수심: ${result.verdict}`);
    console.log(`\n   [통과 항목]`);
    result.passes.forEach(p => console.log(`   ${p}`));
    
    if (result.issues.length > 0) {
      console.log(`\n   [문제 항목]`);
      result.issues.forEach(i => console.log(`   ${i}`));
    }

    console.log(`\n   ➜ ${result.final_verdict}`);

    if (result.final_verdict.includes('APPROVE')) summary.approve++;
    else if (result.final_verdict.includes('REJECT')) summary.reject++;
    else if (result.final_verdict.includes('REQUEST')) summary.revise++;

  } catch (e) {
    console.log(`❌ Error processing ${file}: ${e.message}`);
  }
});

// 최종 리포트
console.log('\n' + '='.repeat(80));
console.log('\n📊 최종 결과\n');
console.log(`✅ 승인 (06-desk-approved/): ${summary.approve}개`);
console.log(`🚩 수정 요청 (REQUEST-REVISION): ${summary.revise}개`);
console.log(`❌ 거부 (rejected/): ${summary.reject}개`);
console.log(`\n🎯 액션 아이템:`);

allResults.forEach(r => {
  if (r.final_verdict.includes('APPROVE')) {
    console.log(`  ✓ ${r.id}: ${r.headline} → 06-desk-approved/로 이동`);
  } else if (r.final_verdict.includes('REJECT')) {
    console.log(`  ✗ ${r.id}: ${r.headline} → rejected/로 이동 (사유: ${r.issues.filter(i => i.startsWith('❌'))[0]?.substring(3) || 'multiple issues'})`);
  } else if (r.final_verdict.includes('REQUEST')) {
    console.log(`  ~ ${r.id}: ${r.headline} → 작성기자에 수정 지시 (항목: ${r.issues.length}개)`);
  }
});

console.log('\n' + '='.repeat(80));
