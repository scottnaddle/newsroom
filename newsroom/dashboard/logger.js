/**
 * Agent Activity Logger
 * 모든 에이전트의 입출 활동을 기록
 */

const fs = require('fs');
const path = require('path');

const LOGS_DIR = '/root/.openclaw/workspace/newsroom/shared/logs';

/**
 * 에이전트 활동 기록
 */
function logActivity(agent, action, details) {
  const timestamp = new Date().toISOString();
  
  const entry = {
    timestamp,
    agent,
    action,
    details: {
      ...details,
      duration: details.duration || null,
      status: details.status || 'success',
      fileCount: details.fileCount || null
    }
  };
  
  // JSONL 형식으로 기록 (시계열)
  const activityFile = path.join(LOGS_DIR, 'agent-activity.jsonl');
  const line = JSON.stringify(entry) + '\n';
  
  fs.appendFileSync(activityFile, line);
  
  // 최근 30분 활동 (메모리/파일)
  updateRecentActivity(entry);
  
  console.log(`[${agent}] ${action}: ${details.message || ''}`);
  
  return entry;
}

/**
 * 최근 30분 활동 업데이트 (대시보드에서 빠르게 접근)
 */
function updateRecentActivity(entry) {
  const recentFile = path.join(LOGS_DIR, 'agent-activity-recent.json');
  
  let recent = [];
  try {
    recent = JSON.parse(fs.readFileSync(recentFile, 'utf8'));
  } catch {
    recent = [];
  }
  
  // 새 항목 추가
  recent.unshift(entry);
  
  // 최근 100개만 유지
  recent = recent.slice(0, 100);
  
  fs.writeFileSync(recentFile, JSON.stringify(recent, null, 2));
}

/**
 * 에이전트별 통계
 */
function getAgentStats() {
  const activityFile = path.join(LOGS_DIR, 'agent-activity.jsonl');
  
  if (!fs.existsSync(activityFile)) {
    return {};
  }
  
  const lines = fs.readFileSync(activityFile, 'utf8').split('\n').filter(l => l.trim());
  const stats = {};
  
  lines.forEach(line => {
    try {
      const entry = JSON.parse(line);
      if (!stats[entry.agent]) {
        stats[entry.agent] = {
          totalActions: 0,
          successCount: 0,
          failureCount: 0,
          lastActivity: null,
          actions: {}
        };
      }
      
      stats[entry.agent].totalActions++;
      stats[entry.agent].lastActivity = entry.timestamp;
      
      if (entry.details.status === 'success') {
        stats[entry.agent].successCount++;
      } else {
        stats[entry.agent].failureCount++;
      }
      
      if (!stats[entry.agent].actions[entry.action]) {
        stats[entry.agent].actions[entry.action] = 0;
      }
      stats[entry.agent].actions[entry.action]++;
    } catch (e) {
      // 파싱 오류 무시
    }
  });
  
  return stats;
}

/**
 * 모든 에이전트의 현재 상태 (기본값)
 */
function getAgentStatus() {
  const stats = getAgentStats();
  
  const agents = [
    'orchestrator',       // 통합 파이프라인 오케스트레이터
    'digest_collector',
    'digest_writer',
    'digest_publisher',
    'paper_processor',
    'cartoon_agent',
    'colloquy_agent',
    'insight_analyst',
    'system_architect'
  ];
  
  const status = {};
  
  agents.forEach(agent => {
    const agentStats = stats[agent] || {};
    status[agent] = {
      name: agent,
      status: agentStats.lastActivity ? 'idle' : 'pending',
      lastActivity: agentStats.lastActivity || null,
      totalActions: agentStats.totalActions || 0,
      successRate: agentStats.totalActions > 0 
        ? Math.round(agentStats.successCount / agentStats.totalActions * 100)
        : 0
    };
  });
  
  return status;
}

module.exports = {
  logActivity,
  getAgentStats,
  getAgentStatus
};
