#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const DRAFTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/02-drafted';
const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/03-published';
const REJECTED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/digest/rejected';

const GHOST_URL = 'https://ubion.ghost.io';  // cron 요청 기준
const GHOST_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const AI_DIGEST_TAG_ID = '69a78cc8659ea80001153beb';

// JWT 생성
function generateJWT() {
  const [kid, secret] = GHOST_API_KEY.split(':');
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const payload = Buffer.from(JSON.stringify({iat:now,exp:now+300,aud:'/admin/'})).toString('base64url');
  const signature = crypto.createHmac('sha256',Buffer.from(secret,'hex')).update(header+'.'+payload).digest('base64url');
  return header+'.'+payload+'.'+signature;
}

// Ghost API 호출 (리다이렉트 지원)
function callGhostAPI(method, endpoint, body = null, retries = 3) {
  return new Promise((resolve, reject) => {
    const token = generateJWT();
    const url = new URL(GHOST_URL + endpoint);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json'
      },
      followRedirect: true
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      // 리다이렉트 처리 (3xx 상태 코드)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = res.headers.location;
        console.log(`  [Redirect] ${res.statusCode} → ${redirectUrl}`);
        res.resume(); // 응답 드레인
        
        // 새로운 URL로 재시도 (새 JWT 생성)
        const newUrl = new URL(redirectUrl);
        const newToken = generateJWT();  // 새 호스트를 위한 새 JWT
        const redirectOptions = {
          hostname: newUrl.hostname,
          port: newUrl.port || 443,
          path: newUrl.pathname + newUrl.search,
          method: method === 'POST' ? 'POST' : 'GET',
          headers: {
            'Authorization': `Ghost ${newToken}`,
            'Content-Type': 'application/json'
          }
        };
        
        const redirectReq = https.request(redirectOptions, (redirectRes) => {
          let redirectData = '';
          redirectRes.on('data', chunk => redirectData += chunk);
          redirectRes.on('end', () => {
            if (redirectRes.statusCode >= 200 && redirectRes.statusCode < 300) {
              try {
                resolve(JSON.parse(redirectData));
              } catch (e) {
                resolve(redirectData);
              }
            } else {
              reject(new Error(`Ghost API error after redirect: ${redirectRes.statusCode} ${redirectData}`));
            }
          });
        });
        
        redirectReq.on('error', reject);
        if (body) redirectReq.write(JSON.stringify(body));
        redirectReq.end();
        return;
      }
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          if (retries > 0) {
            console.log(`  [Retry ${4-retries}/3] HTTP ${res.statusCode}, waiting 5s...`);
            setTimeout(() => {
              callGhostAPI(method, endpoint, body, retries-1).then(resolve).catch(reject);
            }, 5000);
          } else {
            reject(new Error(`Ghost API error: ${res.statusCode} ${data}`));
          }
        }
      });
    });

    req.on('error', (err) => {
      if (retries > 0) {
        console.log(`  [Retry ${4-retries}/3] Network error, waiting 5s...`);
        setTimeout(() => {
          callGhostAPI(method, endpoint, body, retries-1).then(resolve).catch(reject);
        }, 5000);
      } else {
        reject(err);
      }
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 피처 이미지 가져오기
function getFeatureImageUrl(headline, tags) {
  // 간단한 예제: 첫 번째 태그로 검색 이미지 생성
  const query = encodeURIComponent(tags[0] || headline);
  return `https://source.unsplash.com/1200x630/?${query}`;
}

// 파일 삭제
function deleteFile(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (e) {
    console.error(`Failed to delete ${filePath}:`, e.message);
    return false;
  }
}

// 파일 이동
function moveFile(src, dst) {
  try {
    const dir = path.dirname(dst);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.copyFileSync(src, dst);
    fs.unlinkSync(src);
    return true;
  } catch (e) {
    console.error(`Failed to move ${src} to ${dst}:`, e.message);
    return false;
  }
}

async function publishDigest(filePath) {
  const filename = path.basename(filePath);
  console.log(`\n📤 Publishing: ${filename}`);
  
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!content.digest || !content.digest.headline) {
      throw new Error('Invalid digest structure: missing headline');
    }

    const tags = [{ id: AI_DIGEST_TAG_ID }];
    if (content.digest.ghost_tags) {
      // AI_DIGEST_TAG_ID는 이미 추가됨, 다른 태그들만 추가
      content.digest.ghost_tags.forEach(tag => {
        if (tag !== 'ai-digest') {
          tags.push({ name: tag });
        }
      });
    }

    const featureImage = getFeatureImageUrl(content.digest.headline, content.digest.ghost_tags || []);

    const postData = {
      posts: [{
        title: content.digest.headline,
        html: content.digest.html,
        status: 'published',
        featured: false,
        tags: tags,
        meta_title: content.digest.meta_title || content.digest.headline,
        meta_description: content.digest.meta_description || content.digest.lead,
        feature_image: featureImage,
        codeinjection_foot: ''
      }]
    };

    const result = await callGhostAPI('POST', '/ghost/api/admin/posts/?source=html', postData);
    
    if (!result.posts || result.posts.length === 0) {
      throw new Error('No post returned from Ghost API');
    }

    const post = result.posts[0];
    const publishResult = {
      ghost_post_id: post.id,
      ghost_url: `${GHOST_URL}/ghost/#/editor/post/${post.id}`,
      public_url: `${GHOST_URL}/${post.slug}/`,
      status: 'published',
      published_at: post.published_at || new Date().toISOString()
    };

    // 결과 파일 생성
    content.stage = 'published';
    content.publish_result = publishResult;
    content.audit_log = content.audit_log || [];
    content.audit_log.push({
      agent: 'digest-publisher',
      action: 'published',
      timestamp: new Date().toISOString()
    });

    const publishedFilePath = path.join(PUBLISHED_DIR, filename);
    if (!fs.existsSync(PUBLISHED_DIR)) {
      fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
    }
    fs.writeFileSync(publishedFilePath, JSON.stringify(content, null, 2));
    
    // 원본 파일 삭제
    deleteFile(filePath);
    
    console.log(`   ✅ Published: ${content.digest.headline}`);
    console.log(`   🔗 URL: ${publishResult.public_url}`);
    
    return { success: true, filename, headline: content.digest.headline, url: publishResult.public_url };
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    
    // rejected로 이동
    const rejectedFilePath = path.join(REJECTED_DIR, filename);
    moveFile(filePath, rejectedFilePath);
    
    // rejected 파일에 오류 기록
    try {
      const content = JSON.parse(fs.readFileSync(rejectedFilePath, 'utf8'));
      content.stage = 'rejected';
      content.error = {
        agent: 'digest-publisher',
        action: 'publish_failed',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      fs.writeFileSync(rejectedFilePath, JSON.stringify(content, null, 2));
    } catch (e) {
      console.error(`   Failed to update rejected file: ${e.message}`);
    }
    
    return { success: false, filename, error: error.message };
  }
}

async function main() {
  console.log('🚀 AI Digest Publisher');
  console.log(`📁 Source: ${DRAFTED_DIR}`);
  console.log(`📤 Target: ${PUBLISHED_DIR}\n`);

  if (!fs.existsSync(DRAFTED_DIR)) {
    console.log('❌ Drafted directory not found');
    process.exit(1);
  }

  const files = fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json')).sort();
  
  if (files.length === 0) {
    console.log('✅ No drafted digests to publish');
    process.exit(0);
  }

  console.log(`📋 Found ${files.length} digests to publish\n`);

  const results = [];
  for (const file of files) {
    const filePath = path.join(DRAFTED_DIR, file);
    const result = await publishDigest(filePath);
    results.push(result);
  }

  console.log('\n\n📊 Summary:');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Published: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (successful.length > 0) {
    console.log('\n발행된 기사:');
    successful.forEach(r => {
      console.log(`  • ${r.headline}`);
      console.log(`    ${r.url}`);
    });
  }

  if (failed.length > 0) {
    console.log('\n발행 실패:');
    failed.forEach(r => {
      console.log(`  • ${r.filename}: ${r.error}`);
    });
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
