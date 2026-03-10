/**
 * Pixel Office Engine — pixel-agents 스타일 게임 엔진
 * 캐릭터가 실제로 움직이고 일하는 비주얼
 * 
 * 핵심:
 * - 타일맵 기반 세계
 * - 경로찾기 (A* 알고리즘)
 * - 스프라이트 애니메이션
 * - 상태 머신 (idle, walking, sitting, working)
 */

// 상수
const TILE_SIZE = 32;
const OFFICE_WIDTH = 20; // 타일 단위
const OFFICE_HEIGHT = 10;

// 캐릭터 상태
const CharacterState = {
  IDLE: 'idle',           // 제자리 대기
  WALKING: 'walking',     // 이동 중
  SITTING: 'sitting',     // 앉음
  TYPING: 'typing',       // 타이핑 (앉아있는 상태)
  READING: 'reading',     // 읽는 중 (앉아있는 상태)
  WAITING: 'waiting'      // 대기 중 (생각하는 포즈)
};

// 방향
const Direction = {
  DOWN: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3
};

/**
 * A* 경로찾기 알고리즘
 */
class PathFinder {
  constructor(width, height, blocked = new Set()) {
    this.width = width;
    this.height = height;
    this.blocked = blocked;
  }
  
  findPath(startX, startY, endX, endY) {
    const openSet = [];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    
    const key = (x, y) => `${x},${y}`;
    const heuristic = (x, y) => Math.abs(x - endX) + Math.abs(y - endY);
    
    openSet.push({ x: startX, y: startY });
    gScore.set(key(startX, startY), 0);
    fScore.set(key(startX, startY), heuristic(startX, startY));
    
    while (openSet.length > 0) {
      // 가장 낮은 fScore 찾기
      let current = openSet[0];
      let currentIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (fScore.get(key(openSet[i].x, openSet[i].y)) < 
            fScore.get(key(current.x, current.y))) {
          current = openSet[i];
          currentIdx = i;
        }
      }
      
      if (current.x === endX && current.y === endY) {
        // 경로 재구성
        const path = [];
        let node = current;
        while (cameFrom.has(key(node.x, node.y))) {
          path.unshift(node);
          const prev = cameFrom.get(key(node.x, node.y));
          node = prev;
        }
        path.unshift({ x: startX, y: startY });
        return path;
      }
      
      openSet.splice(currentIdx, 1);
      
      // 이웃 타일 확인
      const neighbors = [
        { x: current.x, y: current.y + 1 }, // down
        { x: current.x - 1, y: current.y }, // left
        { x: current.x + 1, y: current.y }, // right
        { x: current.x, y: current.y - 1 }  // up
      ];
      
      for (const neighbor of neighbors) {
        const { x, y } = neighbor;
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
        if (this.blocked.has(key(x, y))) continue;
        
        const tentativeGScore = gScore.get(key(current.x, current.y)) + 1;
        
        if (!gScore.has(key(x, y)) || tentativeGScore < gScore.get(key(x, y))) {
          cameFrom.set(key(x, y), current);
          gScore.set(key(x, y), tentativeGScore);
          fScore.set(key(x, y), tentativeGScore + heuristic(x, y));
          
          if (!openSet.find(n => n.x === x && n.y === y)) {
            openSet.push({ x, y });
          }
        }
      }
    }
    
    return []; // 경로 없음
  }
}

/**
 * 캐릭터 클래스
 */
class Character {
  constructor(id, name, icon, color, startX, startY) {
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.color = color;
    
    this.x = startX;
    this.y = startY;
    this.targetX = startX;
    this.targetY = startY;
    
    this.state = CharacterState.IDLE;
    this.direction = Direction.DOWN;
    
    this.path = [];
    this.pathIndex = 0;
    
    this.animationFrame = 0;
    this.workload = 0;
    this.isSitting = false;
    
    this.seatX = null;
    this.seatY = null;
  }
  
  setTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
  }
  
  update(pathFinder) {
    // 목표 위치에 도달했는지 확인
    if (this.x === this.targetX && this.y === this.targetY) {
      if (this.path.length === 0) {
        this.state = this.isSitting ? CharacterState.SITTING : CharacterState.IDLE;
        this.pathIndex = 0;
      }
    }
    
    // 경로가 없으면 새로 찾기
    if (this.path.length === 0 && 
        (this.x !== this.targetX || this.y !== this.targetY)) {
      this.path = pathFinder.findPath(this.x, this.y, this.targetX, this.targetY);
      this.pathIndex = 0;
    }
    
    // 경로를 따라 이동
    if (this.pathIndex < this.path.length) {
      const next = this.path[this.pathIndex];
      this.x = next.x;
      this.y = next.y;
      this.pathIndex++;
      this.state = CharacterState.WALKING;
      
      // 방향 설정
      if (this.pathIndex < this.path.length) {
        const current = this.path[this.pathIndex];
        if (current.y > this.y) this.direction = Direction.DOWN;
        else if (current.y < this.y) this.direction = Direction.UP;
        else if (current.x < this.x) this.direction = Direction.LEFT;
        else if (current.x > this.x) this.direction = Direction.RIGHT;
      }
    } else if (this.x === this.targetX && this.y === this.targetY) {
      // 목표에 도달
      this.path = [];
      this.pathIndex = 0;
      
      if (this.seatX !== null && this.seatY !== null) {
        this.isSitting = true;
      }
    }
    
    // 애니메이션 프레임 업데이트
    this.animationFrame = (this.animationFrame + 1) % 8;
  }
  
  // 작업 시작 (타이핑, 읽기 등)
  startWork(type, workload) {
    this.state = type;
    this.workload = workload;
  }
  
  // 직책으로 이동
  goToSeat(x, y) {
    this.seatX = x;
    this.seatY = y;
    this.setTarget(x, y);
  }
}

/**
 * 픽셀 오피스 엔진
 */
class PixelOfficeEngine {
  constructor(canvasId, statusData) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    
    this.ctx = this.canvas.getContext('2d');
    this.statusData = statusData || {};
    
    // 타일맵 (0=통로, 1=벽, 2=책상, 3=의자)
    this.tileMap = this.createTileMap();
    this.blocked = this.getBlockedTiles();
    this.pathFinder = new PathFinder(OFFICE_WIDTH, OFFICE_HEIGHT, this.blocked);
    
    // 에이전트 배치 (7명)
    this.agents = this.createAgents();
    
    this.frame = 0;
    this.animationId = null;
    
