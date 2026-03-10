# GitHub 배포 준비 완료 ✅

**날짜:** 2026-03-10 13:02 KST  
**상태:** 🟢 GitHub 배포 준비 완료

---

## 📦 배포 대상

**AskedTech AI 뉴스룸 자동화 시스템**

- 7개 에이전트 (수집기, 취재기자, 작성기자, 검증자, 편집자, 교열자, 발행자)
- Ghost CMS 자동 발행
- 실시간 품질 게이트
- 제어 센터 대시보드

---

## ✅ 준비된 것

### 1. 코드 & 스크립트
- ✅ 50+ 유틸리티 스크립트
- ✅ 7개 에이전트 SOUL.md 문서
- ✅ 오케스트레이터 프롬프트
- ✅ 파이프라인 자동화
- ✅ 품질 게이트 로직

### 2. 문서
- ✅ MEMORY.md (전체 프로젝트 문맥)
- ✅ SOUL.md (AI 성격 정의)
- ✅ USER.md (사용자 정보)
- ✅ DEPLOYMENT.md (배포 가이드)
- ✅ 각 에이전트 SOUL.md

### 3. 설정
- ✅ .gitignore (민감한 파일 제외)
- ✅ 예제 config 파일
- ✅ 초기화 스크립트

### 4. 상태
- ✅ 현재 76개 기사 발행됨
- ✅ 오케스트레이터 정상 작동
- ✅ 파이프라인 안정화

---

## 🚀 GitHub 연결 단계

### Step 1: GitHub Repo URL 제공받기

스캇이 GitHub repo URL을 제공해야 합니다:
```
https://github.com/username/askedtech-newsroom
```

### Step 2: 원격 저장소 추가

```bash
cd /root/.openclaw/workspace
git remote add origin https://github.com/username/askedtech-newsroom.git
```

### Step 3: 현재 브랜치 설정

```bash
git branch -M main
git push -u origin main
```

### Step 4: 완료!

```bash
# 확인
git remote -v
# origin  https://github.com/username/askedtech-newsroom.git (fetch)
# origin  https://github.com/username/askedtech-newsroom.git (push)
```

---

## 📋 푸시될 내용

### 포함 (✅)
```
newsroom/
├── prompts/              (오케스트레이터)
├── scripts/              (50+ 유틸리티)
├── workspaces/           (7개 에이전트)
├── shared/
│   ├── config/example/   (샘플 설정)
│   └── prompts/          (공통 프롬프트)
├── control-center/       (대시보드 코드)
└── pipeline/
    ├── 08-published/     (샘플 기사 10개)
    ├── memory/           (상태 파일)
    └── [기타 구조]

/, MEMORY.md, SOUL.md, DEPLOYMENT.md, AGENTS.md, etc.
```

### 제외 (❌)
```
newsroom/shared/config/ghost.json         (API Key)
newsroom/shared/config/llm-keys.json      (LLM Keys)
TOOLS.md                                  (개인 설정)
node_modules/                             (의존성)
package.json, package-lock.json           (npm 파일)
newsroom/pipeline/tmp/                    (임시 파일)
newsroom/pipeline/01-sourced/             (임시 상태)
newsroom/pipeline/03-reported/            (임시 상태)
기타 민감 파일들
```

---

## 🔐 민감한 파일 처리

배포 후 **새 서버에서 직접 생성해야 할 파일:**

### 1. `newsroom/shared/config/ghost.json`
```json
{
  "apiUrl": "https://insight.ubion.global",
  "adminApiKey": "YOUR_GHOST_ADMIN_API_KEY"
}
```

### 2. `newsroom/shared/config/llm-keys.json`
```json
{
  "anthropic": "sk-ant-...",
  "google": "AIzaSy...",
  "zhipu": "..."
}
```

### 3. `TOOLS.md` (개인 설정)
```markdown
# TOOLS.md - 로컬 노트

### Google AI Studio
- Key: YOUR_KEY
- Models: gemini-3-pro-image-preview
```

---

## 📊 배포 후 체크리스트

배포 후 새 서버에서 실행할 것:

```bash
# 1. Clone
git clone https://github.com/username/askedtech-newsroom.git

# 2. Install
cd newsroom
npm install

# 3. Configure
cp shared/config/ghost.json.example shared/config/ghost.json
# 실제 API Key 입력

# 4. Initialize
mkdir -p pipeline/{01-sourced,03-reported,04-drafted,05-fact-checked,07-copy-edited,08-published,rejected,tmp}
mkdir -p pipeline/memory

# 5. Test
node scripts/pipeline-runner.js

# 6. Setup Cron (OpenClaw)
# MEMORY.md의 크론 Job ID 참고
```

---

## 📞 버전 관리

**Current Version:** 2026-03-10  
**Status:** ✅ Production Ready

**주요 개선사항:**
- P0-1: JSON 파싱 버그 해결
- P0-2: Ghost API 토큰 검증
- P0-3: 오케스트레이터 LLM 호출 명시화
- 20개 부족 기사 재작성
- 품질 게이트 강화
- 자동화 안정화

---

## 🎯 Next Steps

1. **스캇이 GitHub repo URL 제공**
2. **원격 저장소 연결**
   ```bash
   git remote add origin <URL>
   git push -u origin main
   ```
3. **새 서버에서 배포**
   ```bash
   git clone <URL>
   cd newsroom && npm install
   # 설정 파일 생성
   npm start
   ```

---

**준비 완료! GitHub 배포 명령만 기다리고 있습니다.** 🚀
