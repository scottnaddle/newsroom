#!/bin/bash
# UBION Dashboard 크론 작업 설정

echo "🔧 UBION Dashboard Systemd 서비스 설치 중..."

# 1. Systemd 서비스 파일 복사
sudo cp /root/.openclaw/workspace/newsroom/dashboard/ubion-dashboard.service /etc/systemd/system/

# 2. 권한 설정
sudo chmod 644 /etc/systemd/system/ubion-dashboard.service

# 3. Systemd 데몬 리로드
sudo systemctl daemon-reload

# 4. 서비스 활성화 (부팅 시 자동 시작)
sudo systemctl enable ubion-dashboard.service

echo "✅ Systemd 서비스 설치 완료"
echo ""
echo "다음 명령어를 실행하세요:"
echo "  sudo systemctl start ubion-dashboard"
echo "  sudo systemctl status ubion-dashboard"
echo "  tail -f /var/log/ubion-dashboard.log"
