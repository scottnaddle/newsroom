# 🏢 UBION Dashboard v2 - 완성!

## ✅ 개발 현황

### Phase 1: Backend ✅
- ✅ `server.js` - Express + 1분 폴링
- ✅ `monitor.js` - 파이프라인 1분 주기 스캔
- ✅ `logger.js` - 에이전트 활동 기록
- ✅ REST API 3개 (`/api/status`, `/api/agents`, `/api/analytics`)
- ✅ 로그 자동 정리 (7일 보관)

### Phase 2: Frontend ✅
- ✅ `index.html` - 네비게이션 페이지
- ✅ `main.html` - 메인 대시보드
- ✅ `education.html` - AI 교육 상세
- ✅ `digest.html` - AI Digest 상세
- ✅ `activity.html` - 에이전트 활동 로그
- ✅ `analytics.html` - 시간대별 발행 현황 (막대그래프)

---

## 🚀 사용 방법

### 1. 서버 실행 (이미 실행 중)
```bash
cd /root/.openclaw/workspace/newsroom/dashboard
node server.js
```

### 2. 대시보드 접속
```
http://127.0.0.1:3848/pages/index.html
```

### 3. 개별 페이지 접속
- 메인: `http://127.0.0.1:3848/pages/main.html`
- AI 교육: `http://127.0.0.1:3848/pages/education.html`
- AI Digest: `http://127.0.0.1:3848/pages/digest.html`
- 활동 로그: `http://127.0.0.1:3848/pages/activity.html`
- 분석: `http://127.0.0.1:3848/pages/analytics.html`

---

## 📊 주요 기능

| 기능 | 상태 |
|------|------|
| **1분 폴링** | ✅ 완료 |
| **AI 교육 / Digest 분리** | ✅ 완료 |
| **막대그래프** | ✅ 완료 |
| **에이전트 추적** | ✅ 완료 |
| **실시간 알림** | ✅ 완료 |
| **7일 로그** | ✅ 완료 |
| **REST API** | ✅ 완료 |

---

## 🔍 API 엔드포인트

```bash
# 현재 상태
curl http://localhost:3848/api/status

# 에이전트 상태
curl http://localhost:3848/api/agents

# 24시간 분석 데이터
curl http://localhost:3848/api/analytics?hours=24

# 건강 확인
curl http://localhost:3848/health
```

---

## 📈 그래프

- **유형**: 막대그래프 (Chart.js)
- **범위**: 지난 24시간
- **분류**: AI 교육 (파란색), AI Digest (주황색)
- **갱신**: 1분마다

---

## 💾 로그 정책

- **보관 기간**: 7일
- **자동 정리**: 매시간
- **위치**: `/root/.openclaw/workspace/newsroom/shared/logs/`

### 로그 파일
- `agent-activity.jsonl` - 에이전트 활동 (시계열)
- `pipeline-stats.jsonl` - 파이프라인 통계 (시계열)
- `agent-activity-recent.json` - 최근 100개 활동
- `dashboard-status.json` - 현재 상태

---

## 🔧 Ghost CMS 통합

Ghost 페이지에 embed하기:

```html
<iframe 
  src="http://127.0.0.1:3848/pages/main.html" 
  width="100%" 
  height="800px"
  style="border:none; border-radius:8px;"
></iframe>
```

또는 프록시로 `/dashboard/` 경로로 연결:

```nginx
location /dashboard/ {
  proxy_pass http://localhost:3848/pages/;
}
```

---

## 📋 파일 구조

```
dashboard/
├── server.js              # Express + 폴링
├── monitor.js             # 1분 스캔
├── logger.js              # 활동 로깅
├── api/
│   ├── status.js
│   ├── agents.js
│   └── analytics.js
├── pages/
│   ├── index.html         # 메인 네비
│   ├── main.html          # 대시보드
│   ├── education.html     # 교육
│   ├── digest.html        # 다이제스트
│   ├── activity.html      # 로그
│   └── analytics.html     # 분석
├── package.json
├── SETUP.md
└── README.md
```

---

## 🎯 다음 단계 (스캇 결정)

1. **Ghost 페이지 추가** - iframe 또는 프록시?
2. **크론 설정** - monitor.js 자동 실행?
3. **프로덕션 배포** - systemd 서비스?

---

**Version**: 2.0.0  
**Status**: Production Ready ✅  
**Last Updated**: 2026-03-06  
**Backend**: Running on Port 3848  
**Polling**: Every 60 seconds  
**Log Retention**: 7 days  

🚀 Ready to go!
