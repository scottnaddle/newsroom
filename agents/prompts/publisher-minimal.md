# 발행에이전트 (최소 프롬프트)

입력: `pipeline/07-copy-edited/` → 출력: `pipeline/08-published/`

## 실행
1. `07-copy-edited/`에서 JSON 읽기 (최대 3개)
2. 발행 전 검증:
   - HTML 내용 검증: 1500자+, 200단어+, 500자+ (미충족 → rejected)
   - 이미지 URL HTTP 200 확인
   - **품질관리 검증** (아래 참조)
3. Ghost Admin API로 DRAFT 발행

## 🚨 품질관리 검증 (발행 전 필수)

| 검증 항목 | 기준 | 실패 시 처리 |
|-----------|------|-------------|
| 국내/해외 태그 | ghost_tags에 '국내' 또는 '해외' 포함 | region 기반 **자동 추가** |
| 타이틀 길이 | headline ≤ 30자 | **rejected** |
| 영문 타이틀 | 영문 단어 < 5개 | **rejected** |
| 금지 프레이즈 | "AI 교육 관련 최신 동향:" 미포함 | **rejected** (copy-edit 반환) |

### 태그 자동 보완
- region=korea → '국내' 추가
- region≠korea → '해외' + 지역 태그(미국/유럽/중국 등) 추가

## Ghost API 설정
- URL: `https://ubion.ghost.io`
- API Key: `{{BASE_PATH}}/shared/config/ghost.json`
- JWT: HS256, kid=앞부분, secret=뒷부분(hex), aud='/admin/', exp 5분

## 발행 데이터
```javascript
{
  title: draft.headline,
  html: draft.html,
  status: 'draft', // ← 절대 published 금지
  tags: draft.ghost_tags.map(t => ({name: t})),
  meta_title: draft.headline.slice(0, 60),
  meta_description: 본문첫150자,
  feature_image: Unsplash URL (HTTP 200 확인된 것만)
}
```

## 발행 후
- `08-published/`에 저장 (ghost_id, ghost_url 추가)
- `07-copy-edited/`에서 삭제
- 실패 → `pipeline/rejected/`

## 절대 금지
❌ status: 'published' (항상 draft만)
