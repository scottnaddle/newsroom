/**
 * Unsplash 피처 이미지 — 카테고리별 검증된 사진 풀
 * 모든 ID는 HTTP 200 확인 완료
 */

const PHOTO_POOLS = {
  policy: [
    '1562408590-e32931084e23',  // AI abstract blue
    '1485827404703-89b55fcc595e', // futuristic tech
    '1451187580459-43490279c0fa', // data globe
    '1606761568499-6d2451b23c66', // AI robot
    '1677442135703-1787eea5ce01', // AI interface
  ],
  research: [
    '1532619187608-e5375cab36aa',  // lab/research
    '1503676260728-1c00da094a0b',  // books/study
    '1546410531-bb4caa6b424d',     // education books
    '1488590528505-98d2b5aba04b',  // laptop research
    '1507003211169-0a1dd7228f2d',  // researcher
  ],
  industry: [
    '1558618666-fcd25c85cd64',    // code screen
    '1488590528505-98d2b5aba04b', // laptop/tech
    '1677442135703-1787eea5ce01', // AI tech
    '1606761568499-6d2451b23c66', // AI/robot
    '1562408590-e32931084e23',    // tech abstract
  ],
  education: [
    '1509062522246-3755977927d7', // classroom
    '1532619187608-e5375cab36aa', // study/learning
    '1503676260728-1c00da094a0b', // books
    '1546410531-bb4caa6b424d',    // education
    '1485827404703-89b55fcc595e', // technology education
  ],
  opinion: [
    '1507003211169-0a1dd7228f2d', // person/portrait
    '1562408590-e32931084e23',    // abstract
    '1451187580459-43490279c0fa', // conceptual
  ],
  data: [
    '1451187580459-43490279c0fa', // data visualization
    '1558618666-fcd25c85cd64',    // code/data
    '1488590528505-98d2b5aba04b', // analytics
    '1562408590-e32931084e23',    // tech abstract
  ],
};

function detectCategory(headline, tags) {
  const all = ((tags||[]).join(' ') + ' ' + (headline||'')).toLowerCase();
  if (all.match(/연구|학술|논문|실험/)) return 'research';
  if (all.match(/기업|구글|마이크로|스타트업|에듀테크|산업/)) return 'industry';
  if (all.match(/오피니언|칼럼|기고/)) return 'opinion';
  if (all.match(/데이터|통계|분석/)) return 'data';
  if (all.match(/교실|수업|학생|교원|교사|학교/)) return 'education';
  return 'policy';
}

function getUsedIds(recentFile) {
  try { return JSON.parse(require('fs').readFileSync(recentFile, 'utf8')); }
  catch { return []; }
}
function saveUsedId(recentFile, photoId) {
  const fs = require('fs');
  const used = getUsedIds(recentFile);
  used.unshift(photoId);
  fs.writeFileSync(recentFile, JSON.stringify(used.slice(0, 50)));
}

function getFeatureImageUrl({ headline, tags, recentIdsFile }) {
  const category = detectCategory(headline, tags);
  const pool = PHOTO_POOLS[category] || PHOTO_POOLS['policy'];
  const used = recentIdsFile ? getUsedIds(recentIdsFile) : [];
  const available = pool.filter(id => !used.includes(id));
  const candidates = available.length > 0 ? available : pool;
  const photoId = candidates[Math.floor(Math.random() * candidates.length)];
  if (recentIdsFile) saveUsedId(recentIdsFile, photoId);
  return `https://images.unsplash.com/photo-${photoId}?w=1200&h=630&fit=crop&q=85&auto=format`;
}

if (require.main === module) {
  const [,, headline, tags] = process.argv;
  console.log(getFeatureImageUrl({ headline, tags: tags ? tags.split(',') : [] }));
}

module.exports = { getFeatureImageUrl, detectCategory };
