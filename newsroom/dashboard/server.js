#!/usr/bin/env node
/**
 * UBION Dashboard Server v2
 * Express + WebSocket
 * Port: 3848
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const bodyParser = require('body-parser');
const cors = require('cors');

const { runMonitor } = require('./monitor');
const statusApi = require('./api/status');
const agentsApi = require('./api/agents');
const analyticsApi = require('./api/analytics');

/**
 * 1주일 이상 된 로그 삭제
 */
function cleanupOldLogs() {
  const fs = require('fs');
  const path = require('path');
  
  const logsDir = '/root/.openclaw/workspace/newsroom/shared/logs';
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  const files = ['agent-activity.jsonl', 'pipeline-stats.jsonl'];
  
  files.forEach(filename => {
    const filepath = path.join(logsDir, filename);
    
    if (!fs.existsSync(filepath)) return;
    
    try {
      const lines = fs.readFileSync(filepath, 'utf8').split('\n').filter(l => l.trim());
      const filtered = lines.filter(line => {
        try {
          const entry = JSON.parse(line);
          const timestamp = new Date(entry.timestamp);
          return timestamp.getTime() > sevenDaysAgo;
        } catch {
          return true;
        }
      });
      
      fs.writeFileSync(filepath, filtered.join('\n') + (filtered.length > 0 ? '\n' : ''));
      console.log(`🧹 ${filename}: ${lines.length - filtered.length}개 오래된 항목 삭제`);
    } catch (e) {
      console.error(`정리 오류 (${filename}):`, e.message);
    }
  });
}

const app = express();
const port = 3848;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ============================================
// 정적 파일 제공 (대시보드 페이지)
// ============================================

app.use('/pages', express.static('/root/.openclaw/workspace/newsroom/dashboard/pages'));

// ============================================
// REST API Routes
// ============================================

app.get('/api/status', statusApi);
app.get('/api/agents', agentsApi);
app.get('/api/analytics', analyticsApi);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// 대시보드 메인 페이지
app.get('/', (req, res) => {
  res.sendFile('/root/.openclaw/workspace/newsroom/dashboard/pages/main.html');
});

// ============================================
// WebSocket Setup
// ============================================

const server = http.createServer(app);

// ============================================
// 1분 주기 모니터링
// ============================================

console.log('🚀 UBION Dashboard Server v2 시작 중...\n');

// 초기 실행
runMonitor();

// 1분마다 모니터링 실행 (폴링 방식)
setInterval(() => {
  runMonitor();
}, 60 * 1000);

// 로그 정리 (매시간 1주일 이상 된 데이터 삭제)
setInterval(() => {
  cleanupOldLogs();
}, 60 * 60 * 1000); // 1시간마다

// ============================================
// Server 시작
// ============================================

server.listen(port, '0.0.0.0', () => {
  console.log(`\n✅ Dashboard Server 실행 중`);
  console.log(`📍 WebSocket: ws://0.0.0.0:${port}`);
  console.log(`📍 REST API: http://0.0.0.0:${port}/api/`);
  console.log(`🏥 Health Check: http://0.0.0.0:${port}/health`);
  console.log(`\n📊 사용 가능한 엔드포인트:`);
  console.log(`   GET /api/status       - 파이프라인 상태`);
  console.log(`   GET /api/agents       - 에이전트 상태`);
  console.log(`   GET /api/analytics    - 시간대별 그래프 데이터`);
  console.log(`\n🔄 모니터링 주기: 1분`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Server 종료 중...');
  server.close(() => {
    console.log('✅ Server 종료 완료');
    process.exit(0);
  });
});
