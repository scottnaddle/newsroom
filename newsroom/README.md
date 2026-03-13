# AskedTech 뉴스룸 — 7 에이전트 자동화 시스템

**파일 기반 파이프라인 + OpenClaw 크론**으로 구현된 완전 자동 뉴스 생산 시스템.

한국 뉴스룸의 편집 계층구조를 AI 에이전트로 구현하여, 수집 → 취재 → 작성 → 팩트체크 → 교열 → 발행까지 **완전 자동**으로 처리합니다.

---

## 🚀 배포 현황

| 항목 | 상태 |
|------|------|
| **GitHub** | ✅ https://github.com/scottnaddle/newsroom |
| **발행 기사** | ✅ 76개+ |
| **총 커밋** | ✅ 91개 |
| **OpenClaw 호환** | ✅ 완벽 |
| **새 서버 배포** | ✅ ~15분 |

---

## 🏗️ 파이프라인 아키텍처

```
OpenClaw Cron (30분 주기)
       │
       ▼
┌─────────────────┐
│ Source Collector│  ← Brave Search로 AI 뉴스 수집
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Reporter     │  ← 보도 가능성 검증 & 맥락 조사
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Writer      │  ← 경향신문 스타일 기사 작성 (1600자+)
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│   Fact-Checker          │  ← web_search 기반 검증
│   (신뢰도 점수 산출)     │
└────────┬────────────────┘
         │
      신뢰도?
      ↙      ↘
   <75%      ≥75%
    ↓         ↓
[거절]    [편집자]
          Editor-Desk
             │
             ↓
        [교열기자]
       Copy-Editor
             │
             ↓
         [발행자]
       Publisher
             │
             ▼
       Ghost CMS
         DRAFT
             │
             ▼
       스캇에게 알림
```

### 파이프라인 단계

```
pipeline/
├── 01-sourced/          ← Collector 수집 완료
├── 03-reported/         ← Reporter 취재 완료
├── 04-drafted/          ← Writer 초안 완성
├── 05-fact-checked/     ← Fact-Checker 검증 완료
├── 06-desk-approved/    ← Editor-Desk 승인
├── 07-copy-edited/      ← Copy-Editor 교열 완료
├── 08-published/        ← Publisher 발행 (Ghost DRAFT)
├── rejected/            ← 신뢰도 < 75점 또는 품질 미달
└── memory/              ← 파이프라인 상태 & 메타데이터
```

---

## 🤖 7개 에이전트

### 1️⃣ Source Collector (수집기)
- **역할**: Brave Search로 AI 뉴스 수집
- **입력**: 키워드 (config에서 정의)
- **출력**: `01-sourced/*.json`
- **스케줄**: 30분마다 (07:00~22:00)
- **Job ID**: `2a7923e8-a292-435b-bd55-1ba0ec08032e`

### 2️⃣ Reporter (취재기자)
- **역할**: 기사의 보도 가능성 검증
- **입력**: `01-sourced/*.json`
- **출력**: `03-reported/*.json`
- **검증**: 구체성, 뉴스 가치, 신뢰성
- **Job ID**: `bf5d972c-df27-480b-8b19-b32fcc8b4c25`

### 3️⃣ Writer (작성기자)
- **역할**: 경향신문 스타일로 기사 작성
- **입력**: `03-reported/*.json`
- **출력**: `04-drafted/*.json` (HTML, 1600자+)
- **구조**: 리드박스 + h2 섹션 + 참고자료 + AI 각주
- **Job ID**: `d3c17519-5951-447f-af8b-f6d7494b82d9`

### 4️⃣ Fact-Checker (팩트체커)
- **역할**: web_search 기반 검증 & 신뢰도 산출
- **입력**: `04-drafted/*.json`
- **출력**: `05-fact-checked/*.json` (신뢰도 점수)
- **기준**:
  - ≥ 90점: 자동 통과
  - 75~89점: FLAG (수동 검토)
  - < 75점: 자동 거절
