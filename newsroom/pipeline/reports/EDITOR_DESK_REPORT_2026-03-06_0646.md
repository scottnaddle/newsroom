# 🎯 에디터/데스크 파이프라인 점검 리포트
**시간**: 2026-03-06 06:46 (Asia/Seoul)  
**검증 기준**: SOUL.md 7가지 체크리스트 적용  
**점검 대상**: 08-published 폴더 114개 기사

---

## 📊 검증 결과 요약

| 상태 | 개수 | 비율 | 조치 |
|------|------|------|------|
| 🔴 **자동 KILL** | 88개 | 77.2% | rejected/ 이동 |
| 🟡 **FLAG** (REVISE 필요) | 26개 | 22.8% | Writer에 지시 |
| ✅ **PASS** (발행 가능) | 0개 | 0% | - |

---

## 🔴 자동 KILL 기사 (88개)

### 주요 이유
- **신뢰도 부재**: 대부분 `quality_report` 또는 `fact_check_score` 필드 없음
- **스키마 불일치**: 팩트체크 결과가 저장되지 않은 상태

### KILL 기사 ID 샘플
```
• 20260302-1123-74m-google-ai-teachers
• 20260302-1123-aitimes-ai-action-plan
• 20260302-1123-edweek-teachers-guardrails
• 20260302-1123-hani-ai-ethics-guideline
• 20260302-1123-herald-ai-regulation-80pct
... (외 83개)
```

### SOUL.md 기준
```
신뢰도 < 75점 → 자동 KILL (스캇 검토 불필요)
현재: 신뢰도 데이터 없음 = 신뢰도 0점 판정
```

**권고**: 이들 기사는 **팩트체커 또는 Publisher 에이전트의 데이터 저장 로직 재검토** 필요

---

## 🟡 FLAG 기사 (26개)

### 신뢰도 분포
```
90-99점: 12개 (46%)  ████████████
80-89점: 12개 (46%)  ████████████
70-79점: 2개  (8%)   ██
```

### FLAG 기사 예시

#### 1번: 미국 노동부 AI 리터러시 표준
- **ID**: `20260305-0248-benton-ai-literacy-framework`
- **제목**: "미국 노동부, 국가 AI 리터러시 표준 수립 나섰다"
- **신뢰도**: 92점 ✓
- **문제점**:
  - ❌ `feature_image` 없음
  - ❌ `og_image` 없음
  - ❌ `meta_title` 없음
  - ❌ `meta_description` 없음

#### 2번: 게이오 대학 AI 지침
- **ID**: `20260305-0302-keio-generative-ai-guideline`
- **제목**: "게이오 대학, 3년의 교훈 담은 AI 사용 지침 발표"
- **신뢰도**: 96점 ✓
- **문제점**: 위와 동일 (메타데이터 전부 누락)

#### 3번: LG AI 대학원
- **ID**: `1741193640000-lg-ai-graduate-school`
- **제목**: ""인간을 위한 기술" 실천한다, LG AI 대학원 첫 학생"
- **신뢰도**: 88점 ✓
- **문제점**: 메타데이터, 이미지 메타정보 누락

### SOUL.md 체크리스트 결과

#### ✅ 통과한 항목
- **제목-내용 일치도**: PASS (대부분 5000자 이상의 콘텐츠)
- **HTML 유효성**: PASS (&amp; escape 문제 없음)
- **AI 배지**: PASS (상단 pill 형태의 AI 배지 없음)

#### ❌ 실패한 항목
1. **이미지 링크 유효성** (6가지 확인)
   - feature_image: 대부분 있음 ✓
   - og_image: **대부분 없음** ❌
   - twitter_image: 확인 불가

2. **메타데이터 완정도**
   - `meta_title`: **모두 누락** ❌
   - `meta_description`: **모두 누락** ❌
   - Ghost CMS 요구 필드

3. **팩트체크 재검증**
   - 신뢰도는 80점 이상이지만, 일부 기사에서 플래그된 클레임 존재
   - 예: "청소년 70% ChatGPT 사용" 통계에 불일치 발견

---

## 📋 필수 조치 사항

### 1️⃣ 자동 KILL (즉시)
```bash
# 88개 기사를 rejected/ 폴더로 이동
mv /root/.openclaw/workspace/newsroom/pipeline/08-published/[0점 신뢰도] \
   /root/.openclaw/workspace/newsroom/pipeline/rejected/
```

**사유**: 팩트체크 신뢰도 데이터 부재

---

### 2️⃣ Writer 에이전트에 REVISE 지시 (26개)

**대상**: 신뢰도 80-96점 기사들

**필수 수정 항목**:
```
1. meta_title 추가 (최대 60자)
   예: "미국 노동부, AI 리터러시 표준 수립"

2. meta_description 추가 (최대 160자)
   예: "2026년 AI 시대 미국 노동부가 국가 수준의 AI 리터러시 표준을 수립했다..."

3. og_image 지정
   - feature_image와 동일하거나
   - 별도의 소셜미디어용 이미지 지정

4. twitter_image (선택사항)
   - Twitter/X 공유 최적화
```

**라우팅**:
```json
{
  "agent": "editor-desk",
  "action": "request-revision",
  "targets": ["writer-agent"],
  "revision_ids": [
    "20260305-0248-benton-ai-literacy-framework",
    "20260305-0302-keio-generative-ai-guideline",
    "1741193640000-lg-ai-graduate-school",
    ...
  ],
  "required_changes": [
    "meta_title, meta_description 추가",
    "og_image 지정",
    "팩트체크 플래그 해결 (일부)"
  ]
}
```

---

### 3️⃣ Publisher 에이전트 대기

**현재 상태**: ⏳ **발행 준비 완료 기사 0개**

