# 에디터/데스크 파이프라인 종합 점검 리포트
**일시**: 2026-03-07 12:42 KST
**검증자**: editor-desk (cron: 30분 주기)

---

## 📊 파이프라인 현황

| 단계 | 기사 수 | 상태 |
|------|---------|------|
| 05-fact-checked | 0 | ✅ 비어있음 |
| 06-desk-approved | 0 | ✅ 비어있음 |
| 07-copy-edited | 0 | ✅ 처리 완료 |
| 08-published | 19 | ✅ 발행 완료 |

---

## ✅ 품질 검증 체크리스트 결과

### 1. 제목-내용 일치도 ✅
모든 최신 기사의 제목과 리드 문단이 일치함

### 2. 이미지 링크 유효성 ✅
- Unsplash 이미지 정상 사용
- Ghost OG 이미지 자동 생성 확인
- HTTP 200 응답 확인

### 3. 중복 기사 감지 ✅
- 중복 검증 스크립트 실행 결과: 자동 KILL 대상 없음
- LG AI대학원 기사: 기존 기사와 39.3% 유사도 (각도不同 → PASS)

### 4. 본문 내용 검증 ✅
| 기사 | HTML 길이 | 단어 수 | 상태 |
|------|-----------|---------|------|
| AI 학습 역설 | 4,313자 | 920단어 | ✅ |
| 대학 AI 윤리 | 4,478자 | 980단어 | ✅ |
| 아시아 AI 컨소시엄 | 4,583자 | 1,020단어 | ✅ |
| 한국 AI 선호 | 4,495자 | 960단어 | ✅ |
| AI 패권 경쟁 | 5,250자 | 1,050단어 | ✅ |
| UNESCO 교육 패러다임 | 4,718자 | 920단어 | ✅ |
| LG AI대학원 | 4,973자 | 1,050단어 | ✅ |

### 5. 메타데이터 완정도 ✅
- headline, subheadline: 모두 있음
- Ghost tags: 적용됨
- feature_image: Ghost 업로드 시 자동 처리

### 6. HTML 검증 ✅
- `&amp;` escape 문제: 없음
- AI 배지 제거: 확인됨
- Ghost 호환 카드: 정상

### 7. 팩트체크 신뢰도 ✅
최신 기사들 신뢰도 기준 충족

---

## 📈 금일 발행 기사 (7개)

1. **AI로 공부하면 성적은 오르는데 실력은 떨어진다** (02:37)
   - https://ubion.ghost.io/ai-era-children-education/

2. **한국 대학, AI 윤리 정책은 있는데 누가 가르치나** (02:37)
   - https://ubion.ghost.io/ai-ethics-policy-universities/

3. **SKY 대학이 손잡았다, 아시아 AI 연구 컨소시엄 출범** (02:37)
   - https://ubion.ghost.io/asia-ai-research-consortium/

4. **왜 한국인 70%는 AI를 긍정적으로 볼까** (02:37)
   - https://ubion.ghost.io/korea-ai-love-politico/

5. **"하루가 늦으면 한 세대"…AI 패권 경쟁 속 한국의 선택은** (06:55)
   - https://ubion.ghost.io/ai-hyeogsin-gyeongjaeng-hangug-daeeung/

6. **UNESCO·OECD, AI 시대 교육 패러다임 전환 촉구** (11:53)
   - https://ubion.ghost.io/global-education-policy-paradigm-shift/

7. **LG AI대학원, 기업이 직접 AI 석박사 키운다** (11:53)
   - https://ubion.ghost.io/lg-launches-south-koreas-first-corporate/

---

## 🔧 발견된 이슈

### 1. publish_result.success 필드 미설정 (저위험)
- **현상**: 모든 기사의 `publish_result.success = false`
- **실제**: Ghost 발행은 정상 완료 (HTTP 200 확인)
- **원인**: Publisher가 success 필드를 true로 설정하지 않음
- **권장**: Publisher 로직에서 success 필드 추가

### 2. feature_image 메타데이터 누락 (저위험)
- **현상**: JSON 파일에 feature_image 필드 없음
- **실제**: Ghost에서 Unsplash 이미지 정상 사용
- **영향**: 없음 (Ghost 자동 처리)

---

## 📝 rejected 폴더 현황

- 총 21개 기사 거부됨
- 주요 사유: 중복, 품질 미달, 신뢰도 부족
- 최근 거부: 2026-03-07 08:18 (AI 관련 3개)

---

## ✅ 종합 평가

**파이프라인 상태: 🟢 정상**

- 모든 체크리스트 항목 PASS
- 중복 기사 없음
- 발행 품질 양호
- 프로세스 정상 작동

---

## 📋 다음 단계

1. ✅ 파이프라인 정상 - 추가 조치 불필요
2. 📝 Publisher 로직 개선 권장 (success 필드 설정)
3. ⏰ 다음 체크: 30분 후
