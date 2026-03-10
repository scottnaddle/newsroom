# Editor/Desk 파이프라인 점검 리포트
**일시**: 2026-03-07 14:43 (KST)
**담당**: Editor-Desk (에디터/데스크)

---

## 📊 파이프라인 상태 요약

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 00-intake | 0 | ✅ 비어있음 |
| 01-sourced | 0 | ✅ 비어있음 |
| 02-assigned | 0 | ✅ 비어있음 |
| 03-reported | 0 | ✅ 비어있음 |
| 04-drafted | 0 | ✅ 비어있음 |
| 05-fact-checked | 0 | ✅ 비어있음 |
| 06-desk-approved | 0 | ✅ 비어있음 |
| 07-copy-edited | 0 | ✅ 비어있음 |
| **08-published** | **18** | ✅ 발행 완료 |
| rejected | 43 | 🗑️ 폐기 |

---

## ✅ 체크리스트 검증 결과

### 1. 제목-내용 일치도 검사
- **상태**: ✅ PASS
- 발행된 18개 기사 모두 제목과 본문 내용 일치

### 2. 이미지 링크 유효성
- **상태**: ⚠️ FLAG
- 이미지 없는 기사: **15개/18개 (83%)**
- 이미지 있는 기사: 3개 (스마트폰 금지, 한기대, LG AI대학원)
- **권고**: Publisher에서 feature_image 자동 생성 로직 점검 필요

### 3. 중복 기사 감지
- **상태**: ✅ PASS
- 자동 KILL 대상 없음
- 중복 검증 스크립트 실행 완료

### 4. 본문 내용 검증
- **상태**: ✅ PASS
- 모든 기사 500자 이상 본문 확보
- 단어 수: 870~1247단어 (기준 200단어 이상 충족)
- HTML 길이: 3731~5991자 (기준 1500자 이상 충족)

### 5. 메타데이터 완정도
- **상태**: ⚠️ FLAG
- feature_image 누락 15건
- 기타 메타데이터 (headline, subheadline) 정상

### 6. HTML 검증
- **상태**: ✅ PASS
- `&amp;` escape 문제 없음 (0개 파일)
- `/tmp` 경로 이미지 없음

### 7. 팩트체크 신뢰도
- **상태**: ✅ PASS
- 모든 기사 fact-checked 단계 통과 후 발행

---

## 🚨 발견된 이슈

### [중간] 이미지 누락 (15건)
발행된 기사 중 83%가 feature_image 없음. Ghost 발행 시 기본 이미지 사용됨.

**영향받는 기사**:
```
2026-03-06_10-04_01-ai-bootcamp-policy.json
2026-03-06_10-11_seoul-youth-academy-ai.json
2026-03-06_12-11_ai-education-direction.json
2026-03-06_12-11_ai-regulation-2026.json
2026-03-06_15-18_hannam-bootcamp.json
2026-03-06_15-18_joongang-lg-ai-graduate.json
2026-03-06_18-00-global-edu-policy.json
2026-03-06_18-00-seoul-ai-bootcamp.json
2026-03-06_18-00_ai-required-course-campus.json
2026-03-07_02-37_ai-era-children-education.json
2026-03-07_02-37_ai-ethics-policy-universities.json
2026-03-07_02-37_asia-ai-research-consortium.json
2026-03-07_02-37_korea-ai-love-politico.json
2026-03-07_06-55_ai-hyeogsin-gyeongjaeng-hangug-daeeung.json
2026-03-07_11-53_global-education-policy-paradigm-shift.json
```

**권고 조치**: Publisher 로직에서 Unsplash 자동 검색 실패 시 재시도 또는 기본 이미지 할당

---

## 📈 파이프라인 흐름 상태

```
현재 상태: 유휴 (Idle)
├── 대기 중인 기사: 0개
├── 처리 중인 기사: 0개
├── 발행 완료: 18개
└── 폐기: 43개

처리율: 29.5% (18 / 61)
```

---

## 🎯 다음 단계 권고사항

1. **Source Collector 실행**: 새로운 뉴스 수집 필요
2. **Publisher 로직 점검**: feature_image 자동 생성 실패 원인 분석
3. **이미지 보완**: 발행된 15개 기사에 대해 Unsplash 이미지 수동 추가 검토

---

## ✅ 종합 평가

| 항목 | 점수 | 비고 |
|------|------|------|
| 제목-내용 일치 | 100% | ✅ |
| 이미지 완정도 | 17% | ⚠️ 개선 필요 |
| 중복 검증 | 100% | ✅ |
| 본문 품질 | 100% | ✅ |
| HTML 품질 | 100% | ✅ |
| **전체 점수** | **83%** | 양호 |

**데스크 결정**: 파이프라인 정상, 이미지 생성 로직 개선 필요

---

_생성 시간: 2026-03-07 14:43:00_
