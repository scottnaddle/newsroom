/**
 * dashboard/server.js — 관제센터 서버
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cron = require('node-cron');

class DashboardServer {
  constructor(config, engine) {
    this.config = config;
    this.engine = engine;
    this.port = config.dashboard?.port || 3848;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
  }

  start() {
    // Static files
    this.app.use(express.static(path.join(__dirname, 'public')));

    // API endpoints
    this.app.get('/api/status', (req, res) => {
      res.json(this.engine.getState());
    });

    this.app.get('/api/config', (req, res) => {
      // 민감 정보 제거
      const safe = { ...this.config };
      if (safe.llm) safe.llm = { ...safe.llm, api_key: '***' };
      if (safe.cms) safe.cms = { ...safe.cms, api_key: '***' };
      res.json(safe);
    });

    // WebSocket
    this.wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'initial', data: this.engine.getState() }));
    });

    // 1분 주기 브로드캐스트
    cron.schedule('* * * * *', () => {
      const state = this.engine.getState();
      const msg = JSON.stringify({ type: 'update', data: state });
      this.wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(msg);
      });
    });

    this.server.listen(this.port, () => {
      console.log(`\n📊 Dashboard: http://localhost:${this.port}`);
    });
  }

  stop() {
    this.server.close();
  }
}

module.exports = DashboardServer;
