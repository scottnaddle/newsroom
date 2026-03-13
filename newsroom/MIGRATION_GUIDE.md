# 🚀 마이그레이션 & 이관 가이드

이 가이드는 GitHub 리포에서 새로운 서버로 **newsroom 프로젝트를 이관하는 방법**을 설명합니다.

---

## 📋 빠른 시작 (8분)

### **1단계: Clone (2분)**
```bash
cd /your/new/server/path
git clone https://github.com/scottnaddle/newsroom.git
cd newsroom
npm install
```

### **2단계: 설정 복사 (2분)**
```bash
# Ghost API 설정 파일 복사
cp shared/config/ghost.json.example shared/config/ghost.json

# 실제 Ghost API Key 입력
nano shared/config/ghost.json
```

**ghost.json 형식:**
```json
{
  "baseUrl": "https://your-ghost-instance.ghost.io",
  "adminApiKey": "YOUR_API_KEY_HERE",
  "contentApiKey": "YOUR_CONTENT_API_KEY"
}
```

### **3단계: 크론 작업 등록 (3분)**

새로운 OpenClaw 서버가 있다면:

```bash
# OpenClaw 크론에 7개 에이전트 등록
# MEMORY.md의 "크론 Job ID" 섹션 참고

# 예:
openclaw cron add --job '{
  "name": "Newsroom Source Collector",
  "schedule": { "kind": "cron", "expr": "*/30 * * * *" },
  "payload": { "kind": "agentTurn", "message": "Start source collection" },
  "sessionTarget": "isolated"
}'
```

**Job ID 참고:**
- 소스수집기: `2a7923e8-a292-435b-bd55-1ba0ec08032e`
- 취재기자: `bf5d972c-df27-480b-8b19-b32fcc8b4c25`
- 작성기자: `d3c17519-5951-447f-af8b-f6d7494b82d9`
- 팩트체커: `b0049592-2dac-4bb2-b718-f76fad8efdba`
- 에디터/데스크: `c20081e1-73be-4856-8768-029c326676d6`
- 교열기자: `e57f7327-a883-492a-93eb-7ea54cb12d9e`
- 발행에이전트: `cecbf113-6ac7-4cc1-8694-d65a040324ed`

### **4단계: 파이프라인 시작 (1분)**
```bash
cd scripts
node pipeline-runner.js
```

---

## 🎯 이관 체크리스트

| 항목 | 파일 | 확인 |
|------|------|------|
| ✅ 코드 & 스크립트 | 모두 포함 | GitHub에서 자동 |
| ✅ 7개 에이전트 설정 | `workspaces/*/SOUL.md` | 자동 |
| ✅ 파이프라인 로직 | `scripts/pipeline-runner.js` | 자동 |
| ⚠️ Ghost API Key | `shared/config/ghost.json` | **수동 입력 필요** |
| ✅ Control Center | `control-center/` | 자동 |
| ✅ 183개 기사 샘플 | `pipeline/08-published/` | 자동 |
| ✅ 모든 문서 | `docs/`, `README.md` | 자동 |

---

## 🌍 배포 시나리오별 가이드

### **시나리오 1: 같은 OpenClaw 서버 내 다른 경로**

```bash
# 기존 경로
/root/.openclaw/workspace/newsroom

# 새 경로
/root/.openclaw/workspace/newsroom-v2

# 이관 방법
cp -r newsroom newsroom-v2
cd newsroom-v2
# Ghost 설정만 수정
nano shared/config/ghost.json
node scripts/pipeline-runner.js
```

---

### **시나리오 2: 다른 OpenClaw 서버로 이관**

```bash
# 새 서버에 SSH 접속
ssh user@new-server.com

# Clone
cd /root/.openclaw/workspace
git clone https://github.com/scottnaddle/newsroom.git
cd newsroom

# 설정
npm install
cp shared/config/ghost.json.example shared/config/ghost.json
nano shared/config/ghost.json

# 크론 작업 등록 (OpenClaw가 설치되어 있다면)
openclaw cron list

# 시작
node scripts/pipeline-runner.js
```

---

### **시나리오 3: AWS EC2로 배포**

```bash
# EC2 인스턴스에 SSH 접속
ssh -i your-key.pem ec2-user@your-instance.amazonaws.com

# Node.js 설치 (필요시)
curl -fsSL https://fnm.io/install | bash
fnm install 24

# Clone & 설정
cd /opt
git clone https://github.com/scottnaddle/newsroom.git
cd newsroom
npm install

cp shared/config/ghost.json.example shared/config/ghost.json
nano shared/config/ghost.json

# PM2로 백그라운드 실행
npm install -g pm2
pm2 start scripts/pipeline-runner.js --name "newsroom"
pm2 save
pm2 startup

# 로그 확인
pm2 logs newsroom
```

---

### **시나리오 4: Docker로 배포**

