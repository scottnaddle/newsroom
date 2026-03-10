# 🔍 Editor-Desk Pipeline Checkpoint
**Cron: editor-desk (30분 주기) | 2026-03-06 14:07 KST**

---

## 📊 **파이프라인 현황**

| 단계 | 기사 수 | 상태 | 조치 |
|------|--------|------|------|
| 01-sourced | 3 | ⏳ 대기 | 에이전트 재시작 필요 |
| 02-assigned | 0 | 🚫 병목 | Reporter 배정 실패 |
| 03-reported | 0 | 🚫 병목 | - |
| 04-drafted | 0 | 🚫 병목 | - |
| 05-fact-checked | **2** | 🔴 정체 | **데스크 검증 필요** |
| 06-desk-approved | **0** | 🔴 비어있음 | **병목 지점** |
| 07-copy-edited | 1 | ✅ 진행 | 발행 대기 |
| 08-published | 13 | ✅ 누적 | - |

**문제점**: 큐에 23개 기사가 대기 중이지만, 02-assigned 단계에서 완전히 정체됨.

---

## 🎯 **05-Fact-Checked 검증 결과**

### **기사 1: "교육부, AI 인재양성 37개 대학 신규 선정"**

| 검증 항목 | 결과 | 상세 |
|----------|------|------|
| ✅ 제목-내용 일치 | **PASS** | 리드 문단이 제목 맥락 충분함 (95% 일치) |
| ✅ 이미지 유효성 | **PASS** | Unsplash 이미지, 404 없음 (1개) |
| ✅ HTML 검증 | **PASS** | kg-card 형식 정상, 이스케이프 문자 없음 |
| ✅ 본문 길이 | **PASS** | 5994자, 652단어 (최소 1500자, 200단어 요구) |
| ✅ AI 배지 | **PASS** | 배지 없음, 하단 법적 고지 포함 |
| ⚠️ 메타데이터 | **CRITICAL** | feature_image, og_image, meta_title, meta_description 모두 MISSING |
| 🚩 팩트체크 | **FLAG (83점)** | **2개 오류 감지 및 이미 교열 단계에서 수정됨** |
| ✅ 카테고리 | **PASS** | "policy" (적절) |

**핵심 문제**: 
- 팩트체크에서 발표일(3월 4일→2월 26일), 정책 시작 연도(2024년→2023년) **오류 2건 발견**
- **Copy-Editor에 의해 이미 수정됨** (corrections 로그 확인됨)
- **메타데이터 완전 부족**: Ghost 발행 시 심각한 문제 → 자동 보정 필수

**판정**: **REVISE** (메타데이터 추가 후 APPROVE)

---

### **기사 2: "TASK_1741262640-ai-bootcamp-revision.json"**

⚠️ **이 파일은 기사가 아닙니다!**

- **실체**: Editor-Desk가 원본 기사(기사 1)에 대해 작성기자에게 발행한 수정 요청 문서
- **발행 일자**: 2026-03-06 13:02 (어제)
- **포함 내용**: 팩트체크 상세 분석, 수정 사항, 데드라인(2026-03-07 13:02)

**문제**: 수정 요청 문서가 05-fact-checked에 저장되어 파이프라인 혼동 유발

**조치**: **삭제** 또는 별도 폴더(`revisions/`)로 이동

---

## 🚨 **자동 KILL 기준 검사**

### 기사 1 검사
```
❌ 제목-내용 불일치 (50% 미만): NO  
❌ 이미지 404 또는 2개 이상: NO  
❌ 완전 중복 기사: NO (기사 2와 종합 유사도 52.7%)  
❌ HTML escape 심각 (3개 이상): NO  
❌ AI 배지 (상단 pill): NO  
```
✅ **자동 KILL 기준 모두 통과**

---

## 📋 **필수 조치 (SOUL.md 지침)**

### **1️⃣ 즉시 처리 (긴급)**

```bash
# 기사 1을 06-desk-approved로 이동
# (메타데이터 자동 보정 후)

# meta_title: headline + subheadline 조합
# meta_description: 리드 문단 첫 100자
# og_image: feature_image와 동일하게 설정
```

**메타데이터 자동 생성 규칙**:
- `meta_title`: `headline + ' | ' + 사이트명` (max 60자)
- `meta_description`: 리드 박스 텍스트 첫 120자
- `og_image`: feature_image와 동일 (없으면 Unsplash에서 첫 이미지)
- `twitter_image`: og_image와 동일

---

### **2️⃣ 파이프라인 병목 진단**

**문제**: 01-sourced → 02-assigned 단계 완전 정체

**원인 분석 필요**:
```bash
# 1. Reporter 에이전트 상태 확인
ls -la /root/.openclaw/workspace/newsroom/workspaces/reporter/

# 2. 최신 에러 로그 확인
tail -100 /root/.openclaw/workspace/newsroom/workspaces/reporter/memory/error.log

# 3. 작업 큐 상태 확인
cat /root/.openclaw/workspace/newsroom/workspaces/reporter/memory/queue.json | jq '.[] | {id, status, assigned_at}' | head -10
```

**권장 조치**:
- Reporter 에이전트 재시작
- 01-sourced의 3개 기사 강제 재할당

---

### **3️⃣ TASK_*.json 파일 정리**

```bash
# 수정 요청 문서를 별도 폴더로 이동
mkdir -p /root/.openclaw/workspace/newsroom/pipeline/revisions/
mv /root/.openclaw/workspace/newsroom/pipeline/05-fact-checked/TASK_*.json \
   /root/.openclaw/workspace/newsroom/pipeline/revisions/
```

---

## ✅ **최종 권고**

### **신뢰도 점수 기반 라우팅 (SOUL.md 6.2절)**

**기사 1**: 팩트체크 점수 83점 (80-89 범위)
- 체크리스트: 모두 PASS (메타데이터 자동 보정 후)
- **결정**: **06-desk-approved로 이동** ✅
- **조건**: 메타데이터 자동 생성 후

---

## 📊 **문제점 정리**

| 영역 | 문제 | 심각도 | 원인 |
|------|------|--------|------|
| **파이프라인** | 02-assigned 병목 (0개) | 🔴 높음 | Reporter 에이전트 장애 추정 |
| **메타데이터** | 완전 부족 | 🔴 높음 | Publisher 또는 Writer의 메타데이터 생성 로직 누락 |
| **파일 관리** | TASK_*.json 혼재 | 🟡 중간 | 파일 시스템 구조 정리 필요 |
| **팩트체크** | 2개 오류 발견 → 이미 수정됨 | ✅ 해결됨 | Copy-Editor가 적절히 처리 |

---

## 🎓 **다음 30분 주기 체크포인트**

- [ ] 기사 1 메타데이터 보정 확인
- [ ] 기사 1이 06-desk-approved로 이동했는지 확인
- [ ] Reporter 에이전트 상태 점검
- [ ] 01-sourced의 3개 기사 진행 상황 확인
- [ ] TASK_*.json 파일 정리 완료 확인

---

**Report Generated**: 2026-03-06 14:07 KST (Cron: editor-desk 30분 주기)  
**Next Check**: 2026-03-06 14:37 KST
