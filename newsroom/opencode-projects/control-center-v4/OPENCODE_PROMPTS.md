# 🤖 opencode AI Code Generation Prompts

## Canvas Engine 구현

### Prompt 1: Pixel Character Renderer

```
당신은 pixel art game engine을 만드는 전문가입니다.

다음 요구사항으로 TypeScript Canvas 2D renderer를 만들어주세요:

**파일**: `frontend/src/engines/PixelRenderer.ts`

**요구사항**:
1. Canvas 2D context를 사용한 pixel-perfect 렌더링
2. 16x16 pixel sprite sheet 지원
3. 캐릭터 상태별 애니메이션 (idle, walking, typing, reading, error)
4. Integer zoom level 지원 (1x, 2x, 3x, 4x)
5. 성능 최적화: dirty rectangle invalidation

**구현**:
- class PixelRenderer
  - constructor(canvas, spriteSheet)
  - drawSprite(x, y, frameX, frameY, width, height)
  - animate(deltaTime)
  - clear()
  - present()
- SpriteManager (sprite sheet 관리)
- AnimationFrame (프레임 정의)

**특징**:
- 부드러운 애니메이션 (60fps)
- 메모리 효율적 (dirty rect)
- 확장 가능한 구조
```

### Prompt 2: Character State Machine

```
다음 요구사항으로 캐릭터 상태 머신을 구현해주세요:

**파일**: `frontend/src/engines/CharacterStateMachine.ts`

**상태**:
- Idle (앉기)
- Walking (이동)
- Typing (타이핑)
- Reading (읽기)
- Processing (생각)
- Publishing (손 올리기)
- Error (고개 흔들기)
- Waiting (대기 표시)

**요구사항**:
1. 상태 전이 (State transition)
2. 각 상태별 애니메이션 프레임 정의
3. 이벤트 기반 상태 변화
4. 타이머 기반 상태 관리

**구현**:
- class CharacterState (abstract)
  - onEnter()
  - onUpdate(deltaTime)
  - onExit()
- IdleState, WalkingState, TypingState, etc.
- class Character
  - setState(newState)
  - getState()
  - update(deltaTime)
```

### Prompt 3: Office Layout Renderer

```
Tile-based office layout renderer를 만들어주세요:

**파일**: `frontend/src/engines/OfficeLayout.ts`

**요구사항**:
1. Tile grid 기반 레이아웃 (16x16 tiles)
2. 타일 타입: floor, wall, desk, chair, computer
3. 타일 컬러 커스터마이징
4. Auto-tiling (벽이 자동으로 연결)
5. 레이아웃 저장/로드 (JSON)

**구현**:
- class TileMap
  - setTile(x, y, tileType, color)
  - getTile(x, y)
  - render(renderer)
- class TileType (enum)
- class OfficeLayout
  - addCharacter(character, tileX, tileY)
  - removeCharacter(id)
  - save()
  - load(json)
```

### Prompt 4: Pathfinding (BFS)

```
BFS 경로 탐색을 구현해주세요:

**파일**: `frontend/src/engines/Pathfinding.ts`

**요구사항**:
1. BFS (Breadth-First Search) 알고리즘
2. 이동 불가능 타일 무시 (벽, 데스크)
3. 최단 경로 반환
4. 경로 캐싱

**구현**:
- class Pathfinder
  - findPath(startX, startY, endX, endY)
  - isWalkable(tileType)
  - getNeighbors(x, y)
```

---

## React 컴포넌트 구현

### Prompt 5: PixelOfficeCanvas Component

```
React 컴포넌트로 pixel office를 렌더링해주세요:

**파일**: `frontend/src/components/PixelOfficeCanvas.tsx`

**요구사항**:
1. Canvas element 관리
2. 마우스 이벤트 처리 (클릭, 드래그)
3. 실시간 렌더링 루프
4. ResizeObserver로 반응형 처리
5. WebSocket 연결

**Props**:
- agents: Agent[]
- layout: OfficeLayout
- onAgentSelect: (agentId) => void
- onAgentMove: (agentId, x, y) => void

**기능**:
- 캐릭터 클릭 → 상세 정보
- 캐릭터 드래그 → 위치 변경
- 우클릭 → 컨텍스트 메뉴
- 마우스 호버 → 정보 표시
```

