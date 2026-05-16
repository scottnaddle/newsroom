#!/usr/bin/env python3
"""
DeerFlow health check — Hermes Agent MCP 서버로 사용하기 위한 정보 수집
"""

import json
import subprocess
import sys

def check_url(url, label):
    """URL이 응답하는지 확인"""
    print(f"\n🔍 {label}: {url}")
    try:
        r = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '5', url],
                          capture_output=True, text=True, timeout=10)
        if r.returncode == 0 and r.stdout.strip():
            code = r.stdout.strip()
            print(f"   → HTTP {code}")
            return code == '200' or code == '302'
        print(f"   → curl 실패: {r.stderr}")
        return False
    except Exception as e:
        print(f"   → 오류: {e}")
        return False

def get_json(url, label):
    """JSON 응답 확인"""
    print(f"\n🔍 {label}: {url}")
    try:
        r = subprocess.run(['curl', '-s', '--max-time', '5', url],
                          capture_output=True, text=True, timeout=10)
        if r.returncode == 0 and r.stdout.strip():
            # JSON인지 확인
            try:
                data = json.loads(r.stdout)
                print(f"   ✅ JSON 응답 ({len(r.stdout)} 바이트)")
                print(f"   → {json.dumps(data, indent=2)[:500]}")
                return data
            except:
                print(f"   → 일반 텍스트: {r.stdout[:200]}")
        else:
            print(f"   → 응답 없음")
        return None
    except Exception as e:
        print(f"   → 오류: {e}")
        return None

print("=" * 60)
print("DeerFlow 서버 정보 확인")
print("=" * 60)

# 설정 파일에서 DeerFlow URL 확인
config_path = '/root/.hermes/config.yaml'
try:
    with open(config_path) as f:
        content = f.read()
    # DeerFlow 관련 설정 찾기
    for line in content.split('\n'):
        if 'deer' in line.lower() or 'flow' in line.lower() or 'mcp' in line.lower():
            print(f"📄 config.yaml: {line.strip()}")
except:
    print("📄 config.yaml 없음")

# MCP 설정 구조 확인
print("\n=== MCP 서버 설정 확인 ===")
print("config.yaml 에 다음과 같이 추가해야 합니다:\n")
print("""  mcp_servers:
    deer-flow:
      transport: stdio
      command: /path/to/deer-flow
      args: []""")
print("\n또는 HTTP 전송 방식:\n")
print("""  mcp_servers:
    deer-flow:
      transport: http
      url: http://<서버IP>:<포트>/mcp""")
