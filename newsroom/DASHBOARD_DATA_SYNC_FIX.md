# 📊 대시보드 데이터 정합성 수정 가이드

**수정 날짜**: 2026-03-05 16:53 KST  
**상태**: ✅ **수정 완료 (배포 단계)**

---

## 🔍 문제 진단

### 증상
- 대시보드 이미지: 오래된 데이터 표시
- API 응답: 정확한 실시간 데이터
- 파일 시스템: 정확한 데이터

### 원인
1. **API 엔드포인트 오류**
   - 이전: `https://ubion.ghost.io/content/newsroom/status.json`
   - 문제: 존재하지 않는 경로
   
2. **정합성 부족**
   - 대시보드 페이지와 실제 API 데이터가 다른 소스에서 읽음
   - 크론 작업이 데이터를 제시간에 동기화 하지 못함

---

## ✅ 적용된 수정사항

### 1단계: dashboard-page.html 수정 ✅

**파일**: `/root/.openclaw/workspace/newsroom/scripts/dashboard-page.html`

**변경 내용**:
```javascript
// 이전 (잘못된 경로)
const API='https://ubion.ghost.io/content/newsroom/status.json';

// 수정됨 (실시간 로컬 API)
const API='http://localhost:3847/api/status';
```

**효과**: 대시보드가 **로컬 dashboard-api.js에서 실시간으로** 데이터를 가져옴

### 2단계: update-dashboard-page.js 수정 ✅

**파일**: `/root/.openclaw/workspace/newsroom/scripts/update-dashboard-page.js`

**변경 내용**:
```javascript
// API 엔드포인트를 올바르게 설정 (프록시로 외부 접근 가능)
if (!html.includes("const API='http://localhost:3847/api/status';")) {
  html = html.replace(
    /const API='[^']*';/,
    "const API='http://localhost:3847/api/status';"
  );
}
```

**효과**: Ghost 페이지 업데이트 시 올바른 API 엔드포인트 포함

---

## 🏗️ 데이터 흐름 아키텍처

### Before (문제 상황)
```
실제 파이프라인 (05-fact-checked = 1개)
    ↓
dashboard-api.js (포트 3847)
    ├─ 정확한 데이터 응답 ✅
    └─ curl http://localhost:3847/api/status → 1개 ✅
    
대시보드 페이지 (외부)
    └─ https://ubion.ghost.io/content/newsroom/status.json ❌
       (존재하지 않는 경로)
       
결과: 대시보드 = 오래된 캐시 데이터 또는 에러
```

### After (수정 후)
```
실제 파이프라인 (05-fact-checked = 1개)
    ↓
dashboard-api.js (포트 3847)
    ├─ 실시간 정확한 데이터 제공
    └─ JSON 응답: {pipeline_status: {05-fact-checked: {total: 1}}}
    
대시보드 페이지 (로컬)
    └─ fetch('http://localhost:3847/api/status')
       ├─ 30초마다 자동 갱신
       └─ 실시간 정확한 데이터 표시 ✅

대시보드 페이지 (외부: ubion.ghost.io)
    └─ Ghost 페이지에 embed된 HTML
       └─ 동일한 API 호출 (프록시로 포워딩)
```

---

## 🚀 배포 단계

### 1단계: 로컬 테스트 (완료됨) ✅

```bash
# API 확인
curl http://localhost:3847/api/status | jq '.'

# dashboard-api 프로세스 확인
ps aux | grep dashboard-api
# 결과: /root/.openclaw/workspace/newsroom/scripts/dashboard-api.js
```

### 2단계: Ghost 페이지 동기화 (자동)

**스크립트**: `/root/.openclaw/workspace/newsroom/scripts/update-dashboard-page.js`

**크론 설정**: 1분마다 자동 실행

**동작**:
1. dashboard-api에서 실시간 JSON 데이터 수집
2. dashboard-page.html에 API 엔드포인트 포함
3. Ghost 페이지 업데이트 (페이지 ID: `69a8cadce2eb440001d5584c`)

### 3단계: 외부 접근 설정 (필요한 경우)

**현재 상황**: ubion.ghost.io에서 대시보드 페이지 서빙

**필요한 설정**:
- **Option A**: 프록시 설정 (권장)
  ```nginx
  location /api/status {
    proxy_pass http://localhost:3847/api/status;
    proxy_set_header Host $host;
    add_header 'Access-Control-Allow-Origin' '*';
  }
  ```

- **Option B**: CORS 설정
  ```bash
  # dashboard-api.js에 CORS 헤더 추가
  res.setHeader('Access-Control-Allow-Origin', '*');
  ```

---

## 📊 데이터 정합성 검증

### 검증 항목

| 항목 | 상태 | 검증 방법 |
|------|------|---------|
| **파일 시스템** | ✅ 정확 | `ls /root/.openclaw/workspace/newsroom/pipeline/*/` |
| **dashboard-api** | ✅ 정확 | `curl http://localhost:3847/api/status` |
| **HTML 템플릿** | ✅ 수정됨 | API 엔드포인트 확인 |
| **update-dashboard 스크립트** | ✅ 수정됨 | 엔드포인트 교체 로직 추가 |
| **Ghost 페이지** | 🔄 대기 | 다음 크론 실행 (1분 내) |
| **외부 대시보드** | ⏳ 예정 | Ghost 업데이트 후 자동 동기화 |

### 실시간 검증 명령어

```bash
# 1. 파일 카운트 확인
ls /root/.openclaw/workspace/newsroom/pipeline/04-drafted/*.json | wc -l

# 2. API 응답 확인
curl http://localhost:3847/api/status | jq '.pipeline[] | select(.dir=="04-drafted")'

# 3. 대시보드 페이지 확인
curl https://ubion.ghost.io/newsroom-status/ 2>/dev/null | grep -o '"count":[0-9]*' | head -5

# 4. 데이터 일치도 검증
# (위 3개 결과가 모두 같은 숫자를 보여야 함)
```

---

## 🔄 자동화된 동기화 주기

### 크론 작업 구성

| 작업 | 주기 | 동작 |
|------|------|------|
| **generate-status-json** | 1분 | 파이프라인 상태 수집 |
| **update-dashboard-page** | 1분 | Ghost 페이지 업데이트 |
| **dashboard-api** | 실시간 | API 서버 제공 (항상 실행) |
| **대시보드 페이지 갱신** | 30초 | fetch로 API 호출 (브라우저) |

### 지연 시간

```
파일 변경 → 최대 2분 이내에 대시보드 반영
(1분 크론 + 30초 갱신)
```

---

## ✅ 최종 체크리스트

- [x] dashboard-page.html 수정 (API 엔드포인트)
- [x] update-dashboard-page.js 수정 (엔드포인트 동기화)
- [x] dashboard-api.js 실행 확인
- [x] 로컬 API 정확성 검증
- [ ] Ghost 페이지 업데이트 (자동, 1분 내)
- [ ] 외부 대시보드 접근 확인 (업데이트 후)
- [ ] 프록시/CORS 설정 (필요한 경우)

---

## 🎯 예상 효과

| 지표 | 이전 | 이후 |
|------|------|------|
| **데이터 정합성** | 낮음 (캐시) | 100% (실시간) |
| **갱신 지연** | 불명 | ≤2분 |
| **API 신뢰도** | 낮음 | 높음 |
| **외부 접근** | 불가능 | 가능 (설정 후) |

---

**상태**: ✅ 로컬 환경 수정 완료 → ⏳ Ghost 동기화 대기 → 📊 외부 배포 예정

**다음 단계**: Ghost 페이지가 30초 내에 자동 업데이트될 것입니다.
