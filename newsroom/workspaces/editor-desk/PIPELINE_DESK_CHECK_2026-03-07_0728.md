# 📋 Editor-Desk 파이프라인 점검 리포트
**일시**: 2026-03-07 07:28 KST  
**담당**: 에디터/데스크 (cron 30분)

---

## ✅ 파이프라인 전체 현황

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 00-intake | 0 | ✅ 비어있음 |
| 01-sourced | 4 | 🔵 **대기 중 (병목)** |
| 02-assigned | 0 | ⚠️ 비어있음 |
| 03-reported | 0 | ⚠️ 비어있음 |
| 04-drafted | 0 | ✅ 비어있음 |
| 05-fact-checked | 0 | ✅ 비어있음 |
| 06-desk-approved | 0 | ✅ 비어있음 |
| 07-copy-edited | 0 | ✅ 비어있음 |
| 08-published | 15 | ⚠️ 4개 draft 상태 |
| rejected | 40 | 📁 |

---

## 🔍 7가지 품질 검증 결과

### ✅ 1. 제목-내용 일치도
- **검증 대상**: 05-fact-checked 비어있음 → 검증 불가
- **상태**: N/A (검사할 기사 없음)

### ✅ 2. 이미지 링크 유효성
- **검증 대상**: 05-fact-checked 비어있음 → 검증 불가
- **상태**: N/A (검사할 기사 없음)

### ✅ 3. 중복 기사 감지
- **스크립트 실행 결과**: 검증 대상 0개
- **자동 KILL**: 0개
- **상태**: PASS

### ✅ 4. 본문 내용 검증
- **검증 대상**: 05-fact-checked 비어있음 → 검증 불가
- **상태**: N/A (검사할 기사 없음)

### ✅ 5. 메타데이터 완정도
- **검증 대상**: 05-fact-checked 비어있음 → 검증 불가
- **상태**: N/A (검사할 기사 없음)

### ✅ 6. HTML 검증
- **검증 대상**: 05-fact-checked 비어있음 → 검증 불가
- **상태**: N/A (검사할 기사 없음)

### ✅ 7. 팩트체크 신뢰도
- **검증 대상**: 05-fact-checked 비어있음 → 검증 불가
- **상태**: N/A (검사할 기사 없음)

---

## 🚨 주요 이슈

### [긴급] 파이프라인 병목 - Assigner 미작동

**현상**: 4개 기사가 01-sourced에 머물러 있음
- `ai-career-counseling-paper-kci` (05:25 수집)
- `daegu-ai-bootcamp` (06:25 수집)
- `ai-hyeogsin-gyeongjaeng-hangug-daeeung` (06:55 수집)
- `ai-ro-byeonhwa-hangug-gyoyug-2026` (06:55 수집)

**원인 추정**: Assigner 에이전트가 실행되지 않거나 02-assigned로 이동하지 않음

**영향**: 신규 기사가 발행 파이프라인에 진입하지 못함

**조치 필요**: Assigner 에이전트 실행 확인

---

### [높음] Ghost Draft 기사 4개 발행 대기

| 기사 | Ghost ID | 상태 |
|------|----------|------|
| AI로 공부하면 성적은 오르는데 실력은 떨어진다 | 69ab1733ff4fbf0001ab7074 | draft |
| 한국 대학, AI 윤리 정책은 있는데 누가 가르치나 | 69ab173aff4fbf0001ab707e | draft |
| SKY 대학이 손잡았다, 아시아 AI 연구 컨소시엄 출범 | 69ab1740ff4fbf0001ab708a | draft |
| 왜 한국인 70%는 AI를 긍정적으로 볼까 | 69ab1745ff4fbf0001ab709a | draft |

**조치**: Ghost Admin에서 draft → published 변경 필요

---

## 📊 08-published 발행 현황

| 상태 | 기사 수 | 비고 |
|------|---------|------|
| **published** | 11 | ✅ Ghost에 발행 완료 |
| **draft** | 4 | ⚠️ 발행 대기 |

### 발행된 기사 (11개)
1. 교육부 AI 인재양성 37개 대학
2. 성동구 한반도 미래전략 아카데미
3. AI 교육 프롬프트 vs 사고력
4. 2026년 AI 규제 원년
5. 한남대 AI 부트캠프
6. LG AI대학원 출범
7. UNESCO 2026 교육 대전환
8. 서울시립대 AI 부트캠프
9. 20개 대학 AI 필수과목
10. 스마트폰 사용 금지
11. 한기대 계약학과

---

## 🔵 01-sourced 대기 기사 상세

| ID | 제목 | 소스 | 관련성 | 수집 시간 |
|----|------|------|--------|-----------|
| ai-career-counseling-paper-kci | 한국기술교육대학교 AI 진로상담 논문 | 아시아경제 | 65 | 05:25 |
| daegu-ai-bootcamp | 대구시 교육부 부트캠프 공모 선정 | 시사저널 | 70 | 06:25 |
| ai-hyeogsin-gyeongjaeng-hangug-daeeung | AI 혁신 경쟁 한국 대응 전략 | 전국인력신문 | 68 | 06:55 |
| ai-ro-byeonhwa-hangug-gyoyug-2026 | AI로 변화하는 한국 교육 2026 | 환경감시일보 | 72 | 06:55 |

**상태**: Assigner 실행 시 02-assigned로 이동 예정

---

## 📈 요약

| 항목 | 수치 |
|------|------|
| 검증 대상 기사 | 0개 (05-fact-checked 비어있음) |
| 중복 검사 KILL | 0개 |
| Ghost 발행 완료 | 11개 |
| Ghost draft 대기 | 4개 |
| 파이프라인 대기 | 4개 (01-sourced) |
| rejected 누적 | 40개 |

---

## 🔄 파이프라인 건전성

| 에이전트 | 상태 | 비고 |
|----------|------|------|
| Source Collector | ✅ 정상 | 4개 수집 |
| Assigner | ❌ **중단** | 02 비어있음 |
| Reporter | ⚠️ 대기 | 03 비어있음 |
| Writer | ⚠️ 대기 | 04 비어있음 |
| Fact-checker | ⚠️ 대기 | 05 비어있음 |
| Editor-Desk | ⚠️ 대기 | 06 비어있음 |
| Copy-Editor | ⚠️ 대기 | 07 비어있음 |
| Publisher | ⚠️ 부분 | 4개 draft |

---

## 🎯 권고 조치 (우선순위)

### 1. [긴급] Assigner 에이전트 실행
- 01-sourced의 4개 기사를 02-assigned로 이동
- 이후 파이프라인 자동 진행 가능

### 2. [높음] Ghost Draft → Published 전환
- 4개 기사 Ghost Admin에서 발행
- URL: https://ubion.ghost.io/ghost/

### 3. [낮음] feature_image 생성
- 12개 기사 썸네일 이미지 누락
- SNS 공유 시 미리보기 이미지 없음

---

_에디터/데스크 자동 점검 완료_
_다음 점검: 30분 후_
