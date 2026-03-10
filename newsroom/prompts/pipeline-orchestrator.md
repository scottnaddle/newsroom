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

## STEP 3: 작성 (03-reported → 04-drafted)

`pipeline/03-reported/`의 각 JSON 파일에 대해 (최대 5개):

`reporting_brief` 기반으로 한국어 기사 HTML 작성:

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

JSON에 `"stage":"drafted"` + `"draft":{headline, subheadline, html, slug, ghost_tags[], custom_excerpt, references[], word_count, category}` 추가.
`pipeline/04-drafted/`에 저장, `pipeline/03-reported/`에서 삭제.

---

## STEP 4: 팩트체크 (04-drafted → 05-fact-checked)

`pipeline/04-drafted/`의 각 JSON 파일에 대해 (최대 5개):

**4층 검증:**
1. **구조**: 리드박스·h2 섹션 3개+·참고자료·AI각주 존재
2. **팩트**: 핵심 주장 2~3개를 `web_search`로 교차 검증
3. **가독성**: 문장 길이, 톤 일관성
4. **완정도**: 본문 1600자+, 소스 3개+

**점수 기준:**
- 90+: PASS
- 75-89: FLAG (수정 권고 포함)
- <75: FAIL → `pipeline/rejected/`로 이동

JSON에 `"stage":"fact-checked"` + `"fact_check":{score, verdict, issues[], verified_claims[]}` 추가.
`pipeline/05-fact-checked/`에 저장, `04-drafted/`에서 삭제.

---

## STEP 5: 후처리 (에디터→교열→발행)

팩트체크 완료 후, 자동 스크립트로 후반 3단계 일괄 처리:

```
node /root/.openclaw/workspace/newsroom/scripts/pipeline-runner.js
```

이 스크립트가 `05-fact-checked/` → 에디터검증 → 교열 → Ghost 발행(draft)까지 자동 처리.

결과 출력을 확인하고 보고.

---

## 최종 보고

간단히 보고:
- 수집: N개 새 기사
- 취재→작성→팩트체크→발행: 각 단계별 처리 수
- 탈락: N개 (이유 간략히)
- Ghost 발행: 제목 + URL (있으면)
