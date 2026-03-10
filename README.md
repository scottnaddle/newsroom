# 📰 UBION Newsroom Kit

**OpenClaw 기반 AI 뉴스룸 자동화 파이프라인** — config.yaml 하나로 AI 뉴스 수집·취재·작성·팩트체크·교열·발행이 자동으로 돌아갑니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenClaw](https://img.shields.io/badge/Powered%20by-OpenClaw-purple.svg)](https://openclaw.ai)

---

## ✨ Features

- **7개 AI 에이전트** 파이프라인: 수집 → 배정 → 취재 → 작성 → 팩트체크 → 교열 → 발행
- **config.yaml 하나로** 주제·스타일·스케줄·CMS 설정
- **토큰 최적화** 내장: 사전 필터링, 스마트 스케줄링, 프롬프트 경량화 (최대 88% 절감)
- **자동 크론 등록**: `setup.js`가 OpenClaw 크론 작업 자동 생성
- **Ghost CMS 연동**: JWT 인증, Draft/Published 발행
- **실시간 관제센터**: 파이프라인 모니터링 + 토큰 사용량 추적
- **추가 채널**: Digest, 논문 요약 (선택)

## 📋 Requirements

- [OpenClaw](https://openclaw.ai) (설치 + 실행 중)
- Node.js 18+
- LLM API Key (OpenAI, Anthropic, ZhiPu 등)
- Ghost CMS (선택)

## 🚀 Quick Start

### 1. 클론 & 설치

```bash
git clone https://github.com/scottnaddle/ubion-newsroom-kit.git
cd ubion-newsroom-kit
npm install
```

### 2. 설정

```bash
# 대화형 설정 생성
node bin/cli.js init

# 또는 예시 파일 복사 후 수정
cp templates/config.example.yaml config.yaml
vi config.yaml
```

### 3. OpenClaw 크론 등록

```bash
node bin/cli.js setup
```

이 명령어가 config.yaml을 읽고 OpenClaw 크론 작업을 자동 생성합니다.

### 4. 확인

```bash
node bin/cli.js status
```

### 5. 관제센터 (선택)

```bash
node bin/cli.js dashboard
# → http://localhost:3848
```

---

## 🏗️ Architecture

```
                    OpenClaw Cron
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │Collector │──▶│ Reporter │──▶│  Writer  │
  │ (수집)    │   │ (취재)    │   │ (작성)    │
  └──────────┘   └──────────┘   └──────────┘
                                      │
  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │Publisher │◀──│  Copy    │◀──│  Editor  │◀──┐
  │ (발행)    │   │  Editor  │   │  (편집)   │   │
  └──────────┘   │ (교열)    │   └──────────┘   │
       │         └──────────┘                   │
       ▼                                  ┌──────────┐
  ┌─────────┐                             │  Fact    │
  │  Ghost  │                             │ Checker  │
  │   CMS   │                             └──────────┘
  └─────────┘

  각 에이전트 = OpenClaw 크론 agentTurn (격리 세션)
  파일 기반 파이프라인: JSON 파일이 폴더 간 이동
```

### Pipeline Stages

```
pipeline/
├── 01-sourced/       ← Collector가 수집한 기사 소스
├── 02-assigned/      ← Editor가 배정한 기사
├── 03-reported/      ← Reporter가 취재 완료
├── 04-drafted/       ← Writer가 작성한 초안
├── 05-fact-checked/  ← Fact Checker 검증 완료
├── 06-desk-approved/ ← Editor 승인
├── 07-copy-edited/   ← Copy Editor 교열 완료
├── 08-published/     ← Publisher가 Ghost에 발행
├── rejected/         ← 품질 미달 기사
└── memory/           ← 상태 파일
```

### Token Optimization (Built-in)

| Strategy | Savings | How |
|----------|---------|-----|
| Pre-check | ~65% | 입력 폴더 비어있으면 LLM 호출 안 함 |
| Minimal prompts | ~35% | SOUL.md 대신 경량 프롬프트 사용 |
| Smart scheduling | ~30% | 야간/주말 자동 감소 |
| Code validation | ~25% | HTML/중복 검증을 코드로 처리 |
| **Combined** | **~88%** | |

---

## 📋 config.yaml

```yaml
newsroom:
  name: "AI 교육 뉴스룸"
  language: ko
  timezone: Asia/Seoul

topics:
  - name: "AI 교육 정책"
    keywords: ["AI 교육 정책", "인공지능 교육부"]
    category: policy
    accent_color: "#4338ca"

agents:
  collector:
    enabled: true
    schedule_minutes: 30
    sources:
      brave_search:
        enabled: true
        freshness: "pw"

  writer:
    style: news         # news | blog | academic
    tone: formal
    min_word_count: 300

  publisher:
    publish_as: draft    # draft | published (draft 강력 권장)

cms:
  provider: ghost
  url: "https://your-site.ghost.io"
  api_key: "${GHOST_API_KEY}"

optimization:
  pre_check: true
  prompt_mode: minimal
  smart_scheduling:
    enabled: true
    off_hours: [23, 7]
    weekend_mode: reduced
```

[전체 설정 옵션 → docs/CONFIG.md](docs/CONFIG.md)

---

## 📁 Project Structure

```
ubion-newsroom-kit/
├── config.yaml              # 뉴스룸 설정 (사용자 생성)
├── bin/cli.js               # CLI
├── src/
│   ├── config/              # 설정 로딩·검증
│   ├── setup/               # OpenClaw 크론 자동 등록
│   ├── scripts/             # 유틸 스크립트 (pre-check, validate 등)
│   └── dashboard/           # 관제센터 서버
├── agents/
│   ├── soul/                # 에이전트 SOUL.md (전체 프롬프트)
│   └── prompts/             # 경량 프롬프트 (크론용)
├── shared/
│   └── config/              # Ghost 설정, 소스 목록 등
├── templates/               # 예시 설정 파일
├── pipeline/                # 자동 생성 (기사 흐름)
└── docs/                    # 문서
```

---

## 🔧 Commands

```bash
node bin/cli.js init          # 대화형 설정 생성
node bin/cli.js setup         # OpenClaw 크론 작업 등록
node bin/cli.js status        # 파이프라인 상태 확인
node bin/cli.js dashboard     # 관제센터 시작
node bin/cli.js validate      # 설정 파일 검증
node bin/cli.js reset         # 크론 작업 전체 삭제
```

---

## 🔒 Environment Variables

```bash
export GHOST_API_KEY="kid:secret"
export OPENAI_API_KEY="sk-..."
# 또는 .env 파일
```

config.yaml에서 `${ENV_VAR}` 문법으로 참조합니다.

---

## 📝 License

MIT © UBION
