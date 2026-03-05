#!/usr/bin/env node
/**
 * 파이프라인 상태를 JSON 파일로 생성
 * 1분마다 실행 (cron)
 * 출력: /newsroom/public/status.json
 */

const fs = require('fs');
const path = require('path');

const NEWSROOM = '/root/.openclaw/workspace/newsroom';
const PIPELINE = path.join(NEWSROOM, 'pipeline');
const OUTPUT = path.join(NEWSROOM, 'public', 'status.json');

const STAGES = [
  { dir: '01-sourced', name: '소스 수집', agent: '소수집기', icon: '📡' },
  { dir: '02-assigned', name: '배정', agent: '편집장', icon: '📋' },
  { dir: '03-reported', name: '취재', agent: '취재기자', icon: '🔍' },
  { dir: '04-drafted', name: '초안 작성', agent: '작성기자', icon: '✍️' },
  { dir: '05-fact-checked', name: '팩트체크', agent: '팩트체커', icon: '✅' },
  { dir: '06-desk-approved', name: '편집 승인', agent: '편집장', icon: '📝' },
  { dir: '07-copy-edited', name: '교열', agent: '교열기자', icon: '🔎' },
  { dir: '08-published', name: '발행 완료', agent: '발행에이전트', icon: '🚀' }
];

function countFiles(dir) {
  const fullPath = path.join(PIPELINE, dir);
  try { return fs.readdirSync(fullPath).filter(f => f.endsWith('.json')).length; } catch { return 0; }
}

function getRecentFiles(dir, limit = 5) {
  const fullPath = path.join(PIPELINE, dir);
  try {
    return fs.readdirSync(fullPath)
      .filter(f => f.endsWith('.json'))
      .sort().reverse().slice(0, limit)
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(fullPath, f)));
          return {
            file: f,
            headline: data.draft?.headline || data.copy_edit?.final_headline || data.source_title || data.headline || f,
            published_at: data.published_at || data.collected_at || null,
            ghost_url: data.ghost_url || null
          };
        } catch { return { file: f, headline: f }; }
      });
  } catch { return []; }
}

function getStatus() {
  const today = new Date().toISOString().slice(0, 10);
  
  // 파이프라인 단계별 현황
  const pipeline = STAGES.map(s => ({
    ...s,
    count: countFiles(s.dir),
    status: countFiles(s.dir) >= 5 && s.dir !== '08-published' ? 'warning' : 'ok'
  }));
  
  // 다이제스트 현황
  const digestStages = [
    { dir: 'digest/01-sourced', name: '수집', icon: '⚡' },
    { dir: 'digest/02-drafted', name: '초안', icon: '✍️' },
    { dir: 'digest/03-published', name: '발행', icon: '🚀' }
  ];
  const digest = digestStages.map(s => ({
    ...s,
    count: countFiles(s.dir)
  }));
  
  // 거부 현황
  const rejectedCount = countFiles('rejected');
  const digestRejectedCount = countFiles('digest/rejected');
  
  // 만평 현황
  const cartoonToday = fs.existsSync(path.join(PIPELINE, 'cartoon', `${today}.json`));
  let cartoonData = null;
  if (cartoonToday) {
    try { cartoonData = JSON.parse(fs.readFileSync(path.join(PIPELINE, 'cartoon', `${today}.json`))); } catch {}
  }
  
  // 논설 현황
  const insightToday = fs.existsSync(path.join(PIPELINE, 'insight', `${today}.json`));
  let insightData = null;
  if (insightToday) {
    try { insightData = JSON.parse(fs.readFileSync(path.join(PIPELINE, 'insight', `${today}.json`))); } catch {}
  }
  
  // 최근 발행 기사
  const recentPublished = getRecentFiles('08-published', 5);
  const recentRejected = getRecentFiles('rejected', 3);
  const recentDigest = getRecentFiles('digest/03-published', 3);
  
  // 오늘 통계
  const todayPublished = fs.readdirSync(path.join(PIPELINE, '08-published'))
    .filter(f => f.startsWith(today)).length;
  const todayRejected = fs.readdirSync(path.join(PIPELINE, 'rejected'))
    .filter(f => f.startsWith(today)).length;
  const todayDigest = (() => { try { return fs.readdirSync(path.join(PIPELINE, 'digest/03-published')).filter(f => f.startsWith(today)).length; } catch { return 0; } })();
  
  // 전체 통계
  const totalPublished = countFiles('08-published');
  const totalDigest = countFiles('digest/03-published');
  
  // 경고 생성
  const alerts = [];
  
  // 1. 병목 단계 (5개 이상)
  STAGES.forEach(stage => {
    if (stage.dir !== '08-published') {
      const count = countFiles(stage.dir);
      if (count >= 5) {
        alerts.push({
          level: count >= 10 ? 'critical' : 'warning',
          icon: '⚠️',
          message: `${stage.name}(${stage.agent}): ${count}개 쌓임`,
          stage: stage.dir,
          count
        });
      }
    }
  });
  
  // 2. 발행 정체 (24시간 이상 발행 없음)
  const lastPublished = getRecentFiles('08-published', 1);
  if (lastPublished.length > 0) {
    const lastTime = new Date(lastPublished[0].published_at);
    const now = new Date();
    const hoursDiff = (now - lastTime) / (1000 * 60 * 60);
    
    if (hoursDiff > 4) {
      alerts.push({
        level: hoursDiff > 12 ? 'critical' : 'warning',
        icon: '🔴',
        message: `${Math.floor(hoursDiff)}시간 동안 발행된 기사 없음`,
        stage: '08-published',
        hoursDiff: Math.floor(hoursDiff)
      });
    }
  }
  
  // 3. 아주 높은 거부율
  const totalAttempts = totalPublished + rejectedCount;
  if (totalAttempts > 0) {
    const rejectRate = (rejectedCount / totalAttempts) * 100;
    if (rejectRate > 40) {
      alerts.push({
        level: 'warning',
        icon: '🚫',
        message: `거부율 높음: ${Math.round(rejectRate)}% (${rejectedCount}/${totalAttempts})`,
        stage: 'rejected',
        rate: Math.round(rejectRate)
      });
    }
  }
  
  return {
    timestamp: new Date().toISOString(),
    alerts,
    pipeline,
    digest,
    rejected: { education: rejectedCount, digest: digestRejectedCount },
    cartoon: { today: cartoonToday, data: cartoonData },
    insight: { today: insightToday, data: insightData },
    recentPublished,
    recentRejected,
    recentDigest,
    stats: {
      today: { published: todayPublished, rejected: todayRejected, digest: todayDigest },
      total: { published: totalPublished, rejected: rejectedCount, digest: totalDigest },
      passRate: totalPublished > 0 ? Math.round(totalPublished / (totalPublished + rejectedCount) * 100) : 0
    }
  };
}

// 실행
try {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(getStatus(), null, 2));
  // 조용히 실행 (크론 메시지 제거)
} catch (e) {
  // 오류 시만 로그
  console.error('❌ 오류:', e.message);
  process.exit(1);
}
