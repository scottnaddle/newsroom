# 🗞️ 에디터/데스크 파이프라인 점검 리포트
**일시**: 2026-03-08 01:15 (KST) — 일요일 심야

---

## 📊 파이프라인 현황

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 00-intake | 0 | ✅ |
| 01-sourced | 0 | ✅ |
| 02-assigned | 0 | ✅ |
| 03-reported | 0 | ✅ |
| 04-drafted | 0 | ✅ |
| 05-fact-checked | 0 | ✅ |
| 06-desk-approved | 0 | ✅ |
| 07-copy-edited | 0 (리포트만 존재) | ✅ |
| 08-published | 19 (누적) | ✅ |
| rejected | 30+ (누적) | ✅ |

### 다이제스트 파이프라인

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 01-sourced | **2** (신규 수집) | 📋 대기 중 |
| 02-drafted | 0 | ✅ |
| 03-published | 144 (누적) | ✅ |

**01-sourced 대기 기사:**
1. `anthropic-openai-pentagon-military-ai` — NYT: Anthropic/OpenAI의 펜타곤 관계
2. `nvidia-h200-shift-anthropic-pentagon-talks` — Yahoo Finance: Nvidia H200 생산 중단, Anthropic 펜타곤 협상

→ 다음 digest-writer 크론에서 처리 예정

---

## ✅ Ghost 발행 상태 확인

최근 발행된 5개 기사 Ghost Admin API 직접 확인:

| 발행 시간 (UTC) | 제목 | HTTP |
|---------|------|------|
| 2026-03-07T15:41 | OpenAI, 자체 코드 호스팅 플랫폼 개발… | 200 ✅ |
| 2026-03-07T15:41 | 메타, AI 조직 대대적 개편… | 200 ✅ |
| 2026-03-07T14:37 | 영국 상원, AI 학습용 저작물 라이선싱… | ✅ |
| 2026-03-07T14:37 | 뉴욕주, AI 챗봇의 전문직 조언 금지… | ✅ |
| 2026-03-07T13:35 | AI 반도체 주간 동향… | ✅ |

---

## ✅ 품질 검증 (08-published 기사 스팟 체크)

2026-03-07 발행 기사 8건 검증:

| 항목 | 결과 |
|------|------|
| HTML 길이 | 모두 4,300~5,400자 ✅ (기준: 1,500자 이상) |
| 단어 수 | 모두 490~680단어 ✅ (기준: 200단어 이상) |
| &amp; 이스케이프 | 0건 ✅ |
| AI 배지(🤖) | 0건 ✅ |
| Feature image | **전체 MISSING** ⚠️ (기존 이슈, Publisher 미구현) |
| Fact-check score | 4건 85점, 4건 N/A |

---

## ✅ 중복 검증

```
node check-duplicates-before-approval.js
→ 검증 대상: 0개 (06-desk-approved 비어있음)
→ KILL 대상: 없음
```

---

## 🟡 시스템 상태

| 항목 | 상태 |
|------|------|
| Ghost (insight.ubion.global) | ✅ HTTP 200 |
| Ghost Admin API | ✅ 정상 응답 |
| 디스크 | ✅ 12G/145G (8%) |
| 메인 파이프라인 | ✅ 전 단계 비어있음 |
| 다이제스트 파이프라인 | 📋 01-sourced 2건 대기 |

---

## ⚠️ 지속 추적 이슈

1. **feature_image 누락** (심각도: 중간) — 08-published 전체 기사에 feature_image 없음. Publisher 이미지 로직 미구현 상태 지속.
2. **리포트 파일 누적** (심각도: 낮음) — pipeline/ 디렉토리에 EDITOR_DESK 리포트 80+개. 아카이브 권고.
3. **Fact-check score 누락** (심각도: 낮음) — 최근 기사 4건에 score 없음 (팩트체크 단계 스킵 가능성).

---

## 🟢 결론

**파이프라인 정상 운영 중.**
- 일요일 심야 — 메인 파이프라인 idle 상태 (정상)
- 다이제스트 01-sourced에 신규 2건 대기 (자동 처리 예정)
- Ghost 발행 정상 확인
- 긴급 개입 필요 사항 **없음**