**Dockerfile 생성:**
```dockerfile
FROM node:24-alpine

WORKDIR /app

# Clone
RUN git clone https://github.com/scottnaddle/newsroom.git .

# 설치
RUN npm install

# 설정 파일 복사 (빌드 후 환경변수로 주입)
RUN cp shared/config/ghost.json.example shared/config/ghost.json

# 포트 노출 (Control Center용)
EXPOSE 8000 3848

# 시작
CMD ["node", "scripts/pipeline-runner.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  newsroom:
    build: .
    environment:
      GHOST_BASE_URL: ${GHOST_BASE_URL}
      GHOST_ADMIN_API_KEY: ${GHOST_ADMIN_API_KEY}
    ports:
      - "8000:8000"
      - "3848:3848"
    volumes:
      - ./pipeline:/app/pipeline
      - ./logs:/app/logs
```

**배포:**
```bash
# .env 파일 생성
echo "GHOST_BASE_URL=https://your-ghost.ghost.io" > .env
echo "GHOST_ADMIN_API_KEY=YOUR_KEY_HERE" >> .env

# 실행
docker-compose up -d

# 로그
docker-compose logs -f newsroom
```

---

### **시나리오 5: Google Cloud Run으로 배포**

```bash
# 이미지 빌드
docker build -t gcr.io/your-project/newsroom .

# GCR에 푸시
docker push gcr.io/your-project/newsroom

# Cloud Run 배포
gcloud run deploy newsroom \
  --image gcr.io/your-project/newsroom \
  --platform managed \
  --region us-central1 \
  --set-env-vars "GHOST_BASE_URL=https://your-ghost.ghost.io" \
  --set-env-vars "GHOST_ADMIN_API_KEY=YOUR_KEY_HERE" \
  --memory 2Gi \
  --timeout 3600
```

---

## 🔧 트러블슈팅

### **Ghost API Key 오류**
```
Error: Invalid token (INVALID_JWT)
```

**해결책:**
1. Ghost Admin → Integrations → Custom Integration 확인
2. API Key 재생성
3. `shared/config/ghost.json`에 새 Key 입력

```bash
nano shared/config/ghost.json
# baseUrl과 adminApiKey 다시 확인
```

---

### **파이프라인이 시작되지 않음**
```bash
# 로그 확인
node scripts/pipeline-runner.js 2>&1 | head -50

# 디버그 모드
DEBUG=* node scripts/pipeline-runner.js
```

---

### **Node.js 버전 호환성**
```bash
# 필요 버전: Node 20 이상 (v24 권장)
node --version

# 버전 업그레이드 (nvm 사용)
nvm install 24
nvm use 24
```

---

## 📊 Control Center 대시보드 접속

마이그레이션 후 대시보드 접속:
```
http://localhost:8000              (newsroom 대시보드)
http://localhost:3848              (Control Center)
```

---

## 🚀 자동 배포 스크립트

**quick-deploy.sh 생성:**
```bash
#!/bin/bash
set -e

echo "🚀 Newsroom 자동 배포 스크립트"
echo "================================"

# 설정
read -p "설치 경로 입력 (기본값: /opt/newsroom): " INSTALL_PATH
INSTALL_PATH=${INSTALL_PATH:-/opt/newsroom}

read -p "Ghost API Key 입력: " GHOST_API_KEY
read -p "Ghost 기본 URL 입력 (예: https://your-site.ghost.io): " GHOST_BASE_URL

# Clone
mkdir -p $INSTALL_PATH
cd $INSTALL_PATH
git clone https://github.com/scottnaddle/newsroom.git .

# 설치
npm install

# 설정
cp shared/config/ghost.json.example shared/config/ghost.json
sed -i "s|YOUR_GHOST_URL|$GHOST_BASE_URL|g" shared/config/ghost.json
sed -i "s|YOUR_API_KEY|$GHOST_API_KEY|g" shared/config/ghost.json

echo ""
echo "✅ 배포 완료!"
echo "================"
echo "설치 경로: $INSTALL_PATH"
echo ""
echo "시작 명령어:"
echo "  cd $INSTALL_PATH"
echo "  node scripts/pipeline-runner.js"
echo ""
echo "또는 PM2로 백그라운드 실행:"
echo "  pm2 start scripts/pipeline-runner.js --name newsroom"
```

**실행:**
```bash
chmod +x quick-deploy.sh
./quick-deploy.sh
```

---

## 📚 추가 문서

| 문서 | 설명 |
|------|------|
| `README.md` | 프로젝트 개요 |
| `DEPLOYMENT.md` | 배포 가이드 (상세) |
| `docs/` | 전체 문서 |
| `MEMORY.md` | 프로젝트 이력 & 주요 결정 |

---

## ✅ 이관 완료 확인

새 서버에서 다음을 확인하세요:

```bash
# 1. 기본 설정 확인
ls -la shared/config/ghost.json

# 2. 파이프라인 디렉토리 확인
ls -la pipeline/08-published | wc -l  # 183개 이상이어야 함

# 3. 에이전트 확인
ls -la workspaces/ | grep -E "source|reporter|writer|fact|editor|copy|publisher"

# 4. 스크립트 테스트
node scripts/quick-status.js

# 5. Control Center 시작
node control-center/server.js &

# 6. 파이프라인 실행
node scripts/pipeline-runner.js
```

모두 정상이면 **마이그레이션 완료!** 🎉

---

**문제가 생기면 GitHub Issues에 보고해주세요:**
https://github.com/scottnaddle/newsroom/issues
