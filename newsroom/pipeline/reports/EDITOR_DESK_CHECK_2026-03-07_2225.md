# 🗞️ 에디터/데스크 파이프라인 점검 리포트
**일시**: 2026-03-07 22:25 (KST)

---

## 📊 파이프라인 현황 요약

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 00-intake ~ 04-drafted | 0 | ✅ 비어있음 |
| 05-fact-checked | 0 | ✅ 비어있음 |
| 06-desk-approved | 0 | ✅ 대기 없음 |
| 07-copy-edited | 0 | ✅ |
| 08-published | 19 (누적) | ✅ |
| rejected | 43 (누적) | ✅ |

---

## ✅ 정상 항목

- **Ghost 사이트** (ubion.ghost.io): HTTP 200 ✅
- **메인 파이프라인**: 전 단계 비어있음 — 토요일 밤, 정상
- **발행 기사**: 19건 누적, 이상 없음
- **이전 DeSantis 기사**: digest/03-published로 정상 발행 완료 ✅

---

## 📰 다이제스트 파이프라인 — 신규 기사 3건 검증

| 단계 | 건수 | 비고 |
|------|------|------|
| 01-sourced | 0 | ✅ |
| 02-drafted | 3 | 신규 — 아래 검증 결과 참조 |
| 03-published | 137 (누적) | ✅ (+1, DeSantis 발행) |

### 1️⃣ 엔비디아 H200 생산 중단 / 앤트로픽 펜타곤 기사

**파일**: `2026-03-07_21-59_nvidia-h200-anthropic-pentagon-label.json`

| 체크 항목 | 결과 | 비고 |
|-----------|------|------|
| 1. 제목-내용 일치도 | ✅ PASS (69%) | 핵심 용어 정확히 반영 |
| 2. 이미지 링크 | N/A | 다이제스트 (이미지 없음) |
| 3. 중복 기사 감지 | ✅ PASS | 기존 발행 대비 최대 유사도 5.3% |
| 4. 본문 내용 검증 | ✅ PASS | 2,601자 / 560단어 |
| 5. 메타데이터 | ✅ PASS | meta_title, meta_description 존재 |
| 5. HTML 검증 | ✅ PASS | &amp; 없음, AI pill 없음, AI 각주 있음 |
| 6. JSON 유효성 | ✅ PASS | 파싱 정상 |
| 7. 태그 | ✅ PASS | ai-digest, ai, technology, nvidia, anthropic |

**판정**: ✅ 발행 적격

---

### 2️⃣ AI 반도체 주간 동향 (엔비디아·AMD·ASML)

**파일**: `2026-03-07_21-59_semiconductors-ai-chips-weekly-briefing.json`

| 체크 항목 | 결과 | 비고 |
|-----------|------|------|
| 1. 제목-내용 일치도 | ✅ PASS (65%) | 핵심 용어 정확히 반영 |
| 2. 이미지 링크 | N/A | 다이제스트 |
| 3. 중복 기사 감지 | ✅ PASS | 기존 발행 대비 최대 유사도 13.6% |
| 4. 본문 내용 검증 | ✅ PASS | 2,534자 / 580단어 |
| 5. 메타데이터 | ✅ PASS | meta_title, meta_description 존재 |
| 5. HTML 검증 | ✅ PASS | &amp; 없음, AI pill 없음, AI 각주 있음 |
| 6. JSON 유효성 | ✅ PASS | 파싱 정상 |
| 7. 태그 | ✅ PASS | ai-digest, ai, technology, nvidia, amd |

**NVIDIA 기사(#1)와 겹침 검사**: Jaccard 유사도 13.4% — ✅ 독립 기사
- #1은 H200 단종 + Anthropic 펜타곤 이슈 (속보형)
- #2는 반도체 주간 라운드업 (NVIDIA+AMD+ASML 종합)

**판정**: ✅ 발행 적격

---

### 3️⃣ 앤트로픽 보고서 "AI 일자리 영향 아직 이르다"

**파일**: `2026-03-07_21-59_anthropic-report-ai-jobs-impact.json`

| 체크 항목 | 결과 | 비고 |
|-----------|------|------|
| 1. 제목-내용 일치도 | ✅ PASS (88%) | 거의 완벽한 일치 |
| 2. 이미지 링크 | N/A | 다이제스트 |
| 3. 중복 기사 감지 | ✅ PASS | 기존 발행 대비 유사 기사 없음 |
| 4. 본문 내용 검증 | ✅ PASS | 2,559자 / 520단어 |
| 5. 메타데이터 | ✅ PASS | meta_title, meta_description 존재 |
| 5. HTML 검증 | ✅ PASS | &amp; 없음, AI pill 없음, AI 각주 있음 |
| 6. JSON 유효성 | ✅ PASS | 파싱 정상 |
| 7. 태그 | ✅ PASS | ai-digest, ai, research, anthropic |

**판정**: ✅ 발행 적격

---

## ⚠️ 지속 추적 이슈

| 이슈 | 심각도 | 상태 |
|------|--------|------|
| Writer JSON 이스케이프 버그 | 중간 | 이번 3건은 정상 — 모니터링 지속 |
| feature_image 누락 | 중간 | 14/19 메인 기사 — Publisher 개선 필요 |
| 콜로키 Ghost 미발행 | 낮음 | 지속 |

---

## 🟢 결론

**파이프라인 정상. 신규 다이제스트 3건 모두 발행 적격.**

- 메인 파이프라인 비어있음 (토요일 밤 — 정상)
- DeSantis 기사 정상 발행 완료
- 신규 3건 전체 검증 통과 — 다음 Publisher 사이클에서 자동 발행 예정
- JSON 이스케이프 버그 이번 사이클은 재발 없음

**다음 점검**: 30분 후

에디터/데스크: 헤일리
