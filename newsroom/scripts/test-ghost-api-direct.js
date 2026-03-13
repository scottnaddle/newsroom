#!/usr/bin/env node

/**
 * Ghost Admin API 테스트 - ubion.ghost.io 직접 연결
 * 목적: redirect 제거 후 API 재검증
 */

const jwt = require('jsonwebtoken');
const https = require('https');
const http = require('http');

class GhostAPITest {
  constructor(apiUrl, adminApiKey) {
    this.apiUrl = apiUrl;
    
    if (!adminApiKey || adminApiKey.includes('YOUR_')) {
      console.log('❌ Admin API Key가 설정되지 않았습니다.');
      console.log('   newsroom/shared/config/ghost.json에 API Key를 입력해주세요');
      process.exit(1);
    }

    const parts = adminApiKey.split(':');
    if (parts.length !== 2) {
      console.log('❌ Admin API Key 형식이 잘못되었습니다.');
      console.log('   형식: key_id:secret (예: 69af698cff4fbf0001ab7d9f:59af7140...)');
      process.exit(1);
    }

    this.keyId = parts[0];
    this.secret = parts[1];
  }

  generateToken() {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now,
      exp: now + 5 * 60, // 5분 만료
      aud: '/admin/'
    };

    try {
      const secretBuffer = Buffer.from(this.secret, 'hex');
      const token = jwt.sign(payload, secretBuffer, {
        algorithm: 'HS256',
        header: {
          alg: 'HS256',
          typ: 'JWT',
          kid: this.keyId
        }
      });
      return token;
    } catch (err) {
      console.log('❌ JWT 생성 실패:', err.message);
      process.exit(1);
    }
  }

  makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.apiUrl}${path}`);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const token = this.generateToken();
      const headers = {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GhostAPITest/1.0'
      };

      if (body) {
        const bodyStr = JSON.stringify(body);
        headers['Content-Length'] = Buffer.byteLength(bodyStr);
      }

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: headers,
        timeout: 10000
      };

      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : null;
            resolve({
              status: res.statusCode,
              statusMessage: res.statusMessage,
              headers: res.headers,
              body: parsed,
              raw: data
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              statusMessage: res.statusMessage,
              headers: res.headers,
              body: null,
              raw: data
            });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  async runTests() {
    console.log('🔍 Ghost Admin API 테스트 시작\n');
    console.log(`📍 API URL: ${this.apiUrl}`);
    console.log(`🔑 Key ID: ${this.keyId}`);
    console.log(`🔐 Secret: ${this.secret.substring(0, 20)}...\n`);

    // Test 1: 기본 연결
    console.log('=== Test 1: 기본 연결 테스트 ===');
    try {
      const result = await this.makeRequest('GET', '/ghost/api/v3/admin/posts/');
      console.log(`✅ HTTP ${result.status} ${result.statusMessage}`);

      if (result.status === 200) {
        console.log(`✅ 성공! ${result.body.posts?.length || 0}개 기사 조회됨`);
        return { success: true, test: 'connection' };
      } else if (result.status === 401) {
        console.log('❌ 인증 실패: Invalid token');
        console.log('   원인: API Key가 유효하지 않음');
        if (result.body?.errors) {
          console.log('   오류:', result.body.errors[0].message);
        }
        return { success: false, test: 'connection', error: 'Invalid token' };
      } else {
        console.log(`❌ 오류: HTTP ${result.status}`);
        if (result.body?.errors) {
          console.log('   ', result.body.errors[0].message);
        }
        return { success: false, test: 'connection', status: result.status };
      }
    } catch (err) {
      console.log(`❌ 요청 실패: ${err.message}`);
      return { success: false, test: 'connection', error: err.message };
    }
  }

  async testCreatePost() {
    console.log('\n=== Test 2: 테스트 기사 생성 ===');
    
    const postData = {
      posts: [{
        title: `API 테스트 - ${new Date().toISOString()}`,
        html: '<p>이것은 Ghost Admin API 테스트 기사입니다.</p>',
        status: 'draft'
      }]
    };

    try {
      const result = await this.makeRequest('POST', '/ghost/api/v3/admin/posts/', postData);
      console.log(`✅ HTTP ${result.status} ${result.statusMessage}`);

      if (result.status === 201) {
        console.log(`✅ 성공! 기사 생성됨`);
        console.log(`   ID: ${result.body.posts[0].id}`);
        console.log(`   Title: ${result.body.posts[0].title}`);
        return { success: true, test: 'create', postId: result.body.posts[0].id };
      } else if (result.status === 401) {
        console.log('❌ 인증 실패');
        return { success: false, test: 'create', error: 'Unauthorized' };
      } else {
        console.log(`❌ 오류: HTTP ${result.status}`);
        return { success: false, test: 'create', status: result.status };
      }
    } catch (err) {
      console.log(`❌ 요청 실패: ${err.message}`);
      return { success: false, test: 'create', error: err.message };
    }
  }
}

// Main
(async () => {
  // 설정 읽기
  const fs = require('fs');
  const path = require('path');

  const configPath = path.join(__dirname, '../shared/config/ghost.json');
  
  let config;
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(data);
  } catch (err) {
    console.log('❌ ghost.json을 읽을 수 없습니다.');
    console.log('   경로:', configPath);
    console.log('\n📝 생성 방법:');
    console.log('   1. cp newsroom/shared/config/ghost.json.example newsroom/shared/config/ghost.json');
    console.log('   2. ghost.json을 편집하여 API Key 입력');
    console.log('   3. 다시 실행');
    process.exit(1);
  }

  const tester = new GhostAPITest(config.apiUrl, config.adminApiKey);
  const result1 = await tester.runTests();

  if (result1.success) {
    console.log('\n✅ 기본 연결 테스트 성공!');
    console.log('   Ghost Admin API가 정상 작동 중입니다.');
    console.log('\n다음 단계:');
    console.log('   1. 27개 미동기 기사 자동 발행 가능');
    console.log('   2. npm run sync-ghost 실행');
    console.log('   3. 기사 동기화 확인');
  } else {
    console.log('\n❌ 기본 연결 테스트 실패');
    console.log('   원인:', result1.error || `HTTP ${result1.status}`);
    console.log('\n해결 방법:');
    console.log('   1. API Key 재확인 (Ghost Admin > Integrations)');
    console.log('   2. API Key 형식 확인 (key_id:secret)');
    console.log('   3. 도메인 확인 (https://ubion.ghost.io)');
    console.log('   4. GHOST_API_TEST.md 참고');
  }

  // Test 2: 테스트 기사 생성 (선택, 로컬 테스트용)
  // const result2 = await tester.testCreatePost();
})();
