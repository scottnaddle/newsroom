#!/bin/bash
# 🚀 UBION Dashboard v2 배포 스크립트

set -e

DASHBOARD_DIR="/root/.openclaw/workspace/newsroom/dashboard"
LOG_DIR="/var/log"
SERVICE_NAME="ubion-dashboard"

echo "🚀 UBION Dashboard v2 배포 시작"
echo "================================"
echo ""

# 1️⃣ 서버 정지
echo "1️⃣ 기존 서버 정지 중..."
pkill -f "node server.js" || true
sleep 2
echo "✅ 서버 정지 완료"
echo ""

# 2️⃣ 의존성 설치
echo "2️⃣ npm 의존성 설치 중..."
cd "$DASHBOARD_DIR"
npm install --production > /dev/null 2>&1
echo "✅ 의존성 설치 완료"
echo ""

# 3️⃣ Systemd 서비스 설치
echo "3️⃣ Systemd 서비스 설치 중..."
sudo cp "$DASHBOARD_DIR/ubion-dashboard.service" /etc/systemd/system/
sudo chmod 644 /etc/systemd/system/ubion-dashboard.service
sudo systemctl daemon-reload
sudo systemctl enable ubion-dashboard.service || true
echo "✅ Systemd 서비스 설치 완료"
echo ""

# 4️⃣ 로그 디렉토리 생성
echo "4️⃣ 로그 디렉토리 설정 중..."
sudo mkdir -p "$LOG_DIR"
sudo touch "$LOG_DIR/ubion-dashboard.log"
sudo chmod 666 "$LOG_DIR/ubion-dashboard.log"
echo "✅ 로그 디렉토리 설정 완료"
echo ""

# 5️⃣ 서버 시작
echo "5️⃣ Dashboard 서버 시작 중..."
sudo systemctl start ubion-dashboard.service
sleep 2

# 서비스 상태 확인
if sudo systemctl is-active --quiet ubion-dashboard.service; then
  echo "✅ Dashboard 서버 시작 완료 (Port 3848)"
else
  echo "❌ Dashboard 서버 시작 실패"
  sudo systemctl status ubion-dashboard.service
  exit 1
fi
echo ""

# 6️⃣ Health Check
echo "6️⃣ API Health Check..."
sleep 2
if curl -s http://127.0.0.1:3848/health | grep -q '"status":"ok"'; then
  echo "✅ API Health Check 완료"
else
  echo "⚠️ API 응답 대기 중... (재시도)"
  sleep 3
fi
echo ""

echo "================================"
echo "✅ 배포 완료!"
echo ""
echo "📍 대시보드 접속:"
echo "   http://127.0.0.1:3848/pages/index.html"
echo ""
echo "📊 주요 페이지:"
echo "   - 메인: http://127.0.0.1:3848/pages/main.html"
echo "   - AI 교육: http://127.0.0.1:3848/pages/education.html"
echo "   - AI Digest: http://127.0.0.1:3848/pages/digest.html"
echo ""
echo "🔍 로그 보기:"
echo "   tail -f /var/log/ubion-dashboard.log"
echo ""
echo "🛠️ 서비스 명령어:"
echo "   sudo systemctl start ubion-dashboard   # 시작"
echo "   sudo systemctl stop ubion-dashboard    # 정지"
echo "   sudo systemctl restart ubion-dashboard # 재시작"
echo "   sudo systemctl status ubion-dashboard  # 상태 확인"
