# 🎬 AskedTech 팟캐스트 자동화 - 빠른 시작

## ⚡ 한 번만 설정 (스캇만 하면 됨)

### 1️⃣ YouTube API 설정 (5분)

```bash
# 1. Google Cloud Console 접속
https://console.cloud.google.com/

# 2. 프로젝트 생성
- 이름: AskedTech YouTube Uploader

# 3. YouTube Data API v3 활성화
- APIs & Services → Library → 검색: YouTube Data API v3 → Enable

# 4. OAuth 2.0 클라이언트 ID 생성
- APIs & Services → Credentials → Create Credentials → OAuth client ID
- Application type: Desktop app
- Name: AskedTech Uploader
- **Download JSON** → credentials.json으로 저장

# 5. 파일 이동
cp ~/Downloads/client_secret_*.json /root/.openclaw/workspace/debates/credentials.json
```

### 2️⃣ YouTube 인증 (2분, 1회만)

```bash
cd /root/.openclaw/workspace/debates
node youtube-auth.js

# 브라우저가 열림 → AskedTech YouTube 계정으로 로그인 → 권한 승인
# 완료되면 token.json 자동 생성됨
```

---

## 🚀 이후 자동 실행 (개입 없음)

### 전체 파이프라인 한 번에

```bash
cd /root/.openclaw/workspace/debates
node auto-publish.js "AI 교육 득실"
```

**자동으로 수행되는 작업:**
1. ✅ 오디오를 비디오로 변환 (FFmpeg)
2. ✅ YouTube에 비공개 업로드
3. ✅ Ghost Draft 발행 (YouTube embed 포함)

**결과:**
- YouTube URL: `https://www.youtube.com/watch?v=xxx`
- Ghost Draft: `https://ubion.ghost.io/p/xxx/`

---

## 📁 파일 구조

```
debates/
├── credentials.json       # Google OAuth (1회 다운로드)
├── token.json             # 자동 생성 (갱신됨)
├── youtube-auth.js        # 1회 인증용
├── youtube-upload.js      # YouTube 업로드
├── audio-to-video.js      # FFmpeg 변환
├── auto-publish.js        # 전체 자동화 ⭐
├── ai-education-debate.mp3
├── ai-education-debate.mp4 (자동 생성)
└── ai-education-debate.html
```

---

## 🔧 개별 실행 (필요시)

```bash
# 오디오 → 비디오 변환만
node audio-to-video.js debate.mp3

# YouTube 업로드만
node youtube-upload.js debate.mp4 "AI 교육 토론"

# Ghost 발행만 (이미 YouTube URL 있는 경우)
node publish-to-ghost.js
```

---

## 🔄 크론 자동화 (선택사항)

매주 특정 요일에 자동 실행:

```bash
# 크론 편집
crontab -e

# 매주 월요일 오전 10시 실행
0 10 * * 1 cd /root/.openclaw/workspace/debates && node auto-publish.js >> /var/log/podcast.log 2>&1
```

---

## ⚠️ 보안 주의

- `credentials.json`과 `token.json`은 **절대 GitHub에 올리지 마세요**
- `.gitignore`에 이미 추가됨

---

## 🎯 다음 단계

1. **credentials.json 다운로드** (Google Cloud Console)
2. **node youtube-auth.js** 실행 (1회 인증)
3. **node auto-publish.js "주제"** 실행 (자동화 완료!)

완료되면 스캇이 할 일 없음. AI가 알아서 토론 → TTS → YouTube → Ghost 까지! 💕
