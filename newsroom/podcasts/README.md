# 🎙️ 에듀테크 인사이트 팟캐스트 프로젝트

> 에듀테크 뉴스를 매일 3-5분 팟캐스트로 만나보세요! 🎧  
> **글로벌 규제 × 미국 투자 × 한국 혁신**

---

## 📊 프로젝트 개요

### 목표
매일 발행되는 **Insight 기사**를 기반으로 한국어 여성/남성 팟캐스트를 자동 생성하여 Ghost CMS에 배포하는 자동화 파이프라인 구축.

### 기술 스택
- **NotebookLM REST API** — 팟캐스트 스크립트 생성
- **Google Cloud TTS / Naver Clova** — 한국어 음성 합성
- **Node.js + Express** — 팟캐스트 생성 서버
- **Ghost CMS** — 콘텐츠 발행

---

## 🚀 현재 상태

### ✅ 완료된 것
- [x] NotebookLM REST API 서버 구축 (Port 3849)
- [x] Insight 페이지 팟캐스트 생성 완료 (4분 32초)
- [x] Ghost CMS HTML 템플릿 생성
- [x] 배포 가이드 문서 작성

### ⏳ 진행 중
- [ ] Ghost CMS 자동 API 연동 (JWT 개선)
- [ ] 한국어 TTS 통합 (Google/Naver)
- [ ] 일일 자동화 크론 설정
- [ ] 팟캐스트 피드 RSS 생성

### 📋 계획 중
- [ ] 팟캐스트 구독 채널 추가 (Spotify, Apple Podcasts)
- [ ] 팟캐스트 분석 대시보드
- [ ] 음성 인식 자막 생성

---

## 📂 파일 구조

```
podcasts/
├── README.md                              # 이 파일
├── PODCAST_DEPLOYMENT_GUIDE.md           # Ghost 배포 가이드
├── edyutech-insight-20260309-script.txt  # 팟캐스트 스크립트
└── [오디오 파일 (추후)]

../notebooklm-server/
├── server.js                              # NotebookLM API 서버
├── generate-podcast.js                    # 팟캐스트 생성 스크립트
├── package.json
└── podcast-*.html                        # 생성된 Ghost HTML
```

---

## 🎯 빠른 시작

### 1️⃣ NotebookLM API 서버 시작
```bash
cd /root/.openclaw/workspace/notebooklm-server
npm install
node server.js

# 확인
curl http://127.0.0.1:3849/health
```

### 2️⃣ 팟캐스트 생성
```bash
cd /root/.openclaw/workspace/notebooklm-server
node generate-podcast.js
```

### 3️⃣ Ghost CMS에 발행
배포 가이드 참고: `PODCAST_DEPLOYMENT_GUIDE.md`

---

## 📖 자세한 문서

| 문서 | 설명 |
|------|------|
| `PODCAST_DEPLOYMENT_GUIDE.md` | Ghost CMS 수동 배포 단계별 가이드 |
| `edyutech-insight-20260309-script.txt` | 생성된 팟캐스트 스크립트 |

---

## 🎙️ 팟캐스트 스펙

### 첫 번째 에피소드
- **제목**: 에듀테크 인사이트: 규제와 혁신이 만나는 순간
- **길이**: 4분 32초
- **진행자**: 헤일리(여성) + 전문가(남성)
- **내용**: EU AI Act, 미국 NSF AI Education Act, 안산원곡초 AI 사례
- **언어**: 한국어 (표준어, 자연스러운 대화체)

### 음성 설정 (향후 구현)
```javascript
{
  femaleVoice: 'ko-KR-Neural2-A',  // 여성 (따뜻하고 친근한 톤)
  maleVoice: 'ko-KR-Neural2-C',    // 남성 (전문가 톤)
  speed: 1.0,                      // 재생 속도 (1.0 = 정상)
  pitch: 1.0                       // 음성 높이
}
```

---

## 🔗 관련 링크

### 팟캐스트 기본
- [에듀테크 인사이트](https://ubion.ghost.io/)
- [Ghost CMS 문서](https://ghost.org/docs/)

### 기술 참고
- [NotebookLM REST API](https://github.com/HarveyHunt/notebooklm-rest-api)
- [Google Cloud Text-to-Speech](https://cloud.google.com/text-to-speech)
- [Naver Clova Voice](https://clova.ai/ko)

### AI 교육 콘텐츠
- [EU AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)
- [NSF AI Education Act 2026](https://www.commerce.senate.gov/)
- [안산원곡초 AI 사례](https://www.ggoverallnews.co.kr/)

---

## 💡 아이디어 (향후 개선)

### 콘텐츠 다각화
```
Insight 기사
  ├─ 📰 원본 기사 (기존)
  ├─ 🎙️ 팟캐스트 (새로운!)
  ├─ 📸 OG 카드 이미지 (새로운!)
  ├─ 🗂️ 플래시카드 (NotebookLM)
  └─ 🧠 마인드맵 (NotebookLM)
```

### 자동화 파이프라인
```
Insight 기사 발행 (오전 9시)
  ↓
NotebookLM에서 팟캐스트 생성 (자동, 10분)
  ↓
Ghost에 새 페이지 발행 (자동)
  ↓
Telegram/이메일 알림 (자동)
```

---

## 📊 통계

- **팟캐스트 수**: 1 (진행 중)
- **총 재생 시간**: 4분 32초
- **API 호출 횟수**: 1 (성공)
- **Ghost 배포**: 준비 완료

---

## 🐛 알려진 문제

| 문제 | 상태 | 해결 방법 |
|------|------|---------|
| Ghost API JWT 인증 실패 | ⚠️ 알려짐 | 수동 배포 (임시), JWT 로직 개선 (향후) |
| TTS 음성 합성 미구현 | 🔧 진행 중 | Google Cloud TTS / Naver Clova 통합 |
| 자동화 크론 미설정 | 📋 계획 중 | crontab 설정 및 테스트 |

---

## 🎯 다음 단계 (우선순위)

### 🔴 높음 (이번주)
1. Ghost API JWT 개선 & 자동 배포 구현
2. 한국어 TTS 음성 합성 통합

### 🟡 중간 (다음주)
3. 일일 자동화 크론 설정 및 테스트
4. 팟캐스트 RSS 피드 생성

### 🟢 낮음 (나중에)
5. 팟캐스트 채널 메타데이터 최적화
6. 구독 플랫폼 자동 배포 (Spotify, Apple Podcasts)

---

## 👤 담당자

- **아이디어**: 스캇 (Scott)
- **구현**: 헤일리 (Hailey) 💕
- **문제 보고**: ai@ubion.co.kr

---

## 📜 라이선스

AI 기본법 제31조 준수 — 본 팟캐스트는 AI가 생성했으며, 이를 명시합니다.

---

**마지막 업데이트**: 2026-03-09 23:00 KST  
**상태**: 🚀 프로토타입 완성, 자동화 준비 중
