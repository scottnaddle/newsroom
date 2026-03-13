#!/usr/bin/env node
/**
 * Agent Control Center - Real-time Monitoring Server
 * 
 * Features:
 * - Real-time agent status (WebSocket)
 * - Pipeline flow visualization
 * - Performance metrics
 * - Auto-refresh (1 minute)
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3848;
const PIPELINE_PATH = '/root/.openclaw/workspace/newsroom/pipeline';

// 에이전트 정의
const AGENTS = [
  { id: 'source-collector', name: '소스수집기', stage: '01-sourced', color: '#3b82f6' },
  { id: 'reporter', name: '취재기자', stage: '03-reported', color: '#10b981' },
  { id: 'writer', name: '작성기자', stage: '04-drafted', color: '#f59e0b' },
  { id: 'fact-checker', name: '팩트체커', stage: '05-fact-checked', color: '#ef4444' },
  { id: 'editor-desk', name: '에디터/데스크', stage: '06-desk-approved', color: '#8b5cf6' },
  { id: 'copy-editor', name: '교열기자', stage: '07-copy-edited', color: '#ec4899' },
  { id: 'publisher', name: '발행에이전트', stage: '08-published', color: '#06b6d4' },
  { id: 'digest-collector', name: 'Digest 수집기', stage: null, color: '#0ea5e9' },
  { id: 'digest-writer', name: 'Digest 작성기', stage: null, color: '#6366f1' },
  { id: 'digest-publisher', name: 'Digest 발행기', stage: null, color: '#8b5cf6' },
  { id: 'cartoon-agent', name: '만평 에이전트', stage: null, color: '#f43f5e' },
  { id: 'paper-collector', name: '논문 수집기', stage: null, color: '#14b8a6' },
  { id: 'paper-processor', name: '논문 처리기', stage: null, color: '#0d9488' },
  { id: 'colloquy', name: 'AI Colloquy', stage: null, color: '#a855f7' },
  { id: 'analyst', name: '인사이트 논설', stage: null, color: '#eab308' },
  { id: 'daily-briefing', name: '일일 브리핑', stage: null, color: '#f97316' },
  { id: 'weekly-review', name: '주간 리뷰', stage: null, color: '#64748b' },
  { id: 'system-architect', name: '시스템 아키텍트', stage: null, color: '#f97316' }
];

// 상태 저장소
let currentState = {
  agents: {},
  pipeline: {},
  metrics: {
    totalProcessed: 0,
    successRate: 0,
    avgProcessingTime: 0
  },
  lastUpdate: null,
  alerts: []
};

// 정적 파일 서빙
app.use(express.static('public'));
app.use(express.json());

/**
 * 파이프라인 상태 스캔
 */
