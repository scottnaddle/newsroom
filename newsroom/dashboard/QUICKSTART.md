# 🚀 UBION Dashboard v2 - 빠른 시작 가이드

## 1️⃣ 현재 상태 확인

```bash
# Backend 서버 상태
curl http://127.0.0.1:3848/health
# 응답: {"status":"ok",...}

# API 테스트
curl http://127.0.0.1:3848/api/status | jq '.totalPublished'
# 응답: 183 (발행된 기사 수)
```

## 2️⃣ 로컬에서 테스트

**메인 대시보드:**
```
http://127.0.0.1:3848/pages/main.html
```

**Ghost embed 테스트 (관제센터처럼):**
```
http://127.0.0.1:3848/pages/embed.html
```

## 3️⃣ Ghost에 연결

### Option A: 기존 관제센터 페이지 수정

1. Ghost Admin 접속: https://insight.ubion.global/ghost/
2. Pages → "newsroom-status" 또는 "관제센터" 페이지 클릭
3. Code 모드 진입 (⋯ 메뉴)
4. 기존 HTML 전부 삭제
5. `GHOST_INTEGRATION.md`의 HTML 코드 복사 & 붙여넣기
6. Save/Publish

결과: https://insight.ubion.global/newsroom-status/

### Option B: 새 페이지 생성

1. Ghost Admin → Pages → New page
2. 제목: "🏢 UBION Dashboard v2"
3. `GHOST_INTEGRATION.md`의 HTML 코드 붙여넣기
4. Publish

결과: https://insight.ubion.global/dashboard-v2/

## 4️⃣ 완료 확인

- [ ] 대시보드 로드됨
- [ ] 1분마다 자동 갱신
- [ ] AI 교육/Digest 데이터 보임
- [ ] 막대그래프 표시됨

## 📁 주요 파일

```
dashboard/
├── pages/
│   ├── index.html         # 네비게이션
│   ├── main.html          # 메인 대시보드 ⭐
│   ├── embed.html         # Ghost embed 테스트
│   ├── education.html     # AI 교육
│   ├── digest.html        # AI Digest
│   ├── activity.html      # 활동 로그
│   └── analytics.html     # 분석
├── server.js              # Express 백엔드
├── GHOST_INTEGRATION.md   # ⭐ Ghost 연결 코드
└── QUICKSTART.md         # ← 현재 파일
```

## 💡 팁

### 폴링 주기 변경
pages/*.html에서:
```javascript
setInterval(loadData, 60 * 1000); // 60초 → 원하는 값
```

### 로그 보기
```bash
tail -f /var/log/ubion-dashboard.log
```

### 서버 재시작
```bash
pkill -f "node server.js" && \
cd /root/.openclaw/workspace/newsroom/dashboard && \
node server.js &
```

## 🎯 다음 단계

1. ✅ GHOST_INTEGRATION.md 읽기
2. ✅ Ghost 페이지에 HTML 추가
3. ✅ 대시보드 작동 확인
4. 🎉 완료!

---

**Need help?** Check GHOST_INTEGRATION.md for detailed instructions.
