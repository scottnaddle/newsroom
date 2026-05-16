"""
공유 LLM 호출 유틸리티 — DeepSeek + OpenAI(gpt-4o-mini) fallback
모든 뉴스룸 스크립트에서 import하여 사용
"""
import json, subprocess, re, os

ENV_PATH = '/root/.openclaw/workspace/newsroom/.env'
DEEPSEEK_BASE_URL = os.environ.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1')

_SUCCESS_CACHE = {'deepseek': True, 'openai': True}

def _load_env(key):
    if key in os.environ:
        val = os.environ[key]
        if val and val.strip():
            return val.strip()
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH) as f:
            for line in f:
                line = line.strip()
                if line.startswith(key + '='):
                    return line.split('=', 1)[1].strip()
    return None

def _call_api(api_type, payload, timeout=120):
    """
    api_type: 'deepseek' or 'openai'
    payload: dict with keys: model, messages, temperature, max_tokens
    """
    if api_type == 'deepseek':
        key = _load_env('DEEPSEEK_API_KEY')
        url = f'{DEEPSEEK_BASE_URL}/chat/completions'
        auth = f'Bearer {key}'
    else:
        key = _load_env('OPENAI_API_KEY')
        url = 'https://api.openai.com/v1/chat/completions'
        auth = f'Bearer {key}'
    
    if not key:
        return None
    
    r = subprocess.run(['curl', '-s', '-X', 'POST', url,
        '-H', f'Authorization: {auth}',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps(payload)],
        capture_output=True, text=True, timeout=timeout)
    
    try:
        data = json.loads(r.stdout)
        content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
        if content:
            return content
        # Check for error
        err_msg = data.get('error', {}).get('message', '')
        if err_msg:
            print(f'  ⚠️ {api_type} API 오류: {err_msg[:80]}')
            return None
        return None
    except:
        return None

def call_llm(prompt, system=None, temperature=0.7, max_tokens=3000, label=''):
    """
    DeepSeek 우선 호출, 실패 시 OpenAI(gpt-4o-mini) fallback.
    
    Args:
        prompt: str — user 메시지
        system: str — system 메시지 (선택)
        temperature: float
        max_tokens: int
        label: str — 로그에 표시할 라벨 (선택)
    
    Returns:
        str — 생성된 텍스트, 또는 None (모두 실패)
    """
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})
    
    # 1st: DeepSeek
    if _SUCCESS_CACHE.get('deepseek', True):
        result = _call_api('deepseek', {
            "model": "deepseek-chat",
            "messages": msgs,
            "temperature": temperature,
            "max_tokens": max_tokens
        }, timeout=120)
        if result:
            return result
        # Mark as failed for this session
        _SUCCESS_CACHE['deepseek'] = False
        print(f'  ⚠️ DeepSeek 실패 → OpenAI(gpt-4o-mini) fallback')
    
    # 2nd: OpenAI fallback
    if _SUCCESS_CACHE.get('openai', True):
        # gpt-4o-mini is cheaper and faster
        result = _call_api('openai', {
            "model": "gpt-4o-mini",
            "messages": msgs,
            "temperature": temperature,
            "max_tokens": max_tokens
        }, timeout=60)
        if result:
            return result
        _SUCCESS_CACHE['openai'] = False
    
    return None

def check_api_health():
    """
    모든 API 키 상태를 확인하여 딕셔너리로 반환.
    openai 대시보드 Key는 API 호출은 되지만 billing API는 
    다른 인증 방식(scoped key)이 필요해서 따로 확인 불가.
    
    Returns:
        dict: {
            'deepseek': {'ok': bool, 'provider': 'deepseek'},
            'openai': {'ok': bool, 'provider': 'openai'},
            'fal': {'ok': bool},
            'message': str  — 요약 메시지
        }
    """
    result = {'deepseek': {'ok': False, 'provider': 'deepseek'},
              'openai': {'ok': False, 'provider': 'openai'},
              'fal': {'ok': False}}
    
    # Test DeepSeek
    ds_key = _load_env('DEEPSEEK_API_KEY')
    if ds_key:
        r = subprocess.run(['curl', '-s', '-X', 'POST', f'{DEEPSEEK_BASE_URL}/chat/completions',
            '-H', f'Authorization: Bearer {ds_key}',
            '-H', 'Content-Type: application/json',
            '-d', json.dumps({"model":"deepseek-chat","messages":[{"role":"user","content":"hi"}],"max_tokens":1})],
            capture_output=True, text=True, timeout=15)
        try:
            data = json.loads(r.stdout)
            if data.get('choices'):
                result['deepseek']['ok'] = True
        except:
            pass
    
    # Test OpenAI
    oa_key = _load_env('OPENAI_API_KEY')
    if oa_key:
        r = subprocess.run(['curl', '-s', '-X', 'POST', 'https://api.openai.com/v1/chat/completions',
            '-H', f'Authorization: Bearer {oa_key}',
            '-H', 'Content-Type: application/json',
            '-d', json.dumps({"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":1})],
            capture_output=True, text=True, timeout=15)
        try:
            data = json.loads(r.stdout)
            if data.get('choices'):
                result['openai']['ok'] = True
        except:
            pass
    
    # Test FAL (FLUX)
    fal_key = _load_env('FAL_KEY')
    if fal_key:
        r = subprocess.run(['curl', '-s', '-w', '%{http_code}', '-o', '/dev/null',
            'https://fal.run/fal-ai/flux/dev',
            '-H', f'Authorization: Key {fal_key}',
            '-H', 'Content-Type: application/json',
            '-d', json.dumps({"prompt":"test","num_inference_steps":1,"sync_mode":True})],
            capture_output=True, text=True, timeout=15)
        if r.stdout.strip() == '200':
            result['fal']['ok'] = True
    
    # Build message
    parts = []
    if result['deepseek']['ok']:
        parts.append('DeepSeek ✅')
    else:
        parts.append('DeepSeek ❌')
    
    if result['openai']['ok']:
        parts.append('OpenAI ✅')
    else:
        parts.append('OpenAI ❌')
    if result['fal']['ok']:
        parts.append('FAL(FLUX) ✅')
    else:
        parts.append('FAL(FLUX) ❌')
    
    result['message'] = ' / '.join(parts)
    return result
