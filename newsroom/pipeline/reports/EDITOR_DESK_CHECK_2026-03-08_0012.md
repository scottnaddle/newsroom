# 🗞️ 에디터/데스크 파이프라인 점검 리포트
**일시**: 2026-03-08 00:12 (KST)

---

## 📊 파이프라인 현황 요약

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 00-intake | 0 | ✅ 비어있음 |
| 01-sourced | 0 | ✅ |
| 02-assigned | 0 | ✅ |
| 03-reported | 0 | ✅ |
| 04-drafted | 0 | ✅ |
| 05-fact-checked | 0 | ✅ |
| 06-desk-approved | 0 | ✅ |
| 07-copy-edited | 0 | ✅ |
| 08-published | 19 (누적) | ✅ |
| rejected | 44 (누적) | ✅ |

### 다이제스트 파이프라인

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 01-sourced | 2 | ⏳ 대기 중 |
| 02-drafted | 0 | ✅ |
| 03-published | 142 (누적) | ✅ |
| rejected | 1 | ✅ |

---

## ⏳ 다이제스트 소스 대기 건 (2건)

| # | 제목 | 소스 | 관련성 |
|---|------|------|--------|
| 1 | Meta Reorganises AI Teams, Creates New Applied AI Engineering Unit | Storyboard18 | 88 |
| 2 | OpenAI Builds GitHub Rival, Tensions Rise With Microsoft | Awesome Agents | 90 |

→ 두 건 모두 관련성 점수 적합. 다음 다이제스트 작성 사이클에서 처리 예정.

---

## ✅ 시스템 상태

| 항목 | 상태 |
|------|------|
| Ghost (insight.ubion.global) | ✅ HTTP 200 |
| 중복 검증 스크립트 | ✅ 존재 확인 |
| 메인 파이프라인 | ✅ 비어있음 (심야) |

---

## ⚠️ 지속 추적 이슈

### 1. feature_image 누락 (심각도: 중간)
- 08-published의 최근 기사 8건 모두 `draft.feature_image` 없음
- Ghost 포스트 자체에도 feature_image 없음
- **원인**: Publisher 단계에서 Unsplash 이미지 첨부 로직 미구현 또는 작동 안 함
- **권고**: Publisher 에이전트의 이미지 처리 로직 점검 필요

### 2. 최근 rejected 건 (2026-03-07 23:02)
- `한남대, 교육부 '첨단산업 인재양성 부트캠프' 선정` — 관련성 65점
- 기존 유사 기사 존재 (한남 부트캠프 관련 기 발행)
- ✅ 적절한 거부 처리

---

## 🟢 결론

**파이프라인 정상. 일요일 심야 시간대, 메인 파이프라인 전 단계 비어있음.**
- 다이제스트 파이프라인에 소스 2건 대기 중 (다음 사이클에서 자동 처리)
- feature_image 누락 문제는 지속 추적 필요
- 신규 처리 또는 개입 필요 사항 없음
