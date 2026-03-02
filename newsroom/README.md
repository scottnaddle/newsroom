# AskedTech 뉴스룸 — 7 에이전트 시스템

AI 교육 뉴스 자동화 파이프라인. 한국 뉴스룸 편집 계층구조를 OpenClaw 에이전트로 구현.

## 파이프라인 (세션 간 메시지 기반)

```
[cron 30분]
     ↓
[source-collector] ──sessions_send──→ [editor-desk]  ← 오케스트레이터 허브
                                            │
                          ┌─────────────────┤
                          ↓                 ↓
                     [reporter]        KILL → 종료
                          │
                          ↓
                      [writer]
                          │
                          ↓
                    [fact-checker]
                          │
                    FAIL ←┤→ PASS/FLAG
                     ↓         ↓
                 [reporter]  [editor-desk]
                              │
                   ┌──────────┼──────────┐
                   ↓          ↓          ↓
               REVISE→    APPROVE→    REWRITE→
              [writer]  [copy-editor] [reporter]
                              │
                              ↓
                         [publisher]
                              │
                              ↓
                         Ghost DRAFT
                              │
                              ↓
                       스캇에게 알림 💬
```

## 워크스페이스 구조

```
newsroom/
├── workspaces/
│   ├── source-collector/   ← 각 에이전트 독립 워크스페이스
│   ├── reporter/
│   ├── writer/
│   ├── fact-checker/
│   ├── editor-desk/        ← 오케스트레이터
│   ├── copy-editor/
│   └── publisher/
├── shared/
│   ├── config/             ← 공유 설정 (Ghost API 등)
│   └── schemas/            ← 데이터 스키마
└── docs/
```

## 에이전트 세션 레이블

| 에이전트 | 세션 레이블 | 권장 모델 |
|---------|-----------|---------|
| source-collector | `newsroom-source-collector` | sonnet |
| reporter | `newsroom-reporter` | sonnet |
| writer | `newsroom-writer` | opus |
| fact-checker | `newsroom-fact-checker` | sonnet |
| editor-desk | `newsroom-editor-desk` | opus |
| copy-editor | `newsroom-copy-editor` | sonnet |
| publisher | `newsroom-publisher` | sonnet |

## 에이전트 스폰 방법

각 에이전트는 `sessions_spawn`으로 실행:
- `runtime: "subagent"`
- `label: "newsroom-<agent-name>"`
- `cwd: "/root/.openclaw/workspace/newsroom/workspaces/<agent-name>"`
- `mode: "session"` (에디터/데스크는 persistent)

## 통신 프로토콜

메시지 형식: JSON 문자열
```json
{
  "from": "source-collector",
  "type": "story_candidate",
  "item_id": "uuid",
  "payload": { ... }
}
```

## Ghost CMS
- Admin API: https://askedtech.ghost.io/ghost/api/admin/
- 설정: shared/config/ghost.json (필요 시 스캇에게 문의)
