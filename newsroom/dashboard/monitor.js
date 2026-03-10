/**
 * Pipeline Monitor - 1분마다 모든 파이프라인 상태 스캔
 */

const fs = require('fs');
const path = require('path');

const PIPELINE_DIR = '/root/.openclaw/workspace/newsroom/pipeline';
const LOGS_DIR = '/root/.openclaw/workspace/newsroom/shared/logs';

// 파이프라인 단계별 디렉토리
const EDUCATION_STAGES = [
  '01-sourced',
  '03-reported',
  '04-drafted',
  '05-fact-checked',
  '06-desk-approved',
  '07-copy-edited',
  '08-published'
];

const DIGEST_STAGES = [
  'digest/01-sourced',
  'digest/02-drafted',
  'digest/03-published'
];

// 다른 에이전트들 (일일 생성)
const AGENTS = {
  cartoon: {
    label: '🎨 일일 만평',
    dir: 'cartoon',
    lastFile: true  // 최신 파일만 카운트
  },
  colloquy: {
    label: '💬 Colloquy',
    dir: 'colloquy',
    lastFile: true
  },
  insight: {
    label: '📊 EdTech 인사이트',
    dir: 'insight',
    lastFile: true
  }
};

/**
 * 디렉토리의 JSON 파일 개수 카운트
 */
function countFiles(dir) {
  const fullPath = path.join(PIPELINE_DIR, dir);
  try {
    const files = fs.readdirSync(fullPath);
    return files.filter(f => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

/**
 * 최근 N일 파일 카운트 (일일 에이전트용)
 */
function countRecentFiles(dir, days = 7) {
  const fullPath = path.join(PIPELINE_DIR, dir);
  try {
    const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.json'));
    const now = Date.now();
    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    
    return files.filter(f => {
      try {
        const stat = fs.statSync(path.join(fullPath, f));
        return stat.mtime.getTime() > cutoff;
      } catch {
        return false;
      }
    }).length;
  } catch {
    return 0;
  }
}

/**
 * 파이프라인 상태 스캔
 */
function scanPipeline() {
  const timestamp = new Date().toISOString();
  
  // AI 교육 브랜치
  const education = {};
  EDUCATION_STAGES.forEach(stage => {
    education[stage] = countFiles(stage);
  });
  
  // AI Digest 브랜치
  const digest = {};
  DIGEST_STAGES.forEach(stage => {
    digest[stage] = countFiles(stage);
  });
  
  // 거부/기타
  const rejected = countFiles('rejected');
  
  // 논문 카운트
  const papers = countFiles('papers/published');
  
  // 다른 에이전트들 (일일 생성)
  const agents = {};
  Object.entries(AGENTS).forEach(([key, config]) => {
    agents[key] = {
      label: config.label,
      count: countRecentFiles(config.dir, 7)
    };
  });
  
  // pipeline-runner.js 로그에서 최근 실행 정보 추출
  let lastRunnerLog = null;
  try {
    const logPath = path.join(PIPELINE_DIR, 'pipeline-runner.log');
    if (fs.existsSync(logPath)) {
      const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
      const last = lines.slice(-5);
      lastRunnerLog = last.join(' | ');
    }
  } catch (_) {}

  const status = {
    timestamp,
    mode: 'orchestrator',  // 파이프라인 모드 표시
    branches: {
      education,
      digest
    },
    papers,
    rejected,
    agents,
    totalPublished: education['08-published'] + digest['digest/03-published'] + papers + 
                   Object.values(agents).reduce((sum, a) => sum + a.count, 0),
    alerts: generateAlerts(education, digest, agents),
    lastRunnerLog
  };
  
  return status;
}

/**
 * 알림 생성
 */
function generateAlerts(education, digest, agents) {
  const alerts = [];
  
  // AI 교육 병목 감지
  Object.entries(education).forEach(([stage, count]) => {
    if (count >= 5 && stage !== '08-published') {
      alerts.push({
        level: 'warning',
        branch: 'education',
        stage,
        message: `${stage.split('-')[1]}: ${count}개 쌓임`,
        count
      });
    }
  });
  
  // AI Digest 병목 감지
  Object.entries(digest).forEach(([stage, count]) => {
    if (count >= 3 && !stage.includes('published')) {
      alerts.push({
        level: 'warning',
        branch: 'digest',
        stage,
        message: `${stage}: ${count}개 쌓임`,
        count
      });
    }
  });
  
  // 에이전트 활동 정보
  Object.entries(agents).forEach(([key, agent]) => {
    if (agent.count > 0) {
      alerts.push({
        level: 'info',
        branch: 'agents',
        agent: key,
        message: `${agent.label}: ${agent.count}개 (최근 7일)`,
        count: agent.count
      });
    }
  });
  
  // 발행 활동
  if (education['08-published'] > 0) {
    alerts.push({
      level: 'info',
      branch: 'education',
      message: `발행 완료: ${education['08-published']}개 (누적)`,
      count: education['08-published']
    });
  }
  
  return alerts;
}

/**
 * 상태를 파일에 저장 (WebSocket 또는 파일 폴링용)
 */
function saveStatus(status) {
  const logsDir = '/root/.openclaw/workspace/newsroom/shared/logs';
  
  // 최신 상태
  fs.writeFileSync(
    path.join(logsDir, 'dashboard-status.json'),
    JSON.stringify(status, null, 2)
  );
  
  // 시계열 데이터 (분석용)
  const statsFile = path.join(logsDir, 'pipeline-stats.jsonl');
  const line = JSON.stringify({
    ...status,
    hour: new Date(status.timestamp).getHours()
  }) + '\n';
  
  fs.appendFileSync(statsFile, line);
}

/**
 * 1분마다 실행될 메인 함수
 */
function runMonitor() {
  const status = scanPipeline();
  saveStatus(status);
  
  console.log(`[${status.timestamp}] ✅ Pipeline scanned`);
  console.log(`  교육: 발행=${status.branches.education['08-published']}`);
  console.log(`  다이제스트: 발행=${status.branches.digest['digest/03-published']}`);
  console.log(`  만평: ${status.agents.cartoon.count}개`);
  console.log(`  Colloquy: ${status.agents.colloquy.count}개`);
  console.log(`  인사이트: ${status.agents.insight.count}개`);
  console.log(`  알림: ${status.alerts.length}개`);
  
  return status;
}

// 크론 또는 외부에서 호출
if (require.main === module) {
  // 초기 실행
  runMonitor();
  
  // 1분마다 반복
  setInterval(runMonitor, 60 * 1000);
  console.log('🔄 Pipeline monitor started (1분 주기)');
}

module.exports = { scanPipeline, runMonitor };
