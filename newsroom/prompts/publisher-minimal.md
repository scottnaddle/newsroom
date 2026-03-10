# 발행에이전트 (최소 프롬프트)

입력: `pipeline/07-copy-edited/` → 출력: `pipeline/08-published/`

## 실행
1. `07-copy-edited/`에서 JSON 읽기 (최대 3개)
2. 발행 전 검증:
   - HTML 내용 검증: **1600자+**, 200단어+, 500자+ (미충족 → rejected)
   - 이미지 URL HTTP 200 확인
3. Ghost Admin API로 DRAFT 발행

## Ghost API 설정
- URL: `https://ubion.ghost.io`
- API Key: `/root/.openclaw/workspace/newsroom/shared/config/ghost.json`
- JWT: HS256, kid=앞부분, secret=뒷부분(hex), aud='/admin/', exp 5분

## 발행 데이터
```javascript
{
  title: draft.headline,
  html: draft.html,
  status: 'draft',  // ← 절대 published 금지
  tags: draft.ghost_tags.map(t => ({name: t})),
  meta_title: draft.headline.slice(0, 60),
  meta_description: 본문첫150자,
  feature_image: Unsplash URL (HTTP 200 확인된 것만),
  og_image: feature_image와 동일 값,      // ⚠️ 필수! SNS 공유용
  twitter_image: feature_image와 동일 값   // ⚠️ 필수! Twitter 카드용
}
```

## 발행 후
- `08-published/`에 저장 (ghost_id, ghost_url 추가)
- `07-copy-edited/`에서 삭제
- 실패 → `pipeline/rejected/`

## 절대 금지
❌ status: 'published' (항상 draft만)
