# 📋 Editor-Desk 파이프라인 점검 리포트
**일시**: 2026-03-07 06:43 KST  
**담당**: 에디터/데스크 (cron 30분)

---

## ✅ 파이프라인 전체 현황

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 00-intake | 0 | ✅ 비어있음 |
| 01-sourced | 2 | 🔵 대기 중 |
| 02-assigned | 0 | ✅ 비어있음 |
| 03-reported | 0 | ✅ 비어있음 |
| 04-drafted | 0 | ✅ 비어있음 |
| 05-fact-checked | 0 | ✅ 비어있음 |
| 06-desk-approved | 0 | ✅ 비어있음 |
| 07-copy-edited | 0 | ✅ 비어있음 |
| 08-published | 15 | ⚠️ 4개 draft 상태 |
| rejected | 40 | 📁 (빈 내용 1개 추가됨) |

---

## 📊 08-published 상세 분석

### 발행 상태

| 상태 | 기사 수 | 비고 |
|------|---------|------|
| **published** | 11 | ✅ Ghost에 발행 완료 |
| **draft** | 4 | ⚠️ Ghost draft 상태 |

### 기사별 상세

| ID | 제목 | Ghost 상태 | 이미지 | HTML 길이 | 품질리포트 |
|----|------|-----------|--------|-----------|-----------|
| 01-ai-bootcamp-policy | 교육부 AI 인재양성 37개 대학 | ✅ published | ✅ Unsplash | 5,991자 | ✅ 있음 |
| seoul-youth-academy-ai | 성동구 한반도 미래전략 아카데미 | ✅ published | ❌ 없음 | 3,895자 | ✅ 있음 |
| ai-education-direction | AI 교육 프롬프트 vs 사고력 | ✅ published | ❌ 없음 | 4,199자 | ✅ 있음 |
| ai-regulation-2026 | 2026년 AI 규제 원년 | ✅ published | ❌ 없음 | 4,234자 | ✅ 있음 |
| hannam-bootcamp | 한남대 AI 부트캠프 | ✅ published | ❌ 없음 | 4,158자 | ✅ 있음 |
| joongang-lg-ai-graduate | LG AI대학원 출범 | ✅ published | ❌ 없음 | 4,177자 | ✅ 있음 |
| global-edu-policy | UNESCO 2026 교육 대전환 | ✅ published | ❌ 없음 | 3,731자 | ✅ 있음 |
| seoul-ai-bootcamp | 서울시립대 AI 부트캠프 | ✅ published | ❌ 없음 | 3,826자 | ✅ 있음 |
| ai-required-course-campus | 20개 대학 AI 필수과목 | ✅ published | ❌ 없음 | 4,253자 | ✅ 있음 |
| smart-device-school-restriction | 스마트폰 사용 금지 | ✅ published | ❌ 없음 | 4,266자 | ✅ 있음 |
| Korea-Univ-Tech-Education-Semicon | 한기대 계약학과 | ✅ published | ❌ 없음 | 4,284자 | ❌ 없음 |
| ai-era-children-education | AI로 공부하면 성적 오르는데 | ⚠️ draft | ❌ 없음 | 4,313자 | ❌ 없음 |
| ai-ethics-policy-universities | 한국 대학 AI 윤리 정책 | ⚠️ draft | ❌ 없음 | 4,478자 | ❌ 없음 |
| asia-ai-research-consortium | SKY 대학 AI 컨소시엄 | ⚠️ draft | ❌ 없음 | 4,583자 | ❌ 없음 |
| korea-ai-love-politico | 한국인 70% AI 긍정 | ⚠️ draft | ❌ 없음 | 4,495자 | ❌ 없음 |

---

## 🔍 품질 검증 결과 (7가지 체크리스트)

### ✅ 1. 제목-내용 일치도
- **결과**: PASS
- 모든 기사의 제목과 리드 문단이 일치함

### ✅ 2. 이미지 링크 유효성
- **결과**: 1개 유효, 14개 누락
- 유일한 이미지 (Unsplash) HTTP 200 확인됨
- **⚠️ 14개 기사에 feature_image 없음**

### ✅ 3. 중복 기사 감지
- **결과**: PASS
- 중복 스크립트 실행 결과: KILL 0개, FLAG 0개

### ✅ 4. 본문 내용 검증
- **결과**: PASS
- 모든 기사 HTML 길이 3,731~5,991자 (1,500자 이상 충족)
- 빈 내용 기사 1개 rejected로 이동 완료

### ✅ 5. 메타데이터 완정도
- **결과**: PARTIAL
- headline, subheadline: ✅ 모두 있음
- feature_image: ❌ 14개 누락
- meta_title, meta_description: ✅ 있음

### ✅ 6. HTML 검증
- **결과**: PASS
- `&amp;` 이스케이프: 0개 (모든 기사 정상)
- AI 배지 제거: ✅ 확인됨

### ✅ 7. 팩트체크 신뢰도
- **결과**: PARTIAL
- 10개 기사: quality_report 있음 (overall_confidence 70-83)
- 5개 기사: quality_report 없음

---

## 🔵 대기 중인 기사 (01-sourced)

### 1. `202603070525-kci-ai-career`
- **제목**: 한국기술교육대학교 황현아 교수 AI 진로상담 논문 KCI 등재
- **소스**: The Asia Business Daily
- **관련성**: 65점
- **태그**: research, higher-ed, ai-counseling
- **상태**: 할당 대기 중

### 2. `20260307-0625-daegu-ai-bootcamp`
- **제목**: 대구시, 교육부 인재양성 부트캠프 공모에 경북대·계명대 AI·로봇 분야 선정
- **소스**: 시사저널
- **관련성**: 70점
- **태그**: policy, university, talent-development
- **상태**: 할당 대기 중

---

## 🚨 권고 조치 (우선순위)

### [높음] 이미지 생성 누락
- **문제**: 14개 기사에 feature_image 없음
- **영향**: SNS 공유 시 썸네일 없음
- **조치**: Publisher에서 Unsplash 이미지 생성 로직 실행 필요

### [중간] Draft 기사 발행
- **대상**: 4개 기사 (ai-era-children-education, ai-ethics-policy-universities, asia-ai-research-consortium, korea-ai-love-politico)
- **조치**: Ghost에서 draft → published로 변경

### [중간] 품질 리포트 누락
- **대상**: 5개 기사
- **조치**: Fact-checker 재실행 권고

### [낮음] 신규 기사 파이프라인 진행
- **대상**: 2개 기사 (01-sourced)
- **조치**: Assigner 에이전트 실행 시 자동 처리

---

## 📈 일일 요약

| 항목 | 수치 |
|------|------|
| 검증 대상 기사 | 0개 (05-fact-checked 비어있음) |
| Ghost 발행 완료 | 11개 |
| Ghost draft 상태 | 4개 |
| 이미지 누락 | 14개 |
| rejected 기사 | 40개 |
| 대기 중인 기사 | 2개 |
| 중복 KILL | 0개 |
| HTML 이스케이프 문제 | 0개 |

---

## 🔄 파이프라인 건전성

| 항목 | 상태 |
|------|------|
| Source Collector | ✅ 정상 (2개 수집) |
| Assigner | ✅ 정상 (02 비어있음 = 처리 완료) |
| Reporter | ✅ 정상 |
| Writer | ✅ 정상 |
| Fact-checker | ⚠️ 5개 기사 리포트 누락 |
| Publisher | ⚠️ 이미지 생성 누락, 4개 draft 상태 |
| Ghost 연동 | ✅ 정상 |

---

_에디터/데스크 자동 점검 완료_
