# 📋 Editor-Desk 파이프라인 점검 리포트
**일시**: 2026-03-07 06:58 KST  
**담당**: 에디터/데스크 (cron 30분)

---

## ✅ 파이프라인 전체 현황

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 00-intake | 0 | ✅ 비어있음 |
| 01-sourced | 4 | 🔵 대기 중 (+2新增) |
| 02-assigned | 0 | ✅ 비어있음 |
| 03-reported | 0 | ✅ 비어있음 |
| 04-drafted | 0 | ✅ 비어있음 |
| 05-fact-checked | 0 | ✅ 비어있음 |
| 06-desk-approved | 0 | ✅ 비어있음 |
| 07-copy-edited | 0 | ✅ 비어있음 |
| 08-published | 15 | ⚠️ 4개 draft 상태 |
| rejected | 40 | 📁 |

---

## 📊 08-published 상세 분석

### 발행 상태

| 상태 | 기사 수 | 비고 |
|------|---------|------|
| **published** | 11 | ✅ Ghost에 발행 완료 |
| **draft** | 4 | ⚠️ Ghost draft 상태 |

### 기사별 상세

| ID | 제목 | Ghost 상태 | feature_image | quality_report |
|----|------|-----------|---------------|----------------|
| 01-ai-bootcamp-policy | 교육부 AI 인재양성 37개 대학 | ✅ published | ✅ 있음 | ✅ 있음 (83점) |
| seoul-youth-academy-ai | 성동구 한반도 미래전략 아카데미 | ✅ published | ❌ 없음 | ✅ 있음 |
| ai-education-direction | AI 교육 프롬프트 vs 사고력 | ✅ published | ❌ 없음 | ✅ 있음 |
| ai-regulation-2026 | 2026년 AI 규제 원년 | ✅ published | ❌ 없음 | ✅ 있음 |
| hannam-bootcamp | 한남대 AI 부트캠프 | ✅ published | ❌ 없음 | ✅ 있음 |
| joongang-lg-ai-graduate | LG AI대학원 출범 | ✅ published | ❌ 없음 | ✅ 있음 |
| global-edu-policy | UNESCO 2026 교육 대전환 | ✅ published | ❌ 없음 | ✅ 있음 |
| seoul-ai-bootcamp | 서울시립대 AI 부트캠프 | ✅ published | ❌ 없음 | ✅ 있음 |
| ai-required-course-campus | 20개 대학 AI 필수과목 | ✅ published | ❌ 없음 | ✅ 있음 |
| smart-device-school-restriction | 스마트폰 사용 금지 | ✅ published | ✅ 있음 | ✅ 있음 |
| Korea-Univ-Tech-Education-Semicon | 한기대 계약학과 | ✅ published | ✅ 있음 | ❌ 없음 |
| **ai-era-children-education** | AI로 공부하면 성적은 오르는데 | ⚠️ draft | ❌ 없음 | ❌ 없음 |
| **ai-ethics-policy-universities** | 한국 대학 AI 윤리 정책 | ⚠️ draft | ❌ 없음 | ❌ 없음 |
| **asia-ai-research-consortium** | SKY 대학 AI 컨소시엄 | ⚠️ draft | ❌ 없음 | ❌ 없음 |
| **korea-ai-love-politico** | 한국인 70% AI 긍정 | ⚠️ draft | ❌ 없음 | ❌ 없음 |

---

## 🔍 7가지 품질 검증 결과

### ✅ 1. 제목-내용 일치도
- **결과**: PASS
- 모든 기사의 제목과 리드 문단이 일치함

### ⚠️ 2. 이미지 링크 유효성
- **결과**: PARTIAL
- **유효**: 3개 (ai-bootcamp-policy, smart-device, korea-univ)
- **누락**: 12개 (feature_image 없음)
- 권고: Unsplash 이미지 생성 필요

### ✅ 3. 중복 기사 감지
- **결과**: PASS
- 중복 스크립트 실행 결과: KILL 0개, FLAG 0개
- 05-fact-checked가 비어있어 검사 대상 없음

