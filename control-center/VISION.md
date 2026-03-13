# 🎨 UBION Control Center v4 - Pixel Agents Visualization

## 🎯 비전

pixel-agents의 매력적인 pixel art 스타일을 활용하여, 7개의 AI 에이전트를 **animated pixel characters**로 표현하는 관제센터

---

## 📊 아키텍처 개요

### pixel-agents 스타일 적용

```
Virtual Office Layout
    ↓
7개 에이전트 = 7개 Pixel Characters
    ↓
각 에이전트 상태 = 캐릭터 애니메이션
    ↓
파이프라인 단계 = Office Rooms/Desks
    ↓
실시간 모니터링 = Live Animation
```

---

## 🤖 7개 에이전트 시각화

### 에이전트별 캐릭터 배치

1. **Source Collector** (소스수집기)
   - 위치: Entrance
   - 상태: Searching/Reading (뉴스 소스 찾기)
   - 색상: Blue

2. **Reporter** (취재기자)
   - 위치: Research Desk
   - 상태: Writing (취재 기사 작성)
   - 색상: Green

3. **Writer** (작성기자)
   - 위치: Main Desk
   - 상태: Typing (기사 작성)
   - 색상: Red

4. **Fact-Checker** (팩트체커)
   - 위치: Verification Desk
   - 상태: Reading (검증)
   - 색상: Purple

5. **Editor-Desk** (에디터)
   - 위치: Editor's Room
   - 상태: Reviewing (검토)
   - 색상: Orange

6. **Copy-Editor** (교열기자)
   - 위치: Proofreading Desk
   - 상태: Reading (교열)
   - 색상: Yellow

7. **Publisher** (발행에이전트)
   - 위치: Publishing Room
   - 상태: Publishing (발행)
   - 색상: Cyan

---

## 🏢 Office Layout Design

### 뉴스룸 오피스 구조

```
┌──────────────────────────────────────────┐
│  📰 News Room Control Center             │
├──────────────────────────────────────────┤
│                                          │
│  Entrance      Research      Main        │
│  [Collector]   [Reporter]    [Writer]    │
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  Verification  Editor's      Publishing  │
│  [Fact Check]  [Editor]      [Publisher] │
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  Proofreading                            │
│  [Copy Editor]                           │
│                                          │
│  [Pipeline Stats] [Alerts] [Analytics]   │
│                                          │
└──────────────────────────────────────────┘
```

---

## ✨ 캐릭터 애니메이션 상태

### 에이전트 상태 → 캐릭터 애니메이션

| 에이전트 상태 | 캐릭터 애니메이션 | 설명 |
|---|---|---|
| `idle` | 앉기 (Sitting) | 대기 중 |
| `searching` | 움직임 (Walking) | 소스 찾기 |
| `writing` | 타이핑 (Typing) | 기사 작성 |
| `reading` | 읽기 (Reading) | 문서 읽기 |
| `processing` | 생각 중 (Thinking) | 처리 중 |
| `publishing` | 손 올리기 (Publishing) | 발행 완료 |
| `error` | 고개 흔들기 (Error) | 오류 발생 |
| `waiting` | 대기 표시 (Waiting) | 입력 대기 |

---

## 🎮 Canvas 렌더링 엔진

### 기술 스택

```
Canvas 2D Rendering
    ↓
Character State Machine (Idle → Walk → Type/Read)
    ↓
BFS Pathfinding (오피스 네비게이션)
    ↓
Real-time Animation Loop
    ↓
WebSocket 실시간 업데이트
```

### 성능 최적화

- Integer zoom levels (pixel-perfect)
- Dirty rectangle optimization
- Frame skipping (높은 fps에서)
- Asset caching

---

## 📱 UI 구성

### Main View (Canvas Based)

- **좌측**: Pixel office layout with characters
- **우측**: Control panel
  - Agent details
  - Current task status
  - Quick controls

### Secondary Views

- **Pipeline**: 8단계 시각화
- **Analytics**: 시간대별 그래프
- **Alerts**: 경고 알림
- **Settings**: 오피스 레이아웃 편집

---

## 🔄 데이터 흐름

```
Pipeline Directory Changes
    ↓
Agent Logger (Monitoring)
    ↓
WebSocket Event
    ↓
Character State Update
    ↓
Canvas Animation
    ↓
Visual Feedback
```

---

## 🎨 비주얼 요소

### Pixel Art Assets

1. **Characters** (16x16 sprites)
   - 6가지 기본 캐릭터
   - 각 에이전트별 색상 변형
   - 상태별 프레임 애니메이션

2. **Office Tileset** (16x16 tiles)
   - 바닥 (Floor tiles)
   - 벽 (Walls)
   - 가구 (Desks, Chairs, Computers)
   - 배경 (Decorations)

3. **Effects**
   - 말풍선 (Speech bubbles)
   - 상태 아이콘 (Status icons)
   - 입자 효과 (Particle effects)

---

## 🚀 구현 단계

### Phase 1: Canvas Engine
- [ ] Canvas 렌더러 구현
- [ ] Character sprite sheet 로딩
- [ ] 상태 머신 구현
- [ ] 경로 탐색 (BFS)

### Phase 2: Office Layout
- [ ] Tileset 렌더링
- [ ] 레이아웃 에디터
- [ ] 캐릭터 배치

### Phase 3: Agent Integration
- [ ] WebSocket 연결
- [ ] 상태 업데이트
- [ ] 실시간 애니메이션

### Phase 4: Polish
- [ ] 이펙트 추가
- [ ] 사운드 추가
- [ ] 성능 최적화

---

## 💡 핵심 기능

### 실시간 상태 추적

```javascript
// 에이전트 상태 변화 감지
sourceCollector.state = "searching"  // → 캐릭터 걸음
reporter.state = "writing"           // → 캐릭터 타이핑
factChecker.state = "reading"        // → 캐릭터 읽기
```

### 인터랙티브 오피스

- 캐릭터 클릭 → 상세 정보 표시
- 캐릭터 드래그 → 다른 자리로 이동
- 우클릭 → 컨텍스트 메뉴

### 실시간 피드백

- 경고 → 캐릭터 애니메이션 변화
- 작업 완료 → 특별 애니메이션
- 오류 → 캐릭터가 고개를 흔듦

---

## 🎯 최종 목표

**UBION의 AI News Pipeline을 pixel art office로 시각화하여, 
복잡한 에이전트 시스템을 직관적이고 매력적으로 모니터링할 수 있는 
진정한 "newsroom control center"를 구현한다.**

---

**시작**: 2026-03-06  
**목표 완성**: 2026-03-15  
**상태**: 🟡 Design Phase
