# 🗞️ 에디터/데스크 파이프라인 점검 리포트
**일시**: 2026-03-07 20:55 (KST)

---

## 📊 파이프라인 현황 요약

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 00-intake ~ 05-fact-checked | 0 | ✅ 전부 비어있음 |
| 06-desk-approved | 0 | ✅ 대기 기사 없음 |
| 07-copy-edited | 0 (리포트만) | ✅ |
| 08-published | 19 (누적) | 오늘 8개 발행 |
| rejected | 43 (누적) | 정상 |

**서브 파이프라인:**

| 파이프라인 | 상태 |
|-----------|------|
| 다이제스트 (digest) | ✅ 3개 신규 발행 완료 (19:53 → 20:27 처리) |
| 논문 (papers) | ✅ 발행 완료, 대기 0개 |
| 만평 (cartoon) | ✅ 오늘자 발행 완료, 이미지 HTTP 200 |
| 인사이트 (insight) | ✅ 오늘자 발행 완료, Ghost HTTP 200 |
| 콜로키 (colloquy) | ⚠️ JSON 생성됨, Ghost 미발행 (publish_result = null) |

---

## ✅ 품질 검증 결과 (오늘 발행 8개)

### 전수 검증

| 검증 항목 | 결과 |
|----------|------|
| HTML 길이 ≥1,500자 | ✅ 전체 PASS (4,313~5,416자) |
| &amp; escape 문제 | ✅ 없음 (0건) |
| AI 배지(🤖 pill) | ✅ 없음 (0건) |
| Ghost publish 상태 | ✅ 전체 "published" |
| Ghost 사이트 접속 | ✅ HTTP 200 |
| 중복 기사 | ✅ 없음 |

---

## ✅ 이전 이슈 해소

### 다이제스트 3개 대기 → 처리 완료
이전 리포트(20:08)에서 대기 중이던 3개 소스:
- ✅ `ai-generated-iran-war-videos-surge` → published (HTTP 200)
- ✅ `broadcom-ai-chip-revenue-jumps-74-percent` → published (HTTP 200)
- ✅ `us-drafts-ai-chip-export-control-rules` → published (HTTP 200)

모두 20:27에 03-published로 이동, Ghost 발행 확인됨.

---

## ⚠️ 추적 중인 이슈

### 1. feature_image 누락 (중간) — 지속

오늘 발행 8개 중 **6개가 feature_image 없음**:
- 02:37 배치 4개 전부
- 06:55 배치 1개
- 11:53 `global-education-policy-paradigm-shift`

feature_image 있는 기사: LG 기사 (Unsplash), 17:58 기사 (Unsplash) — 2개만

**권고**: Publisher Unsplash fallback 로직 강화 필요

### 2. 02:37 배치 품질 점수 미기록 (낮음) — 지속

4개 기사 `quality_report.overall_confidence = null`
→ 팩트체크 단계 건너뛴 것으로 추정

### 3. 콜로키 Ghost 미발행 (낮음) — 지속

`2026-03-07_colloquy.json`: topic/characters/conversation 정상 생성
하지만 `publish_result = null` — 콜로키 Publisher 사이클 미실행

### 4. 일부 기사 public_url 미기록 (낮음)

02:37 배치 및 06:55 기사: `publish_result`에 `ghost_edit_url`만 있고 `public_url` / `ghost_url` 없음.
Ghost 사이트에서 직접 확인 시 정상 표시됨 → 실질적 문제 없음, Publisher 기록 로직 개선 권장

---

## 🟢 결론

**파이프라인 정상 가동 중. 긴급 조치 사항 없음.**

- 메인 파이프라인: 전 단계 비어있음 (토요일 저녁, 정상)
- Ghost 발행: 모든 기사 published 확인 ✅
- 다이제스트: 이전 대기 3건 모두 처리 완료 ✅
- 만평/인사이트: 정상 ✅
- 콜로키: Ghost 미발행 (비긴급, 지속 추적)
- feature_image 누락: 지속 이슈, Publisher 로직 개선 권장

**다음 점검**: 30분 후

에디터/데스크: 헤일리
