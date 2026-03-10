/**
 * 고급 이미지 다양화
 * - 헤드라인 분석으로 의미론적 매칭
 * - 역순 처리로 최신 기사 우선 다양화
 * - 신뢰성 높은 Unsplash ID만 사용
 */

const fs = require('fs');
const path = require('path');

// Unsplash 이미지 풀 로드
const imagePool = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../shared/config/unsplash-images.json'),
  'utf-8'
));

// 카테고리 키워드 매칭 (순서 중요! 우선순위 높은 것부터)
const categoryKeywords = {
  '교실_학생': [
    '교실', '학생', '교사', '수업', '학교', '고교', '초등', '대학',
    '강의실', '학급', '교육', '선생님', '학습', '강사'
  ],
  '데이터_통계': [
    '데이터', '통계', '조사', '비율', '분석', '차트', '그래프',
    '연구', '설문', '수치'
  ],
  '기업_기술': [
    'lg', 'ms', '구글', '마이크로소프트', '코파일럿',
    '아마존', '애플', '오픈ai', 'deepmind'
  ],
  '교육_정책': [
    '정책', '법안', '법', '규제', '의무', '교육부', '의회', '주',
    '거버넌스', '지침', '가이드라인', '원칙'
  ]
};

// 카테고리 우선순위 (더 구체적인 것부터)
const categoryOrder = ['기업_기술', '데이터_통계', '교실_학생', '교육_정책'];

// 기사를 카테고리로 분류 (우선순위 있음)
function categorizeArticle(headline, tags) {
  const combined = (headline + ' ' + (tags || []).join(' ')).toLowerCase();
  
  // 우선순위 순으로 확인
  for (const category of categoryOrder) {
    const keywords = categoryKeywords[category];
    for (const keyword of keywords) {
      if (combined.includes(keyword)) {
        return category;
      }
    }
  }
  
  return '기본';
}

// 이미지 URL 생성
function buildUnsplashUrl(photoId) {
  return `https://images.unsplash.com/${photoId}?w=1200&h=630&fit=crop&q=85&auto=format`;
}

// 메인
async function main() {
  const publishedDir = path.join(__dirname, '../pipeline/08-published');
  let files = fs.readdirSync(publishedDir).filter(f => f.endsWith('.json'));

  console.log(`\n🎨 고급 이미지 다양화 (역순 처리)...\n`);

  // 최신순 역정렬 (최신 기사부터 처리)
  files.sort().reverse();

  // 카테고리별 인덱스 추적
  const categoryIndices = {};
  for (const category of Object.keys(imagePool)) {
    categoryIndices[category] = 0;
  }

  let stats = { updated: 0, unchanged: 0, categorized: {} };

  for (const file of files) {
    const filePath = path.join(publishedDir, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      continue;
    }

    if (!data.draft) continue;

    const { headline, ghost_tags } = data.draft;
    const category = categorizeArticle(headline, ghost_tags);
    
    // 통계 업데이트
    if (!stats.categorized[category]) stats.categorized[category] = 0;
    stats.categorized[category]++;

    // 이미지 선택 (회전식)
    const images = imagePool[category] || imagePool['기본'];
    const idx = categoryIndices[category] % images.length;
    categoryIndices[category]++;
    
    const photoId = images[idx];
    const newUrl = buildUnsplashUrl(photoId);
    const oldUrl = data.draft.feature_image;

    if (oldUrl === newUrl) {
      stats.unchanged++;
    } else {
      data.draft.feature_image = newUrl;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      stats.updated++;
      
      console.log(`✅ [${category.padEnd(8)}] ${headline.substring(0, 45).padEnd(45)} | ${photoId.substring(0, 20)}`);
    }
  }

  console.log(`\n✨ 완료!`);
  console.log(`  • 업데이트됨: ${stats.updated}개`);
  console.log(`  • 유지됨: ${stats.unchanged}개`);
  console.log(`\n📊 카테고리별 분포:`);
  for (const [cat, count] of Object.entries(stats.categorized)) {
    console.log(`  • ${cat}: ${count}개`);
  }
  console.log('');
}

main().catch(console.error);
