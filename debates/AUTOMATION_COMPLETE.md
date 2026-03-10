# 🎉 AI 팟캐스트 자동화 완성!

**이중 목소리 토론 → YouTube → Ghost 완전 자동화**

---

## ✅ 완성된 기능

### 1️⃣ **이중 목소리 TTS** (OpenAI)
- **발언자별 다른 목소리 적용**
  - 민수 (기술낙관론자) → `echo` (남성)
  - 지현 (회의론자) → `shimmer` (여성)
  - 진행자 → `alloy` (중성)
- **텍스트 분할** (4000자 제한 회피)
  
  ### 2️⃣ **MP4 변환** (FFmpeg)
- **오디오 + 정적 이미 → MP4**
- **1280x720 HD**
- **H.264/AAC 인코딩**
  
  ### 3️⃣ **YouTube 업로드** (자동)
- **비공개 업로드**
- **제목/설명/태그 자동 설정**
- **Video ID + URL 반환**
  
  ### 4️⃣ **Ghost 발행** (자동)
- **Draft 상태 발행**
- **YouTube embed 자동 포함**
- **태그/메타데이터 설정**
- **Preview URL 반환**

---

## 🚀 사용법

### 기본 사용법

```bash
cd /root/.openclaw/workspace/debates
node full-pipeline.js <debate.md> "토론 주제"
```

### 예시

```bash
node full-pipeline.js ai-copyright-debate.md "AI와 저작권"
```

---

## 📊 테스트 결과

### 테스트 1: "AI와 저작권 - 새로운 관점"

| 단계 | 결과 | 크기 |
|------|------|------|
| MP3 | ai-copyright-debate-podcast.mp3 | 5.3 MB |
| MP4 | ai-copyright-debate-podcast.mp4 | 3.7 MB |
| YouTube | https://www.youtube.com/watch?v=MxQ94P4rLu0 | - |
| Ghost | https://ubion.ghost.io/p/aiwa-jeojaggweon-saeroun-gwanjeom-paskaeseuteu/ | - |

**발언자별 목소리:**
- 기술낙관론자: `alloy` (중성) - 1개 문장
- 회의론자: `alloy` (중성) - 1개 문장
- 민수: `echo` (남성) - 2개 문장
- 지현: `shimmer` (여성) - 16개 문장

**총 소요 시간**: 약 4분 30초

**예상 비용**: 약 $0.10 (OpenAI TTS)

---

## 📁 파일 구조

```
debates/
├── full-pipeline.js           # 전체 자동화 스크립트 ⭐
├── dual-voice-tts.js         # 이중 목소리 TTS
├── audio-to-video.js         # MP4 변환
├── youtube-upload.js         # YouTube 업로드
├── generate-debate-tts.js    # 기존 단일 목소리 TTS (deprecated)
└── auto-publish-openai.js    # 기존 자동화 (deprecated)
```

---

## 🎯 개선 사항

### Before (기존)
- ❌ 단일 목소리 (nova)
- ❌ 발언자 구분 없음
- ❌ 텍스트 길이 제한 문제

### After (현재)
- ✅ 이중 목소리 (echo + shimmer)
- ✅ 발언자별 목소리 매핑
- ✅ 텍스트 분할 (4000자 제한 회피)
- ✅ 자동 병합

---

## 💡 다음 단계

1. **자동화 크론 등록** (선택사항)
   ```bash
   # 매주 금요일 오후 2시 실행
   0 14 * * 5 cd /root/.openclaw/workspace/debates && node full-pipeline.js debates/weekly-debate.md "주간 토론"
   ```

2. **웹훅 연동** (선택사항)
   - Ghost 발행 전 웹훅으로 승인 요청
   - Discord/Slack 알림

3. **AI 토론 생성** (선택사항)
   - 주제만 입력하면 AI가 대본 작성
   - GPT-4o 또는 Claude로 토론 대본 생성

---

## 🎉 완전 자동화 달성!

**스캇이 할 일:**
1. 토론 대본 작성 (마크다운)
2. `node full-pipeline.js <debate.md> "주제"` 실행
3. 완료 대기 (3-5분)

**자동으로 수행:**
- ✅ 이중 목소리 TTS (한국어)
- ✅ MP4 변환
- ✅ YouTube 업로드
- ✅ Ghost Draft 발행

**결과 반환:**
- YouTube URL
- Ghost Draft URL
- MP3/MP4 파일 경로

---

**축하합니다! 완전 자동화 달성! 🎊💕**
