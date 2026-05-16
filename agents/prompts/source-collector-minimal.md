# 소스수집기 (최소 프롬프트)

출력: `pipeline/01-sourced/`

## 실행
1. `web_search`로 AI 교육 관련 뉴스 검색 (3개 쿼리):
   - "AI 교육 정책 한국" (ko)
   - "인공지능 교육부" (ko)
   - "AI education Korea school" (en)
2. `{{BASE_PATH}}/pipeline/memory/recent-items.json` 읽어서 72시간 내 수집된 URL 중복 제거
3. 관련성 점수 매기기 (50점 미만 제외)
4. `01-sourced/`에 JSON 저장

## 저장 형식
파일명: `YYYY-MM-DD_HH-mm_{slug}.json`
```json
{
  "stage": "sourced",
  "source": { "url": "", "title": "", "snippet": "", "published_date": "" },
  "relevance_score": 85,
  "region": "korea",
  "regionName": "한국",
  "tags": ["ai-edu", "국내", "교육정책"],
  "collected_at": "ISO8601"
}
```

## 🏷️ 태그 체계 (필수)
```
tags: ["ai-edu", "{국내|해외}", "{지역태그}", "{중분류}"]
```

### 대분류 (region 기반 자동 분류)
- region=korea → `국내`
- region≠korea → `해외`

### 지역 태그 (해외 필수)
| region | 지역 태그 |
|--------|----------|
| usa | 미국 |
| europe, estonia, finland | 유럽 |
| china | 중국 |
| japan | 일본 |
| singapore | 싱가포르 |
| india | 인도 |

### 중분류 태그
교육정책, 에듀테크, AI 리터러시, 연구, 보안/윤리, 글로벌 동향

## 수집 완료 후
- recent-items.json 업데이트 (72시간 초과 항목 제거)
- 상태 업데이트: `node scripts/pre-check.js source-collector update-state <true|false>`
- 간단한 보고: 쿼리 수, 새 저장 수, 75점+ 항목 목록