- **Job ID**: `b0049592-2dac-4bb2-b718-f76fad8efdba`

### 5️⃣ Editor-Desk (편집자)
- **역할**: 기사 최종 검증 (제목-내용, 중복, 메타데이터)
- **입력**: `05-fact-checked/*.json`
- **출력**: `06-desk-approved/*.json`
- **체크리스트**:
  - 제목과 내용 일치도 (80%+)
  - 중복 여부 (85% 이상 중복 제외)
  - 본문 길이 (1500자+)
  - 메타데이터 완정도
- **Job ID**: `c20081e1-73be-4856-8768-029c326676d6`

### 6️⃣ Copy-Editor (교열기자)
- **역할**: 맞춤법, 톤, 명확성 최종 검토
- **입력**: `06-desk-approved/*.json`
- **출력**: `07-copy-edited/*.json`
- **검토**:
  - 문법 & 맞춤법
  - 톤 & 일관성
  - 가독성 & 명확성
  - HTML 구조 검증
- **Job ID**: `e57f7327-a883-492a-93eb-7ea54cb12d9e`

### 7️⃣ Publisher (발행자)
- **역할**: Ghost CMS에 DRAFT 발행
- **입력**: `07-copy-edited/*.json`
- **출력**: Ghost CMS (DRAFT 상태)
- **기능**:
  - JWT 인증 (HS256)
  - 메타데이터 자동 생성 (meta_title, meta_description)
  - 이미지 최적화 (Unsplash + OG 카드)
- **주의**: 자동 publish 안 함 (스캇이 수동 검토 후 발행)
- **Job ID**: `cecbf113-6ac7-4cc1-8694-d65a040324ed`

---

## 📋 에이전트 워크스페이스

```
workspaces/
├── source-collector/
│   ├── SOUL.md              ← 에이전트 정의
│   ├── prompt.md            ← 프롬프트
│   └── README.md
├── reporter/
│   ├── SOUL.md
│   ├── prompt.md
│   └── README.md
├── writer/
│   ├── SOUL.md
│   ├── prompt.md
│   └── README.md
├── fact-checker/
│   ├── SOUL.md
│   ├── prompt.md
│   └── README.md
├── editor-desk/             ← 오케스트레이터 허브
│   ├── SOUL.md
│   ├── prompt.md
│   └── README.md
├── copy-editor/
│   ├── SOUL.md
│   ├── prompt.md
│   └── README.md
└── publisher/
    ├── SOUL.md
    ├── prompt.md
    └── README.md
```

각 워크스페이스는:
- ✅ OpenClaw 세션으로 독립 실행
- ✅ SOUL.md로 역할 & 규칙 정의
- ✅ 파일 I/O로 통신 (JSON)
- ✅ 크론 작업으로 자동 실행

---

## 🔄 통신 프로토콜

### 파일 기반 파이프라인

각 에이전트는 **폴더 간 파일 이동**으로 통신:

```
01-sourced/*.json (수집기 출력)
    ↓
read()
    ↓
Reporter SOUL.md 규칙 적용
    ↓
03-reported/*.json (Reporter 출력)
    ↓
...계속...
```

### JSON 구조

```json
{
  "id": "uuid",
  "title": "기사 제목",
  "content": "기사 내용",
  "html": "<html>...</html>",
  "metadata": {
    "category": "policy",
    "author": "에이전트명",
    "created_at": "2026-03-10T14:00:00Z",
    "status": "drafted"
  },
  "quality": {
    "score": 85,
    "flag": false,
    "issues": []
  }
}
```

---

## 🚀 실행 방법

### 방법 1: OpenClaw 크론 (자동)

MEMORY.md의 Job ID를 OpenClaw에 등록:

```bash
openclaw cron add \
  --jobId 2a7923e8-a292-435b-bd55-1ba0ec08032e \
  --schedule "*/30 7-22 * * *" \
  --payload '{"kind":"agentTurn","message":"수집...","model":"anthropic/claude-sonnet-4-6"}'
```

