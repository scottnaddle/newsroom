/**
 * GET /api/status
 * 현재 파이프라인 상태 조회
 */

const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const statusFile = '/root/.openclaw/workspace/newsroom/shared/logs/dashboard-status.json';
  
  try {
    const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: '상태 조회 실패' });
  }
};
