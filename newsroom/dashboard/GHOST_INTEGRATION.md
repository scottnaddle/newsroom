# 🔗 대시보드를 관제센터 페이지에 연결하기

## 방법 1: Ghost Admin UI에서 직접 수정 (권장)

### 단계별 가이드

1. **Ghost Admin 접속**
   ```
   https://insight.ubion.global/ghost/
   ```

2. **관제센터 페이지 찾기**
   - Pages 메뉴에서 "newsroom-status" 또는 "관제센터" 페이지 찾기
   - 페이지를 클릭해서 편집 모드 진입

3. **Code 모드로 전환**
   - 우측 상단의 세 점 메뉴 (⋯) 클릭
   - "Edit HTML" 또는 "Code" 선택

4. **기존 HTML 전부 선택 & 삭제**
   - `Ctrl+A` 또는 `Cmd+A`로 모든 코드 선택
   - Delete 키로 삭제

5. **새 대시보드 HTML 붙여넣기**
   - 아래 코드를 복사해서 붙여넣기

```html
<!-- UBION Dashboard v2 연결 (2026-03-06) -->
<div id="dashboard-container" style="margin: 0 auto; padding: 20px;"></div>

<script>
  // 1분마다 대시보드 로드
  async function loadDashboard() {
    try {
      const response = await fetch('http://127.0.0.1:3848/pages/main.html', {
        method: 'GET',
        cache: 'no-cache'
      });
      
      if (!response.ok) throw new Error('HTTP ' + response.status);
      
      const html = await response.text();
      
      // body 태그 내용만 추출
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const content = bodyMatch ? bodyMatch[1] : html;
      
      document.getElementById('dashboard-container').innerHTML = content;
      
      // 스타일 적용
      const styles = content.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || [];
      styles.forEach(style => {
        const head = document.head;
        const styleEl = document.createElement('style');
        styleEl.textContent = style.replace(/<\/?style[^>]*>/g, '');
        head.appendChild(styleEl);
      });
      
      // 스크립트 실행
      const scripts = content.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
      scripts.forEach(script => {
        const code = script.replace(/<\/?script[^>]*>/g, '');
        try {
          eval(code);
        } catch (e) {
          console.warn('스크립트 실행 오류:', e.message);
        }
      });
    } catch (error) {
      document.getElementById('dashboard-container').innerHTML = `
        <div style="
          background: #fee2e2;
          border: 2px solid #ef4444;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          color: #991b1b;
          font-family: system-ui, sans-serif;
        ">
          <p style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">⚠️ 대시보드 연결 실패</p>
          <p style="font-size: 14px; margin-bottom: 12px; color: #7f1d1d;">${error.message}</p>
          <p style="font-size: 12px; color: #7f1d1d; margin-bottom: 16px;">
            Port 3848에서 대시보드 서버가 실행 중인지 확인하세요.
          </p>
          <button onclick="loadDashboard()" style="
            padding: 8px 16px;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
          ">재시도</button>
        </div>
      `;
    }
  }
  
  // 초기 로드
  loadDashboard();
  
  // 1분마다 자동 갱신
  setInterval(loadDashboard, 60 * 1000);
</script>

<style>
  #dashboard-container {
    width: 100%;
  }
</style>
```

6. **Save or Publish**
   - 우측 상단의 "Save" 또는 "Publish" 버튼 클릭

7. **완료!**
   - 이제 관제센터 페이지에서 대시보드가 로드됩니다
   - URL: `https://insight.ubion.global/newsroom-status/`

---

## 확인 사항

### 대시보드가 로드되지 않으면:

1. **Backend 서버 확인**
   ```bash
   curl http://127.0.0.1:3848/health
   ```
   응답: `{"status":"ok",...}`

2. **Port 3848 확인**
   ```bash
   netstat -tlnp | grep 3848
   ```

3. **브라우저 콘솔 확인**
   - F12 → Console 탭
   - CORS 또는 네트워크 오류 확인

---

## 방법 2: 프록시 사용 (선택)

### Nginx 설정 (선택사항)

```nginx
# /etc/nginx/sites-available/insight.ubion.global
location /dashboard/ {
  proxy_pass http://127.0.0.1:3848/pages/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

그 후 Ghost 페이지 HTML을 다음과 같이 수정:

```html
<iframe 
  src="/dashboard/main.html" 
  width="100%" 
  height="800px"
  style="border:none; border-radius:8px;"
></iframe>
```

---

## 방법 3: 새 페이지 생성 (대안)

기존 관제센터 페이지를 유지하고 싶으면:

1. Ghost Admin → Pages → New page
2. 제목: `🏢 UBION Dashboard v2`
3. Slug: `dashboard-v2`
4. 위의 HTML 코드 붙여넣기
5. Publish

---

## 📍 최종 결과

✅ 대시보드가 Ghost에서 **1분마다 자동 갱신**됩니다
✅ AI 교육 / AI Digest 분리 보기 가능
✅ 막대그래프로 24시간 발행 현황 시각화
✅ 에이전트 활동 추적
✅ 실시간 알림

---

**완료 후:**
- [ ] Ghost 페이지에서 대시보드 로드 확인
- [ ] 1분 폴링 작동 확인
- [ ] AI 교육/Digest 데이터 업데이트 확인
