# Multi-Pipeline Interface Design Guide

## 개요

AskedTech의 모든 파이프라인(AI 교육, Digest, 콘텐츠, 논문 검색)을 한 화면에서 관리할 수 있는 최적화된 인터페이스입니다.

---

## 🎯 설계 목표

1. **한 화면에서 모든 파이프라인 관리**
   - 빠른 파이프라인 전환
   - 파이프라인별 상태 한눈에 파악

2. **두 가지 뷰 모드 지원**
   - **단일 뷰**: 선택된 파이프라인의 상세 정보
   - **비교 뷰**: 모든 파이프라인의 통계 비교

3. **실시간 모니터링**
   - 각 파이프라인의 활동 실시간 추적
   - 병목 현상 자동 감지

---

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  Logo  │ [📚 AI 교육] [⚡ Digest] [🎨 콘텐츠] [📚 논문] │ 모드선택 │ 상태
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┬──────────────┬──────────────┐         │
│  │ 📥 수집국    │ ⚙️ 파이프라인│ 📡 발행국    │         │
│  │              │              │ & 로그       │         │
│  │              │              │              │         │
│  │ 기사 카드    │ 1️⃣ 수집     │ 활동 로그    │         │
│  │ (스크롤)     │ ⬇️           │ (최신순)     │         │
│  │              │ 2️⃣ 취재     │              │         │
│  │              │ ⬇️           │ 통계:        │         │
│  │              │ 3️⃣ 작성     │ 💾 발행: 72  │         │
│  │              │ ⬇️           │ ⏳ 처리: 2   │         │
│  │              │ ...          │ ⚠️ 실패: 1   │         │
│  │              │              │              │         │
│  └──────────────┴──────────────┴──────────────┘         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📱 뷰 모드

### 1️⃣ 단일 뷰 (Single View)

**목적**: 선택된 파이프라인의 상세 정보 표시

**레이아웃**:
```
[📚 AI 교육 선택됨]
├─ 좌측: 수집국 (기사 리스트)
├─ 중앙: 파이프라인 (7단계)
└─ 우측: 발행국 (로그 + 통계)
```

**기능**:
- ✅ 탭 클릭으로 파이프라인 전환
- ✅ 선택된 파이프라인의 모든 상세 정보 표시
- ✅ 실시간 활동 로그
- ✅ 파이프라인별 통계

**언제 사용**:
- 특정 파이프라인에 집중해서 모니터링
- 문제 파이프라인 디버깅
- 세부 작업 추적

---

### 2️⃣ 비교 뷰 (Comparison View)

**목적**: 모든 파이프라인의 통계를 한눈에 비교

**레이아웃**:
```
[반응형 그리드]
┌─────────────────┐ ┌─────────────────┐
│ 📚 AI 교육      │ │ ⚡ AI Digest    │
│ 💾 72    ⏳ 2   │ │ 💾 45    ⏳ 1   │
│ ⚠️ 1     7단계 │ │ ⚠️ 0     3단계 │
│ 단계: ...      │ │ 단계: ...      │
└─────────────────┘ └─────────────────┘

┌─────────────────┐ ┌─────────────────┐
│ 🎨 콘텐츠      │ │ 📚 논문 검색    │
│ 💾 120   ⏳ 5   │ │ 💾 38    ⏳ 2   │
│ ⚠️ 2     3단계 │ │ ⚠️ 0     3단계 │
│ 단계: ...      │ │ 단계: ...      │
└─────────────────┘ └─────────────────┘
```

**정보 표시**:
- 파이프라인 이름 + 아이콘
- 발행 수 (💾)
- 처리 중 (⏳)
- 실패 건 (⚠️)
- 단계 수
- 각 단계 아이콘

**기능**:
- ✅ 카드 클릭으로 단일 뷰로 전환
- ✅ 한눈에 모든 파이프라인의 진행 상황 파악
- ✅ 병목 파이프라인 즉시 식별

**언제 사용**:
- 전체 시스템 상태 모니터링
- 파이프라인 간 성능 비교
- 리소스 할당 결정
- 대시보드/리포트용

---

## 🎨 UI 컴포넌트

### 헤더 구조

```
┌──────────────────────────────────────────────────────────┐
│ 📰 Logo │ [탭들] │ [모드] │ [상태]                        │
└──────────────────────────────────────────────────────────┘
```