### Prompt 6: AgentControlPanel Component

```
선택된 에이전트의 제어판을 만들어주세요:

**파일**: `frontend/src/components/AgentControlPanel.tsx`

**Props**:
- agent: Agent | null
- onStateChange: (state) => void

**표시 정보**:
- 에이전트 이름 + 아이콘
- 현재 상태 (State)
- 최근 활동
- 처리한 기사 수
- 실패율
- 마지막 실행 시간

**컨트롤**:
- 상태 수동 변경
- 작업 다시 실행
- 에이전트 강제 종료
```

---

## Backend API 구현

### Prompt 7: Real-time Agent Tracking API

```
FastAPI 엔드포인트로 실시간 에이전트 추적을 구현해주세요:

**파일**: `backend/agents.py`

**엔드포인트**:
1. GET /api/agents
   - 모든 에이전트 상태 반환

2. GET /api/agents/{agent_id}
   - 특정 에이전트 상세 정보

3. POST /api/agents/{agent_id}/state
   - 에이전트 상태 업데이트

4. GET /api/agents/{agent_id}/activities
   - 최근 활동 로그

5. WebSocket /ws/agents
   - 실시간 에이전트 상태 스트림

**모델**:
- class Agent
  - id: str
  - name: str
  - type: str
  - state: AgentState
  - position: (x, y)
  - lastActivity: datetime
  - stats: AgentStats
```

### Prompt 8: Pipeline Monitoring API

```
파이프라인 모니터링 API를 구현해주세요:

**파일**: `backend/pipeline.py`

**엔드포인트**:
1. GET /api/pipeline/articles
   - 모든 기사 상태

2. GET /api/pipeline/articles/{article_id}
   - 특정 기사의 진행 상황

3. GET /api/pipeline/stats
   - 시간대별 통계

**실시간 업데이트**:
- WebSocket /ws/pipeline
- 기사가 단계를 이동할 때 이벤트 전송
```

---

## 데이터베이스 통합

### Prompt 9: SQLite Agent Logger

```
SQLite에 에이전트 활동을 기록하는 로거를 만들어주세요:

**파일**: `backend/database/logger.py`

**기능**:
1. 에이전트 상태 변화 기록
2. 활동 타임스탬프
3. 기사 처리 추적
4. 쿼리 메소드:
   - get_recent_activities(agent_id, limit=10)
   - get_agent_stats(agent_id)
   - get_pipeline_stats(hours=24)
```

---

## 통합 테스트

### Prompt 10: Integration Test Suite

```
Canvas + API + Database를 통합 테스트하는 테스트 스위트를 만들어주세요:

**파일**: `backend/tests/test_integration.py`

**테스트**:
1. 에이전트 상태 변화 → DB 저장 → WebSocket 전송 → Canvas 업데이트
2. 기사 이동 → 파이프라인 업데이트 → 통계 계산
3. 다중 에이전트 동시 처리

**Mock**:
- Mock agent activities
- Mock file system changes
- Verify Canvas updates
```

---

## opencode 실행 순서

```
1. Prompt 1: PixelRenderer.ts (기초)
   ↓
2. Prompt 2: CharacterStateMachine.ts (상태)
   ↓
3. Prompt 3: OfficeLayout.ts (레이아웃)
   ↓
4. Prompt 4: Pathfinding.ts (경로)
   ↓
5. Prompt 5: PixelOfficeCanvas.tsx (UI)
   ↓
6. Prompt 6: AgentControlPanel.tsx (제어)
   ↓
7. Prompt 7: agents.py (Backend API)
   ↓
8. Prompt 8: pipeline.py (파이프라인)
   ↓
9. Prompt 9: logger.py (DB 통합)
   ↓
10. Prompt 10: test_integration.py (테스트)
```

---

**사용법**: 
각 prompt를 opencode에 복사-붙여넣기하면 자동으로 코드가 생성됩니다.
생성된 코드를 검토하고 필요시 조정하세요.
