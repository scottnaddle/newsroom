/**
 * GET /api/agents
 * 에이전트 상태 및 최근 활동 조회
 */

const fs = require('fs');
const path = require('path');
const { getAgentStatus } = require('../logger');

module.exports = (req, res) => {
  try {
    // 에이전트 상태
    const agents = getAgentStatus();
    
    // 최근 활동
    const recentFile = '/root/.openclaw/workspace/newsroom/shared/logs/agent-activity-recent.json';
    let recent = [];
    try {
      recent = JSON.parse(fs.readFileSync(recentFile, 'utf8'));
    } catch {
      recent = [];
    }
    
    res.json({
      agents,
      recentActivity: recent.slice(0, 20),
      totalAgents: Object.keys(agents).length,
      activeAgents: Object.values(agents).filter(a => a.status === 'processing').length
    });
  } catch (e) {
    res.status(500).json({ error: '에이전트 조회 실패' });
  }
};
