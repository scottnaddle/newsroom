#!/usr/bin/env python3
"""
API 상태 확인 스크립트
=====================
사용법:
    python3 scripts/check_api_health.py

모든 API 키(DeepSeek, OpenAI, FAL)의 연결 상태를 확인합니다.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from llm_utils import check_api_health

if __name__ == '__main__':
    print("API 상태 확인 중...\n")
    result = check_api_health()
    
    ok_icon = chr(0x2705)  # ✅
    fail_icon = chr(0x274C)  # ❌
    
    names = [('DeepSeek', result['deepseek']),
             ('OpenAI (gpt-4o-mini)', result['openai']),
             ('FAL AI (FLUX)', result['fal'])]
    
    for name, status in names:
        icon = ok_icon if status['ok'] else fail_icon
        status_text = "정상" if status['ok'] else "연결 실패"
        print(f'  {icon} {name}: {status_text}')
    
    print(f'\n{result["message"]}')
    
    if not result['deepseek']['ok']:
        print('\nDeepSeek API가 작동하지 않습니다.')
        print(' -> OpenAI(gpt-4o-mini)로 자동 fallback됩니다.')
        if not result['openai']['ok']:
            print(' -> OpenAI도 실패했습니다. API 키를 확인하세요.')
    
    print('\n잔액 확인 방법:')
    print(' - DeepSeek: https://platform.deepseek.com/usage (웹 대시보드)')
    print(' - OpenAI: https://platform.openai.com/usage (웹 대시보드)')
    print(' - FAL AI: https://fal.ai/dashboard (웹 대시보드)')
    print()
    print(' -> 이 API들은 REST API로 잔액 조회를 지원하지 않습니다.')
    print(' -> 웹 대시보드에서 직접 확인하거나, 잔액 부족 시')
    print('    OpenAI로 자동 fallback되며 텔레그램으로 알림이 전송됩니다.')
