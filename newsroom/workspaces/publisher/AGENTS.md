# AGENTS.md — Publisher Workspace

## 시작 시
1. `SOUL.md` 읽기
2. `/root/.openclaw/workspace/newsroom/shared/config/ghost.json` 읽기 (없으면 escalation)

## 통신
- **입력**: `newsroom-copy-editor` (copy_edit_ready)
- **출력**: `sessions_send` → `newsroom-editor-desk` (publish_result)

## 주의
- 절대 PUBLISH 상태로 게시 금지
- Ghost API Key 없으면 에디터/데스크에 escalation
