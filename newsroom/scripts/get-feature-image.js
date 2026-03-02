/**
 * Unsplash 키워드 검색 — 기사별 고유 피처 이미지
 * 
 * API 키 불필요 — 카테고리별 큐레이션된 사진 풀 + 헤드라인 키워드 매핑
 * 같은 카테고리라도 풀에서 랜덤 선택하여 중복 최소화
 */

// 카테고리별 큐레이션된 Unsplash 사진 ID 풀
const PHOTO_POOLS = {
  policy: [
    'gakXaqzGad0', // 한국 정부 건물 / 도시
    'RpFqFNxbWwA', // 공공 정책 / 회의
    'JKUTrJ4vK00', // 국회 / 법률
    '1K9T5YiZ2jU', // 디지털 정책
    'BfrQnKBulYQ', // 교육 정책
    'muOHbrFGEQY', // AI 기술 정책
  ],
  research: [
    'WE_Kv_ZB1l0', // 학술 연구
    'AFB6S2kibuk', // 논문 / 도서관
    'hpjSkU2UYSU', // 실험실
    'cXU6tNxhub0', // 데이터 분석
    '5fNmWej4tAA', // 연구자
  ],
  industry: [
    '8CqDvPuo_kI', // 테크 기업
    'KieCLNzKoBo', // AI 산업
    'hGV2TfOh0ns', // 스타트업
    'lRoX0shwjUQ', // 기술 혁신
  ],
  opinion: [
    'aJTiW00qqtI', // 사람 / 인터뷰
    'IfT1NbHqTm8', // 토론
    'TamMbr4okv4', // 의견
  ],
  data: [
    'JKUTrJ4vK00', // 데이터 시각화
    'hpjSkU2UYSU', // 통계
    'cXU6tNxhub0', // 분석
  ],
  // 키워드 기반 추가
  education: [
    'BfrQnKBulYQ', // 교실
    'hpjSkU2UYSU', // 학생
    'TZZwC_xsClY', // 교육
    '505eectW54k', // 수업
    'WE_Kv_ZB1l0', // 배움
  ],
  ai: [
    '1K9T5YiZ2jU', // AI
    'muOHbrFGEQY', // 인공지능
    'KieCLNzKoBo', // 머신러닝
    'hGV2TfOh0ns', // 딥러닝
  ],
};

// 헤드라인에서 카테고리 힌트 추출
function detectCategory(headline, tags) {
  if (tags && tags.length > 0) {
    const primary = tags[0];
    if (PHOTO_POOLS[primary]) return primary;
  }
  const h = headline.toLowerCase();
  if (h.includes('정책') || h.includes('법') || h.includes('정부') || h.includes('교육부')) return 'policy';
  if (h.includes('연구') || h.includes('논문') || h.includes('학술')) return 'research';
  if (h.includes('기업') || h.includes('산업') || h.includes('스타트업')) return 'industry';
  if (h.includes('ai') || h.includes('인공지능') || h.includes('머신')) return 'ai';
  if (h.includes('교육') || h.includes('학교') || h.includes('수업') || h.includes('학생')) return 'education';
  return 'policy';
}

// 최근 사용된 이미지 ID 추적 (중복 방지)
function getUsedIds(recentFile) {
  try {
    return JSON.parse(require('fs').readFileSync(recentFile, 'utf8'));
  } catch { return []; }
}

function saveUsedId(recentFile, photoId) {
  const fs = require('fs');
  const used = getUsedIds(recentFile);
  used.unshift(photoId);
  const trimmed = used.slice(0, 50); // 최근 50개만 추적
  fs.writeFileSync(recentFile, JSON.stringify(trimmed));
}

/**
 * 기사에 맞는 Unsplash 이미지 URL 반환
 * @returns {string} Unsplash CDN URL (1200x630)
 */
function getFeatureImageUrl({ headline, tags, recentIdsFile }) {
  const category = detectCategory(headline, tags);
  const pool = PHOTO_POOLS[category] || PHOTO_POOLS['policy'];

  const used = recentIdsFile ? getUsedIds(recentIdsFile) : [];
  // 최근 사용 안 한 것 우선
  const available = pool.filter(id => !used.includes(id));
  const candidates = available.length > 0 ? available : pool;
  const photoId = candidates[Math.floor(Math.random() * candidates.length)];

  if (recentIdsFile) saveUsedId(recentIdsFile, photoId);

  return `https://images.unsplash.com/photo-${photoId}?w=1200&h=630&fit=crop&q=85`;
}

// CLI 실행
if (require.main === module) {
  const [,, headline, tags] = process.argv;
  const url = getFeatureImageUrl({
    headline: headline || 'AI 교육 정책',
    tags: tags ? tags.split(',') : ['policy'],
  });
  console.log(url);
}

module.exports = { getFeatureImageUrl, detectCategory };
