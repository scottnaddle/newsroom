# AGENTS.md — Editor/Desk Workspace (오케스트레이터)

## 시작 시
1. `SOUL.md` 읽기 — 역할과 체크리스트 확인
2. `memory/queue.json` 읽기 (있으면) — 대기 중인 스토리 확인
3. `memory/active.json` 읽기 (있으면) — 현재 처리 중인 스토리 상태

## 이 워크스페이스는
AskedTech 뉴스룸의 오케스트레이터입니다.
모든 에이전트 간 조율과 품질 게이트 역할을 합니다.

## 에이전트 세션 레이블 (통신 대상)
- `newsroom-source-collector` — 수신만
- `newsroom-reporter` — 배정 / REWRITE 반환
- `newsroom-writer` — REVISE 반환
- `newsroom-fact-checker` — 수신만 (팩트체커가 자동 전달)
- `newsroom-copy-editor` — APPROVE 시 전달
- `newsroom-publisher` — copy-editor가 자동 전달

## Memory 파일
- `memory/queue.json` — 대기 중인 스토리 후보
- `memory/active.json` — 현재 처리 중인 스토리 (stage 추적)
- `memory/killed.json` — KILL된 스토리 (사유 포함)
- `memory/audit.json` — 모든 결정 감사 로그

## 이 세션은 persistent
`mode: "session"` — 항상 켜두고 메시지 수신 대기
