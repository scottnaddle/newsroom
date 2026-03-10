/**
 * 픽셀 에이전트 시어터 v2 - pixel-agents 스타일 애니메이션
 * Canvas 기반, Vanilla JS, Ghost 친화적
 * 
 * 기능:
 * - 픽셀 아트 에이전트 (32x32)
 * - 실제 이동 (걷기, 앉기)
 * - 상태별 애니메이션 (타이핑, 읽기, 대기)
 * - 간단한 사무실 배경
 */

class PixelAgentTheater {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.frame = 0;
    this.animationId = null;
    
    // 에이전트 정의 (작업 흐름 순서)
    this.agents = [
      { id: 0, name: '소수집기', icon: '📡', stage: '01-sourced', x: 80, targetX: 80, y: 120, state: 'idle', work: 0, color: '#3B82F6' },
      { id: 1, name: '취재기자', icon: '🔍', stage: '03-reported', x: 160, targetX: 160, y: 120, state: 'idle', work: 0, color: '#10B981' },
      { id: 2, name: '작성기자', icon: '✍️', stage: '04-drafted', x: 240, targetX: 240, y: 120, state: 'idle', work: 0, color: '#F59E0B' },
      { id: 3, name: '팩트체커', icon: '✅', stage: '05-fact-checked', x: 320, targetX: 320, y: 120, state: 'idle', work: 0, color: '#8B5CF6' },
      { id: 4, name: '편집장', icon: '📋', stage: '06-desk-approved', x: 400, targetX: 400, y: 120, state: 'idle', work: 0, color: '#EC4899' },
      { id: 5, name: '교열기자', icon: '🔎', stage: '07-copy-edited', x: 480, targetX: 480, y: 120, state: 'idle', work: 0, color: '#06B6D4' },
      { id: 6, name: '발행', icon: '🚀', stage: '08-published', x: 560, targetX: 560, y: 120, state: 'done', work: 0, color: '#EF4444' }
    ];
    
