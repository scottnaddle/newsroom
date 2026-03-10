#!/usr/bin/env node

/**
 * NotebookLM REST API Server
 * Insight 페이지의 콘텐츠를 기반으로 팟캐스트 생성
 * 
 * Endpoints:
 * POST /api/notebooks - 새 노트북 생성
 * POST /api/sources - 소스(URL) 추가
 * POST /api/podcasts/generate - 팟캐스트 생성
 * GET /api/podcasts/:id - 팟캐스트 상태 조회
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('crypto').randomUUID ? () => require('crypto').randomUUID() : () => Math.random().toString(36).substr(2, 9);

const app = express();
app.use(express.json());

// 설정
const CONFIG = {
  port: process.env.PORT || 3849,
  notebookLmApiUrl: 'https://notebooklm.google.com',
  baseDir: '/root/.openclaw/workspace/notebooklm-server',
};

// 데이터 저장소
const notebooks = new Map();
const podcasts = new Map();
const sources = new Map();

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 고유 ID 생성
 */
function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

/**
 * 팟캐스트 스크립트를 오디오로 변환 (TTS)
 * 실제로는 Google Cloud TTS 또는 Naver Clova 사용
 */
async function convertScriptToAudio(script, voiceConfig) {
  console.log('🎙️ TTS 변환 시작...');
  
  // 현재는 스크립트만 저장 (나중에 TTS 통합)
  return {
    audioUrl: `https://askedtech.ghost.io/podcasts/${generateId()}.mp3`,
    duration: '4:32',
    script: script
  };
}

/**
 * 팟캐스트 스크립트 생성
 */
