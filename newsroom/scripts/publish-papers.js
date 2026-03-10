#!/usr/bin/env node

/**
 * AI 교육 논문 발행 에이전트
 * 
 * 요약된 논문을 Ghost CMS에 발행합니다.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// Configuration
const API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const GHOST_URL = 'https://insight.ubion.global';

// Ghost 태그 ID (ai-papers 태그는 Ghost Admin에서 먼저 생성해야 함)
// AI_DIGEST_TAG_ID = '69a78cc8659ea80001153beb'
// AI_PAPERS_TAG_ID = '생성 후 여기에 입력'
const AI_PAPERS_TAG_ID = process.env.AI_PAPERS_TAG_ID || 'ai-papers'; // 태그 이름으로 시도

const WORKSPACE = '/root/.openclaw/workspace/newsroom';
const SUMMARIZED_DIR = `${WORKSPACE}/pipeline/papers/02-summarized`;
const PUBLISHED_DIR = `${WORKSPACE}/pipeline/papers/03-published`;
const REJECTED_DIR = `${WORKSPACE}/pipeline/papers/04-rejected`;

// Ensure directories
[PUBLISHED_DIR, REJECTED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// JWT Token Generation
function generateJWT() {
  const [kid, secret] = API_KEY.split(':');
  const header = Buffer.from(JSON.stringify({
    alg: 'HS256',
    typ: 'JWT',
    kid
  })).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: '/admin/'
  })).toString('base64url');

  const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'hex'));
  hmac.update(header + '.' + payload);
  const signature = hmac.digest('base64url');

  return header + '.' + payload + '.' + signature;
}

// HTTPS request helper
function ghostRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, GHOST_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Ghost ${generateJWT()}`,
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve({ raw: data });
          }
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Get or create ai-papers tag
async function getOrCreateTag() {
  try {
    // First, try to find the tag
    const tagsResult = await ghostRequest('GET', '/ghost/api/admin/tags/?limit=all');
    const existingTag = tagsResult.tags?.find(t => t.slug === 'ai-papers');
    
    if (existingTag) {
      console.log(`  📌 태그 발견: ai-papers (ID: ${existingTag.id})`);
      return existingTag.id;
    }
    
    // Create new tag if not exists
    console.log('  📌 새 태그 생성: ai-papers');
    const createResult = await ghostRequest('POST', '/ghost/api/admin/tags/', {
      tags: [{
        name: 'AI Papers',
        slug: 'ai-papers',
        description: 'AI 교육 관련 학술 논문 아카이브',
        accent_color: '#8b5cf6'
      }]
    });
    
    return createResult.tags[0].id;
  } catch (error) {
    console.error('  ⚠️ 태그 처리 실패:', error.message);
    return null;
  }
}

// Get feature image (placeholder for papers)
function getFeatureImage(paper) {
  // Use a generic academic paper image
  const images = [
    'https://images.unsplash.com/photo-1532619675605-1ede6c2ed2b0?w=1200&h=630&fit=crop&q=85&auto=format',
    'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&h=630&fit=crop&q=85&auto=format',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&h=630&fit=crop&q=85&auto=format'
  ];
  return images[Math.floor(Math.random() * images.length)];
}

// Publish a paper
async function publishPaper(filename, tagId) {
  const summarizedPath = path.join(SUMMARIZED_DIR, filename);
  const paper = JSON.parse(fs.readFileSync(summarizedPath, 'utf8'));

  console.log(`📤 발행 중: ${paper.arxiv_id}`);
  console.log(`   제목: ${paper.ghost.headline.slice(0, 50)}...`);

  try {
    // Prepare Ghost post
    const ghostPost = {
      posts: [{
        title: paper.ghost.headline,
        html: paper.ghost.html,
        status: 'published',
        featured: false,
        tags: tagId ? [{ id: tagId }] : [{ name: 'AI Papers', slug: 'ai-papers' }],
        meta_title: paper.ghost.meta_title,
        meta_description: paper.ghost.meta_description,
        feature_image: getFeatureImage(paper),
        feature_image_alt: paper.ghost.feature_image_alt || 'AI 교육 논문'
      }]
    };

    // Publish to Ghost
    const result = await ghostRequest('POST', '/ghost/api/admin/posts/?source=html', ghostPost);
    
    if (!result.posts || !result.posts[0]) {
      throw new Error('Ghost API에서 post 반환 없음');
    }

    const publishedPost = result.posts[0];
    
    // Prepare result
    const publishedData = {
      ...paper,
      stage: 'published',
      publish_result: {
        ghost_post_id: publishedPost.id,
        ghost_url: `${GHOST_URL}/ghost/#/editor/post/${publishedPost.id}`,
        public_url: `${GHOST_URL}/${publishedPost.slug}/`,
        status: 'published',
        published_at: publishedPost.published_at || new Date().toISOString()
      },
      audit_log: [
        ...(paper.audit_log || []),
        {
          agent: 'paper-publisher',
          action: 'published',
          timestamp: new Date().toISOString()
        }
      ]
    };

    // Save to published
    const publishedPath = path.join(PUBLISHED_DIR, filename);
    fs.writeFileSync(publishedPath, JSON.stringify(publishedData, null, 2));

    // Delete from summarized
    fs.unlinkSync(summarizedPath);

    console.log(`   ✅ 발행 완료`);
    console.log(`   🔗 ${publishedData.publish_result.public_url}\n`);
    
    return publishedData;
  } catch (error) {
    console.error(`   ❌ 발행 실패: ${error.message}\n`);
    
    // Move to rejected
    const rejectedPath = path.join(REJECTED_DIR, filename);
    fs.writeFileSync(rejectedPath, JSON.stringify({
      ...paper,
      stage: 'rejected',
      error: error.message,
      rejected_at: new Date().toISOString(),
      audit_log: [
        ...(paper.audit_log || []),
        {
          agent: 'paper-publisher',
          action: 'rejected',
          timestamp: new Date().toISOString(),
          reason: error.message
        }
      ]
    }, null, 2));
    fs.unlinkSync(summarizedPath);
    
    return null;
  }
}

// Main
async function main() {
  console.log('📚 AI 교육 논문 발행 에이전트 시작\n');
  console.log(`📅 ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n`);

  const files = fs.readdirSync(SUMMARIZED_DIR).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('발행할 논문이 없습니다.');
    process.exit(0);
  }

  console.log(`📄 ${files.length}개 논문 발견\n`);

  // Get or create tag
  const tagId = await getOrCreateTag();
  console.log('');

  // Publish each paper
  const results = [];
  for (const filename of files) {
    const result = await publishPaper(filename, tagId);
    if (result) results.push(result);
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('📊 발행 완료!');
  console.log(`   성공: ${results.length}/${files.length}`);
  
  results.forEach(r => {
    console.log(`   • ${r.arxiv_id}: ${r.publish_result.public_url}`);
  });
}

main().catch(console.error);