    this.animate();
  }
  
  // 픽셀 아트 에이전트 그리기 (32x32 size)
  drawPixelAgent(agent) {
    const { x, y, state, icon, color, work } = agent;
    const size = 32;
    
    // 배경 박스
    this.ctx.fillStyle = work > 0 ? '#E0F2FE' : '#f8fafc';
    this.ctx.fillRect(x - size/2, y - size/2, size, size);
    
    // 테두리
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = work > 0 ? 2 : 1;
    this.ctx.strokeRect(x - size/2, y - size/2, size, size);
    
    // 픽셀 캐릭터 그리기 (간단한 도형)
    const cx = x;
    const cy = y - 4;
    
    // 머리 (원)
    this.ctx.fillStyle = '#FFB56B';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy - 6, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    
    // 눈 (상태별)
    this.ctx.fillStyle = '#000';
    if (state === 'reading') {
      // 읽는 중: 눈 굴리기
      const eyeOffset = Math.sin(this.frame * 0.05) * 1;
      this.ctx.fillRect(cx - 2 + eyeOffset, cy - 7, 1, 1);
      this.ctx.fillRect(cx + 1 + eyeOffset, cy - 7, 1, 1);
    } else if (state === 'typing') {
      // 타이핑: 깜빡임
      if (Math.floor(this.frame / 10) % 2 === 0) {
        this.ctx.fillRect(cx - 2, cy - 7, 1, 1);
        this.ctx.fillRect(cx + 1, cy - 7, 1, 1);
      }
    } else {
      // idle/done
      this.ctx.fillRect(cx - 2, cy - 7, 1, 1);
      this.ctx.fillRect(cx + 1, cy - 7, 1, 1);
    }
    
    // 몸 (사각형)
    this.ctx.fillStyle = color;
    this.ctx.fillRect(cx - 3, cy, 6, 6);
    
    // 팔 (움직임)
    const armY = cy + 2;
    const armSwing = Math.sin(this.frame * 0.1) * 2;
    this.ctx.fillRect(cx - 4, armY, 2, 4); // 왼쪽 팔
    this.ctx.fillRect(cx + 2, armY, 2, 4); // 오른쪽 팔
    
    // 아이콘
    this.ctx.font = 'bold 10px Arial';
    this.ctx.fillStyle = '#000';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(icon, cx, cy + 10);
    
    // 작업량 표시 (프로그레스 바)
    if (work > 0) {
      this.ctx.fillStyle = '#3B82F6';
      this.ctx.fillRect(x - size/2, y + size/2 + 2, (size * work / 10), 2);
      this.ctx.strokeStyle = '#3B82F6';
      this.ctx.strokeRect(x - size/2, y + size/2 + 2, size, 2);
    }
    
    // 상태 아이콘 (상단)
    const stateEmoji = {
      idle: '💤',
      typing: '✍️',
      reading: '👀',
      waiting: '⏳',
      done: '✅'
    };
    this.ctx.font = '9px Arial';
    this.ctx.fillText(stateEmoji[state], cx, y - size/2 - 6);
  }
  
  // 사무실 배경 그리기
  drawOffice() {
    // 바닥
    this.ctx.fillStyle = '#E5E7EB';
    this.ctx.fillRect(0, 180, this.canvas.width, 100);
    
    // 타일 패턴
    this.ctx.strokeStyle = '#D1D5DB';
    this.ctx.lineWidth = 1;
    for (let i = 0; i < this.canvas.width; i += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(i, 180);
      this.ctx.lineTo(i, 280);
      this.ctx.stroke();
    }
    
    // 책상 간단히
    this.ctx.fillStyle = '#8B7355';
    for (let i = 0; i < this.agents.length; i++) {
      const x = this.agents[i].targetX;
      this.ctx.fillRect(x - 20, 140, 40, 30);
    }
    
    // 벽
    this.ctx.fillStyle = '#F3F4F6';
    this.ctx.fillRect(0, 0, this.canvas.width, 50);
    
    // 바닥선
    this.ctx.strokeStyle = '#9CA3AF';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 180);
    this.ctx.lineTo(this.canvas.width, 180);
    this.ctx.stroke();
  }
  
  // 상태 업데이트
  updateStatus(statusData) {
    if (!statusData || !statusData.pipeline) return;
    
    const stages = [
      '01-sourced', '03-reported', '04-drafted',
      '05-fact-checked', '06-desk-approved', '07-copy-edited', '08-published'
    ];
    
    stages.forEach((stage, idx) => {
      if (idx < this.agents.length && statusData.pipeline[idx]) {
        const count = statusData.pipeline[idx].count;
        this.agents[idx].work = Math.min(count, 10);
        
        if (count > 0) {
          const states = ['typing', 'reading', 'waiting'];
          this.agents[idx].state = states[idx % states.length];
        } else {
          this.agents[idx].state = idx === this.agents.length - 1 ? 'done' : 'idle';
        }
      }
    });
  }
  
  // 메인 애니메이션 루프
  animate = () => {
    // 캔버스 지우기
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 헤더
    this.ctx.font = 'bold 14px Arial';
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('🏢 Agent Theater — 뉴스룸 에이전트 활동 시각화', this.canvas.width / 2, 25);
    
    // 사무실 배경
    this.drawOffice();
    
    // 에이전트들
    this.agents.forEach(agent => {
      // 이동 애니메이션 (걷기)
      if (agent.state === 'typing' || agent.state === 'reading') {
        agent.x += (agent.targetX - agent.x) * 0.05;
      } else {
        agent.x = agent.targetX;
      }
      
      this.drawPixelAgent(agent);
    });
    
    // 시간 표시
    const now = new Date().toLocaleTimeString('ko-KR');
    this.ctx.font = '9px Arial';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`갱신: ${now}`, this.canvas.width - 10, this.canvas.height - 10);
    
    this.frame++;
    this.animationId = requestAnimationFrame(this.animate);
  };
  
  stop() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }
}

if (typeof window !== 'undefined') {
  window.PixelAgentTheater = PixelAgentTheater;
}
