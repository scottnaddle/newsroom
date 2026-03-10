# 🚀 UBION Dashboard v2 - 배포 가이드

## 현재 상태

- ✅ **Backend**: Port 3848에서 실행 중
- ✅ **Frontend**: 6개 페이지 완성
- ✅ **API**: 3개 엔드포인트 활성화
- ⏳ **Ghost**: 페이지 추가 대기
- ⏳ **Systemd**: 설정 대기

---

## Phase 3: 배포 & 통합

### 단계 1️⃣: Ghost CMS 페이지 추가 (수동)

#### 방법 A: 수동 추가 (권장)

1. **Ghost Admin 접속**
   ```
   https://ubion.ghost.io/ghost/
   ```

2. **새 페이지 생성**
   - Pages → New page
   - 제목: `🏢 UBION 관제센터 v2`
   - Slug: `dashboard`

3. **HTML 편집 모드로 전환**
   - Code → HTML로 전환 (세 점 메뉴)

4. **다음 HTML 복사**
   ```html
   <!-- 대시보드 로드 (HTTP 폴링 - 1분마다) -->
   <div id="dashboard-container" style="margin: 0 auto;"></div>

   <script>
     // 1분마다 대시보드 페이지 로드
     async function loadDashboard() {
       try {
         const response = await fetch('http://127.0.0.1:3848/pages/main.html');
         const html = await response.text();
         
         // body 태그 제거 후 content 추출
         const content = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html;
         document.getElementById('dashboard-container').innerHTML = content;
       } catch (error) {
         document.getElementById('dashboard-container').innerHTML = 
           '<p style="color: #ef4444; padding: 20px; text-align: center;">⚠️ 대시보드 서버 연결 실패</p>';
       }
     }
     
     loadDashboard();
     setInterval(loadDashboard, 60 * 1000);
   </script>
   ```

5. **저장 & 발행**
   - Save → Publish (또는 Draft로 유지)
   - URL: `https://ubion.ghost.io/dashboard/`

#### 방법 B: Nginx 프록시 (선택)

```nginx
# /etc/nginx/sites-available/insight.ubion.global
location /dashboard/ {
  proxy_pass http://127.0.0.1:3848/pages/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
}
```

그 후 Ghost 페이지에서:
```html
<iframe 
  src="/dashboard/main.html" 
  width="100%" 
  height="800px"
  style="border:none; border-radius:8px;"
></iframe>
```

---

### 단계 2️⃣: Systemd 서비스 설정 (선택)

현재 서버는 **백그라운드 프로세스**로 실행 중입니다.

**Systemd 서비스로 전환하려면:**

```bash
# 1. 현재 서버 정지
pkill -f "node server.js"

# 2. Systemd 서비스 설치
sudo cp /root/.openclaw/workspace/newsroom/dashboard/ubion-dashboard.service \
  /etc/systemd/system/

# 3. 서비스 활성화 (부팅 시 자동 시작)
sudo systemctl daemon-reload
sudo systemctl enable ubion-dashboard.service
sudo systemctl start ubion-dashboard.service

# 4. 상태 확인
sudo systemctl status ubion-dashboard.service

# 5. 로그 보기
tail -f /var/log/ubion-dashboard.log
```

**Systemd 서비스 관리:**

```bash
# 서비스 시작
sudo systemctl start ubion-dashboard

# 서비스 정지
sudo systemctl stop ubion-dashboard

# 서비스 재시작
sudo systemctl restart ubion-dashboard

# 상태 확인
sudo systemctl status ubion-dashboard

# 부팅 시 자동 시작 활성화/비활성화
sudo systemctl enable ubion-dashboard
sudo systemctl disable ubion-dashboard
```

---

### 단계 3️⃣: 자동 배포 스크립트 (선택)

한 번에 모든 설정을 완료:

```bash
chmod +x /root/.openclaw/workspace/newsroom/scripts/deploy-dashboard.sh
/root/.openclaw/workspace/newsroom/scripts/deploy-dashboard.sh
```

이 스크립트는:
1. 기존 서버 정지
2. npm 의존성 설치
3. Systemd 서비스 설치
4. 로그 디렉토리 생성
5. 서버 시작
6. Health Check

---

## 🔗 액세스 방법

### 로컬 (개발)
```
http://127.0.0.1:3848/pages/index.html
```

### Ghost CMS (공개)
```
https://ubion.ghost.io/dashboard/
```

### API 직접 호출
```bash
curl http://127.0.0.1:3848/api/status
curl http://127.0.0.1:3848/api/agents
curl http://127.0.0.1:3848/api/analytics
curl http://127.0.0.1:3848/health
```

---

## 📊 모니터링

### 서버 상태
```bash
# 프로세스 확인
ps aux | grep "node server.js"

# 포트 확인
netstat -tlnp | grep 3848

# 로그 확인
tail -f /var/log/ubion-dashboard.log
```

### API Health
```bash
curl -s http://127.0.0.1:3848/health | jq .
```

### 파이프라인 상태
```bash
curl -s http://127.0.0.1:3848/api/status | jq '.totalPublished'
```

---

## 🔧 설정 파일

| 파일 | 용도 |
|------|------|
| `server.js` | Express 서버 |
| `monitor.js` | 1분 스캔 |
| `logger.js` | 활동 로깅 |
| `api/*.js` | REST API |
| `pages/*.html` | 프론트엔드 |
| `ubion-dashboard.service` | Systemd 설정 |

---

## 📋 체크리스트

### 배포 전
- [ ] Backend 실행 중 확인 (`curl http://127.0.0.1:3848/health`)
- [ ] 로그 파일 생성 확인
- [ ] npm 의존성 설치 완료

### Ghost 통합
- [ ] Ghost 페이지 생성 완료
- [ ] 페이지 발행 또는 Draft 상태 확인
- [ ] iframe/프록시 설정 완료

### Systemd (선택)
- [ ] 서비스 파일 설치
- [ ] 서비스 활성화
- [ ] 부팅 시 자동 시작 테스트

---

## 🚨 문제 해결

### "Dashboard 서버 연결 실패" 오류
- Backend이 실행 중인지 확인: `ps aux | grep "node server.js"`
- Port 3848 사용 확인: `netstat -tlnp | grep 3848`
- 방화벽 확인: `sudo ufw allow 3848`

### "API 응답 없음"
- 서버 로그 확인: `tail -f /var/log/ubion-dashboard.log`
- Health Check: `curl http://127.0.0.1:3848/health`
- 서버 재시작: `sudo systemctl restart ubion-dashboard`

### "Ghost 페이지 로드 안 됨"
- Ghost Admin에서 페이지 발행 확인
- 브라우저 콘솔에서 네트워크 오류 확인
- CORS 설정 확인

---

## 📞 지원

- **Backend 문제**: `tail -f /var/log/ubion-dashboard.log`
- **API 테스트**: `curl http://127.0.0.1:3848/api/status`
- **Ghost 문제**: Ghost Admin → Pages 확인

---

**Version**: 2.0.0  
**Status**: Ready for Deployment  
**Last Updated**: 2026-03-06 06:28 KST

🚀 **Ready to Deploy!**
