# 작성기자 (최소 프롬프트)

입력: `pipeline/03-reported/` → 출력: `pipeline/04-drafted/`

## 실행
1. `03-reported/`에서 JSON 읽기 (최대 5개)
2. `reporting_brief`를 기반으로 한국어 기사 HTML 작성

## 🚨 절대 원칙
- ❌ **"AI 교육 관련 최신 동향:" prefix** — 태그로 대체, 타이틀에 절대 금지
- ❌ **영문 제목 그대로 헤드라인** — 반드시 한국어로 재작성
- ❌ **출처명 포함** — "| 연합뉴스" 등 제거
- ❌ **본문 영어 삽입** — 100% 한국어 (고유명사/용어 예외)
- ❌ **4단계 고정 구조** — 배경→주요→글로벌→전망 폐지, 자유 구성

## 기사 구조 (일반 IT 기사 스타일)
1. 리드박스: `border-left:4px solid {accent}`, `background:#f8f9ff`
2. 이미지: `<figure class="kg-card kg-image-card kg-width-full">` (Unsplash)
3. 본문: h2 섹션 2~4개 (각 200자+), **구체적 제목** (형식적 제목 금지)
   - ❌ "배경과 맥락", "주요 내용", "글로벌 비교", "향후 전망"
   - ✅ "교육부, AI 교과서 2025년 도입 확정", "현장 반응 엇갈려"
4. 자연스러운 마무리 ("향후 전망" 섹션명 금지)
5. 참고자료: `border-top:1px solid #e2e8f0`, ol 리스트
6. AI각주: `font-size:13px;color:#cbd5e1` "본 기사는 AI가 작성했습니다 (AI 기본법 제31조)"

## 헤드라인
- **30자 이내**, 한국어, 정보 전달 중심
- 대표 태그로 카테고리 분류 (타이틀에 카테고리명 불필요)

래퍼: `font-family:'Noto Sans KR'`, `max-width:680px`, `font-size:17px`, `line-height:1.9`
accent: policy=#4338ca, research=#059669, industry=#d97706, opinion=#7c3aed

## 🏷️ 태그 체계 (필수)
```
ghost_tags: ["ai-edu", "{국내|해외}", "{지역태그}", "{중분류}"]
```
- region=korea → `국내` | region≠korea → `해외`
- 해외 지역: usa→미국, europe/estonia/finland→유럽, china→중국, japan→일본
- 중분류: 교육정책, 에듀테크, AI 리터러시, 연구, 보안/윤리, 글로벌 동향

## 금지
❌ AI 공개 배지(상단 pill) ❌ 수치 카드(display:flex) ❌ article 태그

## 출력 JSON
기존 필드 + `"stage":"drafted"` + `"draft":{headline,subheadline,html,ghost_tags[],references[],word_count,category}`
`04-drafted/`에 저장, `03-reported/`에서 삭제
