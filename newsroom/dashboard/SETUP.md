# 🏢 UBION Dashboard v2 설정 가이드

## ✅ Backend 설치 완료

### 실행 중인 서비스

- **Port**: 3848
- **URL**: http://127.0.0.1:3848
- **REST API**: 
  - `/api/status` - 파이프라인 상태
  - `/api/agents` - 에이전트 상태
  - `/api/analytics` - 시간대별 그래프 (막대 그래프)
- **갱신**: 1분마다 자동 폴링
- **로그**: 1주일 유지 후 자동 삭제

---

## 📍 Ghost CMS에 대시보드 페이지 추가

### Option A: 수동으로 HTML 복사

1. Ghost Admin (`https://ubion.ghost.io/ghost/`) 접속
2. **Pages** → **New page**
3. 제목: `🏢 UBION 관제센터`
4. **Editor** → HTML 모드로 전환
5. 다음 HTML 복사:

```html
<!-- 대시보드 로드 (HTTP 폴링) -->
<div id="dashboard-container" style="margin:0 auto; max-width: 1400px;"></div>

<script>
  // Dashboard 메인 페이지 HTML 로드
  fetch('/dashboard/main.html')
    .then(r => r.text())
    .then(html => {
      // <body> 태그 제거 후 embed
      const content = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html;
      document.getElementById('dashboard-container').innerHTML = content;
    });
</script>

<style>
  /* Ghost 테마와의 호환성 */
  #dashboard-container {
    padding: 20px;
  }
</style>
```

6. **Publish**

---

### Option B: 프록시 사용 (권장)

Nginx/Apache에서 대시보드를 프록시:

```nginx
# /etc/nginx/sites-available/insight.ubion.global
location /dashboard/ {
  proxy_pass http://localhost:3848/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
}
```

그 후:
- Ghost에 iframe 추가: `<iframe src="/dashboard/main.html" width="100%" height="800px"></iframe>`

---

## 🔍 모니터링 정책

### 1분마다 폴링
- 파이프라인 상태 자동 스캔
- 에이전트 활동 로깅
- 알림 생성

### 로그 정책
- **보관 기간**: 7일
- **자동 정리**: 매시간 (오래된 데이터 삭제)
- **파일 위치**: `/root/.openclaw/workspace/newsroom/shared/logs/`

---

## 📊 그래프 (막대 그래프)

- **X축**: 시간 (00:00 ~ 24:00)
- **Y축**: 기사 수
- **데이터**:
  - 파란색: AI 교육
  - 주황색: AI Digest
- **범위**: 지난 24시간

---

## 🚀 시작하기

### 1. Backend 실행 (이미 실행 중)

```bash
cd /root/.openclaw/workspace/newsroom/dashboard
npm install  # 처음에만
node server.js
```

### 2. Ghost 페이지 추가

Ghost Admin에서 위의 **Option A** 또는 **Option B** 실행

### 3. 대시보드 접속

- **로컬**: http://127.0.0.1:3848/pages/main.html
- **Ghost 내**: 페이지 생성 후 `https://insight.ubion.global/dashboard/`

---

## 💡 API 사용 예

```bash
# 현재 상태 조회
curl http://localhost:3848/api/status | jq .

# 에이전트 상태
curl http://localhost:3848/api/agents | jq '.agents'

# 그래프 데이터 (지난 24시간)
curl http://localhost:3848/api/analytics?hours=24 | jq .

# 건강 확인
curl http://localhost:3848/health
```

---

## 🔧 커스터마이징

### 색상 변경
`pages/main.html`의 CSS에서:
```css
.stat-value { color: #1f2937; } /* 수정 */
```

### 갱신 주기 변경
`pages/main.html`의 JavaScript에서:
```javascript
setInterval(loadData, 60 * 1000); // 60초 → 원하는 초로 변경
```

### 로그 보관 기간 변경
`server.js`의 `cleanupOldLogs()`에서:
```javascript
const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
// 7 → 원하는 날수로 변경
```

---

## 📝 로그 파일

### agent-activity.jsonl
```json
{"timestamp":"2026-03-06T06:23Z","agent":"writer","action":"draft_completed",...}
```

### pipeline-stats.jsonl
```json
{"timestamp":"2026-03-06T06:23Z","branches":{"education":{...},"digest":{...}},...}
```

### agent-activity-recent.json
최근 100개 활동 (대시보드 빠른 로드용)

---

## 🎯 다음 단계

- [ ] Ghost 페이지 추가
- [ ] 크론 작업 등록 (`monitor.js` 자동 실행)
- [ ] 프로덕션 배포

---

**Version**: 2.0.0  
**Last Updated**: 2026-03-06  
**Status**: Production Ready
