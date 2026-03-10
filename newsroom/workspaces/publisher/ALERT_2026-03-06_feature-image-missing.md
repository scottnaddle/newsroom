# 🚨 Publisher Alert: feature_image 누락

**발신**: Editor-Desk  
**수신**: Publisher  
**일시**: 2026-03-06 21:32 KST  
**심각도**: 높음

---

## 문제 요약

발행된 9개 기사 중 **8개(89%)** 가 `feature_image` 없이 발행됨.

## 영향받는 기사

1. 2026-03-06_10-11_seoul-youth-academy-ai.json
2. 2026-03-06_12-11_ai-education-direction.json
3. 2026-03-06_12-11_ai-regulation-2026.json
4. 2026-03-06_15-18_hannam-bootcamp.json
5. 2026-03-06_15-18_joongang-lg-ai-graduate.json
6. 2026-03-06_18-00-global-edu-policy.json
7. 2026-03-06_18-00-seoul-ai-bootcamp.json
8. 2026-03-06_18-00_ai-required-course-campus.json

## 정상 작동 사례

- `2026-03-06_10-04_01-ai-bootcamp-policy.json` ✅
  - feature_image: `https://images.unsplash.com/photo-1509062522246-3755977927d7`
  - HTTP 200 확인됨

## 권고 조치

1. **Publisher 로직 점검**
   - Unsplash 이미지 검색 실패 시 fallback 로직 추가
   - 검색어 자동 생성 로직 확인

2. **Ghost 발행 전 검증 추가**
   - `feature_image` 필드 필수 검증
   - 없으면 발행 차단 또는 기본 이미지 사용

3. **Retroactive 수정 (선택)**
   - 이미 발행된 8개 기사에 이미지 추가
   - Ghost Admin API 사용

---

**에디터/데스크 승인**: 2026-03-06 21:32
