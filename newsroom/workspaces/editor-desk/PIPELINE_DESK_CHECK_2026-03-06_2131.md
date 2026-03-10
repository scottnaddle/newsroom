# 📋 파이프라인 데스크 점검 리포트

**점검 시간**: 2026-03-06 21:31 KST  
**담당**: 에디터/데스크

---

## 📊 파이프라인 현황

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 00-intake | 0 | ✅ |
| 01-sourced | 1 | ⚠️ 대기 중 |
| 02-assigned | 0 | - |
| 03-reported | 0 | - |
| 04-drafted | 0 | - |
| 05-fact-checked | 0 | - |
| 06-desk-approved | 0 | - |
| 07-copy-edited | 0 | - |
| 08-published | 9 | ✅ |
| rejected | 32 | - |

---

## ⚠️ 발견된 문제

### 1. 파이프라인 정체 (01-sourced)
- **기사**: `2026-03-06_19-45_smart-device-school-restriction.json`
- **제목**: "새학기 개학 앞두고 학교 내 스마트기기 사용 법률로 제한"
- **문제**: Source Collector에서 수집되었으나 Reporter에게 할당되지 않음
- **조치 필요**: 02-assigned로 이동 후 Reporter 처리

### 2. 🚨 발행 기사 이미지 누락 (심각)
- **영향**: 9개 중 8개 기사 (89%)
- **문제**: `feature_image` 필드가 비어있음
- **영향도**: Ghost 블로그에서 카드 이미지 없음 → 클릭률 저하

| 기사 | feature_image |
|------|---------------|
| 2026-03-06_10-04_01-ai-bootcamp-policy.json | ✅ 있음 (HTTP 200) |
| 2026-03-06_10-11_seoul-youth-academy-ai.json | ❌ 없음 |
| 2026-03-06_12-11_ai-education-direction.json | ❌ 없음 |
| 2026-03-06_12-11_ai-regulation-2026.json | ❌ 없음 |
| 2026-03-06_15-18_hannam-bootcamp.json | ❌ 없음 |
| 2026-03-06_15-18_joongang-lg-ai-graduate.json | ❌ 없음 |
| 2026-03-06_18-00-global-edu-policy.json | ❌ 없음 |
| 2026-03-06_18-00-seoul-ai-bootcamp.json | ❌ 없음 |
| 2026-03-06_18-00_ai-required-course-campus.json | ❌ 없음 |

### 3. ✅ 정상 항목
- **&amp; 이스케이프**: 모든 기사에서 없음 (좋음)
- **HTML 길이**: 모든 기사 3700자 이상 (좋음)
- **단어 수**: 모든 기사 870단어 이상 (좋음)
- **중복 기사**: 06-desk-approved 비어있어 검증 불필요

---

## 📋 권고 조치

### 즉시 조치
1. **파이프라인 흐름 재개**
   - 01-sourced 기사를 02-assigned로 이동
   - Reporter 에이전트 트리거 필요

2. **Publisher 로직 점검**
   - `feature_image` 생성 로직 확인
   - Unsplash 이미지 검색 실패 시 fallback 로직 추가

### 추후 조치
- 이미지 없이 발행된 8개 기사에 대해 retroactive 이미지 추가 검토
- Ghost Admin API로 feature_image 업데이트

---

## 📈 통계 요약

- **총 수집**: 1개 (대기 중)
- **총 발행**: 9개
- **총 거부**: 32개
- **이미지 누락률**: 89% (8/9)
- **품질 이슈**: 없음 (HTML, 이스케이프 정상)
