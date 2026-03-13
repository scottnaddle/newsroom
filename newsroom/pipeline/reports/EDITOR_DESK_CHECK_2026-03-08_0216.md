# 🗞️ 에디터/데스크 파이프라인 점검 리포트
**일시**: 2026-03-08 02:16 (KST) — 일요일 심야

---

## 📊 파이프라인 현황

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 00-intake | 0 (reporter-status.md만) | ✅ |
| 01-sourced | 0 | ✅ |
| 02-assigned | 0 | ✅ |
| 03-reported | 0 | ✅ |
| 04-drafted | 0 | ✅ |
| 05-fact-checked | 0 | ✅ |
| 06-desk-approved | 0 | ✅ |
| 07-copy-edited | 0 (리포트만 존재) | ✅ |
| 08-published | 19 (누적) | ✅ |
| rejected | 44 (누적) | ✅ |

### 다이제스트 파이프라인

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 01-sourced | **2** (신규 수집) | 📋 대기 중 |
| 02-drafted | 0 | ✅ |
| 03-published | 146 (누적) | ✅ |

**01-sourced 대기 기사:**
1. `california-ai-laws-2026-guide` — Yaabot: 캘리포니아 AI 규제 프레임워크 (관련도 78)
2. `openai-anthropic-pentagon-rivalry-nyt` — NYT: OpenAI-Anthropic 펜타곤 경쟁 (관련도 92)

→ 다음 digest-writer 크론에서 자동 처리 예정

### 기타 파이프라인

| 항목 | 상태 |
|------|------|
| Cartoon | 최신: 2026-03-07 발행 완료 ✅ |
| Insight | 최신: 2026-03-07 발행 완료 ✅ |
| Papers | 5건 ✅ |
| Colloquy | 2건 ✅ |

---

## ✅ 중복 검증

```
node check-duplicates-before-approval.js
→ 검증 대상: 0개 (06-desk-approved 비어있음)
→ KILL 대상: 없음
```

---

## 🟢 시스템 상태

| 항목 | 상태 |
|------|------|
| Ghost (ubion.ghost.io) | ✅ HTTP 200 |
| 디스크 | ✅ 12G/145G (8%) |
| 메인 파이프라인 | ✅ 전 단계 비어있음 (idle) |
| 다이제스트 파이프라인 | 📋 01-sourced 2건 대기 |
| Reporter cron | ✅ 정상 (no assigned files) |

---

## ⚠️ 지속 추적 이슈

1. **feature_image 누락** (심각도: 중간) — Publisher 이미지 로직 미구현 상태 지속
2. **리포트 파일 누적** (심각도: 낮음) — pipeline/ 디렉토리에 EDITOR_DESK 리포트 80+개, 아카이브 권고
3. **3/8 만평 미생성** (심각도: 낮음) — 일요일이므로 정상, 크론 스케줄에 따라 자동 생성 예정

---

## 🟢 결론

**파이프라인 정상 운영 중.**
- 일요일 심야 — 메인 파이프라인 idle 상태 (정상)
- 다이제스트 01-sourced에 신규 2건 대기 (자동 처리 예정)
- Ghost 정상 가동 중 (HTTP 200)
- 긴급 개입 필요 사항 **없음**
