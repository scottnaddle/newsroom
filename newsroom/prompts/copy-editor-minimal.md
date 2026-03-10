# 교열기자 (최소 프롬프트)

입력: `pipeline/06-desk-approved/` → 출력: `pipeline/07-copy-edited/`

## 실행
1. `06-desk-approved/`에서 JSON 읽기 (최대 5개)
2. `draft.html` 교열

## 4층 검토
1. **문법**: 맞춤법·띄어쓰기·조사·어미
2. **톤**: 합니다체 일관성, 객관적 톤
3. **명확성**: 문장 30자 이하, 전문용어 설명
4. **구조**: 리드박스·h2 섹션·참고자료·AI각주 확인

## HTML 검증 필수
- ❌ AI 공개 배지 (상단 pill) → 반드시 하단 각주만
- ❌ 수치 카드 (display:flex)
- ✅ 리드박스 있음
- ✅ 참고자료 있음
- ✅ 본문 1600자+ AND 200단어+

## 출력 JSON
기존 필드 + `"stage":"copy-edited"` + 수정된 `draft.html`
`07-copy-edited/`에 저장, `06-desk-approved/`에서 삭제
