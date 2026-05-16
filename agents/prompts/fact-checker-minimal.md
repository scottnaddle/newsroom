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

## 🚨 품질관리 감지 (필수)

### 영어 본문 잔여 감지
- 영어 3단어 이상 연속 (고유명사 제외) → `english_residual: true`

### 헤드라인 품질
- "AI 교육 관련 최신 동향:" 포함 → `headline_prefix_issue: true`
- 30자 초과 → `headline_too_long: true`
- 영문 5단어 이상 → `headline_english_issue: true`

### 형식적 구조 감지
- 4단계 고정 구조(배경→주요→글로벌→전망) → `formal_structure: true`

### 태그 완정도
- 국내/해외 태그 누락 → `missing_region_tag: true`

## 점수 기준
- 90+: PASS → `05-fact-checked/`
- 75-89: FLAG → `05-fact-checked/` (qc_flags 포함)
- <75: FAIL → `pipeline/rejected/`

## 출력 JSON
```json
{
  ...기존 필드...,
  "stage": "fact-checked",
  "fact_check_report": {
    "score": 92,
    "status": "PASS",
    "verified_claims": [...],
    "qc_flags": {
      "english_residual": false,
      "headline_prefix_issue": false,
      "headline_too_long": false,
      "headline_english_issue": false,
      "formal_structure": false,
      "missing_region_tag": false
    }
  }
}
```
