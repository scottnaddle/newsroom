#!/usr/bin/env node
/**
 * pre-check.js — 파이프라인 사전 필터링
 * 
 * 에이전트의 입력 폴더에 파일이 있는지 확인.
 * 파일이 없으면 exit(0)으로 종료 → 크론에서 "할 일 없음"으로 처리
 * 파일이 있으면 에이전트 정보를 stdout에 출력
 * 
 * 사용법: node pre-check.js <agent-id>
 * 
 * Exit codes:
 *   0 = 할 일 없음 (LLM 호출 불필요)
 *   1 = 할 일 있음 (LLM 호출 필요)
 */

const fs = require('fs');
const path = require('path');

const PIPELINE = '/root/.openclaw/workspace/newsroom/pipeline';

// 에이전트별 입력 폴더 매핑
const AGENT_INPUTS = {
  'source-collector': {
    // 소스수집기는 특별 처리: 스마트 백오프
    type: 'smart-backoff',
    stateFile: path.join(PIPELINE, 'memory', 'collector-state.json'),
    minIntervalMs: 30 * 60 * 1000,      // 기본 30분
    backoffMultiplier: 2,                 // 빈 결과 시 2배
    maxIntervalMs: 3 * 60 * 60 * 1000,   // 최대 3시간
    resetOnNewFile: true
  },
  'editor-desk': {
    type: 'multi-check',
    folders: ['01-sourced', '05-fact-checked'],
  },
  'reporter': {
    type: 'folder-check',
    folder: '02-assigned',
  },
  'writer': {
    type: 'folder-check',
    folder: '03-reported',
  },
  'fact-checker': {
    type: 'folder-check',
    folder: '04-drafted',
  },
  'copy-editor': {
    type: 'folder-check',
    folder: '06-desk-approved',
  },
  'publisher': {
    type: 'folder-check',
    folder: '07-copy-edited',
  },
};

function countJsonFiles(folder) {
  const fullPath = path.join(PIPELINE, folder);
  try {
    return fs.readdirSync(fullPath).filter(f => f.endsWith('.json')).length;
  } catch (e) {
    return 0;
  }
}

function handleSmartBackoff(config) {
  let state = { lastRun: 0, consecutiveEmpty: 0, currentInterval: config.minIntervalMs };
  
  try {
    if (fs.existsSync(config.stateFile)) {
      state = JSON.parse(fs.readFileSync(config.stateFile, 'utf8'));
    }
  } catch (e) { /* use defaults */ }

  const now = Date.now();
  const elapsed = now - (state.lastRun || 0);

  // 시간이 충분히 지났는지 확인
  if (elapsed < state.currentInterval) {
    const remainMin = Math.round((state.currentInterval - elapsed) / 60000);
    console.log(JSON.stringify({
      action: 'skip',
      reason: `백오프 대기 중 (${remainMin}분 후 실행)`,
      consecutiveEmpty: state.consecutiveEmpty,
      currentIntervalMin: Math.round(state.currentInterval / 60000)
    }));
    process.exit(0);
  }

  // 실행해야 함
  console.log(JSON.stringify({
    action: 'run',
    consecutiveEmpty: state.consecutiveEmpty,
    currentIntervalMin: Math.round(state.currentInterval / 60000)
  }));
  process.exit(1);
}

function updateCollectorState(foundNew) {
  const config = AGENT_INPUTS['source-collector'];
  let state = { lastRun: 0, consecutiveEmpty: 0, currentInterval: config.minIntervalMs };
  
  try {
    if (fs.existsSync(config.stateFile)) {
      state = JSON.parse(fs.readFileSync(config.stateFile, 'utf8'));
    }
  } catch (e) { /* use defaults */ }

  state.lastRun = Date.now();

  if (foundNew) {
    state.consecutiveEmpty = 0;
    state.currentInterval = config.minIntervalMs;
  } else {
    state.consecutiveEmpty++;
    state.currentInterval = Math.min(
      state.currentInterval * config.backoffMultiplier,
      config.maxIntervalMs
    );
  }

  const dir = path.dirname(config.stateFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(config.stateFile, JSON.stringify(state, null, 2));
  
  console.log(JSON.stringify({
    action: 'state-updated',
    foundNew,
    consecutiveEmpty: state.consecutiveEmpty,
    nextIntervalMin: Math.round(state.currentInterval / 60000)
  }));
}

// ===== 스마트 스케줄링 =====
function checkSmartSchedule(agentId) {
  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;
  const kstDay = new Date(now.getTime() + 9 * 60 * 60 * 1000).getDay();
  const isWeekend = kstDay === 0 || kstDay === 6;
  const isNight = kstHour >= 23 || kstHour < 7;
  const isPeak = (kstHour >= 9 && kstHour < 12) || (kstHour >= 14 && kstHour < 18);

  // 야간: skip
  if (isNight) {
    console.log(JSON.stringify({
      action: 'skip', reason: `야간 (KST ${kstHour}시)`, kstHour, agent: agentId
    }));
    return false;
  }

  // 주말 비피크: 50% skip
  if (isWeekend && !isPeak && now.getMinutes() % 2 === 0) {
    console.log(JSON.stringify({
      action: 'skip', reason: `주말 비피크 감소 (KST ${kstHour}시)`, kstHour, agent: agentId
    }));
    return false;
  }

  return true; // 실행 가능
}

// ===== MAIN =====
const agentId = process.argv[2];
const subCommand = process.argv[3]; // 'update-state' for post-run

if (!agentId) {
  console.error('Usage: node pre-check.js <agent-id> [update-state <true|false>]');
  process.exit(2);
}

const config = AGENT_INPUTS[agentId];
if (!config) {
  console.error(`Unknown agent: ${agentId}`);
  process.exit(1); // 모르는 에이전트는 일단 실행
}

// 소스수집기 상태 업데이트 (post-run)
if (subCommand === 'update-state') {
  const foundNew = process.argv[4] === 'true';
  updateCollectorState(foundNew);
  process.exit(0);
}

// 스마트 스케줄 체크 (update-state가 아닌 경우만)
if (!subCommand && !checkSmartSchedule(agentId)) {
  process.exit(0);
}

// 사전 체크
switch (config.type) {
  case 'folder-check': {
    const count = countJsonFiles(config.folder);
    if (count === 0) {
      console.log(JSON.stringify({ action: 'skip', agent: agentId, folder: config.folder, count: 0 }));
      process.exit(0);
    }
    console.log(JSON.stringify({ action: 'run', agent: agentId, folder: config.folder, count }));
    process.exit(1);
    break;
  }

  case 'multi-check': {
    const counts = {};
    let total = 0;
    config.folders.forEach(f => {
      const c = countJsonFiles(f);
      counts[f] = c;
      total += c;
    });
    if (total === 0) {
      console.log(JSON.stringify({ action: 'skip', agent: agentId, folders: counts, total: 0 }));
      process.exit(0);
    }
    console.log(JSON.stringify({ action: 'run', agent: agentId, folders: counts, total }));
    process.exit(1);
    break;
  }

  case 'smart-backoff': {
    handleSmartBackoff(config);
    break;
  }

  default:
    process.exit(1);
}
