# 🗞️ 에디터/데스크 파이프라인 점검 리포트
**일시**: 2026-03-07 20:08 (KST)

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
| 다이제스트 (digest) | ⚡ 01-sourced에 3개 대기 중 (19:53 수집) |
| 논문 (papers) | ✅ 발행 완료, 대기 0개 |
| 만평 (cartoon) | ✅ 오늘자 발행 완료, 이미지 HTTP 200 |
| 인사이트 (insight) | ✅ 오늘자 발행 완료, ghost_url 확인 |
| 콜로키 (colloquy) | ⚠️ JSON 생성됨, Ghost 미발행 (ghost_url = null) |

---

## ✅ 품질 검증 결과 (오늘 발행 8개)

### 전수 검증 PASS

| 검증 항목 | 결과 |
|----------|------|
| HTML 길이 ≥1,500자 | ✅ 전체 PASS (4,313~5,416자) |
| 단어 수 ≥200 | ✅ 전체 PASS |
| &amp; escape 문제 | ✅ 없음 |
| AI 배지(🤖 pill) | ✅ 없음 |
| Ghost publish 상태 | ✅ 전체 "published" |
| Ghost 사이트 접속 | ✅ HTTP 200 |

### Ghost 발행 상태 업데이트
이전 리포트(19:03)에서 5개 기사가 Ghost에서 draft 상태로 보고됐으나, 현재 확인 결과 **모든 8개 기사의 publish_result.status = "published"**로 확인됨. 이전 보고는 최상위 필드(ghost_status)로 조회해 누락된 것으로, 실제로는 `publish_result.status`에 정상 기록됨.

→ **이슈 해소됨** ✅

---

## ⚠️ 추적 중인 이슈

### 1. feature_image 누락 (중간) — 지속

오늘 발행 8개 중 **6개가 feature_image 없음**:
- 02:37 배치 4개 (ai-era-children-education, ai-ethics-policy-universities, asia-ai-research-consortium, korea-ai-love-politico)
- 06:55 배치 1개 (ai-hyeogsin-gyeongjaeng)
- 11:53 배치 1개 (global-education-policy-paradigm-shift)

11:53 LG 기사와 17:58 기사만 Unsplash 이미지 보유.

**권고**: Publisher에서 Unsplash fallback 이미지 자동 할당 로직 강화

### 2. 콜로키 Ghost 미발행 (낮음) — 지속

`2026-03-07_colloquy.json` 생성됨 (topic, characters, conversation 포함) 하지만 ghost_url = null.
콜로키 Publisher 사이클 미실행.

### 3. 다이제스트 신규 대기 (정보)

01-sourced에 3개 새 소스 수집됨 (19:53):
- ai-generated-iran-war-videos-surge
- broadcom-ai-chip-revenue-jumps-74-percent
- us-drafts-ai-chip-export-control-rules

→ 다음 다이제스트 Writer 사이클에서 처리 예정

### 4. 품질 점수 미기록 (낮음) — 지속

02:37 배치 4개 기사에 quality_report.overall_confidence = null
→ 팩트체크 단계를 건너뛴 것으로 추정

---

## 📋 중복 검사

06-desk-approved에 대기 기사 0개 → 검증 대상 없음.
08-published 기사 간 중복:
- LG AI대학원 (어제 vs 오늘): 각도 상이 → **허용** (시리즈)
- UNESCO/OECD 교육정책 (어제 vs 오늘): 범위 상이 → **허용** (보완)

---

## 🟢 결론

**파이프라인 정상 가동 중. 긴급 조치 사항 없음.**

- 메인 파이프라인: 처리 완료 상태 (비어있음)
- Ghost 발행 상태: 전수 확인 완료 — 모두 published ✅
- 만평/인사이트: 정상 발행 ✅
- 다이제스트: 3개 신규 소스 대기 중 (자동 처리 예정)
- 콜로키: Ghost 미발행 (비긴급)

**다음 점검**: 30분 후

에디터/데스크: 헤일리
