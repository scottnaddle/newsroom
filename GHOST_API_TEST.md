# Ghost Admin API 테스트 가이드

**작성일:** 2026-03-10 16:28 KST  
**목적:** insight.ubion.global 직접 연결 API 테스트  
**주의:** redirect 제거 후 재검증

---

## 📋 테스트 설정

### Ghost Instance 정보

```
Ghost CMS URL (변경됨):  https://insight.ubion.global
이전 URL:               https://ubion.ghost.io (redirect 제거)
API 버전:               v3, v4 지원
인증:                   JWT (HS256)
```

### 필요 정보

```
Admin API Key 형식: {key_id}:{secret}
예: 69af698cff4fbf0001ab7d9f:59af7140e7ddf74f49773a495950508b92655d6ab67126215313e800c660b95c

가져오는 위치:
Ghost Admin > Settings > Integrations > Custom Integration
```

---

## 🧪 테스트 시나리오

### Test 1: 기본 연결 테스트

```bash
# 1. DNS 확인
nslookup insight.ubion.global

# 2. HTTPS 연결 확인
curl -I https://insight.ubion.global

# 3. Ghost 버전 확인
curl https://insight.ubion.global/ghost/api/v3/admin/users/ \
  -H "Authorization: Ghost {key_id}:{secret}" \
  -H "Content-Type: application/json"
```

### Test 2: JWT 생성 및 테스트

```javascript
// Node.js에서 JWT 생성 테스트
const jwt = require('jsonwebtoken');

const apiKey = "69af698cff4fbf0001ab7d9f:59af7140e7ddf74f49773a495950508b92655d6ab67126215313e800c660b95c";
const [id, secret] = apiKey.split(':');

const payload = {
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 5 * 60,
  aud: '/admin/'
};

const token = jwt.sign(payload, Buffer.from(secret, 'hex'), {
  algorithm: 'HS256',
  header: {
    alg: 'HS256',
    typ: 'JWT',
    kid: id
  }
});

console.log('생성된 토큰:', token);
```

### Test 3: POST 요청 (기사 작성)

```bash
curl -X POST https://insight.ubion.global/ghost/api/v3/admin/posts/ \
  -H "Authorization: Ghost {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "posts": [{
      "title": "테스트 기사",
      "html": "<p>테스트 내용</p>",
      "status": "draft"
    }]
  }'
```

### Test 4: GET 요청 (기사 목록)

```bash
curl https://insight.ubion.global/ghost/api/v3/admin/posts/ \
  -H "Authorization: Ghost {token}" \
  -H "Content-Type: application/json"
```

---

## 🔍 예상 응답

### ✅ 성공 응답

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "posts": [
    {
      "id": "12345...",
      "title": "테스트 기사",
      "slug": "test-post",
      "html": "<p>테스트 내용</p>",
      "status": "draft",
      "created_at": "2026-03-10T16:28:00.000Z",
      "published_at": null
    }
  ]
}
```

### ❌ 실패 응답

```json
HTTP/1.1 401 Unauthorized
{
  "errors": [
    {
      "message": "Invalid token",
      "errorType": "UnauthorizedError"
    }
  ]
}
```

---

## 🛠️ 자동화 테스트 스크립트

### test-ghost-api.js

```javascript
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

class GhostAPITester {
  constructor(apiUrl, adminApiKey) {
    this.apiUrl = apiUrl;
    const [id, secret] = adminApiKey.split(':');
    this.keyId = id;
    this.secret = Buffer.from(secret, 'hex');
  }

  generateToken() {
    const payload = {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 5 * 60,
      aud: '/admin/'
    };

    return jwt.sign(payload, this.secret, {
      algorithm: 'HS256',
      header: {
        alg: 'HS256',
        typ: 'JWT',
        kid: this.keyId
      }
    });
  }

