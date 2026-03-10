/**
 * Agent Control Center - Frontend
 * 
 * Features:
 * - WebSocket real-time updates
 * - Agent cards with status
 * - Pipeline flow visualization
 * - Click for detailed info
 */

// WebSocket 연결
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

// 상태
let state = {
  agents: {},
  pipeline: {},
  metrics: {},
  alerts: [],
  lastUpdate: null
};

// DOM 요소
const elements = {
  lastUpdate: document.getElementById('lastUpdate'),
  connectionStatus: document.getElementById('connectionStatus'),
  flowDiagram: document.getElementById('flowDiagram'),
  agentGrid: document.getElementById('agentGrid'),
  totalProcessed: document.getElementById('totalProcessed'),
  successRate: document.getElementById('successRate'),
  avgProcessingTime: document.getElementById('avgProcessingTime'),
  activeAgents: document.getElementById('activeAgents'),
  alertsList: document.getElementById('alertsList')
};

// 파이프라인 단계 정의
const PIPELINE_STAGES = [
  { id: '01-sourced', name: '수집', color: '#3b82f6' },
  { id: '02-assigned', name: '할당', color: '#6366f1' },
  { id: '03-reported', name: '취재', color: '#10b981' },
  { id: '04-drafted', name: '작성', color: '#f59e0b' },
  { id: '05-fact-checked', name: '팩트체크', color: '#ef4444' },
  { id: '06-desk-approved', name: '데스크', color: '#8b5cf6' },
  { id: '07-copy-edited', name: '교열', color: '#ec4899' },
  { id: '08-published', name: '발행', color: '#06b6d4' }
];

// 에이전트 정의
const AGENTS = [
  { id: 'source-collector', name: '🔍 소스수집기', stage: '01-sourced', color: '#3b82f6' },
  { id: 'reporter', name: '📝 취재기자', stage: '03-reported', color: '#10b981' },
  { id: 'writer', name: '✍️ 작성기자', stage: '04-drafted', color: '#f59e0b' },
  { id: 'fact-checker', name: '✅ 팩트체커', stage: '05-fact-checked', color: '#ef4444' },
  { id: 'editor-desk', name: '📰 에디터/데스크', stage: '06-desk-approved', color: '#8b5cf6' },
  { id: 'copy-editor', name: '📖 교열기자', stage: '07-copy-edited', color: '#ec4899' },
  { id: 'publisher', name: '🚀 발행에이전트', stage: '08-published', color: '#06b6d4' }
];

/**
 * WebSocket 연결
 */
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    reconnectAttempts = 0;
    updateConnectionStatus(true);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleUpdate(data);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket closed');
    updateConnectionStatus(false);
    
    // 자동 재연결
    if (reconnectAttempts < MAX_RECONNECT) {
      reconnectAttempts++;
      setTimeout(connectWebSocket, 3000);
    }
  };
}

/**
 * 연결 상태 업데이트
 */
function updateConnectionStatus(connected) {
  if (connected) {
    elements.connectionStatus.textContent = '🟢 연결됨';
    elements.connectionStatus.classList.add('connected');
  } else {
    elements.connectionStatus.textContent = '🔴 연결 끊김';
    elements.connectionStatus.classList.remove('connected');
  }
}

/**
 * 상태 업데이트 처리
 */
function handleUpdate(data) {
  console.log('📊 handleUpdate called with:', data);
  
  // WebSocket 메시지는 { type, data } 형태, HTTP는 직접 데이터
  if (data.type && data.data) {
    state = data.data;
  } else {
    state = data;
  }
  
  console.log('📊 State after processing:', state);
  renderPipeline();
  renderAgents();
  renderMetrics();
  renderAlerts();
  updateLastUpdate();
}

/**
 * 파이프라인 렌더링
 */
function renderPipeline() {
  console.log('🎨 renderPipeline called, state.pipeline:', state.pipeline);
  elements.flowDiagram.innerHTML = '';

  PIPELINE_STAGES.forEach((stage, index) => {
    const count = state.pipeline[stage.id] || 0;
    console.log(`  Stage ${stage.id}: ${count}`);
    
    // 상자
    const box = document.createElement('div');
    box.className = 'stage-box';
    if (count > 5) box.classList.add('active');
    else if (count > 0) box.classList.add('warning');
    
    box.innerHTML = `
      <div class="stage-name">${stage.name}</div>
      <div class="stage-count">${count}</div>
    `;
    
    elements.flowDiagram.appendChild(box);
    
    // 화살표 (마지막 제외)
    if (index < PIPELINE_STAGES.length - 1) {
      const arrow = document.createElement('div');
      arrow.className = 'arrow';
      arrow.textContent = '→';
      elements.flowDiagram.appendChild(arrow);
    }
  });
}

