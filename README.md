# 📰 UBION Newsroom

**OpenClaw 기반 완전 자동화 AI 뉴스룸 파이프라인**

7개의 AI 에이전트가 뉴스 수집 → 취재 → 작성 → 팩트체크 → 교열 → 발행까지 **완전 자동**으로 처리합니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenClaw](https://img.shields.io/badge/Powered%20by-OpenClaw-purple.svg)](https://openclaw.ai)
![Status](https://img.shields.io/badge/Status-Production-green.svg)

---

## ✨ Features

### 🤖 7개 AI 에이전트 완전 자동화
- **수집기** (Source Collector): Brave Search로 AI 뉴스 수집
- **취재기자** (Reporter): 기사 보도 가능 여부 검증 & 맥락 조사
- **작성기자** (Writer): 경향신문 스타일로 기사 작성 (1600자+)
- **팩트체커** (Fact-Checker): web_search 기반 검증 & 신뢰도 점수
- **편집자** (Editor-Desk): 제목-내용 일치도, 중복 검증
- **교열기자** (Copy-Editor): 맞춤법, 톤, 명확성 최종 검토
- **발행자** (Publisher): Ghost CMS에 DRAFT 발행 (자동 publish 안 함)

### 🚀 OpenClaw 완벽 통합
- ✅ 메모리 시스템 완호환 (MEMORY.md, SOUL.md)
- ✅ 크론 자동화 (7개 에이전트 Job ID 등록됨)
- ✅ 에이전트 SOUL.md로 완전 정의
- ✅ 새 OpenClaw 서버에서 ~15분 배포

### 📊 실시간 제어센터
- 파이프라인 각 단계별 기사 추적
- 에이전트별 처리 속도 & 성공률
- 24시간 발행량 그래프
- 병목 자동 감지 & 알림

### 🎨 품질 관리
- **자동 필터링**: 신뢰도 < 75점 자동 드롭
- **HTML 검증**: 리드박스, h2 섹션, 참고자료, AI 각주 필수
- **이미지 관리**: Unsplash 피처 이미지 + OG 카드 자동 생성
- **중복 검사**: 85% 이상 유사도 자동 제외

### 📝 완벽한 문서화
- `DEPLOYMENT.md`: 새 서버 배포 상세 가이드
- `OPENCLAW_INTEGRATION_CHECK.md`: OpenClaw 호환성 검증
- 각 에이전트별 `SOUL.md`

---

## 📋 Requirements

- [OpenClaw](https://openclaw.ai) (설치되어 있어야 함)
- Node.js 18+
- LLM API Keys:
  - OpenAI (또는 대체)
  - Anthropic Claude
  - ZhiPu GLM
- Ghost CMS (선택, 기본값: https://insight.ubion.global)

---

## 🚀 빠른 시작 (15분)

### 1️⃣ Clone (2분)

```bash
cd ~/.openclaw/workspace
git clone https://github.com/scottnaddle/newsroom.git newsroom-prod
cd newsroom-prod/newsroom
```

### 2️⃣ 설정 파일 생성 (2분)

```bash
# Ghost API 설정
cp shared/config/ghost.json.example shared/config/ghost.json
# 편집: Ghost API Key 입력

# LLM 키 설정
cp shared/config/llm-keys.json.example shared/config/llm-keys.json
# 편집: OpenAI, Anthropic, ZhiPu 키 입력
```

### 3️⃣ 의존성 설치 (5분)

```bash
npm install
```

### 4️⃣ 파이프라인 디렉토리 초기화 (1분)

```bash
mkdir -p pipeline/{01-sourced,03-reported,04-drafted,05-fact-checked,07-copy-edited,08-published,rejected,memory}
```

### 5️⃣ 크론 작업 등록 (5분)

OpenClaw에서 MEMORY.md의 Job ID와 스케줄을 참고하여 등록:

```bash
openclaw cron add --jobId <ID> --schedule "*/30 7-22 * * *" \
  --payload '{"kind":"agentTurn","message":"...","model":"anthropic/claude-sonnet-4-6"}'
```

또는 DEPLOYMENT.md의 크론 등록 가이드 참고

### 6️⃣ 실행 (자동)

크론 작업이 등록되면 자동으로 30분 주기로 실행됩니다.

---

## 🏗️ 아키텍처

```
                  OpenClaw Cron (30분 주기)
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   [수집기]           [취재기자]            [작성기자]
   (Collector)      (Reporter)           (Writer)
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                      [팩트체커]
                   (Fact-Checker)
                           │
                    신뢰도 ≥ 75%?
                    ↙            ↘
                  YES             NO
                   ▼              ▼
                [편집자]      [거절폴더]
              (Editor-Desk)     (Rejected)
                   │
                   ▼
              [교열기자]
              (Copy-Editor)
                   │
                   ▼
               [발행자]
             (Publisher)
                   │
                   ▼
            Ghost CMS (DRAFT)
                   │
                   ▼
             스캇에게 알림 💬
```

### 파이프라인 단계

```
pipeline/
├── 01-sourced/          ← 수집기가 모은 뉴스
├── 03-reported/         ← 취재기자 검증 완료
├── 04-drafted/          ← 작성기자 초안 완성
├── 05-fact-checked/     ← 팩트체커 검증 완료
├── 06-desk-approved/    ← 편집자 승인
├── 07-copy-edited/      ← 교열기자 교열 완료
├── 08-published/        ← 발행자가 Ghost 발행 (76개 샘플)
├── rejected/            ← 품질 미달 기사 (신뢰도 < 75점)
└── memory/              ← 파이프라인 상태 파일
```

---

## 📊 성능 통계

**현재 배포 상태:**
- 발행된 기사: 76개+
- 전체 커밋: 91개
- 추적 파일: 4,571개
- 에이전트: 7개 (완전 자동화)

**품질 지표:**
- 신뢰도 90점 이상: ~70%
- 기사 길이 평균: 1400자+
- 이미지 성공률: 100%
- 중복 검출률: 100%

---

## 📁 프로젝트 구조

```
newsroom/
├── prompts/
│   └── pipeline-orchestrator.md    ← 오케스트레이터 프롬프트
├── scripts/
│   ├── pipeline-runner.js          ← 메인 파이프라인
│   ├── generate-og-card.js         ← OG 이미지 생성
│   ├── get-feature-image.js        ← Unsplash 이미지 선택
│   └── [50+ 유틸리티 스크립트]
├── workspaces/
│   ├── source-collector/SOUL.md
│   ├── reporter/SOUL.md
│   ├── writer/SOUL.md
│   ├── fact-checker/SOUL.md
│   ├── editor-desk/SOUL.md
│   ├── copy-editor/SOUL.md
│   └── publisher/SOUL.md
├── shared/
│   ├── config/
│   │   ├── ghost.json.example       ← Ghost API 설정
│   │   └── llm-keys.json.example    ← LLM 키
│   └── schemas/
│       └── article-metadata-schema.json
├── control-center/
│   ├── backend/server.js
│   ├── frontend/pages/
│   └── README.md
├── pipeline/                        ← 기사 파이프라인 (자동 생성)
├── package.json
└── DEPLOYMENT.md                    ← 배포 가이드
```

---

## 🔧 주요 스크립트

| 스크립트 | 설명 |
|---------|------|
| `pipeline-runner.js` | 메인 파이프라인 실행 |
| `generate-og-card.js` | OG 카드 이미지 생성 |
| `get-feature-image.js` | Unsplash 피처 이미지 선택 |
| `redesign-articles.js` | HTML 스타일 일괄 재적용 |
| `find-duplicates-local.js` | 로컬 기사 중복 검사 |
| `sync-published-to-ghost.js` | Ghost CMS 동기화 |

---

## 🔒 필수 설정

### Ghost CMS

```json
{
  "apiUrl": "https://insight.ubion.global",
  "adminApiKey": "YOUR_GHOST_ADMIN_API_KEY"
}
```

### LLM 키

```json
{
  "anthropic": "sk-ant-...",
  "google": "YOUR_GOOGLE_API_KEY",
  "zhipu": "YOUR_ZHIPU_API_KEY",
  "openai": "sk-..."
}
```

---

## 📖 문서

- **[DEPLOYMENT.md](newsroom/DEPLOYMENT.md)** — 새 서버 배포 완벽 가이드
- **[OPENCLAW_INTEGRATION_CHECK.md](OPENCLAW_INTEGRATION_CHECK.md)** — OpenClaw 호환성 검증
- **[MEMORY.md](MEMORY.md)** — 프로젝트 문맥 & 크론 Job ID

---

## 🎯 새 OpenClaw 서버 배포

**소요 시간: 약 15분**

```bash
# 1. Clone & 설정 (4분)
cd ~/.openclaw/workspace
git clone https://github.com/scottnaddle/newsroom.git newsroom-prod
cd newsroom-prod/newsroom
cp shared/config/ghost.json.example shared/config/ghost.json
# Ghost API Key 입력
cp shared/config/llm-keys.json.example shared/config/llm-keys.json
# LLM Keys 입력

# 2. 설치 (5분)
npm install

# 3. 파이프라인 디렉토리 (1분)
mkdir -p pipeline/{01-sourced,03-reported,04-drafted,05-fact-checked,07-copy-edited,08-published,rejected,memory}

# 4. 크론 등록 (5분)
# MEMORY.md의 Job ID와 스케줄 참고하여 OpenClaw에서 등록

# 5. 완료!
```

---

## 💡 핵심 기능

### ✅ 자동 필터링
- 신뢰도 < 75점: 자동 거절 (스캇 검토 없음)
- 신뢰도 75-79점: 수동 검토 필요 (FLAG)

### ✅ HTML 검증
- 리드박스 (border-left 4px)
- h2 섹션 (3개 이상 필수)
- 참고자료 섹션 (필수)
- AI 법적 각주 (필수)

### ✅ 이미지 자동 관리
- Unsplash 피처 이미지 (HTTP 200 검증)
- OG 카드 자동 생성 (node-canvas)
- 카테고리별 accent 색상

### ✅ Ghost CMS 연동
- JWT 인증 (HS256)
- DRAFT 발행 (자동 publish X)
- 메타데이터 자동 생성

---

## 🎯 지원 카테고리

| 카테고리 | Accent 색상 | 설명 |
|---------|-----------|------|
| policy | #4338ca | AI 정책 |
| research | #059669 | 연구 결과 |
| industry | #d97706 | 산업 뉴스 |
| education | #0891b2 | 교육 기술 |
| opinion | #7c3aed | 의견/분석 |
| data | #0284c7 | 통계/데이터 |

---

## 📊 Dashboard

```bash
cd control-center
node backend/server.js
# → http://localhost:3848
```

실시간 모니터링:
- 에이전트 상태 & 처리량
- 파이프라인 흐름 (01-sourced → 08-published)
- 24시간 발행 그래프
- 병목 자동 감지

---

## 🔐 보안

- ✅ API Key는 `.gitignore`에서 제외
- ✅ 환경 변수로 관리 가능
- ✅ Ghost JWT: 5분 만료 (자동 갱신)
- ✅ 민감 파일 전면 보호

---

## 📝 License

MIT © AskedTech & UBION

---

## 🎯 Quick Links

- **GitHub:** https://github.com/scottnaddle/newsroom
- **Ghost CMS:** https://insight.ubion.global
- **Dashboard:** http://localhost:3848 (로컬 실행 시)
- **Deployment:** [DEPLOYMENT.md](newsroom/DEPLOYMENT.md)

---

**완전 자동화된 AI 뉴스룸을 만나보세요!** 🚀