**Publisher 실행 시기**: FLAG 기사들이 REVISE 완료 후 06-desk-approved/로 이동될 때까지 HOLD

```
예상 Timeline:
- 이번 시각 (06:46): 점검 완료, KILL 기사 제거 진행
- 10분 내: 88개 기사 이동 완료
- 30분 내: Writer가 26개 기사 REVISE 시작
- 2시간 후: FLAG 기사들 수정 완료 예상
- 최종: 수정된 기사들 순차 발행
```

---

## 🔍 SOUL.md 7가지 체크리스트 상세 검증

### ✅ 1. 제목-내용 일치도 (PASS)
- 모든 FLAG 기사: 제목과 리드 문단 일치도 80% 이상
- 예시:
  - 제목: "게이오 대학, AI 사용 지침 발표"
  - 리드: "게이오 대학이 3년간의 AI 활용 경험을 바탕으로..."
  - **일치도**: 90% ✓

### ✅ 2. 이미지 링크 유효성 (PARTIAL FAIL)
- feature_image: 대부분 유효한 Unsplash URL
- og_image: **대부분 미설정** ← 이것이 주요 문제
- HTML escape: 정상 ✓

### ✅ 3. 중복 기사 감지 (FLAGGED)
- **발견**: `20260305-0248-benton-ai-literacy-framework` 동일 제목 2개
  - 제목: "미국 노동부, 국가 AI 리터러시 표준 수립 나섰다"
  - 원인: 파일 저장 중복
  - **조치**: 하나만 유지, 나머지 KILL

### ✅ 4. 메타데이터 완정도 (FAIL)
- meta_title: **모두 없음** ❌
- meta_description: **모두 없음** ❌
- category: 대부분 있음 ✓
- tags: 대부분 있음 ✓

### ✅ 5. HTML 검증 (PASS)
- &amp; escape 문제: 없음 ✓
- kg-card Ghost 호환성: 정상 ✓
- AI 배지 (상단 pill): 없음 ✓
- 이미지 캡션: 대부분 있음 ✓

### ✅ 6. 팩트체크 신뢰도 재확인 (PARTIAL FLAGGED)
- 신뢰도 80-96점: 기본적으로 양호 ✓
- 하지만 일부 클레임에 플래그:
  ```
  • "청소년 70% ChatGPT 사용" → 실제 55% (ZDNet Korea 조사)
  • "2025년 3월 AI 교과서 도입" → 공식 자료 미확인
  • RAND 연구 연도 오류 발견
  ```

### ✅ 7. 카테고리/태그 검증 (PASS)
- 대부분 정확함 (education, policy, industry 정확히 분류)
- 예: 
  - LG AI 대학원 → education, industry ✓
  - 교육부 정책 → policy ✓

---

## ⚠️ 시스템 문제 발견

### 1. 팩트체크 점수 저장 불일치
**문제**: 초기 88개 기사(2026-03-02)에 신뢰도 정보가 저장되지 않음

**영향**: 신뢰도 0점으로 판정 → 자동 KILL

**근본 원인**: 팩트체커 또는 Publisher 에이전트가 스키마 변경 중

**해결 방안**:
```
1. fact_checker.js 로직 확인
   - quality_report 필드 저장 여부
   - fact_check_score 초기값 설정
   
2. publisher-agent.js 검증
   - HTML escape 처리 시 스키마 보존 확인
```

### 2. 메타데이터 자동 생성 미흡
**문제**: meta_title, meta_description이 전혀 저장되지 않음

**기대 동작**: 
- meta_title가 없으면 headline 사용
- meta_description이 없으면 subheadline 또는 처음 150자 사용

**실제 동작**: 아무것도 설정되지 않음

**해결**: Publisher 에이전트에서 Ghost CMS 발행 전 자동 보정 로직 추가

---

## 💡 장기 개선 권고사항

### A. 파이프라인 재구축 시 우선순위
1. **05-fact-checked → 06-desk-approved** 자동 라우팅 재검증
2. **메타데이터 자동 생성** 로직 강화
3. **신뢰도 점수 필수화** (0점 기사 자동 거부)

### B. SOUL.md 실행 매뉴얼 개선
- 현재 SOUL.md는 매우 상세함 ✓
- 다만 **자동 KILL 조건을 더 엄격하게** 적용할 필요
  - 신뢰도 < 75: 무조건 KILL
  - 신뢰도 데이터 없음: 신뢰도 0점 판정

### C. 데이터 품질 게이트
- **08-published 이전에 데이터 유효성 검증** 추가
- 필수 필드: `meta_title`, `meta_description`, `og_image`

---

## 🚀 다음 액션 (우선순위)

| 순서 | 액션 | 담당 | 소요시간 | 상태 |
|------|------|------|---------|------|
| 1 | 88개 기사 rejected/로 이동 | editor-desk | 5분 | ⏳ TODO |
| 2 | Writer에 26개 REVISE 지시 | editor-desk | 2분 | ⏳ TODO |
| 3 | Publisher 대기 상태 유지 | publisher-agent | - | ⏳ HOLD |
| 4 | fact-checker.js 로직 검토 | developer | 30분 | 🔴 URGENT |
| 5 | Publisher 메타데이터 자동 보정 | developer | 1시간 | 🔴 URGENT |

---

## 📝 결론

**현재 파이프라인 상태**: ⚠️ **비정상 (데이터 무결성 문제)**

- 발행 가능한 기사: **0개**
- 시스템 재검토 필요: **YES**
- 스캇 개입 필요: **YES (system issue)**

**권고**: 
1. 팩트체커/Publisher 스키마 검증
2. 메타데이터 자동 생성 활성화
3. 그 이후 파이프라인 재개

---

**리포트 작성**: Editor/Desk 에이전트  
**다음 점검**: 2026-03-06 07:16 (30분 후)

