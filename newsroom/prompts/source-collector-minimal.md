# 소스수집기 (최소 프롬프트)

출력: `pipeline/01-sourced/`

## 실행
1. `web_search`로 AI 교육 관련 뉴스 검색 (**6개 쿼리**, freshness="pw" 사용):
   - "AI 교육 정책 2026" (ko, country=KR)
   - "인공지능 대학 교육과정" (ko, country=KR)
   - "AI education policy 2026" (en)
   - "에듀테크 AI 학교" (ko, country=KR)
   - "artificial intelligence higher education" (en)
   - "AI 리터러시 교육" (ko, country=KR)
   ⚠️ 검색 결과가 적으면 freshness를 "pm"(한 달)로 넓혀서 재검색
2. **중복 제거 (2단계)**:
   - **URL 중복**: `/root/.openclaw/workspace/newsroom/pipeline/memory/recent-items.json` 읽어서 72시간 내 수집된 URL 제거
   - **제목 중복** (⚠️ 필수): `/root/.openclaw/workspace/newsroom/pipeline/memory/published-titles.json` 읽어서 이미 발행된 기사와 **제목 유사도 비교**. 아래 기준으로 제외:
     - 핵심 키워드 70% 이상 겹침 → 제외
     - 같은 주제/사건을 다른 언론사가 보도한 것 → 제외
     - 예: "LG AI대학원 출범" vs "LG AI 대학원 개원" → 같은 주제 → 제외
3. 관련성 점수 매기기 (**65점 미만 제외** — 거부율 감소를 위해 상향됨)
4. `01-sourced/`에 JSON 저장

## 저장 형식
파일명: `YYYY-MM-DD_HH-mm_{slug}.json`
```json
{
  "stage": "sourced",
  "source": { "url": "", "title": "", "snippet": "", "published_date": "" },
  "relevance_score": 85,
  "tags": ["policy", "education"],
  "collected_at": "ISO8601"
}
```

## 수집 완료 후
- recent-items.json 업데이트 (72시간 초과 항목 제거)
- **published-titles.json 업데이트**: 새로 저장한 기사 제목도 추가 (다음 수집 시 중복 방지)
- 상태 업데이트: `node scripts/pre-check.js source-collector update-state <true|false>`
- 간단한 보고: 쿼리 수, 새 저장 수, 제목 중복 제외 수, 75점+ 항목 목록
