/**
 * Unsplash 피처 이미지 — 카테고리별 검증된 사진 풀 (v2)
 * 모든 ID는 HTTP 200 확인 완료 (2026-03-04)
 * 풀 크기: 카테고리당 8~15개, 전체 45개
 */

const PHOTO_POOLS = {
  // AI, 기술 정책, 규제
  policy: [
    '1677442135703-1787eea5ce01', // AI interface blue
    '1606761568499-6d2451b23c66', // AI robot face
    '1562408590-e32931084e23',    // AI abstract blue
    '1451187580459-43490279c0fa', // data globe
    '1485827404703-89b55fcc595e', // futuristic tech
    '1639762681057-408e52192e55', // AI circuit
    '1531297484001-80022131f5a1', // laptop code dark
    '1518770660439-4636190af475', // circuit board
    '1526374965328-7f61d4dc18c5', // binary code
    '1504711434969-e33886168f5c', // AI visualization
    '1614741118887-7a4ee193a5fa', // digital brain
    '1518186285589-2f7649de83e0', // tech abstract
  ],

  // 연구, 학술, 논문
  research: [
    '1532619187608-e5375cab36aa', // lab research
    '1507003211169-0a1dd7228f2d', // researcher person
    '1532187863486-abf9dbad1b69', // science lab
    '1576671081837-49000212a370', // data analysis
    '1628595351029-c2bf17511435', // research notes
    '1559757148-5c350d0d3c56',    // science experiment
    '1519452575417-564c1401ecc0', // academic study
    '1543286386-713bdd548da4',    // data charts
    '1542744173-05336fcc7ad4',    // analytics graph
  ],

  // 에듀테크, 기업, 산업
  industry: [
    '1558618666-fcd25c85cd64',    // code screen
    '1461749280684-dccba630e2f6', // laptop coding
    '1498050108023-c5249f4df085', // developer laptop
    '1517694712202-14dd9538aa97', // coding dark
    '1551288049-bebda4e38f71',    // tech workspace
    '1573164713988-8665fc963095', // startup meeting
    '1607705703571-c5a8695f18f6', // AI technology
    '1516321318423-f06f85e504b3', // tech office
    '1535378917042-10a22c95931a', // digital workspace
    '1460925895917-afdab827c52f', // business data
  ],

  // 교육, 학교, 학생, 교실
  education: [
    '1509062522246-3755977927d7', // classroom
    '1503676260728-1c00da094a0b', // books study
    '1546410531-bb4caa6b424d',    // education books
    '1488590528505-98d2b5aba04b', // laptop study
    '1580582932707-520aed937b7b', // students class
    '1571260899304-425eee4c7efc', // school tablet
    '1524178232363-1fb2b075b655', // students working
    '1564981797816-1043664bf78d', // classroom tech
    '1595257841889-eca2678454e2', // student learning
    '1497633762265-9d179a990aa6', // library study
    '1456406644174-8ddd4cd52a06', // campus students
    '1488521787991-ed7bbaae773c', // teacher class
    '1580894894513-541e068a3e2b', // online learning
  ],

  // 오피니언, 칼럼, 의견
  opinion: [
    '1507003211169-0a1dd7228f2d', // thoughtful person
    '1562408590-e32931084e23',    // abstract thinking
    '1451187580459-43490279c0fa', // conceptual
    '1532187863486-abf9dbad1b69', // analysis
    '1519452575417-564c1401ecc0', // writing/study
    '1628595351029-c2bf17511435', // notes/writing
  ],

  // 데이터, 통계, 분석
  data: [
    '1543286386-713bdd548da4',    // data visualization
    '1542744173-05336fcc7ad4',    // analytics
    '1460925895917-afdab827c52f', // business charts
    '1551288049-bebda4e38f71',    // data workspace
    '1526374965328-7f61d4dc18c5', // binary/code
    '1573164713988-8665fc963095', // data meeting
    '1576671081837-49000212a370', // data analysis
    '1607705703571-c5a8695f18f6', // AI data
  ],
};

// 전체 유니크 ID 풀 (used-images 추적용)
const ALL_IDS = [...new Set(Object.values(PHOTO_POOLS).flat())];

function detectCategory(headline, tags) {
  const all = ((tags||[]).join(' ') + ' ' + (headline||'')).toLowerCase();
  if (all.match(/연구|학술|논문|실험|리서치|report|study|research/)) return 'research';
  if (all.match(/기업|구글|마이크로소프트|openai|스타트업|에듀테크|산업|투자|business/)) return 'industry';
  if (all.match(/오피니언|칼럼|기고|opinion|editorial/)) return 'opinion';
  if (all.match(/데이터|통계|분석|수치|data|analytics/)) return 'data';
  if (all.match(/교실|수업|학생|교원|교사|학교|대학|classroom|student|teacher|university|college/)) return 'education';
  return 'policy';
}

function getUsedIds(recentFile) {
  try { return JSON.parse(require('fs').readFileSync(recentFile, 'utf8')); }
  catch { return []; }
}

function saveUsedId(recentFile, photoId) {
  const fs = require('fs');
  const used = getUsedIds(recentFile);
  if (!used.includes(photoId)) used.unshift(photoId);
  // 전체 풀 크기보다 크게 유지 (순환 허용)
  fs.writeFileSync(recentFile, JSON.stringify(used.slice(0, ALL_IDS.length)));
}

function getFeatureImageUrl({ headline, tags, recentIdsFile }) {
  const category = detectCategory(headline, tags);
  const pool = PHOTO_POOLS[category] || PHOTO_POOLS['policy'];
  const used = recentIdsFile ? getUsedIds(recentIdsFile) : [];

  // 카테고리 풀에서 미사용 우선 선택
  const available = pool.filter(id => !used.includes(id));
  // 카테고리 풀이 모두 소진되면 전체 풀에서 미사용 선택
  const fallback = ALL_IDS.filter(id => !used.includes(id));
  // 최후 수단: 카테고리 풀 전체에서 랜덤
  const candidates = available.length > 0 ? available
    : fallback.length > 0 ? fallback
    : pool;

  const photoId = candidates[Math.floor(Math.random() * candidates.length)];
  if (recentIdsFile) saveUsedId(recentIdsFile, photoId);
  return `https://images.unsplash.com/photo-${photoId}?w=1200&h=630&fit=crop&q=85&auto=format`;
}

if (require.main === module) {
  const [,, headline, tags] = process.argv;
  const url = getFeatureImageUrl({
    headline, tags: tags ? tags.split(',') : [],
    recentIdsFile: process.argv[4] || null
  });
  console.log(url);
}

module.exports = { getFeatureImageUrl, detectCategory, ALL_IDS };
