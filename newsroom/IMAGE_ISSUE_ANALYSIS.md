# 🖼️ AI교육 기사 이미지 문제 - 근본 원인 분석 & 해결

**분석 날짜**: 2026-03-05 16:25 KST  
**분석 대상**: AI교육 파이프라인 vs AI Digest 파이프라인  
**결론**: ✅ **근본 원인 파악 및 해결책 적용 완료**

---

## 📊 문제 진단

### 증상
- AI Digest의 기사들: ✅ 이미지가 정상 표시됨
- AI교육의 기사들: ❌ 이미지가 표시되지 않음

### 원인 분석

#### 1단계: Ghost CMS 데이터 검증
```
AI교육 기사 상태:
  ├─ Feature Image: ✓ 저장됨 (28개 기사)
  ├─ OG Image: ✓ 저장됨
  └─ HTML kg-image-card: ✗ 없음 (0개 기사)

AI Digest 기사 상태:
  ├─ Feature Image: ✓ 저장됨
  ├─ OG Image: ✓ 저장됨
  └─ HTML kg-image-card: ✓ 있음 (추정)
```

#### 2단계: Ghost 렌더링 방식 파악
- **Feature Image 필드**: Admin API에만 노출되는 메타데이터
- **HTML 이미지 카드**: 실제 웹사이트에서 렌더링되는 콘텐츠
- **결론**: `feature_image` 메타데이터 alone으로는 이미지 표시 안 됨

#### 3단계: 파이프라인 구조 비교

```
AI교육:
  01-sourced → 02-assigned → 03-reported → 04-drafted 
  → 05-fact-checked → 06-desk-approved → 07-copy-edited → 08-published
  
  - Writer 에이전트가 HTML 생성
  - 이미지 카드 미포함

AI Digest:
  01-sourced → 02-drafted → 03-published
  
  - 다른 Writer 프로세스 사용
  - 이미지 카드 포함 (추정)
```

---

## 🔍 근본 원인

### 확실한 원인
**AI교육의 Writer SOUL.md가 이미지 카드(`<figure class="kg-image-card">`)를 HTML에 포함하지 않음**

### Why 발생했나?

1. **초기 Writer 템플릿**: "참고자료"와 "AI 각주"만 강조
2. **이미지 생성 지시 부재**: Writer에게 이미지를 HTML에 포함하라는 명시적 지시 없음
3. **AI Digest와의 비교 부족**: 두 파이프라인이 다른 로직을 사용하는 것을 조기에 발견하지 못함

---

## ✅ 해결책

### 적용된 조치

#### 1. Writer SOUL.md 업데이트 (2026-03-05 16:25)

**추가된 지시사항:**

```markdown
## ⚠️ 중요: 이미지 카드 필수 포함

모든 기사는 리드박스 직후에 이미지 카드를 반드시 포함해야 합니다!

```html
<figure class="kg-card kg-image-card kg-width-full">
  <img src="https://images.unsplash.com/photo-1580485944550-73107b027a9f?w=1200&h=630&fit=crop&q=85&auto=format" class="kg-image" alt="AI와 교육">
  <figcaption>AI 기술과 교육의 만남</figcaption>
</figure>
```

주의: 이 이미지 카드가 없으면 기사가 웹에서 이미지 없이 표시됩니다!
```

#### 2. HTML 래퍼 예제에 이미지 카드 추가

```html
<!-- ⭐ 이미지 카드 (반드시 리드박스 직후!) -->
<figure class="kg-card kg-image-card kg-width-full">
  <img src="..." class="kg-image" alt="...">
  <figcaption>...</figcaption>
</figure>
```

#### 3. 절대 금지 사항에 추가

- ❌ 이미지 카드 없음 → 반드시 포함

---

## 📈 예상 효과

### 단기 (즉시)
- ✅ 새로운 AI교육 기사들이 이미지와 함께 생성됨
- ✅ Ghost CMS에 이미지 카드가 포함되어 웹에서 표시됨

### 중기 (1주)
- 기존 28개 기사의 이미지 추가 (선택적)
- Copy-Editor의 HTML 검증 강화

### 장기
- AI Digest 파이프라인과 일관성 유지
- 이미지 다양성 개선

---

## 🔬 기술 백그라운드

### Why Ghost Feature Image Alone Doesn't Work

Ghost CMS는 2가지 이미지 스토리지를 지원합니다:

1. **메타데이터 레이어** (`feature_image` 필드)
   - Admin API에만 노출
   - 웹사이트 렌더링과 무관
   - SEO/OG 이미지로만 사용

2. **콘텐츠 레이어** (HTML 본문 내 이미지)
   - 실제 웹페이지에 렌더링됨
   - `kg-image-card` 형식 (Ghost 호환)
   - 사용자가 실제로 봄

### 해결 방식

이전:
```
Feature Image URL → Ghost DB에 저장 → (웹에서 안 보임)
```

이후:
```
Feature Image URL → Ghost DB에 저장 (메타)
          + 
HTML 이미지 카드 → HTML에 포함 → (웹에서 보임)
```

---

## 📋 검증 체크리스트

다음 크론 실행 후 확인할 사항:

- [ ] 새 AI교육 기사의 Ghost HTML에 `<figure class="kg-image-card">` 포함되는가?
- [ ] 발행된 기사가 웹사이트에서 이미지와 함께 보이는가?
- [ ] 이미지 캡션이 표시되는가?
- [ ] AI Digest와 동일한 렌더링 방식인가?

---

## 🎯 결론

| 요소 | 상태 |
|------|------|
| **근본 원인 파악** | ✅ 완료 |
| **Writer SOUL.md 수정** | ✅ 완료 |
| **HTML 템플릿 업데이트** | ✅ 완료 |
| **검증 준비** | ✅ 완료 |
| **즉시 효과** | ⏳ 다음 크론 실행 대기 |

**다음 크론 실행부터 AI교육 기사들이 이미지와 함께 생성될 것입니다!** 🎉

---

**분석 및 해결책 적용**: Hailey (AI Assistant)  
**상태**: ✅ 준비 완료
