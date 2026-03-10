# 🔧 Setup Guide

## 전체 흐름

```
1. git clone & npm install
2. config.yaml 생성 (init)
3. OpenClaw 설정 생성 (setup)
4. openclaw.json에 병합
5. API 키 설정
6. OpenClaw 재시작
7. 크론 작업 등록
8. 동작 확인
```

## Step 1: 설치

```bash
git clone https://github.com/scottnaddle/ubion-newsroom-kit.git
cd ubion-newsroom-kit
npm install
```

## Step 2: 설정 생성

```bash
node bin/cli.js init
```

대화형으로 뉴스룸 이름, 주제, CMS, LLM을 설정합니다.
`config.yaml`과 `pipeline/` 디렉토리가 생성됩니다.

## Step 3: OpenClaw 설정 생성

```bash
node bin/cli.js setup
```

두 개의 파일이 생성됩니다:
- `openclaw-config.json` — LLM 프로바이더, 인증, 에이전트 설정
- `cron-jobs.json` — 7개 에이전트 크론 작업 정의

## Step 4: openclaw.json에 병합

`openclaw-config.json`의 내용을 `~/.openclaw/openclaw.json`에 병합합니다.

### 방법 A: OpenClaw 채팅에서 요청
```
"openclaw-config.json을 읽고 openclaw.json에 적용해줘"
```

### 방법 B: 수동 병합
```bash
# 기존 설정 백업
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak

# jq로 병합 (jq 설치 필요)
jq -s '.[0] * .[1]' ~/.openclaw/openclaw.json openclaw-config.json > /tmp/merged.json
cp /tmp/merged.json ~/.openclaw/openclaw.json
```

## Step 5: API 키 설정

```bash
# 환경변수로 설정
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."

# 또는 openclaw.json에 직접 입력
# models.providers.<provider>.apiKey 필드
```

## Step 6: OpenClaw 재시작

```bash
openclaw gateway restart
```

## Step 7: 크론 작업 등록

OpenClaw 채팅에서:
```
"cron-jobs.json을 읽고 크론 작업을 등록해줘"
```

또는 OpenClaw의 cron API를 직접 사용합니다.

## Step 8: 동작 확인

```bash
# 파이프라인 상태
node bin/cli.js status

# 관제센터
node bin/cli.js dashboard
# → http://localhost:3848
```

---

## openclaw-config.json 구조

```json
{
  "auth": {
    "profiles": {
      "openai:default": { "provider": "openai", "mode": "token" }
    }
  },
  "models": {
    "providers": {
      "openai": {
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "${OPENAI_API_KEY}",
        "api": "openai-completions",
        "models": [
          {
            "id": "gpt-4o",
            "name": "GPT-4o",
            "api": "openai-completions",
            "reasoning": false,
            "input": ["text"],
            "contextWindow": 128000,
            "maxTokens": 16384
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": "openai/gpt-4o",
      "workspace": "/path/to/newsroom-kit",
      "userTimezone": "Asia/Seoul"
    }
  }
}
```

## 지원 LLM 프로바이더

| Provider | Key | Models |
|----------|-----|--------|
| OpenAI | `openai` | gpt-4o, gpt-4o-mini |
| Anthropic | `anthropic` | claude-opus-4-6, claude-sonnet-4-6 |
| ZhiPu | `zai` | glm-5 |
| Moonshot | `moonshot` | kimi-k2.5 |

## 채널 설정 (Telegram, Discord 등)

채널 설정은 `openclaw configure` 명령어로 별도 설정합니다.
이 Kit은 채널 설정을 자동 생성하지 않습니다.

```bash
openclaw configure
# → 채널 선택 및 설정
```