### ✅ 4. 본문 내용 검증
- **결과**: PASS
- 모든 기사 HTML 길이 3,731~5,991자 (1,500자 이상 충족)

### ⚠️ 5. 메타데이터 완정도
- **결과**: PARTIAL
- headline, subheadline: ✅ 모두 있음
- feature_image: ❌ 12개 누락
- meta_title, meta_description: ✅ 있음
- publish_result: ✅ 모두 있음 (Ghost ID 포함)

### ✅ 6. HTML 검증
- **결과**: PASS
- `&amp;` 이스케이프: 0개 (모든 기사 정상)
- AI 배지 제거: ✅ 확인됨

### ⚠️ 7. 팩트체크 신뢰도
- **결과**: PARTIAL
- 10개 기사: quality_report 있음 (overall_confidence 70-83)
- 5개 기사: quality_report 없음
  - Korea-Univ-Tech-Education-Semicon
  - ai-era-children-education (draft)
  - ai-ethics-policy-universities (draft)
  - asia-ai-research-consortium (draft)
  - korea-ai-love-politico (draft)

---

## 🔵 01-sourced 대기 기사 (4개)

| ID | 제목 | 소스 | 관련성 |
|----|------|------|--------|
| ai-career-counseling-paper-kci | 한국기술교육대학교 AI 진로상담 논문 | 아시아경제 | 65 |
| daegu-ai-bootcamp | 대구시 교육부 부트캠프 공모 선정 | 시사저널 | 70 |
| ai-hyeogsin-gyeongjaeng-hangug-daeeung | AI 혁신 경쟁 한국 대응 전략 | 전국인력신문 | 68 |
| ai-ro-byeonhwa-hangug-gyoyug-2026 | AI로 변화하는 한국 교육 2026 | 전국인력신문 | - |

**상태**: Assigner 에이전트 실행 시 02-assigned로 이동 예정

---

## 🚨 권고 조치 (우선순위)

### [높음] Ghost Draft → Published 전환
- **대상**: 4개 기사
  - ai-era-children-education (ID: 69ab1733ff4fbf0001ab7074)
  - ai-ethics-policy-universities (ID: 69ab173aff4fbf0001ab707e)
  - asia-ai-research-consortium (ID: 69ab1740ff4fbf0001ab708a)
  - korea-ai-love-politico (ID: 69ab1745ff4fbf0001ab709a)
- **조치**: Ghost Admin에서 draft → published 변경

### [중간] feature_image 생성
- **대상**: 12개 기사
- **조치**: Publisher에서 Unsplash 이미지 생성 로직 실행
- **영향**: SNS 공유 시 썸네일 없음

### [낮음] 품질 리포트 보완
- **대상**: 5개 기사
- **조치**: Fact-checker 재실행 권고

### [낮음] 신규 기사 파이프라인 진행
- **대상**: 4개 기사 (01-sourced)
- **조치**: Assigner 에이전트 실행 시 자동 처리

---

## 📈 요약

| 항목 | 수치 |
|------|------|
| 검증 대상 기사 | 0개 (05-fact-checked 비어있음) |
| Ghost 발행 완료 | 11개 |
| Ghost draft 상태 | 4개 |
| feature_image 누락 | 12개 |
| quality_report 누락 | 5개 |
| rejected 기사 | 40개 |
| 대기 중인 기사 | 4개 |
| 중복 KILL | 0개 |
| HTML 이스케이프 문제 | 0개 |

---

## 🔄 파이프라인 건전성

| 항목 | 상태 |
|------|------|
| Source Collector | ✅ 정상 (4개 수집) |
| Assigner | ⚠️ 02 비어있음 = 4개 대기 |
| Reporter | ✅ 정상 |
| Writer | ✅ 정상 |
| Fact-checker | ⚠️ 5개 기사 리포트 누락 |
| Publisher | ⚠️ 4개 draft 상태, 12개 이미지 누락 |
| Ghost 연동 | ✅ 정상 (API 응답 OK) |

---

_에디터/데스크 자동 점검 완료_
