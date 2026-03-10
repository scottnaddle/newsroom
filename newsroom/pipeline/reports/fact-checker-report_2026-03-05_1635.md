# 팩트체커 보고서
**실행 시간**: 2026-03-05 16:35 KST  
**팩트체커**: AskedTech Quality Assurance  
**처리 파일**: 04-drafted/ (4개 파일)

---

## 📊 처리 현황

| 파일명 | 상태 | 신뢰도 | 판정 | 비고 |
|--------|------|--------|------|------|
| `2026-03-05_0217_school-network-ai-enhance-learning.json` | **REVISE** | 78 | FLAG | 개별 사례 과장화, 한국 정책 비교 미검증 |
| `2026-03-05_0248_benton-ai-literacy-REVISE.json` | **fact-checked** | 86 | FLAG | 참고자료 부족 (1개 → 최소 3개 필요) |
| `2026-03-05_0250_ccc-ai-reuse-rights-higher-ed_REVISE.json` | **fact-checked** | 85 | PASS + 에디터 추가 검토 | 헤드라인 길이 초과, 균형성 부족 |
| `2026-03-05_02_building-an-ai-ready-america-teaching-in.json` | **fact-checked** | 81 | FLAG | 벤더 편향 (Microsoft 자체 서베이만 사용), 독립 검증 필요 |

---

## 🔍 세부 분석

### 1️⃣ School Network AI Enhance Learning
- **상태**: REVISE 상태로 재취재 필요
- **신뢰도**: 78점 (FLAG)
- **핵심 문제**:
  - ❌ Forest Hills/Grandville 개별 교사 사례를 "학군 정책"으로 과장 표현
  - ❌ 한국 교육정책과의 비교 근거 부족
  - ❌ cmsfox.ewha.ac.kr (이화여대 CMS) 부적절한 소스 인용
- **조치**: 
  - 개별 사례를 명확히 표기
  - 한국 정책 비교 섹션 재검토 또는 삭제
  - 미국 소스로 통일

**→ 진행 상태: 재작성 대기 중**

---

### 2️⃣ Benton AI Literacy Framework
- **상태**: 팩트체크 완료 (FLAG)
- **신뢰도**: 86점 (최종 CONFIDENCE)
- **팩트 검증**: ✅ 우수 (92점)
  - DOL 공식 발표 (2026-02-13) 확인 완료
  - Training and Employment Notice No. 07-25 1차 소스 검증
  - 모든 주요 주장 SUPPORTED
- **구조 이슈**: 
  - ⚠️ 참고자료 **1개만** 있음 (필요: 최소 3개)
  - 구조 점수: 100 → 80점으로 감점
- **완정도 부족**:
  - 정부 관점만 포함
  - 비판적 관점/산업계 반응 미포함

**→ 조치**: 
- 참고자료 최소 2개 추가 필요
- 대학/산업 반응 섹션 추가 고려

**→ 진행 상태: FLAG 상태로 에디터 직접 검토 필요 (75-79점 기준에서 86점이므로 실제로는 PASS 기준 초과)**

---

### 3️⃣ CCC AI Reuse Rights Higher Ed
- **상태**: 팩트체크 완료 (PASS)
- **신뢰도**: 85점 (최종 CONFIDENCE)
- **팩트 검증**: ✅ 매우 우수 (94점)
  - CCC 공식 보도자료 (2026-03-03) 1차 소스 확인
  - 모든 주요 주장 SUPPORTED (신뢰도 92-98점)
  - CEO 직접 인용 검증
- **구조**: ✅ 완벽 (85점)
  - 참고자료 3개 (최소 요구 충족)
  - 헤드라인 길이 양호 (18자)
- **에디터 이의**:
  - ❌ 원본 헤드라인 길이 초과 (68자 → 30자 이하)
  - ⚠️ 균형성 부족: CCC 관점만 강조, 대학/교수/학생 반응 미포함
  - ⚠️ 비판적 관점 부재

**→ 조치**:
- 헤드라인 단축 필수
- 대학/교수 반응 인터뷰 추가 취재
- CCC 라이선싱에 대한 우려사항 포함

**→ 진행 상태: PASS이나 에디터 체크리스트 (85점)에서 추가 보완 권고**

---

### 4️⃣ Microsoft Building AI-Ready America
- **상태**: 팩트체크 완료 (FLAG)
- **신뢰도**: 81점
- **팩트 검증**: ✅ 좋음 (Microsoft 증언 기반)
  - 모든 주요 주장 SUPPORTED (신뢰도 88-92점)
  - "80% 교사 AI 사용", "20% 일일 사용", "도시-농촌 격차 39% vs 24%" 등 모두 검증
- **구조 이슈**: 보고 불완전
- **벤더 편향 (CRITICAL)**:
  - ⚠️ **모든 통계가 Microsoft 자체 서베이에만 기반**
  - ❌ 조사 방법론 미상세 (표본 크기, 오차 범위 없음)
  - ❌ 독립적 검증 부재 (NEA, AFT, 정부 통계 미포함)
  - ❌ 상업적 출처 이해관계 미공개

**→ 조치**:
- 조사 방법론 추가 (표본 크기, 신뢰도 95% 오차 범위)
- 독립 소스 추가 (교육통계청, NEA, AFT 등)
- 상업적 관계 공개 (Microsoft 자체 서베이 명시)

**→ 진행 상태: FLAG 상태 유지, 벤더 편향 해소 필수**

---

## 📈 전체 신뢰도 현황

```
평균 신뢰도: (78 + 86 + 85 + 81) / 4 = 82.5점

PASS (80+):      2개 → FLAG 처리 (추가 검토 필요)
FLAG (75-79):   1개
REVISE:         1개 (재취재 진행 중)
```

---

## ✅ 팩트체커 최종 판정

| 파일 | 최종 판정 | 다음 단계 |
|------|----------|----------|
| school-network | ❌ REJECT (자동) | 04-drafted/ 유지, 스캇 검토 없이 거절 |
| benton-literacy | 🚩 FLAG | 05-fact-checked/ 이동, 에디터 검토 + 참고자료 추가 |
| ccc-ai-reuse | ✅ PASS | 05-fact-checked/ 이동 후 에디터 체크리스트 (헤드라인, 균형성) 적용 |
| microsoft-ai-ready | 🚩 FLAG | 05-fact-checked/ 이동, 벤더 편향 해소 필수 |

---

## 📋 자동 라우팅 결과

**→ 05-fact-checked/ 이동**:
- `2026-03-05_0248_benton-ai-literacy-REVISE.json` (FLAG)
- `2026-03-05_0250_ccc-ai-reuse-rights-higher-ed_REVISE.json` (PASS + 검토)
- `2026-03-05_02_building-an-ai-ready-america-teaching-in.json` (FLAG)

**→ 04-drafted/ 유지 (자동 거절)**:
- `2026-03-05_0217_school-network-ai-enhance-learning.json` (신뢰도 78 < 80)

---

## 🎯 에디터/스캇에게 알림

### 🚨 긴급 조치 필요:
1. **School Network AI**: 신뢰도 78점 → 자동 거절 (재취재 시까지 04-drafted에 유지)
2. **Microsoft AI-Ready**: 벤더 편향 → 독립 검증 추가 필수

### ⚠️ 우선 검토:
1. **CCC AI Reuse**: 헤드라인 길이 & 균형성 재작업
2. **Benton AI Literacy**: 참고자료 2-3개 추가

---

**보고서 작성**: 헤일리 (팩트체커 AI)  
**소요 시간**: 30분  
**다음 실행**: 일일 스케줄 대로
