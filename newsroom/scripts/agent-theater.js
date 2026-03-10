/**
 * Agent Theater — 픽셀 아트로 에이전트 활동을 시각화
 * Canvas 기반 애니메이션
 */

class AgentTheater {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.agents = [];
    this.articles = [];
    this.animationFrame = null;
    
    // 에이전트 정의
    this.agentDefs = [
      { id: 'sourcer', name: '소수집기', icon: '📡', color: '#3B82F6', x: 50, y: 100 },
      { id: 'reporter', name: '취재기자', icon: '🔍', color: '#10B981', x: 150, y: 100 },
      { id: 'writer', name: '작성기자', icon: '✍️', color: '#F59E0B', x: 250, y: 100 },
      { id: 'checker', name: '팩트체커', icon: '✅', color: '#8B5CF6', x: 350, y: 100 },
      { id: 'editor', name: '편집장', icon: '📋', color: '#EC4899', x: 450, y: 100 },
      { id: 'copyedit', name: '교열기자', icon: '🔎', color: '#06B6D4', x: 550, y: 100 },
      { id: 'publisher', name: '발행', icon: '🚀', color: '#EF4444', x: 650, y: 100 }
    ];
    
    this.init();
  }
  
  init() {
    // 에이전트 초기화
    this.agentDefs.forEach(def => {
      this.agents.push({
        ...def,
        state: 'idle', // idle, typing, reading, waiting, done
        stateTime: 0,
        article: null
      });
    });
    
    this.animate();
  }
  
  // 픽셀 아트 스타일 텍스트
  drawPixelText(text, x, y, size = 12, color = '#000') {
    this.ctx.font = `${size}px 'Courier New', monospace`;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, x, y);
  }
  
  // 에이전트 캐릭터 그리기
  drawAgent(agent) {
    const { x, y, state, color } = agent;
    
    // 배경 박스
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.fillRect(x - 30, y - 40, 60, 60);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x - 30, y - 40, 60, 60);
    
    // 상태 표시기 (상단 좌측)
    const statusColors = {
      idle: '#94a3b8',
      typing: '#3B82F6',
      reading: '#10B981',
      waiting: '#FBBF24',
      done: '#10B981'
    };
    this.ctx.fillStyle = statusColors[state];
    this.ctx.beginPath();
    this.ctx.arc(x - 28, y - 38, 5, 0, Math.PI * 2);
    this.ctx.fill();
    
    // 아이콘
    this.drawPixelText(agent.icon, x, y - 15, 24);
    
    // 이름
    this.drawPixelText(agent.name, x, y + 20, 10, '#475569');
    
    // 상태 아이콘 (하단)
    const stateEmoji = {
      idle: '💤',
      typing: '✍️',
      reading: '👀',
      waiting: '⏳',
      done: '✅'
    };
    this.drawPixelText(stateEmoji[state], x, y + 35, 12);
  }
  
  // 기사 박스 그리기
  drawArticle(article, stage) {
    const x = this.agentDefs[stage].x;
    const y = 180;
    
    this.ctx.fillStyle = '#FEF3C7';
    this.ctx.fillRect(x - 25, y - 15, 50, 30);
    this.ctx.strokeStyle = '#F59E0B';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - 25, y - 15, 50, 30);
    
    // 기사 제목 (짧게)
    const title = article.headline.substring(0, 15);
    this.drawPixelText(title, x, y + 2, 8, '#92400e');
  }
  
  // 흐름 화살표
  drawArrows() {
    this.ctx.strokeStyle = '#D1D5DB';
    this.ctx.lineWidth = 2;
    
    for (let i = 0; i < this.agentDefs.length - 1; i++) {
      const x1 = this.agentDefs[i].x + 30;
      const x2 = this.agentDefs[i + 1].x - 30;
      const y = 100;
      
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y);
      this.ctx.lineTo(x2, y);
      this.ctx.stroke();
      
      // 화살표 head
      this.ctx.beginPath();
      this.ctx.moveTo(x2, y);
      this.ctx.lineTo(x2 - 8, y - 4);
      this.ctx.lineTo(x2 - 8, y + 4);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }
  
  // 상태 데이터 업데이트
  updateStatus(statusData) {
    if (!statusData || !statusData.pipeline) return;
    
    const stages = [
      '01-sourced', '02-assigned', '03-reported', '04-drafted',
      '05-fact-checked', '06-desk-approved', '07-copy-edited', '08-published'
    ];
    
    // 에이전트별 상태 업데이트
    stages.forEach((stage, idx) => {
      if (idx < this.agents.length) {
        const count = statusData.pipeline[idx].count;
        
        // 작업 있으면 active, 없으면 idle
        if (count > 0) {
          this.agents[idx].state = ['typing', 'reading', 'waiting'][Math.floor(Math.random() * 3)];
          this.agents[idx].stateTime = 0;
        } else {
          this.agents[idx].state = 'idle';
        }
      }
    });
  }
  
  // 메인 애니메이션 루프
  animate() {
    // 캔버스 지우기
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 헤더
    this.drawPixelText('🏢 UBION Agent Theater — 뉴스룸 에이전트 활동 시각화', 400, 30, 14, '#1a1a2e');
    
    // 흐름 화살표
    this.drawArrows();
    
    // 에이전트들
    this.agents.forEach(agent => {
      this.drawAgent(agent);
      agent.stateTime += 1;
      
      // 상태 전환 (주기적)
      if (agent.stateTime > 120) {
        const states = ['idle', 'typing', 'reading', 'waiting', 'done'];
        agent.state = states[Math.floor(Math.random() * states.length)];
        agent.stateTime = 0;
      }
    });
    
    // 범례
    this.ctx.fillStyle = '#E5E7EB';
    this.ctx.fillRect(10, this.canvas.height - 60, 780, 50);
    this.drawPixelText('💤 Idle (대기) | ✍️ Typing (작성) | 👀 Reading (읽는 중) | ⏳ Waiting (대기) | ✅ Done (완료)', 400, this.canvas.height - 30, 11, '#475569');
    
    // 마지막 갱신 시간
    const now = new Date().toLocaleTimeString('ko-KR');
    this.drawPixelText(`🔄 ${now}`, 750, this.canvas.height - 10, 9, '#94a3b8');
    
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }
  
  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}

// 자동 초기화 (window 로드 후)
if (typeof window !== 'undefined') {
  window.AgentTheater = AgentTheater;
}
