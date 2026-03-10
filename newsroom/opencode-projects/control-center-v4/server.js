/**
 * UBION Control Center v4 - Express Server
 * 
 * Simple Express server for backend API
 * (faster than FastAPI for deployment)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 8000;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// In-Memory Storage
// ============================================================================

const agents = new Map([
  ['source-collector', { id: 'source-collector', name: 'Source Collector', type: 'collector', state: 'idle', color: '#4169E1', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 2, y: 2 }],
  ['reporter', { id: 'reporter', name: 'Reporter', type: 'reporter', state: 'idle', color: '#228B22', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 8, y: 2 }],
  ['writer', { id: 'writer', name: 'Writer', type: 'writer', state: 'idle', color: '#DC143C', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 14, y: 2 }],
  ['fact-checker', { id: 'fact-checker', name: 'Fact Checker', type: 'fact-checker', state: 'idle', color: '#9370DB', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 2, y: 8 }],
  ['editor-desk', { id: 'editor-desk', name: 'Editor Desk', type: 'editor', state: 'idle', color: '#FF8C00', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 8, y: 8 }],
  ['copy-editor', { id: 'copy-editor', name: 'Copy Editor', type: 'copy-editor', state: 'idle', color: '#FFD700', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 8, y: 14 }],
  ['publisher', { id: 'publisher', name: 'Publisher', type: 'publisher', state: 'idle', color: '#20B2AA', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 14, y: 8 }]
]);

const articles = new Map();
const stats = {
  total_published: 0,
  total_processed: 0,
  success_rate: 0
};

// ============================================================================
// Routes
// ============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), agents: agents.size });
});

// Get all agents
app.get('/api/agents', (req, res) => {
  res.json(Array.from(agents.values()));
});

// Get specific agent
app.get('/api/agents/:agentId', (req, res) => {
  const agent = agents.get(req.params.agentId);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json(agent);
});

// Update agent state
app.post('/api/agents/:agentId/state', (req, res) => {
  const agent = agents.get(req.params.agentId);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const { state, status } = req.body;
  if (state) agent.state = state;
  if (status) agent.status = status;

  res.json({ status: 'ok', agent: agent });
});

// Get all articles
app.get('/api/pipeline/articles', (req, res) => {
  res.json(Array.from(articles.values()));
});

// Get pipeline summary
app.get('/api/pipeline/summary', (req, res) => {
  res.json({
    total_articles: articles.size,
    total_published: stats.total_published,
    total_processed: stats.total_processed,
    success_rate: stats.success_rate,
    agents: agents.size
  });
});

// Simulate article creation
app.post('/api/pipeline/articles', (req, res) => {
  const { id, title, stage } = req.body;
  articles.set(id, { id, title, stage, timestamp: new Date().toISOString() });
  stats.total_processed++;
  res.json({ status: 'ok', article_id: id });
});

// Serve static files (if frontend is built)
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Fallback route
app.get('/', (req, res) => {
  res.json({
    message: '🏢 UBION Control Center v4',
    status: 'running',
    uptime: process.uptime(),
    agents: agents.size,
    articles: articles.size,
    endpoints: {
      health: '/health',
      agents: '/api/agents',
      pipeline: '/api/pipeline/summary'
    }
  });
});

// ============================================================================
// Error handling
// ============================================================================

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║            🏢 UBION Control Center v4 - Server Started! ✅               ║
║                                                                            ║
║  Server: http://127.0.0.1:${PORT}                                          ║
║  Health: http://127.0.0.1:${PORT}/health                                   ║
║  API: http://127.0.0.1:${PORT}/api/agents                                  ║
║                                                                            ║
║  Agents: ${agents.size}                                                          ║
║  Articles: ${articles.size}                                                      ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  process.exit(0);
});
