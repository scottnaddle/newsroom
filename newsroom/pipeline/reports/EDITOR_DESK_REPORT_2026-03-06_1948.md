# 📋 에디터/데스크 검증 리포트

**실행 시간**: 2026-03-06 19:48 (KST)
**검증 기사**: 3개
**소요 시간**: 약 5분

---

## 📊 검증 결과 요약

| 기사 | 신뢰도 | FLAG | 중복 | 이미지 | HTML | 최종 결정 |
|------|--------|------|------|--------|------|-----------|
| 서울시립대 AI 부트캠프 | 91점 | 0 | ✅ PASS | ✅ 200 | ✅ 정상 | ⚡ 07-copy-edited |
| UNESCO·한국 교육 대전환 | 89점 | 0 | ✅ PASS | ✅ 200 | ✅ 정상 | ✅ 06-desk-approved |
| AI 필수과목 의무화 | 84점 | 1 | ✅ PASS | ✅ 200 | ✅ 정상 | ✅ 06-desk-approved |

---

## 🔍 체크리스트 실행 결과

### ✅ 1. 제목-내용 일치도
- global-edu-policy: 95% 일치 ✅
- seoul-ai-bootcamp: 95% 일치 ✅
- ai-required-course-campus: 90% 일치 ✅

### ✅ 2. 이미지 링크 유효성
- 3개 모두 Unsplash URL → HTTP 200 확인 ✅
- &amp; 이스케이프 문제 없음 ✅

### ✅ 3. 중복 기사 감지
- 스크립트 실행 결과: KILL 0개, FLAG 0개, PASS 3개
- 최대 유사도 24.2% (기준 85% 미만) ✅

### ✅ 4. 본문 내용 검증
- global-edu-policy: 3731자 / 890단어 ✅
- seoul-ai-bootcamp: 3826자 / 920단어 ✅
- ai-required-course-campus: 4255자 / 1050단어 ✅

### ✅ 5. 메타데이터 완정도
- 3개 모두 feature_image, og_image, meta_title 존재 ✅

### ✅ 6. HTML 검증
- &amp; 이스케이프: 0개 ✅
- AI 배지 없음 ✅
- AI 각주 있음 ✅

### ✅ 7. 팩트체크 신뢰도
- seoul-ai-bootcamp: 92점 ✅
- global-edu-policy: 88점 ✅
- ai-required-course-campus: 82점 ⚠️ (1 FLAG)

---

## 🚨 FLAG 상세

### ai-required-course-campus (84점)
**FLAG 1개**: "수업·평가 AI 활용 가이드라인 2026년 2월 안내 예정"
- **판단**: '안내 예정' 상태로 확정 여부 미확인
- **데스크 결정**: 비치명적. 승인 후 발행 진행
- **비고**: 추후 가이드라인 확정 시 업데이트 권고

---

## 📈 파이프라인 현황

```
05-fact-checked: 0개 (비움)
06-desk-approved: 2개
  - global-edu-policy (89점)
  - ai-required-course-campus (84점, FLAG 1)
07-copy-edited: 1개 (신규)
  - seoul-ai-bootcamp (91점)
08-published: 6개 (기존)
```

---

## 🎯 권고 사항

1. **06-desk-approved → Publisher 실행 준비됨**
   - 2개 기사 승인 완료
   - Copy Editor가 07-copy-edited 처리 후 Publisher로 전달

2. **07-copy-edited → Copy Editor 대기**
   - seoul-ai-bootcamp (91점) 즉시 교열 가능

3. **다음 데스크 실행 시 확인 필요**
   - ai-required-course-campus: 가이드라인 확정 여부 추적

---

## 📝 검증 스크립트 실행 로그

```bash
# 중복 검증
node check-duplicates-before-approval.js
→ 총 검사: 3개 | PASS: 3개 | KILL: 0개

# 이미지 유효성
curl -I {unsplash_urls}
→ 3개 모두 HTTP 200

# HTML 검증
grep "&amp;" *.json → 0개
```

---

**검증자**: Editor-Desk Agent
**다음 실행**: 30분 후 (cron schedule)
