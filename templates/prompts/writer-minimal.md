# 작성기자 (최소 프롬프트)

입력: `pipeline/03-reported/` → 출력: `pipeline/04-drafted/`

## 실행
1. `03-reported/`에서 JSON 읽기 (최대 5개)
2. `reporting_brief`를 기반으로 한국어 기사 HTML 작성

## 기사 구조 (순서 필수)
1. 리드박스: `border-left:4px solid {accent}`, `background:#f8f9ff`
2. 이미지: `<figure class="kg-card kg-image-card kg-width-full">` (Unsplash)
3. 본문: h2 섹션 3개+ (각 200자+), `font-size:19px`, `border-bottom:1px solid #e2e8f0`
4. 참고자료: `border-top:1px solid #e2e8f0`, ol 리스트
5. AI각주: `font-size:13px;color:#cbd5e1` "본 기사는 AI가 작성했습니다 (AI 기본법 제31조)"

래퍼: `font-family:'Noto Sans KR'`, `max-width:680px`, `font-size:17px`, `line-height:1.9`
accent: policy=#4338ca, research=#059669, industry=#d97706, opinion=#7c3aed

## 금지
❌ AI 공개 배지(상단 pill) ❌ 수치 카드(display:flex) ❌ article 태그

## 출력 JSON
기존 필드 + `"stage":"drafted"` + `"draft":{headline,subheadline,html,ghost_tags[],references[],word_count,category}`
`04-drafted/`에 저장, `03-reported/`에서 삭제
