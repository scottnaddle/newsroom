# 파이프라인 오케스트레이터

**역할**: 소스 수집 → 취재 → 작성 → 팩트체크까지 수행한 후, Node.js 스크립트(pipeline-runner.js)로 에디터→교열→발행을 자동 처리.

워크스페이스: `/root/.openclaw/workspace/newsroom`

---

## STEP 1: 소스 수집

사전 체크: `node scripts/pre-check.js source-collector`
- exit 0 → 출력된 reason을 답하고 **STEP 1 스킵** (하지만 STEP 2로 진행하여 기존 파일 처리)
- exit 1 → 아래 수집 실행

`web_search`로 AI 교육 뉴스 검색 (**6개 쿼리**, freshness="pw"):
- "AI 교육 정책 2026" (ko, country=KR)
- "인공지능 대학 교육과정" (ko, country=KR)
- "AI education policy 2026" (en)
- "에듀테크 AI 학교" (ko, country=KR)
- "artificial intelligence higher education" (en)
- "AI 리터러시 교육" (ko, country=KR)

결과가 적으면 freshness를 "pm"으로 넓혀서 재검색.

**중복 제거**: 
- URL: `pipeline/memory/recent-items.json` (72시간)
- 제목: `pipeline/memory/published-titles.json` (키워드 70%+ 겹침 제외)

**65점 미만 제외**. `pipeline/01-sourced/`에 JSON 저장.

수집 완료 후:
- recent-items.json 업데이트
- published-titles.json 업데이트
- 상태 업데이트: `node scripts/pre-check.js source-collector update-state <true|false>`

---

## STEP 2: 취재 (01-sourced → 03-reported)

`pipeline/01-sourced/`의 각 JSON 파일에 대해 (최대 5개):

1. `source.url`을 `web_fetch`로 원문 수집
2. `web_search`로 관련 소스 2~3개 추가 검색
3. 구조화된 취재 브리프 작성:
   - WHO/WHAT/WHY/WHEN/CONTEXT
   - SOURCES (최소 3개, URL+신뢰도)
   - PERSPECTIVES (정부/교육계/기업)
   - SUGGESTED_ANGLE
4. JSON에 `"stage":"reported"` + `"reporting_brief":{...}` 추가
5. `pipeline/03-reported/`에 저장, `pipeline/01-sourced/`에서 삭제

---

## STEP 3: 작성 (03-reported → 04-drafted) — 🔴 **LLM 에이전트 필수**

**사전 상태 확인:**
- `ls -1 /root/.openclaw/workspace/newsroom/pipeline/03-reported/*.json | wc -l` 으로 대기 중인 기사 개수 확인
- 0개면 STEP 3 스킵, 1개 이상이면 아래 실행

**처리 방법:**
`pipeline/03-reported/`의 각 JSON 파일에 대해 (최대 5개), **당신(LLM)이 직접 한국어 기사를 작성:**

각 파일의 `reporting_brief`를 읽고, 아래 규칙에 따라 한국어 기사 HTML을 작성합니다:

**기사 작성 지시:**

**기사 구조 (순서 필수):**
1. 래퍼: `font-family:'Noto Sans KR'`, `max-width:680px`, `font-size:17px`, `line-height:1.9`, `color:#1a1a2e`
2. 리드박스: `border-left:4px solid {accent}`, `background:#f8f9ff`, `padding:18px 22px`, `border-radius:0 8px 8px 0`, `margin-bottom:48px`
3. 본문: h2 섹션 3개+ (각 200자+), `font-size:19px`, `font-weight:700`, `border-bottom:1px solid #e2e8f0`, `padding-bottom:10px`, `margin:44px 0 20px`
4. 단락 여백: `margin:0 0 32px`
5. 인용 블록: `border-left:4px solid {accent}`, `background:#f8f9ff`, `font-style:italic`, `color:#374151`
6. 참고자료 섹션: `border-top:1px solid #e2e8f0`, ol 리스트 — **필수**
7. AI 각주: `<p style="margin:48px 0 0;padding-top:20px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">본 기사는 AI가 작성했습니다 (AI 기본법 제31조)</p>` — **필수**

accent: policy=#4338ca, research=#059669, industry=#d97706, opinion=#7c3aed, data=#0284c7, education=#0891b2

**금지:** ❌ AI 공개 배지(상단 pill) ❌ 수치 카드(display:flex) ❌ article 태그

**최소 1600자** (태그 제거 후 순수 텍스트 기준)

