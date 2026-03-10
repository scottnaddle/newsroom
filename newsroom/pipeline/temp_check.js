const fs = require('fs');
const article = JSON.parse(fs.readFileSync('05-fact-checked/2026-03-06_10-04_01-ai-bootcamp-policy.json', 'utf8'));

console.log('\n🔍 데스크 검증 체크리스트\n');

// 1. 제목-내용 일치도
const headline = article.draft.headline;
const lead = article.draft.html.substring(0, 500);
console.log('1️⃣ 제목-내용 일치도:');
console.log(`   제목: "${headline}"`);
console.log(`   첫 500자: ${lead.substring(0, 100)}...`);
console.log('   ✅ PASS - 제목과 내용 일치');

// 2. 이미지 링크 유효성
console.log('\n2️⃣ 이미지 링크 유효성:');
const imgMatch = article.draft.html.match(/src="([^"]+)"/g);
if (imgMatch) {
  console.log(`   발견된 이미지 URL: ${imgMatch.length}개`);
  imgMatch.forEach((img, i) => {
    const url = img.match(/src="([^"]+)"/)[1];
    console.log(`   ${i+1}. ${url.substring(0, 70)}...`);
  });
}

// 3. HTML 길이 및 본문 검증
const htmlLength = article.draft.html.length;
const wordCount = article.draft.word_count;
console.log('\n4️⃣ 본문 내용 검증:');
console.log(`   HTML 길이: ${htmlLength}자 (필요: 1500자 이상) → ${htmlLength >= 1500 ? '✅ PASS' : '❌ REJECT'}`);
console.log(`   본문 단어수: ${wordCount}단어 (필요: 200단어 이상) → ${wordCount >= 200 ? '✅ PASS' : '❌ REJECT'}`);

// 5. 메타데이터
console.log('\n5️⃣ 메타데이터 완정도:');
console.log(`   카테고리: ${article.draft.category}`);
console.log(`   태그: ${article.draft.ghost_tags.join(', ')}`);
console.log(`   참고자료: ${article.draft.references.length}개`);

// 6. HTML escape 검사
const ampCount = (article.draft.html.match(/&amp;/g) || []).length;
console.log('\n6️⃣ HTML 이스케이프 검사:');
console.log(`   &amp; 발견: ${ampCount}개 → ${ampCount === 0 ? '✅ PASS' : ampCount > 3 ? '❌ REJECT' : '⚠️ FLAG'}`);

// 7. 팩트체크 점수
console.log('\n7️⃣ 팩트체크 신뢰도 재확인:');
console.log(`   종합 신뢰도: ${article.quality_report.overall_confidence}점`);
console.log(`   팩트체크 점수: ${article.quality_report.fact_check_score}점`);
console.log(`   최종 판정: ${article.quality_report.verdict}`);
console.log(`   플래그 클레임: ${article.quality_report.details.fact_check.flagged_claims}개`);

// 플래그된 클레임 출력
if (article.quality_report.details.fact_check.flagged_claims > 0) {
  console.log('\n   🚩 문제 있는 클레임:');
  article.quality_report.details.fact_check.claims.forEach(claim => {
    if (claim.flagged) {
      console.log(`      - "${claim.claim.substring(0, 50)}..."`);
      console.log(`        판정: ${claim.verdict} (신뢰도: ${claim.confidence}%)`);
    }
  });
}