**요소**:
1. **로고**: AskedTech Multi-Pipeline
2. **파이프라인 탭**: 4개 (클릭으로 전환)
3. **모드 버튼**: 단일/비교 (토글)
4. **상태 표시**: 시스템 + 시간

### 파이프라인 탭

```css
상태: [기본] → [호버] → [활성]
───────────────────────────
배경: rgba(0,212,255,0.1) → 0.15 → 0.25
테두리: rgba(0,212,255,0.2) → #00d4ff → #00ff88
색상: #888 → #00d4ff → #00ff88
```

---

## 📊 파이프라인 정의

```javascript
{
  id: 'education',
  name: '📚 AI 교육',
  icon: '📚',
  color: '#00d4ff',
  stages: [
    { name: '수집', icon: '📰' },
    { name: '취재', icon: '🔍' },
    { name: '작성', icon: '✍️' },
    { name: '검증', icon: '✓' },
    { name: '편집', icon: '📋' },
    { name: '교열', icon: '✏️' },
    { name: '발행', icon: '🚀' }
  ],
  stats: { published: 72, processing: 2, failed: 1 }
}
```

**4개 파이프라인**:

| 파이프라인 | 아이콘 | 색상 | 단계 | 설명 |
|-----------|--------|------|------|------|
| AI 교육 | 📚 | #00d4ff | 7 | 주요 뉴스 파이프라인 |
| AI Digest | ⚡ | #ff6b9d | 3 | 요약 뉴스 |
| 콘텐츠 | 🎨 | #ffd700 | 3 | 만평, 대담 등 |
| 논문 검색 | 📚 | #32cd32 | 3 | 학술 논문 |

---

## 🔄 상태 전환

### 탭 클릭 → 파이프라인 전환

```
1. 탭 클릭
   ↓
2. currentPipeline 변수 업데이트
   ↓
3. 단일 뷰인 경우:
   - 좌측: 해당 파이프라인의 기사 로드
   - 중앙: 해당 파이프라인의 단계 표시
   - 우측: 해당 파이프라인의 로그 + 통계
   ↓
4. UI 즉시 업데이트 (애니메이션)
```

### 모드 전환

```
단일 뷰 ←→ 비교 뷰

단일 → 비교:
- singleView: display = none
- comparisonView: display = grid
- 4개 파이프라인 카드 렌더링

비교 → 단일:
- comparisonView: display = none
- singleView: display = grid
- 마지막 선택된 파이프라인 표시
```

---

## 🚀 최적화 전략

### 1. 성능 최적화

```javascript
// 가상 스크롤 (많은 기사 처리)
class VirtualScroll {
  constructor(container, itemHeight, bufferSize) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.bufferSize = bufferSize;
    this.visibleRange = null;
  }
  
  onScroll(scrollTop, containerHeight) {
    const startIdx = Math.floor(scrollTop / this.itemHeight) - this.bufferSize;
    const endIdx = Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.bufferSize;
    this.renderRange(startIdx, endIdx);
  }
}
```

### 2. 메모리 최적화

```javascript
// 최대 기사 수 제한 (활동 로그)
const MAX_TIMELINE_ITEMS = 20;

function addTimelineEvent(message, type) {
  // 새 항목 추가
  while (timeline.children.length > MAX_TIMELINE_ITEMS) {
    timeline.removeChild(timeline.lastChild);
  }
}
```

### 3. 네트워크 최적화

```javascript
// 선택된 파이프라인만 업데이트
function updatePipeline(id) {
  fetch(`/api/pipeline/${id}/stats`)
    .then(updateUI)
    .catch(handleError);
}
```

---

## 📡 API 연결

### 백엔드 엔드포인트

```
GET /api/pipelines
  → 모든 파이프라인 목록 및 기본 통계

GET /api/pipeline/{id}
  → 특정 파이프라인의 상세 정보

GET /api/pipeline/{id}/articles
  → 파이프라인의 기사 목록

GET /api/pipeline/{id}/logs
  → 파이프라인의 활동 로그

WebSocket /ws/pipeline/{id}
  → 실시간 업데이트 스트림
```

### 응답 형식

