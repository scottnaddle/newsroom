#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// Constants
const WORKSPACE = '/root/.openclaw/workspace/newsroom';
const DRAFTED_DIR = path.join(WORKSPACE, 'pipeline/digest/02-drafted');
const PUBLISHED_DIR = path.join(WORKSPACE, 'pipeline/digest/03-published');
const REJECTED_DIR = path.join(WORKSPACE, 'pipeline/digest/rejected');
const CONFIG_FILE = path.join(WORKSPACE, 'shared/config/ghost.json');
const USED_IMAGES_FILE = path.join(WORKSPACE, 'shared/config/used-images.json');

// Ghost API settings
const GHOST_API_URL = 'https://ubion.ghost.io/ghost/api/admin';
const AI_DIGEST_TAG_ID = '69a78cc8659ea80001153beb';

// Read config
const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const [kid, secret] = config.adminApiKey.split(':');

// Create JWT token
function createJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ 
    iat: now, 
    exp: now + 300, 
    aud: '/admin/' 
  })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

// Get feature image URL
function getFeatureImageUrl(digest) {
  // Simple Unsplash image URL based on topic
  const unsplashTopics = {
    'funding': 'startup-funding',
    'nvidia': 'ai-gpu',
    'phantom': 'money-digital',
    'default': 'artificial-intelligence'
  };
  
  let topic = 'default';
  const headline = (digest.headline || '').toLowerCase();
  if (headline.includes('fund')) topic = 'funding';
  if (headline.includes('nvidia')) topic = 'nvidia';
  if (headline.includes('phantom')) topic = 'phantom';
  
  return `https://images.unsplash.com/photo-1677442d019cecf8f80f1d30c74dc5fb69174c2a5?auto=format&fit=crop&w=1200&h=630&q=80`;
}

// Make HTTPS request
function makeRequest(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'ubion.ghost.io',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Publish digest to Ghost
async function publishDigest(digestData) {
  const token = createJWT();
  
  // Handle nested structure: digest.digest.* or digest.*
  const digestContent = digestData.digest || digestData;
  
  if (!digestContent.headline) {
    throw new Error('Missing headline in digest content');
  }
  
  const featureImage = getFeatureImageUrl(digestContent);
  
  // Build tags array
  const tagsArray = [{ id: AI_DIGEST_TAG_ID }];
  if (digestContent.ghost_tags && Array.isArray(digestContent.ghost_tags)) {
    digestContent.ghost_tags.forEach(tag => {
      if (typeof tag === 'string') {
        // If tag is a string, create a tag object
        // Note: This assumes we can create new tags, otherwise we need their IDs
        tagsArray.push({ name: tag });
      } else if (typeof tag === 'object') {
        tagsArray.push(tag);
      }
    });
  }
  
  const postData = {
    posts: [{
      title: digestContent.headline,
      html: digestContent.html || '',
      status: 'published',
      featured: false,
      tags: tagsArray,
      meta_title: digestContent.meta_title || digestContent.headline,
      meta_description: digestContent.meta_description || digestContent.headline,
      feature_image: featureImage,
      codeinjection_foot: ''
    }]
  };

  const response = await makeRequest('POST', '/ghost/api/admin/posts/?source=html', postData, token);
  
  if (response.status !== 201) {
    throw new Error(`Ghost API error: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.data.posts[0];
}

// Process and publish all drafted digests
async function publishAllDigests() {
  if (!fs.existsSync(DRAFTED_DIR)) {
    console.log('❌ Drafted directory not found');
    process.exit(1);
  }

  // Ensure output directories exist
  [PUBLISHED_DIR, REJECTED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const files = fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.log('할 일 없음 — digest/02-drafted 비어있음');
    process.exit(0);
  }

  const publishedResults = [];
  const rejectedResults = [];

  for (const file of files) {
    const filePath = path.join(DRAFTED_DIR, file);
    let rawData = fs.readFileSync(filePath, 'utf8');
    
    // Handle potential JSON parsing issues
    let digest;
    try {
      digest = JSON.parse(rawData);
    } catch (e) {
      console.error(`❌ JSON 파싱 오류: ${file} - ${e.message}`);
      continue;
    }
    
    // Parse nested digest if it's a string
    if (digest.digest && typeof digest.digest === 'string') {
      try {
        digest.digest = JSON.parse(digest.digest);
      } catch (e) {
        console.error(`⚠️  nested digest 파싱 실패: ${file}`);
      }
    }
    
    let retries = 3;
    let published = false;
    let publishResult = null;
    let error = null;

    while (retries > 0 && !published) {
      try {
        publishResult = await publishDigest(digest);
        published = true;
        break;
      } catch (err) {
        error = err.message;
        retries--;
        if (retries > 0) {
          console.log(`⚠️  ${file}: 재시도 중 (남은 시도: ${retries})`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
        }
      }
    }

    if (published) {
      // Get the actual digest content
      const digestContent = digest.digest || digest;
      const headline = digestContent.headline || '(제목 없음)';
      
      // Save to published directory
      const publishedDigest = {
        ...digest,
        stage: 'published',
        publish_result: {
          ghost_post_id: publishResult.id,
          ghost_url: `https://ubion.ghost.io/ghost/#/editor/post/${publishResult.id}`,
          public_url: `https://ubion.ghost.io/${publishResult.slug}/`,
          status: 'published',
          published_at: publishResult.published_at || new Date().toISOString()
        },
        audit_log: [
          ...(digest.audit_log || []),
          {
            agent: 'digest-publisher',
            action: 'published',
            timestamp: new Date().toISOString()
          }
        ]
      };

      fs.writeFileSync(
        path.join(PUBLISHED_DIR, file),
        JSON.stringify(publishedDigest, null, 2)
      );

      // Delete from drafted
      fs.unlinkSync(filePath);

      publishedResults.push({
        title: headline,
        url: `https://ubion.ghost.io/${publishResult.slug}/`,
        id: publishResult.id
      });

      console.log(`✅ 발행됨: ${headline}`);
    } else {
      // Move to rejected directory
      const rejectedDigest = {
        ...digest,
        stage: 'rejected',
        rejection_reason: error,
        rejected_at: new Date().toISOString(),
        audit_log: [
          ...(digest.audit_log || []),
          {
            agent: 'digest-publisher',
            action: 'rejected',
            reason: error,
            timestamp: new Date().toISOString()
          }
        ]
      };

      fs.writeFileSync(
        path.join(REJECTED_DIR, file),
        JSON.stringify(rejectedDigest, null, 2)
      );

      fs.unlinkSync(filePath);

      rejectedResults.push({
        title: digest.headline,
        error: error
      });

      console.log(`❌ 실패: ${digest.headline} - ${error}`);
    }
  }

  // Summary
  console.log('\n📊 발행 완료 요약:');
  console.log(`- 성공: ${publishedResults.length}건`);
  console.log(`- 실패: ${rejectedResults.length}건`);

  if (publishedResults.length > 0) {
    console.log('\n✅ 발행된 기사:');
    publishedResults.forEach(result => {
      console.log(`  • ${result.title}`);
      console.log(`    ${result.url}`);
    });
  }

  if (rejectedResults.length > 0) {
    console.log('\n❌ 실패한 기사:');
    rejectedResults.forEach(result => {
      console.log(`  • ${result.title}`);
      console.log(`    오류: ${result.error}`);
    });
  }
}

// Run
publishAllDigests().catch(err => {
  console.error('💥 발행 프로세스 오류:', err.message);
  process.exit(1);
});
