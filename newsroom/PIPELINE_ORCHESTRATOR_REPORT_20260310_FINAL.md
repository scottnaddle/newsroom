# 🔄 파이프라인 오케스트레이터 실행 완료

**실행 시각:** 2026년 3월 10일 수요일 07:00 AM (Asia/Seoul) / 22:01 UTC

---

## 최종 보고

### STEP 1 (소스 수집): ✓ 7개 새 기사 수집

**검색 쿼리:** 6개 (rate limit 제약으로 일부 제한)
- "AI 교육 정책 2026" (한국)
- "인공지능 대학 교육과정" (한국)
- "AI education policy 2026" (영문)
- "AI 리터러시 교육" (한국)
- "artificial intelligence higher education" (영문)
- "에듀테크 AI 학교" (한국)

**수집 결과:**
- 총 검색 결과: 19개
- 65점 이상 필터: 7개
- 저장 위치: `pipeline/01-sourced/`
- 상태: ✓ source-collector state 업데이트 완료

**수집된 기사 목록:**
1. 'AI 중점학교' 1141개교 선정…특별교부금 385억 원 지원 (점수: 95) ⭐
2. 초·중등 인공지능(AI) 중점학교 운영 (점수: 90)
3. "금지 대신 필수 교양으로"…대학가 덮친 AI, 교육·평가 판도 바꾼다 (점수: 85)
4. AI 교육혁명 2026: 영국·미국 동시 착수한 거버넌스 강화와 한국의 과제 (점수: 90)
5. "AI·사이버 융합 인재 양성"··· '2026 AI·사이버융합 최고위 과정 제2기' 개강 (점수: 80)
6. 용산구, 2026년 교육협력특화지구 사업 본격 운영 (점수: 75)
7. Cantwell, Moran Introduce Bill to Boost AI Education (점수: 80)

---

### STEP 2 (취재): ✓ 5개 처리 (남은 기사: 2개)

**처리 내용:**
- 각 기사별 WHO/WHAT/WHY/WHEN/CONTEXT 취재 브리프 작성
- 관련 소스 추가 수집 (정부 공식 발표, 언론 보도, 학교 사례)
- 주요 이해관계자 관점 정리 (정부, 교육계, 산업계, 우려 그룹)

**처리된 기사:**
1. "'AI 중점학교' 1141개교 선정…특별교부금 385억 원 지원"
2. "초·중등 인공지능(AI) 중점학교 운영"
3. ""금지 대신 필수 교양으로"…대학가 덮친 AI, 교육·평가 판도 바꾼다"
4. "AI 교육혁명 2026: 영국·미국 동시 착수한 거버넌스 강화와 한국의 과제"
5. ""AI·사이버 융합 인재 양성"··· '2026 AI·사이버융합 최고위 과정 제2기' 개강"

**이동:**
- `pipeline/01-sourced/` → `pipeline/03-reported/`
- 상태: 완료

---

### STEP 3 (작성): ⚠️ 1개 처리 (남은 기사: 5개)

**완성된 기사:**
- 제목: "'AI 중점학교' 1141개교 선정…특별교부금 385억 원 지원"
- 단어 수: 1,404자 (요구사항 1,600자 대비 88%)
- 구조: ✓ 리드박스, h2 섹션 4개, 참고자료, AI 각주 포함
- 저장: `pipeline/04-drafted/source_1_95_reported_drafted.json`

**기사 구조 (예시):**
```
┌─ 리드박스 (accent color: policy #4338ca)
│  └─ "전국 1,141개 학교에서 인공지능 교육 본격화"
├─ h2: 전국 규모의 AI 중점학교 선정 (349자)
├─ h2: AI 교육과정 개편과 교사 연수 (428자)
├─ h2: 교육 인프라 구축과 지역격차 해소 (381자)
├─ h2: 글로벌 트렌드와의 일맥상통 (289자)
├─ 참고자료 섹션 (3개 링크)
└─ AI 각주 (AI 기본법 제31조)
```

**상태:** 남은 5개 기사는 STEP 3 작성 대기 중

---

### STEP 4 (팩트체크): ⏳ 대기

**예정된 검증:**
- 4층 검증 (구조, 팩트, 가독성, 완정도)
- 핵심 주장 2~3개를 web_search로 교차 검증
- 점수 기준:
  - 90+: PASS ✅
  - 75-89: FLAG ⚠️
  - <75: FAIL ❌

**현황:**
- 대기 중인 기사: 04-drafted 1개, 03-reported 5개
- 준비 상태: STEP 3 완성 후 진행 예정

---

### STEP 5 (자동 처리): ⚠️ Ghost API 오류

**실행 결과:**
- pipeline-runner.js 실행 완료
- 처리 대상: 07-copy-edited 3개 기사 감지
- Ghost CMS 발행 시도: ✗ 실패 (HTTP 401 - Invalid JWT Token)

**오류 분석:**
```
Ghost API 오류: {"errors":[{"message":"Invalid token: invalid signature","code":"INVALID_JWT"}]}
원인: Ghost API 토큰 만료 또는 설정 오류
영향: draft 상태 발행 불가 (rejected/로 이동)
```

**거부된 기사 (3개):**
1. korea-ai-policy-school-selection.json - Ghost API 401
2. university-ai-education-reform.json - Ghost API 401
3. us-ai-education-bill.json - JSON 파싱 오류

---

## 📊 파이프라인 상태 트리

```
📁 /pipeline/
├── 01-sourced/           → 2개 (대기 중)
├── 03-reported/          → 5개 (STEP 3 작성 필요)
├── 04-drafted/           → 1개 (STEP 4 팩트체크 필요)
├── 05-fact-checked/      → 0개
├── 06-desk-approved/     → 0개
├── 07-copy-edited/       → 0개
├── 08-published/         → 0개
└── rejected/             → 3개 (Ghost API 오류)
```

---

## 📈 최종 통계

| 단계 | 상태 | 기사 수 |
|-----|------|--------|
| STEP 1: 수집 | ✓ 완료 | 7개 |
| STEP 2: 취재 | ✓ 완료 | 5개 |
| STEP 3: 작성 | ⚠️ 부분 | 1/6개 |
| STEP 4: 팩트 | ⏳ 대기 | 0/6개 |
| STEP 5: 발행 | ✗ 오류 | 0/6개 |
| **미처리** | | 2개 (01-sourced 대기) |
| **거부됨** | | 3개 (Ghost API) |

---

## 🔧 다음 단계 & 권장 사항

### 긴급 조치:
1. **Ghost CMS API 토큰 갱신**
   - Ghost 관리 대시보드에서 API 토큰 재생성
   - 환경 변수 `GHOST_API_KEY` 업데이트
   - pipeline-runner.js 재실행

2. **STEP 3 기사 작성 완성**
   - 남은 5개 기사에 대해 1,600자 이상의 HTML 작성
   - Unsplash에서 category별 이미지 선택 (policy, education, research)
   - 각 기사 리드박스, h2 섹션 3개+, 참고자료, AI 각주 확인

3. **Web Search API Rate Limit 관리**
   - 현재: 1초에 1개 요청만 가능 (Free 플랜)
   - 개선안: 요청을 10-15초 간격으로 분산 또는 유료 플랜 업그레이드

### 최적화:
1. STEP 3 기사 작성 자동화 스크립트 개발
2. STEP 4 팩트체크 웹 검색 배치 처리
3. Ghost CMS 통합 테스트 자동화

---

**보고 완료 시각:** 2026-03-10 22:02:42 UTC (한국시간 07:02 AM)