### 방법 2: 수동 실행

```bash
# 단일 에이전트 실행
node scripts/run-<agent>.js

# 전체 파이프라인
npm start
```

---

## 📊 성능 통계

| 메트릭 | 수치 |
|--------|------|
| **발행된 기사** | 76개+ |
| **총 커밋** | 91개 |
| **파이프라인 단계** | 7개 |
| **예상 처리 시간** | 45분 (수집~발행) |
| **신뢰도 90점 이상** | ~70% |
| **기사 길이 평균** | 1400자+ |

---

## 🔧 주요 스크립트

| 스크립트 | 설명 |
|---------|------|
| `pipeline-runner.js` | 메인 파이프라인 실행 |
| `run-orchestrator.js` | 오케스트레이터 실행 |
| `generate-og-card.js` | OG 카드 이미지 생성 |
| `get-feature-image.js` | Unsplash 이미지 선택 |
| `find-duplicates-local.js` | 기사 중복 검사 |
| `sync-published-to-ghost.js` | Ghost 동기화 |

---

## 📁 디렉토리 구조

```
newsroom/
├── prompts/
│   └── pipeline-orchestrator.md    ← 오케스트레이터
├── scripts/                        ← 50+ 유틸 스크립트
├── workspaces/                     ← 7개 에이전트
├── shared/
│   ├── config/
│   │   ├── ghost.json.example
│   │   └── llm-keys.json.example
│   └── schemas/
├── control-center/                 ← 대시보드
├── pipeline/                       ← 파이프라인 (자동 생성)
├── DEPLOYMENT.md                   ← 배포 가이드
├── OPERATIONS.md                   ← 운영 가이드
├── QUALITY_IMPROVEMENT_GUIDE.md    ← 품질 관리
└── README.md
```

---

## 🎯 OpenClaw 크론 Job ID

모두 MEMORY.md에 문서화되어 있습니다:

```
Source Collector: 2a7923e8-a292-435b-bd55-1ba0ec08032e
Reporter:        bf5d972c-df27-480b-8b19-b32fcc8b4c25
Writer:          d3c17519-5951-447f-af8b-f6d7494b82d9
Fact-Checker:    b0049592-2dac-4bb2-b718-f76fad8efdba
Editor-Desk:     c20081e1-73be-4856-8768-029c326676d6
Copy-Editor:     e57f7327-a883-492a-93eb-7ea54cb12d9e
Publisher:       cecbf113-6ac7-4cc1-8694-d65a040324ed
```

---

## 🔒 필수 설정

### Ghost API (shared/config/ghost.json)

```json
{
  "apiUrl": "https://ubion.ghost.io",
  "adminApiKey": "kid:secret"
}
```

### LLM Keys (shared/config/llm-keys.json)

```json
{
  "anthropic": "sk-ant-...",
  "google": "YOUR_KEY",
  "zhipu": "YOUR_KEY",
  "openai": "sk-..."
}
```

---

## 📖 더 알아보기

- **[../DEPLOYMENT.md](../DEPLOYMENT.md)** — 새 서버 배포 가이드
- **[../MEMORY.md](../MEMORY.md)** — 프로젝트 문맥 & 크론 Job ID
- **[OPERATIONS.md](OPERATIONS.md)** — 운영 및 모니터링
- **[QUALITY_IMPROVEMENT_GUIDE.md](QUALITY_IMPROVEMENT_GUIDE.md)** — 품질 관리

---

## 📊 Dashboard

```bash
cd control-center
node backend/server.js
# → http://localhost:3848
```

실시간 추적:
- 파이프라인 각 단계 기사 수
- 에이전트 처리 속도
- 24시간 발행량
- 병목 자동 감지

---

**완전 자동화된 AI 뉴스룸 시스템입니다!** 🚀
