# 🚀 AskedTech AI 뉴스룸 배포 가이드

**최종 업데이트:** 2026-03-10 13:02 KST  
**파이프라인 상태:** ✅ 정상 작동 중 (76개 기사 발행됨)

---

## 📋 배포 전 체크리스트

### 1. 필수 설정 파일 준비

배포 후 다음 파일들을 **새 서버에서 직접 생성**해야 합니다:

#### `newsroom/shared/config/ghost.json`
```json
{
  "apiUrl": "https://insight.ubion.global",
  "adminApiKey": "YOUR_GHOST_ADMIN_API_KEY_HERE"
}
```

#### `newsroom/shared/config/llm-keys.json`
```json
{
  "anthropic": "YOUR_ANTHROPIC_API_KEY",
  "google": "YOUR_GOOGLE_AI_STUDIO_KEY",
  "zhipu": "YOUR_ZHIPU_API_KEY"
}
```

#### `TOOLS.md`
```markdown
# TOOLS.md - 로컬 설정

### Google AI Studio (Nano Banana / Gemini Image)
- Key: `YOUR_GOOGLE_AI_KEY`
- Models: `gemini-3-pro-image-preview`, `gemini-2.5-flash-image`
- Used for: 만평 이미지 생성
```

### 2. 디렉토리 구조 초기화

```bash
# 파이프라인 디렉토리 생성
mkdir -p newsroom/pipeline/{01-sourced,03-reported,04-drafted,05-fact-checked,07-copy-edited,08-published,rejected}
mkdir -p newsroom/pipeline/digest/{02-drafted,03-published,rejected}
mkdir -p newsroom/pipeline/memory
mkdir -p newsroom/pipeline/tmp
```

### 3. Node.js 패키지 설치

```bash
cd newsroom
npm install
```

---

## 🚀 배포 후 실행

### 1. 오케스트레이터 크론 작업 등록

```bash
# 각 에이전트별 크론 작업 설정 (MEMORY.md 참고)
# Job ID들이 이미 정의되어 있습니다
```

**등록할 크론 작업 (30분 주기):**
- Source Collector (01-sourced 생성)
- Reporter (03-reported 생성)
- Writer (04-drafted 생성)
- Fact-Checker (05-fact-checked 생성)
- Editor-Desk (검증)
- Copy-Editor (07-copy-edited 생성)
- Publisher (08-published 발행)

### 2. 대시보드 서버 실행 (선택사항)

```bash
cd newsroom/control-center
npm install
node backend/server.js
# http://localhost:3848에서 접근
```

---

## 📊 핵심 파일 구조

```
newsroom/
├── prompts/
│   └── pipeline-orchestrator.md    ⭐ 핵심 오케스트레이터
├── scripts/
│   ├── pipeline-runner.js          (메인 파이프라인 실행)
│   ├── rewrite-short-articles.js   (부족 기사 재작성)
│   └── [50+ 유틸리티 스크립트]
├── workspaces/
│   ├── source-collector/SOUL.md    (뉴스 수집)
│   ├── reporter/SOUL.md            (취재)
│   ├── writer/SOUL.md              (작성)
│   ├── fact-checker/SOUL.md        (검증)
│   ├── editor-desk/SOUL.md         (편집)
│   ├── copy-editor/SOUL.md         (교열)
│   └── publisher/SOUL.md           (발행)
├── shared/
│   ├── config/
│   │   ├── ghost.json              🔐 Ghost API 설정
│   │   ├── llm-keys.json           🔐 LLM API 키
│   │   └── article-metadata-schema.json
│   └── prompts/
└── pipeline/
    ├── 01-sourced/                 (뉴스 소스)
    ├── 03-reported/                (취재 결과)
    ├── 04-drafted/                 (초안)
    ├── 05-fact-checked/            (검증됨)
    ├── 07-copy-edited/             (교열됨)
    ├── 08-published/               (발행됨)
    └── memory/                     (상태 파일)
```

---

## ⚙️ 주요 설정

### Ghost CMS 연결

**API URL:** `https://insight.ubion.global`