/**
 * 에이전트 카드 렌더링
 */
function renderAgents() {
  elements.agentGrid.innerHTML = '';

  AGENTS.forEach(agent => {
    const agentState = state.agents[agent.id] || {};
    const count = agentState.count || 0;
    const status = agentState.status || 'idle';
    
    const card = document.createElement('div');
    card.className = `agent-card ${status}`;
    card.onclick = () => showAgentDetails(agent, agentState);
    
    card.innerHTML = `
      <div class="agent-header">
        <h3>${agent.name}</h3>
        <span class="agent-status ${status}">
          ${status === 'active' ? '✅ 활성' : status === 'error' ? '❌ 오류' : '💤 대기'}
        </span>
      </div>
      <div class="agent-metrics">
        <div class="metric-row">
          <span class="metric-label">대기 기사</span>
          <span class="metric-value">${count}개</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">마지막 처리</span>
          <span class="metric-value">${agentState.lastTime ? formatTime(agentState.lastTime) : '-'}</span>
        </div>
      </div>
    `;
    
    elements.agentGrid.appendChild(card);
  });
}

/**
 * 메트릭 렌더링
 */
function renderMetrics() {
  const metrics = state.metrics || {};
  
  elements.totalProcessed.textContent = metrics.totalProcessed || 0;
  elements.successRate.textContent = `${metrics.successRate || 0}%`;
  elements.avgProcessingTime.textContent = `${metrics.avgProcessingTime || 0}분`;
  
  // 활성 에이전트 수
  const activeCount = Object.values(state.agents).filter(a => a.status === 'active').length;
  elements.activeAgents.textContent = activeCount;
}

/**
 * 알림 렌더링
 */
function renderAlerts() {
  const alerts = state.alerts || [];
  
  if (alerts.length === 0) {
    elements.alertsList.innerHTML = '<div class="no-alerts">알림 없음 ✨</div>';
    return;
  }
  
  elements.alertsList.innerHTML = alerts.slice(0, 10).map(alert => `
    <div class="alert-item ${alert.type}">
      <strong>${alert.agent}</strong>: ${alert.message}
      <span style="opacity: 0.6; margin-left: 8px;">${formatTime(alert.timestamp)}</span>
    </div>
  `).join('');
}

/**
 * 마지막 업데이트 시간
 */
function updateLastUpdate() {
  if (state.lastUpdate) {
    elements.lastUpdate.textContent = formatTime(state.lastUpdate);
  }
}

/**
 * 시간 포맷
 */
function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 에이전트 상세 모달
 */
function showAgentDetails(agent, agentState) {
  // 모달 생성
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  
  const content = document.createElement('div');
  content.className = 'modal';
  content.innerHTML = `
    <div class="modal-header">
      <h2>${agent.name} 상세 정보</h2>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <div class="modal-content">
      <div class="metric-row">
        <span class="metric-label">상태</span>
        <span class="metric-value">${agentState.status || 'idle'}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">파이프라인 단계</span>
        <span class="metric-value">${agent.stage}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">대기 기사 수</span>
        <span class="metric-value">${agentState.count || 0}개</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">마지막 처리 파일</span>
        <span class="metric-value">${agentState.lastFile || '-'}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">마지막 처리 시간</span>
        <span class="metric-value">${agentState.lastTime ? formatTime(agentState.lastTime) : '-'}</span>
      </div>
      ${agentState.error ? `
        <div class="alert-item danger" style="margin-top: 16px;">
          <strong>오류:</strong> ${agentState.error}
        </div>
      ` : ''}
    </div>
  `;
  
  modal.appendChild(content);
  document.body.appendChild(modal);
}

/**
 * 주기적 폴링 (fallback)
 */
function startPolling() {
  setInterval(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      handleUpdate(data);
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 60000); // 1분
}

/**
 * 초기 데이터 로드
 */
async function loadInitialData() {
  try {
    console.log('🔄 Loading initial data...');
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    console.log('✅ Data loaded:', data);
    handleUpdate(data);
  } catch (error) {
    console.error('❌ Failed to load data:', error);
    updateConnectionStatus(false);
  }
}

/**
 * 초기화
 */
function init() {
  // 즉시 HTTP로 데이터 로드
  loadInitialData();
  
  // WebSocket 연결
  connectWebSocket();
  
  // 폴링 시작
  startPolling();
}

// DOM 로드 완료 시 시작
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