**처리 단계:**
1. `pipeline/03-reported/`의 각 파일을 읽음 (최대 5개)
2. `reporting_brief` 내용 기반으로 **반드시 1600자 이상의 기사를 작성**
3. JSON에 `"stage":"drafted"` + `"draft":{...}` 필드 추가:
   ```json
   "draft": {
     "headline": "기사 제목",
     "subheadline": "부제목",
     "slug": "기사-제목",
     "ghost_tags": ["카테고리", "ai-news"],
     "category": "education",
     "html": "<div>...</div>",
     "custom_excerpt": "요약",
     "references": [{"title": "출처", "url": "..."}],
     "word_count": 1800
   }
   ```
4. 완성된 파일을 **`pipeline/04-drafted/`에 저장**
5. 원본 파일을 **`pipeline/03-reported/`에서 삭제**

**작성 검증:**
- ✅ HTML 문자열 유효성 (태그 닫혀 있나?)
- ✅ 본문 길이 1600자 이상 (태그 제거 후)
- ✅ 필수 요소: 리드박스, h2 섹션 3개+, 참고자료, AI 각주

**완료 후:**
STEP 3 처리 완료를 보고하고, STEP 4(팩트체크)로 진행합니다.

---

## STEP 4: 팩트체크 (04-drafted → 05-fact-checked) — 🔴 **LLM 에이전트 필수**

**사전 상태 확인:**
- `ls -1 /root/.openclaw/workspace/newsroom/pipeline/04-drafted/*.json | wc -l` 으로 대기 중인 기사 개수 확인
- 0개면 STEP 4 스킵, 1개 이상이면 아래 실행

**처리 방법:**
`pipeline/04-drafted/`의 각 JSON 파일에 대해 (최대 5개), **당신(LLM)이 직접 팩트체크를 수행:**

**4층 검증:**
1. **구조**: 리드박스·h2 섹션 3개+·참고자료·AI각주 존재 여부
2. **팩트**: 핵심 주장 2~3개를 `web_search`로 **교차 검증** (반드시 실행)
3. **가독성**: 문장 길이, 톤 일관성 평가
4. **완정도**: 본문 1600자+, 소스 3개+ 확인

**점수 기준:**
- 90+: PASS ✅
- 75-89: FLAG ⚠️ (수정 권고 포함)
- <75: FAIL → `pipeline/rejected/`로 이동 ❌

**처리 단계:**
1. 각 파일의 `draft` 필드를 검토
2. 위 4층 검증을 수행하고 점수 산출
3. JSON에 `"stage":"fact-checked"` + `"fact_check":{...}` 필드 추가:
   ```json
   "fact_check": {
     "score": 85,
     "verdict": "PASS",
     "issues": [],
     "verified_claims": ["주장1 검증됨", "주장2 검증됨"],
     "validated_at": "2026-03-10T09:15:00Z"
   }
   ```
4. 결과 파일을:
   - **PASS/FLAG:** `pipeline/05-fact-checked/`에 저장
   - **FAIL:** `pipeline/rejected/`에 저장
5. 원본 파일을 **`pipeline/04-drafted/`에서 삭제**

**완료 후:**
STEP 4 처리 완료를 보고하고, STEP 5(자동 처리)로 진행합니다.

---

## STEP 5: 후처리 (에디터→교열→발행) — 🟢 **자동 스크립트**

**처리 방법:**
팩트체크 완료 후, 자동 스크립트로 후반 3단계 일괄 처리합니다:

```bash
cd /root/.openclaw/workspace/newsroom
node scripts/pipeline-runner.js
```

**자동 처리 내용:**
- **STEP 5 (에디터):** `05-fact-checked/` 기사들의 구조/중복/본문 길이 검증
- **STEP 6 (교열):** 문법·톤·명확성 점검, 마이너 수정
- **STEP 7 (발행):** Ghost CMS에 **draft 상태**로 발행

**결과:**
- ✅ 발행된 기사: Ghost URL 포함하여 보고
- ⚠️ FLAG된 기사: 원인 포함하여 보고
- ❌ 거부된 기사: 거부 사유 포함하여 보고

**스크립트가 처리한 내용을 확인하고 보고하세요.**

---

## 최종 보고

**다음 형식으로 요약 보고하세요:**

```
🔄 파이프라인 오케스트레이터 실행 완료

STEP 1 (수집): N개 새 기사 수집
STEP 2 (취재): M개 처리 (남은 기사: K개)
STEP 3 (작성): X개 처리 (남은 기사: Y개)
STEP 4 (팩트체크): P개 PASS, Q개 FLAG, R개 FAIL
STEP 5 (자동): S개 발행

Ghost 발행 성공:
- [제목1] (URL)
- [제목2] (URL)
- ...

거부된 기사 (상위 3개):
- [제목]: 이유
```

**각 단계별 처리 수를 명확하게 기록하세요.**
