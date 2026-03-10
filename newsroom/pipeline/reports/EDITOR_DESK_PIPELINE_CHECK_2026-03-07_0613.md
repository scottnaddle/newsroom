# 📋 Editor-Desk 파이프라인 점검 리포트
**일시**: 2026-03-07 06:13 KST  
**담당**: 에디터/데스크 (cron 30분)

---

## 🚨 긴급 이슈

### 1. 발행 파이프라인 중단
- **08-published 폴더**: 16개 기사 존재
- **실제 Ghost 발행**: 0개 (모두 published=null, ghost_id=null)
- **원인**: Publisher 에이전트가 Ghost 발행을 완료하지 않음

### 2. 빈 내용 기사 발견
- `2026-03-07_04-51_ai-gyoyuk-hwangyeong-jeollyak.json`
- html_length=0 → 내용 없음
- **조치**: rejected로 이동 필요

---

## 📊 파이프라인 현황

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 00-intake | 0 | ✅ |
| 01-sourced | 1 | 🔵 대기 |
| 02-assigned | 0 | ✅ |
| 03-reported | 0 | ✅ |
| 04-drafted | 0 | ✅ |
| 05-fact-checked | 0 | ✅ |
| 06-desk-approved | 0 | ✅ |
| 07-copy-edited | 0 | ✅ |
| 08-published | 16 | 🚨 **미발행** |
| rejected | 39 | 📁 |

---

## 🔍 08-published 상세 분석

### 기사별 현황

| ID | 제목 | 이미지 | HTML길이 | 품질점수 | 상태 |
|----|------|--------|----------|----------|------|
| 01-ai-bootcamp-policy | 교육부 AI 인재양성 37개 대학 | ✅ | 5991 | N/A | 미발행 |
| seoul-youth-academy-ai | 성동구 한반도 미래전략 아카데미 | ❌ | 3895 | N/A | 미발행 |
| ai-education-direction | AI 교육 프롬프트 vs 사고력 | ❌ | 4199 | N/A | 미발행 |
| ai-regulation-2026 | 2026년 AI 규제 원년 | ❌ | 4234 | N/A | 미발행 |
| hannam-bootcamp | 한남대 AI 부트캠프 | ❌ | 4158 | N/A | 미발행 |
| joongang-lg-ai-graduate | LG AI대학원 출범 | ❌ | 4177 | N/A | 미발행 |
| global-edu-policy | UNESCO 2026 교육 대전환 | ❌ | 3731 | N/A | 미발행 |
| seoul-ai-bootcamp | 서울시립대 AI 부트캠프 | ❌ | 3826 | N/A | 미발행 |
| ai-required-course-campus | 20개 대학 AI 필수과목 | ❌ | 4253 | N/A | 미발행 |
| smart-device-school-restriction | 스마트폰 사용 금지 | ❌ | 4266 | N/A | 미발행 |
| Korea-Univ-Tech-Education-Semicon | 한기대 계약학과 | ❌ | 4284 | N/A | 미발행 |
| ai-era-children-education | AI로 공부하면 성적 오르는데 | ❌ | 4313 | N/A | 미발행 |
| ai-ethics-policy-universities | 한국 대학 AI 윤리 정책 | ❌ | 4478 | N/A | 미발행 |
| asia-ai-research-consortium | SKY 대학 AI 컨소시엄 | ❌ | 4583 | N/A | 미발행 |
| korea-ai-love-politico | 한국인 70% AI 긍정 | ❌ | 4495 | N/A | 미발행 |
| ai-gyoyuk-hwangyeong-jeollyak | AI 교사 70% 업무 감소 | ❌ | **0** | N/A | **내용없음** |

### 통계
- **이미지 있음**: 1/16 (6%)
- **평균 HTML 길이**: 3,811자 (0 제외)
- **품질 리포트 있음**: 0/16 (0%)

---

## 🔵 대기 중인 기사

### 01-sourced: `202603070525-kci-ai-career`
- **제목**: 한국기술교육대학교 황현아 교수 AI 진로상담 논문 KCI 등재
- **소스**: The Asia Business Daily
- **관련성**: 65점
- **태그**: research, higher-ed, ai-counseling
- **상태**: 할당 대기 중
- **권고**: 파이프라인 복구 후 02-assigned로 진행

---

## 🚨 권고 조치 (우선순위)

### [긴급] Publisher 재실행
- 16개 기사 모두 Ghost에 발행되지 않음
- Publisher 에이전트 로직 점검 필요
- Ghost API 연결 상태 확인

### [높음] 빈 내용 기사 처리
```bash
mv 08-published/2026-03-07_04-51_ai-gyoyuk-hwangyeong-jeollyak.json rejected/
```

### [높음] 이미지 생성 누락
- 15개 기사에 feature_image 없음
- Publisher에서 Unsplash 이미지 생성 로직 확인

### [중간] 품질 리포트 누락
- 16개 기사 모두 quality_report 없음
- Fact-checker 재실행 권고

---

## 📈 일일 요약

| 항목 | 수치 |
|------|------|
| 검증 대상 기사 | 0개 (05-fact-checked 비어있음) |
| 발행된 기사 | 0개 (실제) |
| 미발행 기사 | 16개 |
| rejected 기사 | 39개 |
| 대기 중 기사 | 1개 |
| 중복 KILL | 0개 |

---

## 🔄 다음 단계

1. **Publisher 에이전트 실행** → 16개 기사 Ghost 발행
2. **빈 내용 기사 rejected 이동**
3. **01-sourced 기사 파이프라인 진행**

---

_에디터/데스크 자동 점검 완료_
