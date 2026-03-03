# HEARTBEAT.md

## 뉴스룸 파이프라인 모니터링

heartbeat 실행 시 아래 순서대로:

### 1. 파이프라인 상태 확인
- 각 단계 파일 수 체크
- 5개 이상 쌓인 단계 → 스캇에게 알림 (08-published 제외)

### 2. 새 발행 기사 확인
- `08-published`에 이전 heartbeat 이후 새 항목 있으면 Ghost URL 보고

### 3. 해외 소스 발굴 (매 heartbeat마다)
- web_search로 신규 해외 AI 교육 뉴스 검색 (아래 쿼리 중 1~2개 랜덤 선택)
  - "AI education news this week schools"
  - "artificial intelligence classroom policy 2026"
  - "AI literacy students teachers latest"
  - "edtech AI regulation update"
  - "generative AI university ban guideline"
- 관련성 75점 이상 신규 기사 → `pipeline/01-sourced/`에 JSON 저장
- 이미 수집된 URL인지 `shared/config/recent-items.json`에서 중복 확인 후 저장

### 4. 이상 없으면 HEARTBEAT_OK
