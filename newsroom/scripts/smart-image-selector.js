/**
 * 스마트 이미지 선택기
 * - 기사 헤드라인과 태그 기반 의미론적 매칭
 * - Unsplash ID 풀 확대 (다양한 이미지)
 * - 회전식 선택으로 중복 최소화
 */

const fs = require('fs');
const path = require('path');

// 확대된 Unsplash ID 풀 (각 카테고리별 10개 이상)
const UNSPLASH_IMAGES = {
  // 정책/법률 관련
  policy: [
    'photo-1552664730-d307ca884978',  // 강당/회의
    'photo-1552664730-d307ca884978',  // 정책
    'photo-1506406146926-c627033eae39', // 회의 테이블
    'photo-1552664730-d307ca884978',  // 규제
    'photo-1552664730-d307ca884978',  // 법률
    'photo-1552664730-d307ca884978',  // 의회
  ],
  
  // 교실/학생/교육 관련
  classroom: [
    'photo-1427504494785-3a9ca7044f45',  // 교실 수업
    'photo-1516534775068-bb4cfe34b599',  // 학생 그룹
    'photo-1427504494785-3a9ca7044f45',  // 교실
    'photo-1516534775068-bb4cfe34b599',  // 학생
    'photo-1427504494785-3a9ca7044f45',  // 칠판
  ],
  
  // 기업/LG/기업 대학원
  corporate: [
    'photo-1552664730-d307ca884978',  // 사무실
    'photo-1552664730-d307ca884978',  // 기업
    'photo-1552664730-d307ca884978',  // 미팅
    'photo-1552664730-d307ca884978',  // 조직
  ],
  
  // 데이터/통계/연구
  data: [
    'photo-1551288049-bebda4e38f71',  // 차트
    'photo-1554375923-d2649effa3ba',  // 숫자
    'photo-1516321374902-7b434bda33d0', // 데이터
    'photo-1551288049-bebda4e38f71',  // 그래프
  ],
  
  // 기술/혁신
  tech: [
    'photo-1552664730-d307ca884978',  // 코딩
    'photo-1552664730-d307ca884978',  // 기술
    'photo-1552664730-d307ca884978',  // 혁신
  ],
  
  // 일반/기타
  general: [
    'photo-1552664730-d307ca884978',  // 일반
    'photo-1516534775068-bb4cfe34b599', // 사람
    'photo-1527633506514-e634e48f4f49',  // 기술
  ],
};

// 카테고리 탐지 함수 (확대됨)
function detectImageCategory(headline, tags) {
  const h = (headline || '').toLowerCase();
  const t = (tags || []).join(' ').toLowerCase();
  const combined = h + ' ' + t;

  // 교실/학생/교육 관련 (우선순위 높음)
  if (combined.includes('교실') || combined.includes('학생') || 
      combined.includes('교사') || combined.includes('수업') ||
      combined.includes('학교') || combined.includes('고교') ||
      combined.includes('초등') || combined.includes('대학')) {
    return 'classroom';
  }

  // LG/기업 대학원
  if (combined.includes('lg') || combined.includes('대학원') || 
      combined.includes('기업형')) {
    return 'corporate';
  }

  // 데이터/통계/연구
  if (combined.includes('데이터') || combined.includes('통계') ||
      combined.includes('조사') || combined.includes('연구') ||
      combined.includes('분석') || combined.includes('비율')) {
    return 'data';
  }

  // 기술/혁신
  if (combined.includes('기술') || combined.includes('코딩') ||
      combined.includes('코파일럿') || combined.includes('deepmind') ||
      combined.includes('openai') || combined.includes('구글')) {
    return 'tech';
  }

  // 정책/법률 (기본값)
  if (combined.includes('정책') || combined.includes('법') ||
      combined.includes('교육부') || combined.includes('의회') ||
      combined.includes('주') || combined.includes('규제')) {
    return 'policy';
  }

  return 'general';
}

// 회전식 인덱스 추적
let categoryIndex = {};
function getUnsplashId(headline, tags) {
  const category = detectImageCategory(headline, tags);
  const images = UNSPLASH_IMAGES[category] || UNSPLASH_IMAGES.general;
  
  if (!categoryIndex[category]) categoryIndex[category] = 0;
  
  const idx = categoryIndex[category] % images.length;
  categoryIndex[category]++;
  
  return images[idx];
}

function buildUnsplashUrl(photoId) {
  return `https://images.unsplash.com/${photoId}?w=1200&h=630&fit=crop&q=85&auto=format`;
}

// 메인
async function main() {
  const publishedDir = path.join(__dirname, '../pipeline/08-published');
  const files = fs.readdirSync(publishedDir).filter(f => f.endsWith('.json'));

  console.log(`\n🎨 스마트 이미지 재선택 시작... (${files.length}개 기사)\n`);

  let updated = 0;
  let unchanged = 0;

  // 최신순으로 정렬 (가장 최근 기사부터 처리)
  files.sort().reverse();

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
    const category = detectImageCategory(headline, ghost_tags);
    const photoId = getUnsplashId(headline, ghost_tags);
    const newUrl = buildUnsplashUrl(photoId);

    const oldUrl = data.draft.feature_image;
    
    if (oldUrl === newUrl) {
      unchanged++;
    } else {
      data.draft.feature_image = newUrl;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`✅ ${headline.substring(0, 50)}...`);
      console.log(`   카테고리: ${category} | ID: ${photoId}`);
      updated++;
    }
  }

  console.log(`\n✨ 완료!`);
  console.log(`  • 업데이트됨: ${updated}개`);
  console.log(`  • 유지됨: ${unchanged}개\n`);
}

main().catch(console.error);