```json
{
  "id": "education",
  "name": "📚 AI 교육",
  "stats": {
    "published": 72,
    "processing": 2,
    "failed": 1
  },
  "articles": [
    {
      "id": 1,
      "title": "...",
      "status": "processing",
      "stage": "작성"
    }
  ],
  "logs": [
    {
      "timestamp": "2026-03-10T17:27:00Z",
      "message": "...",
      "type": "success"
    }
  ]
}
```

---

## 🎨 색상 체계

```css
파이프라인별 색상:
- AI 교육: #00d4ff (네온 청색)
- AI Digest: #ff6b9d (핑크)
- 콘텐츠: #ffd700 (금색)
- 논문: #32cd32 (라임 그린)

상태별 색상:
- 활성/완료: #00ff88 (네온 초록)
- 진행 중: #ffd700 (금색)
- 실패/에러: #ff4444 (빨간색)
- 대기: #888 (회색)

배경:
- 기본: #0a0e27 (진한 파란색-검정)
- 강조: rgba(0, 212, 255, 0.1~0.25)
```

---

## 📋 구현 체크리스트

### 필수 기능
- [x] 4개 파이프라인 탭 네비게이션
- [x] 단일 뷰 (3단 레이아웃)
- [x] 비교 뷰 (그리드 카드)
- [x] 모드 전환 버튼
- [x] 실시간 활동 로그
- [x] 통계 표시

### 고급 기능
- [ ] API 통합 (실제 데이터)
- [ ] WebSocket 연결 (실시간 스트림)
- [ ] 필터 기능 (기사 검색)
- [ ] 내보내기 (CSV/PDF)
- [ ] 알림 시스템 (병목/오류)
- [ ] 다크/라이트 테마 전환

### 성능 최적화
- [ ] 가상 스크롤 (500+ 기사)
- [ ] 레이지 로딩 (파이프라인 탭)
- [ ] 캐싱 (통계 데이터)
- [ ] 이미지 최적화
- [ ] 번들 크기 축소

### 접근성
- [ ] 키보드 네비게이션
- [ ] 스크린 리더 지원
- [ ] 색상 대비 검증
- [ ] 반응형 디자인

---

## 🔌 외부 스킬 연결

### 가능한 스킬 통합

```
1. 차트 라이브러리 (Chart.js)
   - 시계열 그래프 (발행량)
   - 파이 차트 (파이프라인별 분포)
   - 막대 그래프 (파이프라인 비교)

2. 데이터 테이블 (Tabulator.js)
   - 기사 목록 (검색, 정렬, 필터)
   - 활동 로그 (고급 필터)
   - 내보내기 (CSV, Excel, PDF)

3. 알림 시스템 (Toastr/Noty)
   - 병목 감지
   - 오류 알림
   - 성공 메시지

4. 실시간 업데이트 (Socket.io)
   - WebSocket 대체
   - 자동 재연결
   - 메시지 큐

5. 분석 (Analytics.js)
   - 사용자 행동 추적
   - 파이프라인 성능 분석
   - 의사결정 데이터
```

### 추천 통합

**1단계 (필수)**:
```html
<!-- Chart.js (시각화) -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>

<!-- Tabler Icons (아이콘) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons@2.6.0/tabler-icons.css">
```

**2단계 (권장)**:
```html
<!-- Tabulator (테이블) -->
<link href="https://unpkg.com/tabulator-tables/dist/css/tabulator.min.css" rel="stylesheet">
<script src="https://unpkg.com/tabulator-tables/dist/js/tabulator.min.js"></script>

<!-- Socket.io (실시간) -->
<script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
```

---

## 🔮 미래 확장

```
아이디어 1: 파이프라인 커스텀 추가
  → 사용자가 새 파이프라인 생성
  → 단계 커스텀
  → 색상 선택

아이디어 2: 일정 및 알림
  → 예정된 작업 표시
  → 알림 설정
  → 캘린더 뷰

아이디어 3: 고급 분석
  → 성능 지표 (처리 시간)
  → 트렌드 분석
  → 예측 모델

아이디어 4: 협업 기능
  → 팀 사용자 관리
  → 권한 제어
  → 댓글/토론
```

---

## 📚 참고 자료

- 현재 구현: `/root/.openclaw/workspace/control-center/frontend/dist/multi-pipeline.html`
- 메인 뉴스룸: `/root/.openclaw/workspace/control-center/frontend/dist/index.html`
- 대시보드: `/root/.openclaw/workspace/control-center/frontend/dist/dashboard.html`