  async testConnection() {
    console.log('🔍 Ghost API 테스트 시작\n');
    
    const token = this.generateToken();
    console.log('✅ JWT 생성 완료');
    console.log(`   Token (처음 50자): ${token.substring(0, 50)}...`);
    
    const url = `${this.apiUrl}/ghost/api/v3/admin/posts/`;
    console.log(`\n🔗 연결 시도: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Ghost ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log(`\n📊 응답 상태: ${response.status}`);

      if (response.status === 200) {
        const data = await response.json();
        console.log(`✅ 성공! 기사 ${data.posts.length}개 조회됨`);
        return { success: true, posts: data.posts };
      } else {
        const error = await response.json();
        console.log(`❌ 실패: ${JSON.stringify(error, null, 2)}`);
        return { success: false, error };
      }
    } catch (err) {
      console.log(`❌ 요청 실패: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async createTestPost() {
    console.log('\n📝 테스트 기사 생성 시도...\n');
    
    const token = this.generateToken();
    const url = `${this.apiUrl}/ghost/api/v3/admin/posts/`;
    
    const postData = {
      posts: [{
        title: `테스트 기사 - ${new Date().toISOString()}`,
        html: '<p>이것은 API 테스트 기사입니다.</p>',
        status: 'draft'
      }]
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Ghost ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData),
        timeout: 10000
      });

      console.log(`📊 응답 상태: ${response.status}`);

      if (response.status === 201) {
        const data = await response.json();
        console.log(`✅ 성공! 기사 생성됨`);
        console.log(`   ID: ${data.posts[0].id}`);
        console.log(`   Title: ${data.posts[0].title}`);
        return { success: true, post: data.posts[0] };
      } else {
        const error = await response.json();
        console.log(`❌ 실패: ${JSON.stringify(error, null, 2)}`);
        return { success: false, error };
      }
    } catch (err) {
      console.log(`❌ 요청 실패: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

// 사용 예시
const tester = new GhostAPITester(
  'https://insight.ubion.global',
  'YOUR_ADMIN_API_KEY' // 실제 키로 교체 필요
);

(async () => {
  await tester.testConnection();
  // await tester.createTestPost();
})();
```

---

## 📋 테스트 체크리스트

### 연결 테스트
- [ ] DNS 해석 성공
- [ ] HTTPS 연결 가능
- [ ] Ghost 서버 응답
- [ ] 리다이렉트 없음 (직접 연결)

### 인증 테스트
- [ ] API Key 형식 올바름
- [ ] JWT 생성 성공
- [ ] JWT 서명 검증됨
- [ ] Authorization 헤더 올바름

### API 기능 테스트
- [ ] GET /posts/ 성공 (200)
- [ ] POST /posts/ 성공 (201)
- [ ] PUT /posts/{id} 성공 (200)
- [ ] DELETE /posts/{id} 성공 (204)

### 오류 처리
- [ ] 잘못된 토큰 → 401
- [ ] 잘못된 API Key → 401
- [ ] 필드 누락 → 422
- [ ] 타임아웃 처리

---

## 🔧 문제 해결

### 문제: "Invalid token"

**원인:**
1. API Key가 잘못됨
2. secret을 hex로 변환하지 않음
3. JWT 서명이 잘못됨
4. 토큰 만료됨

**해결:**
```bash
# 1. API Key 재발급 (Ghost Admin에서)
# Settings > Integrations > Custom Integration > Regenerate

# 2. 키 형식 확인
echo "key_id:secret" | grep -E '^[a-f0-9]{24}:[a-f0-9]{64}$'

# 3. JWT 디코딩 검증
node -e "console.log(require('jsonwebtoken').decode('YOUR_TOKEN', {complete: true}))"
```

### 문제: "연결 타임아웃"

**원인:**
1. 도메인 DNS 문제
2. 방화벽/네트워크 차단
3. Ghost 서버 응답 지연

**해결:**
```bash
# 1. DNS 테스트
nslookup insight.ubion.global
dig insight.ubion.global

# 2. 직접 연결 테스트
telnet insight.ubion.global 443

# 3. cURL로 상세 정보
curl -v https://insight.ubion.global
```

### 문제: "리다이렉트 여전히 발생"

**확인:**
```bash
# 리다이렉트 없이 직접 연결
curl -L https://insight.ubion.global/ghost/api/v3/admin/posts/

# 리다이렉트 체인 확인
curl -I https://insight.ubion.global

# 응답 헤더 확인
curl -D - https://insight.ubion.global | head -20
```

---

## ✅ 성공 기준

```
모든 테스트 통과:
✅ 연결: 직접 연결 (redirect 없음)
✅ 인증: 토큰 유효함
✅ API: GET/POST/PUT/DELETE 모두 동작
✅ 응답: 올바른 JSON 데이터

기대 효과:
✅ 27개 미동기 기사 자동 발행 가능
✅ 새 기사 자동 동기화
✅ Ghost CMS 완전 통합
```

---

## 🚀 다음 단계

1. **Test 1-4 순서대로 실행**
   - 각 단계에서 응답 확인
   - 오류 메시지 기록

2. **문제 발생 시**
   - 해당 섹션의 "문제 해결" 참고
   - 로그 수집

3. **성공 시**
   - newsroom/shared/config/ghost.json 생성
   - API Key 입력
   - sync-published-to-ghost.js 실행

---

**Ghost Admin API 테스트를 시작하세요!** 🚀
