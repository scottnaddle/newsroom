# YouTube 자동 업로드 설정 가이드

## 1회 설정 (스캇만 하면 됨)

### Step 1: Google Cloud Console 설정

1. **Google Cloud Console** 접속: https://console.cloud.google.com/
2. **새 프로젝트 생성** (또는 기존 프로젝트 선택)
   - 프로젝트 이름: `AskedTech YouTube Uploader`
3. **YouTube Data API v3 활성화**
   - 좌측 메뉴: APIs & Services → Library
   - 검색: `YouTube Data API v3`
   - 클릭 후 **Enable**
4. **OAuth 2.0 클라이언트 ID 생성**
   - APIs & Services → Credentials
   - **Create Credentials** → OAuth client ID
   - Application type: **Desktop app**
   - Name: `AskedTech Uploader`
   - **Create**
5. **credentials.json 다운로드**
   - 생성된 클라이언트 ID 옆 다운로드 버튼 클릭
   - 파일명: `credentials.json`
   - 위치: `/root/.openclaw/workspace/debates/credentials.json`

### Step 2: 첫 인증 (1회만)

```bash
cd /root/.openclaw/workspace/debates
node youtube-auth.js
```

- 브라우저가 열리면서 Google 로그인 요청
- AskedTech YouTube 계정으로 로그인
- 권한 승인 (YouTube 채널 관리)
- 완료되면 `token.json` 자동 생성됨

이후부터는 자동으로 토큰 갱신됨.

---

## 자동화 파이프라인

```
토론 대본 생성 (AI)
    ↓
TTS 변환 (mp3)
    ↓
FFmpeg 변환 (mp3 → mp4)
    ↓
YouTube 업로드 (비공개)
    ↓
embed URL 획득
    ↓
Ghost Draft 발행 (YouTube embed 포함)
```

---

## 필요한 패키지

```bash
npm install googleapis @google-cloud/local-auth
```

---

## 파일 구조

```
debates/
├── credentials.json     # Google OAuth (1회 다운로드)
├── token.json           # 자동 생성 (갱신됨)
├── youtube-upload.js    # 업로드 스크립트
├── audio-to-video.js    # FFmpeg 변환
├── auto-publish.js      # 전체 자동화
├── ai-education-debate.mp3
├── ai-education-debate.mp4
└── thumbnails/
    └── default.jpg      # 기본 썸네일
```

---

## 자동화 트리거 옵션

1. **수동 실행**: `node auto-publish.js`
2. **크론 스케줄**: 매일 특정 시간
3. **웹훅**: Ghost 발행 전 자동 호출
4. **폴더 감시**: 새 mp3 파일 감지 시 자동 실행

---

## 보안 주의사항

- `credentials.json`과 `token.json`은 **절대 공개 금지**
- `.gitignore`에 추가:
  ```
  credentials.json
  token.json
  ```
- YouTube API 할당량: 일일 10,000 units (약 100개 비디오)
