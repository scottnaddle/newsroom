/**
 * UBION Control Center v4 - Express Server
 * 
 * Simple Express server for backend API
 * (faster than FastAPI for deployment)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8000;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// In-Memory Storage
// ============================================================================

const agents = new Map([
  // Main Pipeline
  ['source-collector', { id: 'source-collector', name: 'Source Collector', type: 'collector', state: 'idle', color: '#4169E1', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 2, y: 2 }],
  ['reporter', { id: 'reporter', name: 'Reporter', type: 'reporter', state: 'idle', color: '#228B22', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 8, y: 2 }],
  ['writer', { id: 'writer', name: 'Writer', type: 'writer', state: 'idle', color: '#DC143C', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 14, y: 2 }],
  ['fact-checker', { id: 'fact-checker', name: 'Fact Checker', type: 'fact-checker', state: 'idle', color: '#9370DB', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 2, y: 8 }],
  ['editor-desk', { id: 'editor-desk', name: 'Editor Desk', type: 'editor', state: 'idle', color: '#FF8C00', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 8, y: 8 }],
  ['copy-editor', { id: 'copy-editor', name: 'Copy Editor', type: 'copy-editor', state: 'idle', color: '#FFD700', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 8, y: 14 }],
  ['publisher', { id: 'publisher', name: 'Publisher', type: 'publisher', state: 'idle', color: '#20B2AA', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 14, y: 8 }],
  
  // Digest Agents
  ['digest-collector', { id: 'digest-collector', name: 'Digest Collector', type: 'collector', state: 'idle', color: '#4169E1', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 2, y: 14 }],
  ['digest-writer', { id: 'digest-writer', name: 'Digest Writer', type: 'writer', state: 'idle', color: '#DC143C', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 8, y: 20 }],
  ['digest-publisher', { id: 'digest-publisher', name: 'Digest Publisher', type: 'publisher', state: 'idle', color: '#20B2AA', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 14, y: 14 }],
  
  // Special Agents
  ['cartoon-agent', { id: 'cartoon-agent', name: 'Cartoon Agent', type: 'content', state: 'idle', color: '#FF1493', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 20, y: 2 }],
  ['colloquy', { id: 'colloquy', name: 'Colloquy', type: 'content', state: 'idle', color: '#00CED1', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 20, y: 8 }],
  ['analyst', { id: 'analyst', name: 'Analyst', type: 'analyzer', state: 'idle', color: '#32CD32', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 20, y: 14 }],
  ['daily-briefing', { id: 'daily-briefing', name: 'Daily Briefing', type: 'briefing', state: 'idle', color: '#FFD700', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 20, y: 20 }],
  ['weekly-review', { id: 'weekly-review', name: 'Weekly Review', type: 'review', state: 'idle', color: '#9370DB', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 26, y: 2 }],
  ['paper-collector', { id: 'paper-collector', name: 'Paper Collector', type: 'collector', state: 'idle', color: '#4169E1', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 26, y: 8 }],
  ['paper-processor', { id: 'paper-processor', name: 'Paper Processor', type: 'processor', state: 'idle', color: '#FF8C00', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 26, y: 14 }],
  ['system-architect', { id: 'system-architect', name: 'System Architect', type: 'system', state: 'idle', color: '#696969', status: 'idle', stats: { success: 0, failure: 0, total: 0 }, x: 26, y: 20 }]
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

// Get pipeline statistics
app.get('/api/pipeline/:pipelineId/stats', (req, res) => {
  const { pipelineId } = req.params;
  
  try {
    let pipelineStats = null;
    
    if (pipelineId === 'education') {
      // Read actual stats from 08-published directory
      const publishedPath = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
      const rejectedPath = '/root/.openclaw/workspace/newsroom/pipeline/rejected';
      const draftPath = '/root/.openclaw/workspace/newsroom/pipeline/04-drafted';
      
      let published = 0;
      let processing = 0;
      let failed = 0;
      
      try {
        if (fs.existsSync(publishedPath)) {
          published = fs.readdirSync(publishedPath).filter(f => f.endsWith('.json')).length;
        }
      } catch (e) { /* skip */ }
      
      try {
        if (fs.existsSync(rejectedPath)) {
          failed = fs.readdirSync(rejectedPath).filter(f => f.endsWith('.json')).length;
        }
      } catch (e) { /* skip */ }
      
      try {
        if (fs.existsSync(draftPath)) {
          processing = fs.readdirSync(draftPath).filter(f => f.endsWith('.json')).length;
        }
      } catch (e) { /* skip */ }
      
      const total = published + processing + failed;
      const successRate = total > 0 ? ((published / total) * 100).toFixed(1) : 0;
      
      pipelineStats = {
        published,
        processing,
        failed,
        stages: 8,
        successRate: parseFloat(successRate),
        total,
        lastUpdated: new Date().toISOString()
      };
    } else if (pipelineId === 'digest') {
      // Digest pipeline stats
      const digestPath = '/root/.openclaw/workspace/newsroom/pipeline/digest';
      let published = 0;
      
      try {
        if (fs.existsSync(digestPath)) {
          published = fs.readdirSync(digestPath).filter(f => f.endsWith('.json')).length;
        }
      } catch (e) { /* skip */ }
      
      pipelineStats = {
        published,
        processing: 1,
        failed: 0,
        stages: 3,
        successRate: 100,
        lastUpdated: new Date().toISOString()
      };
    } else if (pipelineId === 'content') {
      pipelineStats = {
        published: 120,
        processing: 5,
        failed: 2,
        agents: 5,
        successRate: 98.1,
        lastUpdated: new Date().toISOString()
      };
    } else if (pipelineId === 'research') {
      // Research (papers) pipeline stats
      const papersPath = '/root/.openclaw/workspace/newsroom/pipeline/papers/03-published';
      let published = 0;
      
      try {
        if (fs.existsSync(papersPath)) {
          published = fs.readdirSync(papersPath).filter(f => f.endsWith('.json')).length;
        }
      } catch (e) { /* skip */ }
      
      pipelineStats = {
        published,
        processing: 2,
        failed: 0,
        agents: 2,
        successRate: 100,
        lastUpdated: new Date().toISOString()
      };
    } else if (pipelineId === 'system') {
      pipelineStats = {
        active: agents.size,
        idle: 0,
        uptime: '99.9%',
        monitored: agents.size,
        lastUpdated: new Date().toISOString()
      };
    }
    
    if (pipelineStats) {
      res.json({
        pipeline: pipelineId,
        stats: pipelineStats
      });
    } else {
      res.status(404).json({ error: 'Pipeline not found' });
    }
  } catch (e) {
    console.error('Error getting stats:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get articles by pipeline
app.get('/api/pipeline/:pipelineId/articles', (req, res) => {
  const { pipelineId } = req.params;
  const limit = parseInt(req.query.limit) || 5;
  
  try {
    let pipelinePath = '';
    let articles = [];
    
    if (pipelineId === 'education') {
      // Read from 08-published for education pipeline
      pipelinePath = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
      
      if (fs.existsSync(pipelinePath)) {
        const files = fs.readdirSync(pipelinePath)
          .filter(f => f.endsWith('.json'))
          .slice(0, limit);
        
        articles = files.map(file => {
          try {
            const content = JSON.parse(fs.readFileSync(path.join(pipelinePath, file), 'utf8'));
            // Extract title from source
            let title = 'AI 교육 뉴스';
            
            if (content.source && content.source.title) {
              title = content.source.title;
            } else if (content.draft && content.draft.headline) {
              title = content.draft.headline;
            } else if (content.reporting_brief && content.reporting_brief.source_title) {
              title = content.reporting_brief.source_title;
            } else if (file.includes('_')) {
              // Extract title from filename as fallback
              const parts = file.split('_');
              if (parts.length > 2) {
                title = parts.slice(3).join('_').replace('.json', '');
                // Convert from kebab-case to readable title
                title = title
                  .replace(/-/g, ' ')
                  .split(' ')
                  .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ');
              }
            }
            
            return {
              id: file.replace('.json', ''),
              title: title,
              status: 'success',
              timestamp: content.published_at || new Date().toISOString()
            };
          } catch (e) {
            console.error('Error reading file:', file, e.message);
            return null;
          }
        }).filter(a => a !== null);
      }
    } else if (pipelineId === 'digest') {
      // Placeholder for digest pipeline
      articles = [
        { id: 'digest-1', title: 'AI 주간 다이제스트 - 교육 분야 최신 동향', status: 'processing', timestamp: new Date().toISOString() },
        { id: 'digest-2', title: 'AI 정책 변화: 주요 각국 교육 규제 강화', status: 'success', timestamp: new Date(Date.now() - 86400000).toISOString() }
      ];
    } else if (pipelineId === 'content') {
      articles = [
        { id: 'content-1', title: 'AI 만평: 교육 현장의 대변신', status: 'success', timestamp: new Date().toISOString() },
        { id: 'content-2', title: '전문가 대담: AI 시대의 교육 격변', status: 'processing', timestamp: new Date().toISOString() }
      ];
    } else if (pipelineId === 'research') {
      articles = [
        { id: 'research-1', title: '[논문] AI 교육 투자 효과 분석 연구', status: 'success', timestamp: new Date().toISOString() },
        { id: 'research-2', title: '[논문] 생성형 AI와 학생 학습 성과 상관관계', status: 'pending', timestamp: new Date().toISOString() }
      ];
    }
    
    res.json({
      pipeline: pipelineId,
      count: articles.length,
      articles: articles
    });
  } catch (e) {
    console.error('Error reading articles:', e);
    res.json({
      pipeline: pipelineId,
      count: 0,
      articles: []
    });
  }
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

// Redirect old pages to unified dashboard
app.get('/index.html', (req, res) => {
  res.redirect('/dashboard-unified.html');
});

app.get('/multi-pipeline.html', (req, res) => {
  res.redirect('/dashboard-unified.html');
});

app.get('/pipeline.html', (req, res) => {
  res.redirect('/dashboard-unified.html');
});

app.get('/dashboard.html', (req, res) => {
  res.redirect('/dashboard-unified.html');
});

app.get('/agents-status.html', (req, res) => {
  res.redirect('/dashboard-unified.html');
});

app.get('/llm-agents.html', (req, res) => {
  res.redirect('/dashboard-unified.html');
});

// Fallback route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist', 'dashboard-unified.html'));
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