    this.animate();
  }
  
  createTileMap() {
    const map = Array(OFFICE_HEIGHT).fill(null).map(() => 
      Array(OFFICE_WIDTH).fill(0)
    );
    
    // 벽
    for (let y = 0; y < OFFICE_HEIGHT; y++) {
      map[y][0] = 1;
      map[y][OFFICE_WIDTH - 1] = 1;
    }
    for (let x = 0; x < OFFICE_WIDTH; x++) {
      map[0][x] = 1;
      map[OFFICE_HEIGHT - 1][x] = 1;
    }
    
    return map;
  }
  
  getBlockedTiles() {
    const blocked = new Set();
    for (let y = 0; y < OFFICE_HEIGHT; y++) {
      for (let x = 0; x < OFFICE_WIDTH; x++) {
        if (this.tileMap[y][x] === 1) {
          blocked.add(`${x},${y}`);
        }
      }
    }
    return blocked;
  }
  
  createAgents() {
    const agents = [
      { id: 0, name: '소수집기', icon: '📡', color: '#3B82F6', seat: { x: 2, y: 4 } },
      { id: 1, name: '취재기자', icon: '🔍', color: '#10B981', seat: { x: 5, y: 4 } },
      { id: 2, name: '작성기자', icon: '✍️', color: '#F59E0B', seat: { x: 8, y: 4 } },
      { id: 3, name: '팩트체커', icon: '✅', color: '#8B5CF6', seat: { x: 11, y: 4 } },
      { id: 4, name: '편집장', icon: '📋', color: '#EC4899', seat: { x: 14, y: 4 } },
      { id: 5, name: '교열기자', icon: '🔎', color: '#06B6D4', seat: { x: 17, y: 4 } },
      { id: 6, name: '발행', icon: '🚀', color: '#EF4444', seat: { x: 2, y: 7 } }
    ];
    
    return agents.map(a => {
      const char = new Character(a.id, a.name, a.icon, a.color, 10, 2);
      char.goToSeat(a.seat.x, a.seat.y);
      return char;
    });
  }
  
  updateAgentsFromStatus() {
    if (!this.statusData.pipeline) return;
    
    const stages = [
      '01-sourced', '03-reported', '04-drafted',
      '05-fact-checked', '06-desk-approved', '07-copy-edited', '08-published'
    ];
    
    stages.forEach((stage, idx) => {
      if (idx < this.agents.length && this.statusData.pipeline[idx]) {
        const count = this.statusData.pipeline[idx].count;
        this.agents[idx].workload = count;
        
        if (count > 0) {
          const states = [CharacterState.TYPING, CharacterState.READING, CharacterState.WAITING];
          const state = states[idx % states.length];
          this.agents[idx].startWork(state, count);
        } else {
          if (this.agents[idx].isSitting) {
            this.agents[idx].state = CharacterState.SITTING;
          } else {
            this.agents[idx].state = CharacterState.IDLE;
          }
        }
      }
    });
  }
  
  drawTileMap() {
    // 바닥
    this.ctx.fillStyle = '#E5E7EB';
    this.ctx.fillRect(0, 0, OFFICE_WIDTH * TILE_SIZE, OFFICE_HEIGHT * TILE_SIZE);
    
    // 타일 그리드
    this.ctx.strokeStyle = '#D1D5DB';
    this.ctx.lineWidth = 1;
    for (let x = 0; x <= OFFICE_WIDTH; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * TILE_SIZE, 0);
      this.ctx.lineTo(x * TILE_SIZE, OFFICE_HEIGHT * TILE_SIZE);
      this.ctx.stroke();
    }
    for (let y = 0; y <= OFFICE_HEIGHT; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * TILE_SIZE);
      this.ctx.lineTo(OFFICE_WIDTH * TILE_SIZE, y * TILE_SIZE);
      this.ctx.stroke();
    }
    
    // 벽
    this.ctx.fillStyle = '#8B7355';
    for (let y = 0; y < OFFICE_HEIGHT; y++) {
      for (let x = 0; x < OFFICE_WIDTH; x++) {
        if (this.tileMap[y][x] === 1) {
          this.ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    
    // 책상 (에이전트 의자 위치)
    this.ctx.fillStyle = '#D2B48C';
    const seats = [
      { x: 2, y: 4 }, { x: 5, y: 4 }, { x: 8, y: 4 }, { x: 11, y: 4 },
      { x: 14, y: 4 }, { x: 17, y: 4 }, { x: 2, y: 7 }
    ];
    seats.forEach(seat => {
      this.ctx.fillRect(seat.x * TILE_SIZE, seat.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      this.ctx.strokeStyle = '#8B7355';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(seat.x * TILE_SIZE, seat.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });
  }
  
  drawCharacter(char) {
    const px = char.x * TILE_SIZE + TILE_SIZE / 2;
    const py = char.y * TILE_SIZE + TILE_SIZE / 2;
    
    // 캐릭터 배경
    this.ctx.fillStyle = char.workload > 0 ? '#FEF3C7' : '#F3F4F6';
    this.ctx.fillRect(char.x * TILE_SIZE + 2, char.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    
    // 테두리
    this.ctx.strokeStyle = char.color;
    this.ctx.lineWidth = char.workload > 0 ? 2 : 1;
    this.ctx.strokeRect(char.x * TILE_SIZE + 2, char.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    
    // 픽셀 캐릭터
    this.ctx.fillStyle = '#FFB56B';
    this.ctx.fillRect(px - 4, py - 6, 8, 8); // 머리
    
    this.ctx.fillStyle = char.color;
    this.ctx.fillRect(px - 4, py, 8, 6); // 몸
    
    // 팔 (움직임)
    const armSwing = Math.sin(char.animationFrame * 0.4) * 1.5;
    this.ctx.fillRect(px - 6, py + 1, 2, 4); // 왼쪽 팔
    this.ctx.fillRect(px + 4, py + 1, 2, 4); // 오른쪽 팔
    
    // 아이콘
    this.ctx.font = 'bold 11px Arial';
    this.ctx.fillStyle = '#000';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(char.icon, px, py + 10);
    
    // 상태 표시
    const stateEmoji = {
      idle: '💤',
      walking: '🚶',
      sitting: '🪑',
      typing: '✍️',
      reading: '👀',
      waiting: '⏳'
    };
    this.ctx.font = '8px Arial';
    this.ctx.fillText(stateEmoji[char.state] || '?', px, py - 10);
    
    // 작업량
    if (char.workload > 0) {
      this.ctx.fillStyle = '#3B82F6';
      this.ctx.fillRect(
        char.x * TILE_SIZE + 2,
        char.y * TILE_SIZE + TILE_SIZE - 4,
        (TILE_SIZE - 4) * (char.workload / 10),
        2
      );
    }
  }
  
  animate = () => {
    // 배경
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 헤더
    this.ctx.font = 'bold 14px Arial';
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('🏢 Pixel Office — UBION Newsroom', 10, 20);
    
    // 오피스 그리기
    this.ctx.save();
    this.ctx.translate(10, 40);
    
    this.drawTileMap();
    
    // 에이전트 업데이트 및 그리기
    this.agents.forEach(agent => {
      agent.update(this.pathFinder);
      this.drawCharacter(agent);
    });
    
    this.ctx.restore();
    
    // 시간
    const now = new Date().toLocaleTimeString('ko-KR');
    this.ctx.font = '9px Arial';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`${now}`, this.canvas.width - 10, this.canvas.height - 10);
    
    this.frame++;
    this.animationId = requestAnimationFrame(this.animate);
  };
  
  updateStatus(statusData) {
    this.statusData = statusData;
    this.updateAgentsFromStatus();
  }
  
  stop() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }
}

if (typeof window !== 'undefined') {
  window.PixelOfficeEngine = PixelOfficeEngine;
}
