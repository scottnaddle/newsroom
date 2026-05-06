#!/usr/bin/env python3
"""Debug Ghost API curl response."""
import json, subprocess, base64, hmac, hashlib, time, re

ENV_PATH = '/root/.openclaw/workspace/newsroom/.env'
with open(ENV_PATH) as f:
    text = f.read()
url_match = re.search(r'GHOST_URL=(.+)', text)
key_match = re.search(r'GHOST_ADMIN_API_KEY=(.+)', text)
ghost_domain = url_match.group(1).strip()
ghost_admin_key = key_match.group(1).strip()
kid, secret = ghost_admin_key.split(':')
now = int(time.time())
jh = base64.urlsafe_b64encode(json.dumps({'alg':'HS256','typ':'JWT','kid':kid}).encode()).rstrip(b'=').decode()
jp = base64.urlsafe_b64encode(json.dumps({'iat':now,'exp':now+300,'aud':'/admin/'}).encode()).rstrip(b'=').decode()
js = base64.urlsafe_b64encode(hmac.new(bytes.fromhex(secret), f'{jh}.{jp}'.encode(), 'sha256').digest()).rstrip(b'=').decode()
jwt = f'{jh}.{jp}.{js}'

# Test 1: direct subprocess.run
print("=== Test 1: subprocess.run ===")
r = subprocess.run(['curl', '-s', '-w', '\n%{http_code}', '-X', 'GET',
    f'https://{ghost_domain}/ghost/api/admin/posts/?limit=1',
    '-H', f'Authorization: Ghost {jwt}',
    '-H', 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    '-H', 'Accept: application/json',
    '-H', 'Referer: https://newsroom.ubion.global/ghost/'],
    capture_output=True, timeout=15)
print(f'stdout len={len(r.stdout)}, stderr len={len(r.stderr)}')
stdout_str = r.stdout.decode('utf-8', errors='replace')
print(f'stdout (last 200): ...{stdout_str[-200:]}')

# Test 2: curl directly without subprocess.run overhead
print("\n=== Test 2: os.system ===")
import os
ret = os.system(f'curl -s -o /tmp/ghost_out.txt -w "%{{http_code}}" "https://{ghost_domain}/ghost/api/admin/posts/?limit=1" -H "Authorization: Ghost {jwt}" -H "User-Agent: Mozilla/5.0" -H "Accept: application/json" -H "Referer: https://{ghost_domain}/ghost/" 2>/dev/null')
print(f'os.system return code: {ret >> 8 if ret > 127 else ret}')
if os.path.exists('/tmp/ghost_out.txt'):
    with open('/tmp/ghost_out.txt') as f:
        content = f.read()
    print(f'stdout len={len(content)}, first 100: {content[:100]}')
else:
    print('No output file')
