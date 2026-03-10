#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getFeatureImageUrl } = require('./get-feature-image.js');

// 상수
const DRAFTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/02-drafted';
const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/03-published';
const REJECTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/rejected';

const GHOST_API_KEY = '69af698cff4fbf0001ab7d9f:59af7140e7ddf74f49773a495950508b92655d6ab67126215313e800c660b95c';
const GHOST_URL = 'https://insight.ubion.global';
const GHOST_API_URL = `${GHOST_URL}/ghost/api/admin/posts/?source=html`;
const AI_DIGEST_TAG_ID = '69a78cc8659ea80001153beb';

// JWT 토큰 생성 (Ghost Admin API - 기존 스크립트 방식)
function generateJWT() {
  const crypto = require('crypto');
  const [id, secret] = GHOST_API_KEY.split(':');
  
  const header = Buffer.from(JSON.stringify({
    alg: 'HS256',
    typ: 'JWT',
    kid: id
  })).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: '/admin/'
  })).toString('base64url');

  const sig = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(header + '.' + payload)
    .digest('base64url');

  return header + '.' + payload + '.' + sig;
}

// Ghost API POST 요청 (axios - 자동 리다이렉트)
async function postToGhost(data) {
  const token = generateJWT();
  
  try {
    const response = await axios.post(GHOST_API_URL, data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Ghost ${token}`
      },
      maxRedirects: 5  // 리다이렉트 자동 처리
    });
    
    return { status: response.status, data: response.data };
  } catch (error) {
    if (error.response) {
      throw new Error(`HTTP ${error.response.status}: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    }
    throw error;
  }
}

// 디렉토리 생성
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 메인 함수
async function publishDigests() {
  ensureDir(PUBLISHED_DIR);
  ensureDir(REJECTED_DIR);

  const files = fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json'));
  const results = { success: [], failed: [] };

  for (const filename of files) {
    const filePath = path.join(DRAFTED_DIR, filename);
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const digest = content.digest;
      
      // feature_image URL 생성
      const featureImageUrl = getFeatureImageUrl({
        headline: digest.headline,
        tags: digest.ghost_tags,
        recentIdsFile: '/tmp/used-images.json'
      });

      // Ghost API 요청 바디
      const ghostPayload = {
        posts: [{
          title: digest.headline,
          html: digest.html,
          feature_image: featureImageUrl,
          status: 'published',
          tags: digest.ghost_tags.map(tag => tag === 'ai-digest' ? { id: AI_DIGEST_TAG_ID } : { name: tag }),
          meta_title: digest.meta_title,
          meta_description: digest.meta_description
        }]
      };

      console.log(`📤 발행 시작: ${filename}...`);
      const response = await postToGhost(ghostPayload);

      if (response.status >= 200 && response.status < 300 && response.data.posts && response.data.posts[0]) {
        const post = response.data.posts[0];
        
        // 성공 파일 저장
        content.publish_result = {
          ghost_post_id: post.id,
          ghost_url: post.url,
          published_at: new Date().toISOString()
        };
        content.stage = 'published';
        content.audit_log.push({
          agent: 'digest-publisher',
          action: 'published',
          timestamp: new Date().toISOString()
        });

        const publishedPath = path.join(PUBLISHED_DIR, filename);
        fs.writeFileSync(publishedPath, JSON.stringify(content, null, 2));
        fs.unlinkSync(filePath);
        
        results.success.push({
          filename,
          ghost_post_id: post.id,
          ghost_url: post.url
        });
        console.log(`✅ 성공: ${filename}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data).substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`❌ 실패: ${filename} - ${error.message}`);
      
      // 실패 파일 이동
      const rejectedPath = path.join(REJECTED_DIR, filename);
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        content.error = error.message;
        content.audit_log.push({
          agent: 'digest-publisher',
          action: 'rejected',
          error: error.message,
          timestamp: new Date().toISOString()
        });
        fs.writeFileSync(rejectedPath, JSON.stringify(content, null, 2));
        fs.unlinkSync(filePath);
      } catch (moveError) {
        try {
          fs.copyFileSync(filePath, rejectedPath);
          fs.unlinkSync(filePath);
        } catch (e) {
          // 실패했더라도 계속 진행
        }
      }
      
      results.failed.push({ filename, error: error.message });
    }
  }

  return results;
}

// 실행
publishDigests().then(results => {
  console.log('\n═══════════════════════════════════');
  console.log('📊 발행 완료');
  console.log('═══════════════════════════════════');
  console.log(`✅ 성공: ${results.success.length}개`);
  console.log(`❌ 실패: ${results.failed.length}개`);
  
  if (results.success.length > 0) {
    console.log('\n📰 발행된 기사:');
    results.success.forEach(item => {
      console.log(`  • ${item.filename}`);
      console.log(`    Ghost ID: ${item.ghost_post_id}`);
      console.log(`    URL: ${item.ghost_url}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n⚠️  실패한 기사:');
    results.failed.forEach(item => {
      console.log(`  • ${item.filename}`);
      console.log(`    오류: ${item.error}`);
    });
  }

  process.exit(results.failed.length > 0 ? 1 : 0);
}).catch(err => {
  console.error('💥 치명적 오류:', err.message);
  process.exit(1);
});