**인증 방식:** JWT (Admin API Key)

**토큰 생성:**
```javascript
// Header.Algorithm: HS256
// Header.Kid: <API Key의 앞부분>
// Payload.iss: <API Key의 앞부분>
// Payload.aud: /admin/
// Payload.exp: now + 300 (5분)
// Secret: <API Key의 뒷부분 (hex)>
```

### LLM 모델

| 모듈 | 기본 모델 | 역할 |
|------|---------|------|
| Source Collector | Gemini 2.5 Flash | 뉴스 검색 & 필터링 |
| Reporter | GLM-4-Plus | 심층 취재 |
| Writer | GLM-4-Plus | 기사 작성 |
| Fact-Checker | Claude 3.5 Sonnet | 팩트 검증 |
| Editor-Desk | Claude 3.5 Sonnet | 편집 (90점 이상 자동 통과) |
| Copy-Editor | Claude 3.5 Sonnet | 최종 교열 |

---

## 🔍 품질 게이트

### 자동 드롭 기준 (신뢰도 < 75점)
- Fact-Checker → rejected로 자동 이동
- 스캇의 검토 없이 제외됨

### 플래그 기준 (신뢰도 75-89점)
- Editor-Desk에서 수동 검토 필요

### 자동 통과 (신뢰도 90점 이상)
- 편집 단계 스킵
- Publisher에서 직접 발행

---

## 📈 모니터링

### 파이프라인 상태 확인

```bash
# 각 단계의 기사 수
ls -la newsroom/pipeline/01-sourced/*.json | wc -l
ls -la newsroom/pipeline/03-reported/*.json | wc -l
ls -la newsroom/pipeline/08-published/*.json | wc -l

# 최근 발행된 기사
ls -lt newsroom/pipeline/08-published/ | head -10
```

### 로그 확인

```bash
tail -f newsroom/pipeline/pipeline-runner.log
```

### 메모리/상태 파일

```
newsroom/pipeline/memory/
├── collector-state.json    (수집기 상태)
├── published-titles.json   (발행된 기사 제목)
├── recent-items.json       (최근 아이템)
└── used-images.json        (사용된 이미지)
```

---

## 🚨 알려진 이슈 & 해결책

### Issue 1: Ghost API "Invalid token"
**상태:** 토큰 검증 실패  
**해결책:** API Key를 Ghost Admin에서 새로 발급받기

**테스트:**
```bash
cd newsroom && node -e "
const crypto = require('crypto');
const config = require('./shared/config/ghost.json');
const [kid, secret] = config.adminApiKey.split(':');
// JWT 생성 테스트...
"
```

### Issue 2: 부족한 기사 (< 1000자)
**상태:** 해결됨 ✅  
**조치:** rewrite-short-articles.js 자동 실행 (20개 기사 → 1600+자로 증가)

### Issue 3: Unsplash 이미지 404
**상태:** 해결됨 ✅  
**조치:** HTTP 200 검증된 ID만 사용

---

## 📞 지원

### 주요 에이전트 SOUL.md
각 에이전트의 역할, 입력/출력, 성공 기준이 정의됨:
- `newsroom/workspaces/*/SOUL.md` 참고

### 품질 가이드
- `newsroom/QUALITY_IMPROVEMENT_GUIDE.md` — 품질 게이트 상세 설명

### 메모리
- `/root/.openclaw/workspace/MEMORY.md` — 전체 프로젝트 문맥 및 결정 이력

---

## ✅ 배포 체크리스트

- [ ] Git clone 및 의존성 설치
- [ ] API Key 설정 파일 생성 (ghost.json, llm-keys.json)
- [ ] 파이프라인 디렉토리 구조 생성
- [ ] 크론 작업 등록 (또는 OpenClaw 스케줄링)
- [ ] 첫 번째 실행 테스트
- [ ] Ghost CMS API 연결 테스트
- [ ] 대시보드 서버 실행 (선택사항)
- [ ] 모니터링 설정

---

**준비 완료! 다른 서버에서 즉시 배포 가능합니다.** 🚀
