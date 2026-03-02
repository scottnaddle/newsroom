# HEARTBEAT.md

## AskedTech 뉴스룸 모니터링

heartbeat 실행 시 아래 항목 확인:

1. **파이프라인 상태** 확인
   - `pipeline/` 각 단계 파일 수 체크
   - 특정 단계에 5개 이상 쌓이면 스캇에게 알림

2. **08-published 새 항목** 있으면
   - Ghost 드래프트 URL 스캇에게 보고

3. **크론 에러** 3회 이상 연속이면 스캇에게 알림

이상 없으면 HEARTBEAT_OK
