/**
 * GET /api/analytics?hours=24
 * 시간대별 발행 현황 (그래프용)
 */

const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const statsFile = '/root/.openclaw/workspace/newsroom/shared/logs/pipeline-stats.jsonl';
    
    if (!fs.existsSync(statsFile)) {
      return res.json({ labels: [], education: [], digest: [] });
    }
    
    const lines = fs.readFileSync(statsFile, 'utf8').split('\n').filter(l => l.trim());
    
    // 시간별 데이터 집계
    const hourlyStats = {};
    
    lines.forEach(line => {
      try {
        const entry = JSON.parse(line);
        const date = new Date(entry.timestamp);
        const hourKey = `${date.getHours()}:00`;
        
        if (!hourlyStats[hourKey]) {
          hourlyStats[hourKey] = {
            education: entry.branches?.education?.['08-published'] || 0,
            digest: entry.branches?.digest?.['digest/03-published'] || 0
          };
        }
      } catch (e) {
        // 파싱 오류 무시
      }
    });
    
    // 레이블과 데이터 포맷
    const labels = Object.keys(hourlyStats).sort();
    const education = labels.map(h => hourlyStats[h].education);
    const digest = labels.map(h => hourlyStats[h].digest);
    
    res.json({
      type: 'bar',
      labels,
      datasets: [
        {
          label: 'AI 교육',
          data: education,
          backgroundColor: '#3b82f6',
          borderColor: '#1e40af',
          borderWidth: 1
        },
        {
          label: 'AI Digest',
          data: digest,
          backgroundColor: '#f97316',
          borderColor: '#c2410c',
          borderWidth: 1
        }
      ]
    });
  } catch (e) {
    res.status(500).json({ error: '분석 데이터 조회 실패' });
  }
};
