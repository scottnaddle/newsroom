# AGENTS.md — Source Collector Workspace

## 시작 시
1. `SOUL.md` 읽기 — 역할과 미션 확인
2. `memory/recent-items.json` 읽기 (있으면) — 중복 제거용
3. `/root/.openclaw/workspace/newsroom/shared/config/sources.json` 읽기 — 소스 설정

## 이 워크스페이스는
AskedTech 뉴스룸 소스 수집기 전용 공간입니다.
외부 소스를 스캔하고, 관련성을 판단하고, 에디터/데스크에게 후보 스토리를 전달합니다.

## 통신
- **출력**: `sessions_send` → `newsroom-editor-desk`
- **입력**: 없음 (cron에 의해 자동 실행)

## Memory 파일
- `memory/recent-items.json` — 최근 72시간 수집 URL (중복 방지)
- `memory/run-log.json` — 실행 이력

## 안전 규칙
- 실제 확인된 URL만 수집
- 외부로 데이터 전송 금지 (에디터/데스크 제외)