function scanPipeline() {
  const newState = {
    agents: {},
    pipeline: {},
    metrics: {
      totalProcessed: 0,
      successRate: 0,
      avgProcessingTime: 0
    },
    lastUpdate: new Date().toISOString(),
    alerts: []
  };

  // 크론 Job ID → 에이전트 ID 매핑
  const CRON_MAP = {
    '2a7923e8-a292-435b-bd55-1ba0ec08032e': 'source-collector',
    'bf5d972c-df27-480b-8b19-b32fcc8b4c25': 'reporter',
    'd3c17519-5951-447f-af8b-f6d7494b82d9': 'writer',
    'b0049592-2dac-4bb2-b718-f76fad8efdba': 'fact-checker',
    'c20081e1-73be-4856-8768-029c326676d6': 'editor-desk',
    'e57f7327-a883-492a-93eb-7ea54cb12d9e': 'copy-editor',
    'cecbf113-6ac7-4cc1-8694-d65a040324ed': 'publisher',
    'c3248e78-fb6a-4db4-84e3-768bab99b899': 'digest-collector',
    'f378b8a8-2081-4d5a-8167-4106e9ab2708': 'digest-writer',
    'dbe4af0c-6415-4c23-9a6d-585342451fa7': 'digest-publisher',
    'b3698d57-d575-4231-858c-561dd4629c24': 'cartoon-agent',
    'd372f5ea-3adb-460b-9334-a2bbb330401a': 'paper-collector',
    '7f0176f7-ef30-497a-bc8e-d3adae8911be': 'paper-processor',
    '93ee63c6-4cf2-46a1-94a5-39990bbb9d92': 'colloquy',
    '17e11d13-95a5-4d0c-a862-b99ca2843b34': 'analyst',
    '622feb3f-43c3-4698-872d-6c5109cd8f1f': 'daily-briefing',
    'b8793684-fcf7-43a6-9c55-ae3c9e57633d': 'weekly-review',
    '303dad45-77de-4431-987b-cd8227641a52': 'system-architect',
    'c02a6b8e-f00b-4f82-84b6-9d0b4c3927bb': 'system-architect',
  };

  // 크론 상태 파일 읽기 (OpenClaw이 관리하는 크론 상태)
  const cronState = {};
  try {
    const cronDbPath = '/root/.openclaw/cron/jobs.json';
    if (fs.existsSync(cronDbPath)) {
      const cronData = JSON.parse(fs.readFileSync(cronDbPath, 'utf8'));
      const jobs = cronData.jobs || cronData;
      (Array.isArray(jobs) ? jobs : Object.values(jobs)).forEach(job => {
        const agentId = CRON_MAP[job.id];
        if (agentId && job.state) {
          const existing = cronState[agentId];
          const jobMs = job.state.lastRunAtMs || 0;
          if (!existing || jobMs > (existing.lastRunAtMs || 0)) {
            cronState[agentId] = {
              lastRunAtMs: job.state.lastRunAtMs,
              lastStatus: job.state.lastStatus || job.state.lastRunStatus,
              consecutiveErrors: job.state.consecutiveErrors || 0,
              runningAtMs: job.state.runningAtMs,
              nextRunAtMs: job.state.nextRunAtMs
            };
          }
        }
      });
    }
  } catch (e) { /* ignore */ }

  // 각 에이전트 상태 확인
  AGENTS.forEach(agent => {
    // 크론 기반 에이전트
    if (!agent.stage) {
      const cs = cronState[agent.id] || {};
      const lastTime = cs.lastRunAtMs ? new Date(cs.lastRunAtMs).toISOString() : null;
      const isRunning = !!cs.runningAtMs;
      const isRecent = lastTime && (Date.now() - cs.lastRunAtMs) < 2 * 60 * 60 * 1000;
      const hasError = cs.lastStatus === 'error';
      
      let status = 'idle';
      if (isRunning) status = 'active';
      else if (hasError && cs.consecutiveErrors >= 2) status = 'error';
      else if (isRecent) status = 'active';
      
      newState.agents[agent.id] = {
        ...agent,
        count: 0,
        lastTime,
        status,
        type: 'cron-agent',
        consecutiveErrors: cs.consecutiveErrors || 0,
        nextRun: cs.nextRunAtMs ? new Date(cs.nextRunAtMs).toISOString() : null
      };
      return;
    }
    
    // 파이프라인 기반 에이전트
    const stagePath = path.join(PIPELINE_PATH, agent.stage);
    
    try {
      const files = fs.readdirSync(stagePath).filter(f => f.endsWith('.json'));
      const count = files.length;
      
      // 가장 최근 파일 확인
      let lastFile = null;
      let lastTime = 0;
      
      files.forEach(file => {
        const filePath = path.join(stagePath, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs > lastTime) {
          lastTime = stats.mtimeMs;
          lastFile = file;
        }
      });
      
      // 파이프라인 파일의 lastTime이 없으면 크론 상태에서 보충
      const cs = cronState[agent.id] || {};
      let agentLastTime = lastTime ? new Date(lastTime).toISOString() : null;
      if (!agentLastTime && cs.lastRunAtMs) {
        agentLastTime = new Date(cs.lastRunAtMs).toISOString();
      }
      
      const isRunning = !!cs.runningAtMs;
      const hasError = cs.lastStatus === 'error' && (cs.consecutiveErrors || 0) >= 2;
      
      let agentStatus = 'idle';
      if (isRunning) agentStatus = 'active';
      else if (hasError) agentStatus = 'error';
      else if (count > 0) agentStatus = 'active';
      else if (cs.lastRunAtMs && (Date.now() - cs.lastRunAtMs) < 2 * 60 * 60 * 1000) agentStatus = 'active';
      
      newState.agents[agent.id] = {
        ...agent,
        count,
        lastFile,
        lastTime: agentLastTime,
        status: agentStatus,
        consecutiveErrors: cs.consecutiveErrors || 0
      };
      
      newState.pipeline[agent.stage] = count;
      newState.metrics.totalProcessed += count;
      
    } catch (error) {
      newState.agents[agent.id] = {
        ...agent,
        count: 0,
        status: 'error',
        error: error.message
      };
      newState.pipeline[agent.stage] = 0;
    }
  });
  
  // Digest 파이프라인 스캔
  const digestStages = ['01-sourced', '02-drafted', '03-published'];
  digestStages.forEach(stage => {
    const stagePath = path.join(PIPELINE_PATH, 'digest', stage);
    try {
      const files = fs.readdirSync(stagePath).filter(f => f.endsWith('.json'));
      newState.pipeline[`digest/${stage}`] = files.length;
    } catch (e) { newState.pipeline[`digest/${stage}`] = 0; }
  });

  // Papers 파이프라인 스캔
  const papersStages = ['01-sourced', '02-summarized', '03-published'];
  papersStages.forEach(stage => {
    const stagePath = path.join(PIPELINE_PATH, 'papers', stage);
    try {
      const files = fs.readdirSync(stagePath).filter(f => f.endsWith('.json'));
      newState.pipeline[`papers/${stage}`] = files.length;
    } catch (e) { newState.pipeline[`papers/${stage}`] = 0; }
  });

  // 성공률 계산
  const publishedCount = newState.pipeline['08-published'] || 0;
  const sourcedCount = newState.pipeline['01-sourced'] || 0;
  newState.metrics.successRate = sourcedCount > 0 
    ? Math.round((publishedCount / sourcedCount) * 100) 
    : 0;
  
  // 알림 생성 (변화 감지)
  if (currentState.lastUpdate) {
    AGENTS.forEach(agent => {
      const oldCount = currentState.pipeline[agent.stage] || 0;
      const newCount = newState.pipeline[agent.stage] || 0;
      
      if (newCount > oldCount) {
        newState.alerts.push({
          type: 'info',
          agent: agent.name,
          message: `새로운 파일 ${newCount - oldCount}개 추가`,
          timestamp: new Date().toISOString()
        });
      }
      
      if (newCount < oldCount) {
        newState.alerts.push({
          type: 'warning',
          agent: agent.name,
          message: `파일 ${oldCount - newCount}개 감소`,
          timestamp: new Date().toISOString()
        });
      }
    });
  }
  
  // 병목 감지
  const pipelineStages = [
    '01-sourced', '02-assigned', '03-reported', '04-drafted',
    '05-fact-checked', '06-desk-approved', '07-copy-edited', '08-published'
  ];
  
  for (let i = 0; i < pipelineStages.length - 1; i++) {
    const current = newState.pipeline[pipelineStages[i]] || 0;
    const next = newState.pipeline[pipelineStages[i + 1]] || 0;
    
    if (current > 5 && next === 0) {
      const stageName = pipelineStages[i].split('-')[1];
      newState.alerts.push({
        type: 'bottleneck',
        message: `병목 감지: ${stageName}에 ${current}개 대기`,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  currentState = newState;
  return newState;
}

/**
 * WebSocket으로 모든 클라이언트에 브로드캐스트
 */
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * WebSocket 연결 처리
 */
wss.on('connection', (ws) => {
  console.log('✅ Client connected');
  
  // 즉시 현재 상태 전송
  ws.send(JSON.stringify({
    type: 'initial',
    data: currentState
  }));
  
  ws.on('close', () => {
    console.log('❌ Client disconnected');
  });
});

/**
 * REST API 엔드포인트
 */

// 현재 상태
app.get('/api/status', (req, res) => {
  res.json(currentState);
});

// 특정 에이전트 상태
app.get('/api/agents/:id', (req, res) => {
  const agent = currentState.agents[req.params.id];
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json(agent);
});

// 파이프라인 흐름
app.get('/api/pipeline', (req, res) => {
  res.json(currentState.pipeline);
});

// 메트릭
app.get('/api/metrics', (req, res) => {
  res.json(currentState.metrics);
});

// 알림
app.get('/api/alerts', (req, res) => {
  res.json(currentState.alerts);
});

// 토큰 사용량 추적
app.get('/api/tokens', (req, res) => {
  try {
    const runsDir = '/root/.openclaw/cron/runs';
    const hours = parseInt(req.query.hours) || 24;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    
    const jobFiles = fs.readdirSync(runsDir).filter(f => f.endsWith('.jsonl'));
    
    const agentTokens = {};  // agentId → { input, output, total, runs, errors, models }
    const hourlyTokens = {}; // hour → total
    const modelUsage = {};   // model → { tokens, runs }
    let totalTokens = 0;
    let totalRuns = 0;
    let skippedRuns = 0;
    
    // 크론 ID → 에이전트 이름 매핑
    const CRON_NAMES = {};
    try {
      const cronData = JSON.parse(fs.readFileSync('/root/.openclaw/cron/jobs.json', 'utf8'));
      cronData.jobs.forEach(j => { CRON_NAMES[j.id] = j.name || j.id; });
    } catch(e) {}
    
    jobFiles.forEach(file => {
      const jobId = file.replace('.jsonl', '');
      const agentName = CRON_NAMES[jobId] || jobId.slice(0, 8);
      const filePath = path.join(runsDir, file);
      
      try {
        const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
        
        lines.forEach(line => {
          try {
            const entry = JSON.parse(line);
            if (entry.action !== 'finished' || !entry.ts || entry.ts < cutoff) return;
            
            const usage = entry.usage || {};
            const input = usage.input_tokens || 0;
            const output = usage.output_tokens || 0;
            const total = usage.total_tokens || (input + output);
            const model = entry.model || 'unknown';
            
            // 에이전트별 집계
            if (!agentTokens[agentName]) {
              agentTokens[agentName] = { input: 0, output: 0, total: 0, runs: 0, errors: 0, skipped: 0, models: {} };
            }
            agentTokens[agentName].runs++;
            
            if (entry.status === 'error') {
              agentTokens[agentName].errors++;
            }
            
            // "할 일 없음" 감지 (토큰 < 1000이면 스킵 처리된 실행)
            if (total < 1000) {
              agentTokens[agentName].skipped++;
              skippedRuns++;
            }
            
            agentTokens[agentName].input += input;
            agentTokens[agentName].output += output;
            agentTokens[agentName].total += total;
            
            if (!agentTokens[agentName].models[model]) {
              agentTokens[agentName].models[model] = 0;
            }
            agentTokens[agentName].models[model] += total;
            
            // 시간별 집계
            const hour = new Date(entry.ts).toISOString().slice(0, 13);
            hourlyTokens[hour] = (hourlyTokens[hour] || 0) + total;
            
            // 모델별 집계
            if (!modelUsage[model]) modelUsage[model] = { tokens: 0, runs: 0 };
            modelUsage[model].tokens += total;
            modelUsage[model].runs++;
            
            totalTokens += total;
            totalRuns++;
          } catch(e) {}
        });
      } catch(e) {}
    });
    
    // 정렬 (토큰 많은 순)
    const sortedAgents = Object.entries(agentTokens)
      .sort((a, b) => b[1].total - a[1].total)
      .reduce((obj, [k, v]) => { obj[k] = v; return obj; }, {});
    
    res.json({
      period: `${hours}h`,
      summary: {
        totalTokens,
        totalRuns,
        skippedRuns,
        avgTokensPerRun: totalRuns > 0 ? Math.round(totalTokens / totalRuns) : 0,
        savingsFromSkips: skippedRuns > 0 ? Math.round(skippedRuns * 25000) : 0  // 예상 절감
      },
      agents: sortedAgents,
      hourly: hourlyTokens,
      models: modelUsage
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * 1분마다 자동 스캔
 */
cron.schedule('* * * * *', () => {
  console.log('🔄 Scanning pipeline...');
  const newState = scanPipeline();
  broadcast({ type: 'update', data: newState });
});

/**
 * 서버 시작
 */
async function start() {
  // 초기 스캔
  scanPipeline();
  
  server.listen(PORT, () => {
    console.log(`\n🚀 Control Center running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/index.html`);
    console.log(`📡 WebSocket: ws://localhost:${PORT}`);
    console.log(`\n⏰ Auto-refresh: Every 1 minute\n`);
  });
}

start();
