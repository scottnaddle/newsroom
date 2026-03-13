# 에이전트 스폰 가이드

각 에이전트를 OpenClaw `sessions_spawn`으로 실행하는 방법입니다.

## 에이전트 스폰 설정

### 1. 에디터/데스크 (오케스트레이터) — 항상 먼저 실행
```json
{
  "runtime": "subagent",
  "label": "newsroom-editor-desk",
  "mode": "session",
  "cwd": "/root/.openclaw/workspace/newsroom/workspaces/editor-desk",
  "task": "AGENTS.md를 읽고 AskedTech 뉴스룸 편집국장으로 활동하세요. 다른 에이전트들의 세션 메시지를 기다리며 파이프라인을 관리합니다.",
  "model": "opus"
}
```

### 2. 소스 수집기 — cron 30분마다
```json
{
  "runtime": "subagent",
  "label": "newsroom-source-collector",
  "mode": "run",
  "cwd": "/root/.openclaw/workspace/newsroom/workspaces/source-collector",
  "task": "AGENTS.md를 읽고 AI 교육 뉴스를 수집하세요. Brave 웹 검색과 RSS 피드를 모두 활용하고, 75점 이상 항목을 newsroom-editor-desk 세션에 전달하세요.",
  "model": "sonnet"
}
```

### 3. 취재기자 — 에디터/데스크가 필요 시 스폰
```json
{
  "runtime": "subagent",
  "label": "newsroom-reporter",
  "mode": "session",
  "cwd": "/root/.openclaw/workspace/newsroom/workspaces/reporter",
  "task": "AGENTS.md를 읽고 배정된 스토리를 취재하세요. 완료 후 newsroom-editor-desk에 취재 브리프를 전송합니다.",
  "model": "sonnet"
}
```

### 4. 작성기자 — 에디터/데스크가 필요 시 스폰
```json
{
  "runtime": "subagent",
  "label": "newsroom-writer",
  "mode": "session",
  "cwd": "/root/.openclaw/workspace/newsroom/workspaces/writer",
  "task": "AGENTS.md를 읽고 취재 브리프로 기사를 작성하세요. 완료 후 newsroom-fact-checker에 초안을 전송합니다.",
  "model": "opus"
}
```

### 5. 팩트체커 — 에디터/데스크가 필요 시 스폰
```json
{
  "runtime": "subagent",
  "label": "newsroom-fact-checker",
  "mode": "session",
  "cwd": "/root/.openclaw/workspace/newsroom/workspaces/fact-checker",
  "task": "AGENTS.md를 읽고 SAFE 프로토콜로 기사를 팩트체킹하세요. 완료 후 newsroom-editor-desk에 결과를 전송합니다.",
  "model": "sonnet"
}
```

### 6. 교열기자 — 에디터/데스크가 필요 시 스폰
```json
{
  "runtime": "subagent",
  "label": "newsroom-copy-editor",
  "mode": "session",
  "cwd": "/root/.openclaw/workspace/newsroom/workspaces/copy-editor",
  "task": "AGENTS.md를 읽고 한국어 교열을 진행하세요. 완료 후 newsroom-publisher에 최종본을 전송합니다.",
  "model": "sonnet"
}
```

### 7. 발행 에이전트 — 교열기자가 필요 시 스폰
```json
{
  "runtime": "subagent",
  "label": "newsroom-publisher",
  "mode": "run",
  "cwd": "/root/.openclaw/workspace/newsroom/workspaces/publisher",
  "task": "AGENTS.md를 읽고 Ghost CMS에 기사를 DRAFT로 게시하세요. 완료 후 newsroom-editor-desk에 결과를 전송합니다.",
  "model": "sonnet"
}
```

## 통신 흐름 요약

```
source-collector ──→ editor-desk ──→ reporter ──→ editor-desk ──→ writer
                                                                      │
                                                                  fact-checker
                                                                      │
                                                                  editor-desk
                                                                      │
                                                                  copy-editor
                                                                      │
                                                                   publisher
                                                                      │
                                                                  editor-desk ──→ 스캇 알림
```

## Ghost API Key 설정
1. Ghost Admin > Settings > Integrations > Add custom integration
2. Admin API Key 복사
3. `shared/config/ghost.json` 생성:
```json
{ "apiUrl": "https://ubion.ghost.io", "adminApiKey": "YOUR_KEY" }
```
