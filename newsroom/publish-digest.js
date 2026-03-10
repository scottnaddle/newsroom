const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Ghost API 설정
const GHOST_URL = 'https://insight.ubion.global';
const API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const AI_DIGEST_TAG_ID = '69a78cc8659ea80001153beb';

// JWT 토큰 생성
function generateJWT() {
  const [kid, secret] = API_KEY.split(':');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const signature = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

// 피처 이미지 가져오기
const { getFeatureImageUrl } = require('./scripts/get-feature-image.js');

async function publishDigest(draftFile) {
  const draftPath = path.join(__dirname, 'pipeline/digest/02-drafted', draftFile);
  const publishedPath = path.join(__dirname, 'pipeline/digest/03-published', draftFile);
  
  console.log(`\n📄 Processing: ${draftFile}`);
  
  // 1. 드래프트 파일 읽기
  const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  
  // 2. 피처 이미지 선택
  const featureImageUrl = getFeatureImageUrl({
    headline: draft.digest.headline,
    tags: draft.digest.ghost_tags,
    recentIdsFile: path.join(__dirname, 'shared/config/used-images.json')
  });
  console.log(`   ✓ Feature image: ${featureImageUrl.substring(0, 60)}...`);
  
  // 3. Ghost 태그 준비 (ai-digest 태그 ID + 기타 태그들)
  const tags = [{ id: AI_DIGEST_TAG_ID }];
  draft.digest.ghost_tags.forEach(tag => {
    if (tag !== 'ai-digest') {
      tags.push({ name: tag });
    }
  });
  
  // 4. Ghost API 요청 본문
  const ghostPost = {
    posts: [{
      title: draft.digest.headline,
      html: draft.digest.html,
      status: 'published',
      featured: false,
      tags: tags,
      meta_title: draft.digest.meta_title,
      meta_description: draft.digest.meta_description,
      feature_image: featureImageUrl,
      codeinjection_foot: ''
    }]
  };
  
  // 5. Ghost Admin API에 발행 요청
  const token = generateJWT();
  const response = await fetch(`${GHOST_URL}/ghost/api/admin/posts/?source=html`, {
    method: 'POST',
    headers: {
      'Authorization': `Ghost ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(ghostPost)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ghost API error: ${response.status} - ${error}`);
  }
  
  const result = await response.json();
  const publishedPost = result.posts[0];
  
  console.log(`   ✓ Published to Ghost (ID: ${publishedPost.id})`);
  
  // 6. 결과 저장
  const publishedData = {
    ...draft,
    stage: 'published',
    publish_result: {
      ghost_post_id: publishedPost.id,
      ghost_url: `${GHOST_URL}/ghost/#/editor/post/${publishedPost.id}`,
      public_url: `${GHOST_URL}/${publishedPost.slug}/`,
      status: 'published',
      published_at: publishedPost.published_at
    },
    audit_log: [
      ...draft.audit_log,
      {
        agent: 'digest-publisher',
        action: 'published',
        timestamp: new Date().toISOString()
      }
    ]
  };
  
  fs.writeFileSync(publishedPath, JSON.stringify(publishedData, null, 2));
  console.log(`   ✓ Saved to: 03-published/${draftFile}`);
  
  // 7. 드래프트 삭제
  fs.unlinkSync(draftPath);
  console.log(`   ✓ Removed from 02-drafted/`);
  
  return {
    title: draft.digest.headline,
    url: `${GHOST_URL}/${publishedPost.slug}/`
  };
}

async function main() {
  const draftedDir = path.join(__dirname, 'pipeline/digest/02-drafted');
  const files = fs.readdirSync(draftedDir).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.log('No drafted files found.');
    return;
  }
  
  console.log(`Found ${files.length} drafted files\n`);
  
  const published = [];
  const failed = [];
  
  for (const file of files) {
    try {
      const result = await publishDigest(file);
      published.push(result);
    } catch (error) {
      console.error(`   ✗ Failed: ${error.message}`);
      failed.push({ file, error: error.message });
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 Publishing Summary\n');
  
  if (published.length > 0) {
    console.log(`✅ Published (${published.length}):`);
    published.forEach(p => {
      console.log(`   • ${p.title}`);
      console.log(`     ${p.url}\n`);
    });
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed (${failed.length}):`);
    failed.forEach(f => {
      console.log(`   • ${f.file}: ${f.error}`);
    });
  }
}

main().catch(console.error);
