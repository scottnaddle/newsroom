#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// 설정
const GHOST_API = 'https://insight.ubion.global/ghost/api/admin/';
const AI_DIGEST_TAG_ID = '69a78cc8659ea80001153beb';
const RECENT_IMAGES_FILE = '/root/.openclaw/workspace/newsroom/shared/config/used-images.json';

// JWT 토큰 생성
function generateJWT() {
  const apiKey = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
  const [kid, secret] = apiKey.split(':');
  
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const signature = crypto.createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(header + '.' + payload)
    .digest('base64url');
  
  return `${header}.${payload}.${signature}`;
}

// 피쳐 이미지 URL 생성
function getFeatureImageUrl(headline, tags) {
  const { getFeatureImageUrl } = require('/root/.openclaw/workspace/newsroom/scripts/get-feature-image.js');
  return getFeatureImageUrl({
    headline,
    tags,
    recentIdsFile: RECENT_IMAGES_FILE
  });
}

// Ghost API 호출 (curl 사용 - 리다이렉트 자동 처리)
function ghostRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    const token = generateJWT();
    const postData = JSON.stringify(data);
    const { execSync } = require('child_process');
    
    const url = `${GHOST_API}${endpoint}`;
    
    // JSON을 파일로 저장해서 curl 사용
    const tmpFile = `/tmp/ghost-post-${Date.now()}.json`;
    fs.writeFileSync(tmpFile, postData);
    
    try {
      const cmd = `curl -s -L -X POST "${url}" \
        -H "Authorization: Ghost ${token}" \
        -H "Content-Type: application/json" \
        -d @${tmpFile}`;
      
      const output = execSync(cmd, { encoding: 'utf8' });
      const json = JSON.parse(output);
      
      if (json.errors) {
        reject(new Error(`Ghost API error: ${JSON.stringify(json)}`));
      } else {
        resolve(json);
      }
    } catch (error) {
      reject(error);
    } finally {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
  });
}

// 다이제스트 발행
async function publishDigest(digestFile) {
  const draftedDir = '/root/.openclaw/workspace/newsroom/pipeline/digest/02-drafted';
  const publishedDir = '/root/.openclaw/workspace/newsroom/pipeline/digest/03-published';
  
  const filePath = path.join(draftedDir, digestFile);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  console.log(`\n📤 발행 시작: ${data.digest.headline}`);
  
  // 피쳐 이미지 선택
  const featureImage = getFeatureImageUrl(data.digest.headline, data.digest.ghost_tags);
  console.log(`🖼️  피쳐 이미지: ${featureImage}`);
  
  // 태그 배열 생성
  const tags = [{ id: AI_DIGEST_TAG_ID }];
  data.digest.ghost_tags.forEach(tag => {
    if (tag !== 'ai-digest') {
      tags.push({ name: tag });
    }
  });
  
  // Ghost 포스트 생성
  const postData = {
    posts: [{
      title: data.digest.headline,
      html: data.digest.html,
      status: 'published',
      featured: false,
      tags: tags,
      meta_title: data.digest.meta_title,
      meta_description: data.digest.meta_description,
      feature_image: featureImage,
      codeinjection_foot: ''
    }]
  };
  
  try {
    const result = await ghostRequest('posts/?source=html', postData);
    const post = result.posts[0];
    
    console.log(`✅ 발행 성공!`);
    console.log(`   ID: ${post.id}`);
    console.log(`   URL: https://insight.ubion.global/${post.slug}/`);
    
    // 결과 저장
    const publishedData = {
      ...data,
      stage: 'published',
      publish_result: {
        ghost_post_id: post.id,
        ghost_url: `https://insight.ubion.global/ghost/#/editor/post/${post.id}`,
        public_url: `https://insight.ubion.global/${post.slug}/`,
        status: 'published',
        published_at: new Date().toISOString()
      },
      audit_log: [
        ...data.audit_log,
        { agent: 'digest-publisher', action: 'published', timestamp: new Date().toISOString() }
      ]
    };
    
    // 03-published에 저장
    const publishedPath = path.join(publishedDir, digestFile);
    fs.writeFileSync(publishedPath, JSON.stringify(publishedData, null, 2));
    console.log(`💾 결과 저장: ${publishedPath}`);
    
    // 02-drafted에서 삭제
    fs.unlinkSync(filePath);
    console.log(`🗑️  임시 파일 삭제: ${filePath}`);
    
    return {
      title: data.digest.headline,
      url: `https://insight.ubion.global/${post.slug}/`
    };
    
  } catch (error) {
    console.error(`❌ 발행 실패: ${error.message}`);
    throw error;
  }
}

// 메인
async function main() {
  const draftedDir = '/root/.openclaw/workspace/newsroom/pipeline/digest/02-drafted';
  const files = fs.readdirSync(draftedDir).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.log('📭 발행할 다이제스트가 없습니다.');
    return;
  }
  
  console.log(`📋 ${files.length}개 다이제스트 발행 시작...\n`);
  
  const results = [];
  for (const file of files) {
    try {
      const result = await publishDigest(file);
      results.push(result);
    } catch (error) {
      console.error(`❌ ${file} 발행 실패: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 발행 완료 요약');
  console.log('='.repeat(60));
  results.forEach((r, i) => {
    console.log(`\n${i + 1}. ${r.title}`);
    console.log(`   ${r.url}`);
  });
}

main().catch(console.error);
