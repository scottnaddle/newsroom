# 📋 이미지 수정 지시서

**발행처**: 스캇 (Editorial Director)  
**수신처**: Editor/Desk (데스크)  
**발행일**: 2026-03-06 06:07 KST  
**우선순위**: 🔴 높음

---

## 🎯 지시 사항

**현황**: 전체 발행 기사 100개 중 **13개 기사에 이미지 문제** 발생

**지시**: 아래 문제별로 수정 계획을 수립하고, **수정하기 전에 상세 계획을 먼저 보고**해 주세요.

---

## 📊 문제 기사 현황

### 🔴 긴급 (우선순위 1)

#### [이미지 없음] 1개 기사
**조치 필요**: feature_image 필드 추가

| ID | 제목 | 상태 |
|---|---|---|
| 69a9ede1ff4fbf0001ab6b90 | 만평: "AI 쓰나미 앞 뒤처진 교육 행정" | feature_image = null |

**수정 방법**:
1. `get-feature-image.js`로 이미지 생성 (tags 기반)
2. Ghost의 `feature_image` 필드에 새 URL 저장
3. 파이프라인 파일 업데이트

**예상 시간**: 1분

---

### 🔴 긴급 (우선순위 2)

#### [HTTP 404] 12개 기사
**조치 필요**: 깨진 Unsplash 이미지 ID 교체

| # | 제목 | 현재 이미지 | 상태 |
|---|---|---|---|
| 1 | Untitled Article | photo-1526374965328-7f5ae4e8290f | 404 |
| 2 | 미국 학군 1,000개, AI 준비도 편차 드러내다 | photo-1551532336-56ac348a0f7e | 404 |
| 3 | 미국 고교생 절반, 대입 탐색에 AI 활용 | photo-1580485944550-73107b027a9f | 404 |
| 4 | 교육부, 대학 AI 활용 윤리 가이드라인 초안 공개 | photo-1526374965328-7f5ae4e8290f | 404 |
| 5 | Untitled Article | photo-1526374965328-7f5ae4e8290f | 404 |
| 6-12 | ... (외 7개) | 다양함 | 404 |

**수정 방법**:

```bash
# 각 기사별로:
1. Ghost에서 기사 조회 (ID)
2. get-feature-image.js로 새 이미지 생성
   - headline + tags 기반 선택
   - used-images.json 추적 (중복 방지)
3. Ghost PUT 요청으로 feature_image 업데이트
4. 파이프라인 파일 업데이트
```

**배치 실행 스크립트**: 
```javascript
// 12개 기사를 한 번에 처리하는 node.js 스크립트 작성
// → 약 2-3분 소요
```

**예상 시간**: 2-3분

---

## 🔧 수정 계획

### Phase 1: 진단 완료 ✅
- ✅ 전체 100개 기사 스캔
- ✅ 문제 13개 식별
- ✅ 원인 분류

### Phase 2: 수정 계획 수립 (지금 여기) 🔵
**데스크에서 해야 할 일**:
1. 리포트 검토
2. 문제별 수정 전략 확인
3. **다음 단계 승인 여부 결정**

### Phase 3: 수정 실행 (승인 후)
1. [이미지 없음] 1개 → 1분
2. [HTTP 404] 12개 → 2-3분

### Phase 4: 검증
- 모든 기사 feature_image HTTP 200 확인
- Ghost 페이지 방문해서 이미지 표시 확인

---

## 📋 상세 수정 전략

### 1️⃣ [이미지 없음] 만평 기사 (1개)

**기사**: 69a9ede1ff4fbf0001ab6b90  
**제목**: 만평: "AI 쓰나미 앞 뒤처진 교육 행정"

**현황**: 
```json
{
  "feature_image": null,
  "og_image": "https://ubion.ghost.io/content/images/2026/03/cartoon-2026-03-05-1.png"
}
```

**수정 방법**:
```javascript
// 1. feature_image 이미지 생성 (만평이므로 "education" 또는 "opinion" 카테고리)
const imageUrl = getFeatureImageUrl({
  headline: "AI 쓰나미 앞 뒤처진 교육 행정",
  tags: ["만평", "교육정책"],
  recentIdsFile: "/root/.openclaw/workspace/newsroom/shared/config/used-images.json"
});

// 2. Ghost에 PUT 요청
ghostReq('PUT', `/ghost/api/admin/posts/69a9ede1ff4fbf0001ab6b90/?source=html`, {
  posts: [{
    feature_image: imageUrl,
    updated_at: post.updated_at
  }]
});

// 3. 파이프라인 파일 업데이트
// /root/.openclaw/workspace/newsroom/pipeline/cartoon/2026-03-05.json
// → publish_result.feature_image = imageUrl
```

---

### 2️⃣ [HTTP 404] 12개 기사

**원인**: 구식 Unsplash ID (아마도 수개월 전 이미지)

**해결 방법**: 모든 404 이미지를 새로운 것으로 교체

**배치 처리 순서**:

```javascript
const postsToFix = [
  { id: '69a916cde2eb440001d558ef', title: 'Untitled Article', tags: [] },
  { id: '69a8ea83e2eb440001d55883', title: '미국 학군 1,000개...', tags: ['research'] },
  // ... 외 10개
];

for (const post of postsToFix) {
  // 1. 새 이미지 생성
  const newImage = getFeatureImageUrl({
    headline: post.title,
    tags: post.tags,
    recentIdsFile: usedImagesFile
  });
  
  // 2. Ghost 업데이트
  await ghostReq('PUT', `/ghost/api/admin/posts/${post.id}/?source=html`, {
    posts: [{ feature_image: newImage, updated_at: post.updated_at }]
  });
  
  console.log(`✅ ${post.id}: 교체 완료`);
  
  // Rate limit 회피
  await sleep(500);
}
```

**예상 시간**: 2-3분 (500ms × 12 + 처리 시간)

---

## ✅ 검증 체크리스트

수정 완료 후 확인할 항목:

- [ ] 모든 기사 feature_image가 HTTP 200 반환?
- [ ] Ghost 페이지에서 이미지가 표시되는가?
- [ ] 파이프라인 JSON 파일 업데이트됨?
- [ ] 중복 이미지 없는가? (used-images.json 확인)

---

## 📞 질문/결정 사항

데스크가 확인해야 할 사항:

1. **수정 방식**: 
   - ✅ A) 자동 배치 처리 (2-3분) 
   - ⬜ B) 수동 검토 후 하나씩 처리 (10분+)
   - ⬜ C) 먼저 몇 개만 테스트 후 나머지 처리

2. **이미지 선택 기준**:
   - ✅ 기존: get-feature-image.js (카테고리별 64개 검증 풀)
   - ⬜ 새로운: unsplash-smart-search.js (기사 내용 기반)

3. **긴급도**:
   - 💬 이미지 없음: 1개 → 긴급 (사용자 경험)
   - 💬 404: 12개 → 높음 (깨진 링크)

---

## 🚀 다음 단계

1. **지금**: 데스크가 이 계획서를 검토
2. **승인 시**: 수정 스크립트 실행
3. **완료 후**: 검증 체크리스트 확인
4. **보고**: 스캇에게 완료 보고

---

**작성자**: Hailey (AI Assistant)  
**상태**: 📋 데스크 검토 대기  
**예상 완료 시간**: 3-5분 (승인 후)