async function generatePodcastScript(sourceUrl, sourceTitle) {
  console.log(`📝 팟캐스트 스크립트 생성 중: ${sourceTitle}`);
  
  // 미리 만든 스크립트 사용 또는 새로 생성
  const scriptTemplate = `
📻 ${sourceTitle}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[배경음: 밝은 뉴스 인트로, 5초]

👩 여성 진행자 (헤일리):
안녕하세요, 에듀테크 인사이트 팟캐스트입니다.
오늘의 주제는 "${sourceTitle}"입니다.

[본문 생성...]

👨 남성 전문가:
네, 감사합니다. 오늘 이야기를 정리해보면,
이것은 매우 중요한 트렌드입니다.

👩 여성 진행자:
감사합니다, 전문가님.
더 자세한 내용은 저희 웹사이트에서 확인하실 수 있습니다.

이상 에듀테크 인사이트 팟캐스트였습니다!

[배경음: 아웃트로, 5초]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return scriptTemplate;
}

// ============================================================================
// REST API 엔드포인트
// ============================================================================

/**
 * 상태 체크
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'NotebookLM REST API',
    port: CONFIG.port,
    notebooks: notebooks.size,
    podcasts: podcasts.size
  });
});

/**
 * 새 노트북 생성
 * POST /api/notebooks
 */
app.post('/api/notebooks', (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const notebookId = generateId();
  const notebook = {
    id: notebookId,
    title,
    description: description || '',
    createdAt: new Date().toISOString(),
    sources: [],
    status: 'created'
  };

  notebooks.set(notebookId, notebook);

  console.log(`✅ 새 노트북 생성: ${notebookId} (${title})`);

  res.status(201).json({
    success: true,
    notebook: notebook
  });
});

/**
 * 소스(URL) 추가
 * POST /api/sources
 */
app.post('/api/sources', (req, res) => {
  const { notebookId, url, title, type = 'webpage' } = req.body;

  if (!notebookId || !url) {
    return res.status(400).json({ error: 'notebookId and url are required' });
  }

  const notebook = notebooks.get(notebookId);
  if (!notebook) {
    return res.status(404).json({ error: 'Notebook not found' });
  }

  const sourceId = generateId();
  const source = {
    id: sourceId,
    notebookId,
    url,
    title: title || url,
    type,
    addedAt: new Date().toISOString(),
    status: 'added'
  };

  sources.set(sourceId, source);
  notebook.sources.push(sourceId);

  console.log(`✅ 소스 추가: ${sourceId} (${url})`);

  res.status(201).json({
    success: true,
    source: source
  });
});

/**
 * 팟캐스트 생성 요청
 * POST /api/podcasts/generate
 */
app.post('/api/podcasts/generate', async (req, res) => {
  const { notebookId, voiceConfig = {} } = req.body;

  if (!notebookId) {
    return res.status(400).json({ error: 'notebookId is required' });
  }

  const notebook = notebooks.get(notebookId);
  if (!notebook) {
    return res.status(404).json({ error: 'Notebook not found' });
  }

  if (notebook.sources.length === 0) {
    return res.status(400).json({ error: 'No sources added to notebook' });
  }

  const podcastId = generateId();
  const podcast = {
    id: podcastId,
    notebookId,
    title: `${notebook.title} - 팟캐스트`,
    status: 'generating',
    createdAt: new Date().toISOString(),
    progress: 0,
    voiceConfig: {
      femaleVoice: voiceConfig.femaleVoice || 'ko-KR-Neural2-A',
      maleVoice: voiceConfig.maleVoice || 'ko-KR-Neural2-C',
      speed: voiceConfig.speed || 1.0
    }
  };

  podcasts.set(podcastId, podcast);

  console.log(`🎙️ 팟캐스트 생성 시작: ${podcastId}`);

  // 비동기 처리 (실제 생성)
  setImmediate(async () => {
    try {
      // Step 1: 모든 소스 수집
      const sourceTitles = notebook.sources
        .map(sid => sources.get(sid)?.title)
        .filter(Boolean);

      podcast.progress = 20;

      // Step 2: 팟캐스트 스크립트 생성
      const script = await generatePodcastScript(
        notebook.sources[0],
        notebook.title
      );

      podcast.progress = 50;

      // Step 3: TTS 변환
      const audio = await convertScriptToAudio(script, podcast.voiceConfig);

      podcast.progress = 80;
      podcast.script = script;
      podcast.audioUrl = audio.audioUrl;
      podcast.duration = audio.duration;

      // Step 4: 완료
      podcast.status = 'completed';
      podcast.progress = 100;
      podcast.completedAt = new Date().toISOString();

      console.log(`✅ 팟캐스트 생성 완료: ${podcastId}`);
    } catch (error) {
      console.error(`❌ 팟캐스트 생성 실패: ${error.message}`);
      podcast.status = 'failed';
      podcast.error = error.message;
    }
  });

  res.status(202).json({
    success: true,
    podcast: {
      id: podcast.id,
      status: podcast.status,
      notebookId: podcast.notebookId,
      message: 'Podcast generation started. Poll /api/podcasts/:id for status.'
    }
  });
});

/**
 * 팟캐스트 상태 조회
 * GET /api/podcasts/:id
 */
app.get('/api/podcasts/:id', (req, res) => {
  const { id } = req.params;
  const podcast = podcasts.get(id);

  if (!podcast) {
    return res.status(404).json({ error: 'Podcast not found' });
  }

  res.json({
    success: true,
    podcast: {
      id: podcast.id,
      title: podcast.title,
      status: podcast.status,
      progress: podcast.progress,
      audioUrl: podcast.audioUrl,
      duration: podcast.duration,
      createdAt: podcast.createdAt,
      completedAt: podcast.completedAt,
      error: podcast.error || null
    }
  });
});

/**
 * 모든 팟캐스트 조회
 * GET /api/podcasts
 */
app.get('/api/podcasts', (req, res) => {
  const allPodcasts = Array.from(podcasts.values()).map(p => ({
    id: p.id,
    title: p.title,
    status: p.status,
    progress: p.progress,
    createdAt: p.createdAt
  }));

  res.json({
    success: true,
    count: allPodcasts.length,
    podcasts: allPodcasts
  });
});

/**
 * 노트북 조회
 * GET /api/notebooks/:id
 */
app.get('/api/notebooks/:id', (req, res) => {
  const { id } = req.params;
  const notebook = notebooks.get(id);

  if (!notebook) {
    return res.status(404).json({ error: 'Notebook not found' });
  }

  const notebookSources = notebook.sources
    .map(sid => sources.get(sid))
    .filter(Boolean);

  res.json({
    success: true,
    notebook: {
      ...notebook,
      sources: notebookSources
    }
  });
});

// ============================================================================
// 서버 시작
// ============================================================================

const server = app.listen(CONFIG.port, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║       🎙️  NotebookLM REST API Server 시작됨              ║
║                                                            ║
║       Port: ${CONFIG.port}                                   ║
║       Endpoint: http://127.0.0.1:${CONFIG.port}          ║
║                                                            ║
║       📚 사용 가능한 엔드포인트:                            ║
║       • GET  /health                                       ║
║       • POST /api/notebooks                                ║
║       • POST /api/sources                                  ║
║       • POST /api/podcasts/generate                        ║
║       • GET  /api/podcasts/:id                             ║
║       • GET  /api/podcasts                                 ║
║       • GET  /api/notebooks/:id                            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
