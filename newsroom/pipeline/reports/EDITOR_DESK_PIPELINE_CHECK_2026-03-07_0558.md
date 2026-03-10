# 📋 Editor-Desk 파이프라인 점검 리포트
**일시**: 2026-03-07 05:58 KST  
**담당**: 에디터/데스크 (cron 30분)

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
| 06-desk-approved | 0 | ✅ |
| 07-copy-edited | 0 | ✅ |
| 08-published | 16 | ⚠️ (4개 draft 상태) |
| rejected | 39 | 📁 보관 |

---

## 🔍 품질 검증 결과

### ✅ 1. 중복 기사 감지
- **검증 결과**: 0개 (이전 배치에서 처리 완료)
- **자동 KILL**: 없음

### ⚠️ 2. 이미지 링크 현황
| 상태 | 개수 | 비고 |
|------|------|------|
| ✅ 이미지 있음 | 3 | Unsplash URL 정상 작동 |
| ❌ 이미지 없음 | 12 | Ghost 발행 시 누락 |
| draft | 1 | 미발행 |

**문제**: 12개 기사에 feature_image 없음 (75%)
- Ghost에는 발행되었으나 이미지가 업로드되지 않음
- Publisher 로직 개선 필요

### ✅ 3. HTML Escape 검사
- **결과**: 문제 없음

### ⚠️ 4. 신뢰도 점수 확인
| 상태 | 개수 |
|------|------|
| 90+ (우수) | 5 |
| 80-89 (양호) | 6 |
| 75-79 (주의) | 0 |
| N/A (없음) | 4 |

**문제**: 4개 기사에 quality_report 없음
- `202603062316-korea-univ-tech-education`
- `20260306234604-ai-era-children`
- `20260306234600-ai-ethics-policy`
- `20260306234606-asia-ai-consortium`
- `20260306234605-korea-ai-love`

### ⚠️ 5. 발행 상태 이상
- **draft 상태 기사**: 4개가 08-published 폴더에 있으나 실제 status=draft
- 이 기사들은 Ghost에 발행되지 않음
- 재발행 필요 또는 rejected로 이동 검토

---

## 🔵 대기 중인 기사

### 01-sourced: `202603070525-kci-ai-career`
- **제목**: 한국기술교육대학교 황현아 교수 AI 진로상담 논문 KCI 등재
- **소스**: The Asia Business Daily
- **관련성**: 65점
- **태그**: research, higher-ed, ai-counseling
- **상태**: 할당 대기 중
- **권고**: 다음 배치에서 02-assigned로 진행

---

## 🚨 권고 조치

### [높음] Publisher 로직 점검
- 16개 중 12개 기사에 feature_image 없음
- Unsplash 이미지 생성이 누락되고 있음
- **권고**: Publisher 에이전트에서 이미지 생성 로직 확인

### [중간] draft 상태 기사 정리
- 4개 기사가 08-published에 있으나 실제로는 draft
- **권고**: 재발행 시도 또는 rejected로 이동

### [낮음] 품질 리포트 누락 기사
- 4개 기사에 quality_report 없음
- **권고**: 팩트체크 재실행 또는 수동 검증

---

## 📈 일일 요약

- **발행된 기사**: 12개 (실제 published)
- **미발행 기사**: 4개 (draft 상태)
- **평균 신뢰도**: 89점 (N/A 제외)
- **이미지 커버리지**: 20% (3/15)
- **중복 KILL**: 0개

---

_에디터/데스크 자동 점검 완료_
