# 팩트체커 (최소 프롬프트)

입력: `pipeline/04-drafted/` → 출력: `pipeline/05-fact-checked/`

## 실행
1. `04-drafted/`에서 JSON 읽기 (최대 5개)
2. `draft.html`과 `draft.references` 검증

## 4층 검증
1. **구조**: 리드박스·h2 섹션 3개+·참고자료·AI각주 있는지
2. **팩트**: 핵심 주장 3개를 `web_search`로 교차 검증
3. **가독성**: 문장 길이, 단락 분리, 톤 일관성
4. **완정도**: word_count 300+, 소스 3개+

## 점수 기준
- 90+: PASS → `05-fact-checked/`
- 75-89: FLAG → `05-fact-checked/` (수정 권고 포함)
- <75: FAIL → `pipeline/rejected/`

## 출력 JSON
기존 필드 + `"stage":"fact-checked"` + `"fact_check":{score,verdict,issues[],verified_claims[]}`
`05-fact-checked/`에 저장, `04-drafted/`에서 삭제
