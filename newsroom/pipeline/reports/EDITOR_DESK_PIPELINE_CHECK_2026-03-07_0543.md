# 📋 Editor-Desk 파이프라인 점검 리포트
**일시**: 2026-03-07 05:43 KST  
**담당**: 에디터/데스크 (cron)

---

## 📊 파이프라인 현황

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 00-intake | 0 | ✅ 비어있음 |
| 01-sourced | 1 | 🔵 대기 중 |
| 02-assigned | 0 | ✅ |
| 03-reported | 0 | ✅ |
| 04-drafted | 0 | ✅ |
| 05-fact-checked | 0 | ✅ |
| 06-desk-approved | 0 | ✅ (중복 KILL됨) |
| 07-copy-edited | 0 | ✅ |
| 08-published | 16 | ✅ |

---

## 🔍 품질 검증 결과

### ✅ 1. 중복 기사 감지
- **검증 결과**: 1개 완전 중복 발견 → 자동 KILL
- **KILL된 기사**: `copy-edited.json` (AI가 교사의 시간을 되찾다)
- **중복 대상**: `2026-03-07_04-51_ai-gyoyuk-hwangyeong-jeollyak.json`
- **유사도**: 100%
- **조치**: `rejected/`로 이동 완료

### ✅ 2. 이미지 링크 유효성
| 상태 | 개수 | 비고 |
|------|------|------|
| HTTP 200 | 3 | Unsplash 이미지 정상 |
| NONE | 13 | ⚠️ feature_image 없음 |

**문제**: 대부분의 발행 기사에 feature_image가 없음
- Ghost에서는 게시되었으나 이미지가 누락된 상태
- Publisher 로직 점검 필요

### ✅ 3. HTML Escape 검사
- **결과**: 문제 없음 (&amp; 미발견)

### ⚠️ 4. 신뢰도 점수 확인
| 상태 | 개수 |
|------|------|
| PASS (80+) | 10 |
| FLAG (75-79) | 0 |
| N/A | 5 |
| FLAG (83) | 1 |

**문제**: 5개 기사에 quality_report 없음
- `2026-03-06_23-16_Korea-Univ-Tech-Education-Semicon.json`
- `2026-03-07_02-37_ai-era-children-education.json`
- `2026-03-07_02-37_ai-ethics-policy-universities.json`
- `2026-03-07_02-37_asia-ai-research-consortium.json`
- `2026-03-07_02-37_korea-ai-love-politico.json`

---

## 🔵 대기 중인 기사

### 01-sourced: `202603070525-kci-ai-career`
- **제목**: 한국기술교육대학교 황현아 교수 AI 진로상담 논문 KCI 등재
- **소스**: The Asia Business Daily
- **관련성**: 65점
- **태그**: research, higher-ed, ai-counseling
- **상태**: 할당 대기 중

---

## 🚨 권고 조치

### [높음] Publisher 로직 점검
- 16개 중 13개 기사에 feature_image 없음
- Unsplash 이미지 생성 로직이 누락되고 있음
- **권고**: Publisher 에이전트 로직 재확인

### [중간] 품질 리포트 누락
- 5개 기사에 quality_report 필드 없음
- 팩트체크 단계에서 누락된 것으로 추정
- **권고**: 해당 기사들에 대한 팩트체크 재실행

### [낮음] 01-sourced 기사 진행
- AI 진로상담 논문 기사 대기 중
- **권고**: 다음 배치에서 02-assigned로 이동

---

## 📈 일일 요약

- **발행된 기사**: 16개
- **중복 KILL**: 1개
- **평균 신뢰도**: 89점 (N/A 제외)
- **이미지 커버리지**: 19% (3/16)

---

_에디터/데스크 자동 점검 완료_
