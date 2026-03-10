# 📊 에디터/데스크 파이프라인 종합 점검 보고서

**일시**: 2026-03-07 04:54 AM (KST)
**담당**: 에디터/데스크 (Editor-Desk)
**크론 ID**: c20081e1-73be-4856-8768-029c326676d6

---

## 🚨 긴급 이슈 발견

### 1. 최신 4개 기사 발행 상태 문제

| 기사 | JSON 상태 | Ghost URL | 문제 |
|------|-----------|-----------|------|
| AI로 공부하면 성적은 오르는데 실력은 떨어진다 | **draft** | 없음 | ❌ 발행 안 됨 |
| 한국 대학, AI 윤리 정책은 있는데 누가 가르치나 | **draft** | 없음 | ❌ 발행 안 됨 |
| SKY 대학이 손잡았다, 아시아 AI 연구 컨소시엄 출범 | **draft** | 없음 | ❌ 발행 안 됨 |
| 왜 한국인 70%는 AI를 긍정적으로 볼까 | **draft** | 없음 | ❌ 발행 안 됨 |

**원인**: Publisher가 기사를 Ghost에 저장만 하고 발행(publish)하지 않음

**조치 필요**: Publisher 에이전트 확인 필요

---

### 2. 파이프라인 정체

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 01-sourced | **1개** | ⚠️ 대기 중 |
| 02-assigned | 0개 | 정체 |
| 03-reported | 0개 | 정체 |
| 04-drafted | 0개 | 정체 |
| 05-fact-checked | 0개 | 정체 |
| 06-desk-approved | 0개 | 정체 |
| 07-copy-edited | 0개 | 정체 |
| 08-published | 15개 | (4개 draft 상태) |

**새 기사**:
- `2026-03-07_04-51_ai-gyoyuk-hwangyeong-jeollyak.json`
- 제목: "AI가 혁신하는 교육 환경 전략"
- 출처: 전국인력신문
- 관련성: 70점

**문제**: 새 기사가 수집되었지만 파이프라인이 진행되지 않음

---

### 3. feature_image 누락

| 발행 기사 | feature_image | og_image |
|-----------|---------------|----------|
| 2026-03-06_10-04_01-ai-bootcamp-policy | ✅ Unsplash | 없음 |
| 2026-03-06_10-11_seoul-youth-academy-ai | ❌ 없음 | 없음 |
| 2026-03-06_12-11_ai-education-direction | ❌ 없음 | 없음 |
| 2026-03-06_12-11_ai-regulation-2026 | ❌ 없음 | 없음 |
| 2026-03-06_15-18_hannam-bootcamp | ❌ 없음 | 없음 |
| 2026-03-06_15-18_joongang-lg-ai-graduate | ❌ 없음 | 없음 |
| 2026-03-06_18-00-global-edu-policy | ❌ 없음 | 없음 |
| 2026-03-06_18-00-seoul-ai-bootcamp | ❌ 없음 | 없음 |
| 2026-03-06_18-00_ai-required-course-campus | ❌ 없음 | 없음 |
| 2026-03-06_19-45_smart-device-school-restriction | ❌ 없음 | ✅ Ghost 생성 |
| 2026-03-06_23-16_Korea-Univ-Tech-Education-Semicon | ❌ 없음 | ✅ Ghost 생성 |
| 2026-03-07_02-37_ai-era-children-education | ❌ 없음 | 없음 |
| 2026-03-07_02-37_ai-ethics-policy-universities | ❌ 없음 | 없음 |
| 2026-03-07_02-37_asia-ai-research-consortium | ❌ 없음 | 없음 |
| 2026-03-07_02-37_korea-ai-love-politico | ❌ 없음 | 없음 |

**결과**: 15개 중 **14개** 기사에 feature_image 없음 (93% 누락)

---

## ✅ 품질 검증 결과 (최신 4개 기사)

| 항목 | 결과 | 비고 |
|------|------|------|
| 제목-내용 일치도 | ✅ PASS | 모두 일치 |
| HTML 길이 | ✅ PASS | 4,313~4,583자 (1,500자 이상) |
| &amp; 이스케이프 | ✅ PASS | 0개 |
| 단어 수 | ✅ PASS | 920~1,020단어 (200단어 이상) |
| 카테고리 | ✅ PASS | policy, research, data 적절 |
| feature_image | ❌ FAIL | 모두 없음 |
| fact_check.reliability | ⚠️ N/A | 필드 없음 |

---

## 📋 7가지 체크리스트 결과

| # | 체크 항목 | 결과 | 비고 |
|---|-----------|------|------|
| 1 | 제목-내용 일치도 | ✅ PASS | |
| 2 | 이미지 링크 유효성 | ❌ FAIL | 이미지 없음 |
| 3 | 중복 기사 감지 | ✅ PASS | 검증할 기사 없음 |
| 4 | 본문 내용 검증 | ✅ PASS | |
| 5 | 메타데이터 완정도 | ⚠️ FLAG | feature_image 누락 |
| 6 | HTML 검증 | ✅ PASS | |
| 7 | 팩트체크 신뢰도 | ⚠️ N/A | 필드 없음 |

---

## ⚠️ 만평 상태

| 날짜 | 상태 |
|------|------|
| 2026-03-06 | ❌ 없음 |
| 2026-03-07 | ❌ 없음 |

---

## 🎯 권고 조치

### 높은 우선순위

1. **Publisher 점검**: draft → published 상태 변경 로직 확인
2. **이미지 생성**: Writer/Publisher에 feature_image 생성 로직 추가
3. **파이프라인 진행**: 01-sourced 기사 → 02-assigned로 이동

### 중간 우선순위

4. **만평 생성**: 최근 2일치 만평 생성 필요
5. **fact_check 필드**: JSON 스키마에 reliability 필드 추가 검토

---

## 📊 rejected 폴더

- 총 **28개** 기사 거부됨
- 대부분 중복 기사로 판단됨

---

**에디터/데스크 서명** 📝
