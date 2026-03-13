#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// 경로
const rejectedDir = '/root/.openclaw/workspace/newsroom/pipeline/rejected/';
const outputDir = '/root/.openclaw/workspace/newsroom/pipeline/08-published/';
const configPath = '/root/.openclaw/workspace/newsroom/shared/config/ghost.json';

// Ghost 설정 로드
let ghostConfig;
try {
  ghostConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error('❌ Ghost 설정 파일 읽기 실패:', e.message);
  process.exit(1);
}

const [apiId, apiSecret] = ghostConfig.adminApiKey.split(':');

// JWT 토큰 생성
function generateJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: apiId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const message = header + '.' + payload;
  const sig = crypto
    .createHmac('sha256', Buffer.from(apiSecret, 'hex'))
    .update(message)
    .digest('base64url');
  return message + '.' + sig;
}

// Ghost에 발행
async function publishToGhost(article, filename) {
  const jwt = generateJWT();
  
  // 슬러그 생성
  const slug = filename
    .replace(/\.json$/, '')
    .replace(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}_/, '')
    .substring(0, 100);
  
  const tags = [
    { id: '69a7a9ed659ea80001153c13' }, // ai-edu 태그
    ...(article.draft.ghost_tags || []).map(tag => ({ name: tag }))
  ];
  
  const payload = {
    posts: [{
      title: article.draft.headline,
      html: article.draft.html,
      status: 'published',
      tags: tags,
      meta_title: article.draft.headline,
      meta_description: article.draft.subheadline,
      custom_excerpt: article.draft.subheadline,
      slug: slug,
      feature_image: article.draft.feature_image || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=500&fit=crop',
    }]
  };
  
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'ubion.ghost.io',
      path: '/ghost/api/admin/posts/?source=html',
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${jwt}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 10000
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.errors) {
            reject(new Error(`Ghost API: ${response.errors.map(e => e.message).join(', ')}`));
          } else if (response.posts && response.posts[0]) {
            resolve(response.posts[0]);
          } else {
            reject(new Error('Ghost returned no post data'));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(body);
    req.end();
  });
}

// 메인 실행
async function main() {
  console.log('🚀 거부된 기사 재발행 시작...\n');
  
  if (!fs.existsSync(rejectedDir)) {
    console.log('⚠️  rejected 디렉토리 없음');
    process.exit(0);
  }
  
  // PASS/PASS 기사들만 찾기
  const files = fs.readdirSync(rejectedDir)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  if (files.length === 0) {
    console.log('ℹ️  처리할 파일 없음');
    process.exit(0);
  }
  
  console.log(`📦 거부된 기사: ${files.length}개\n`);
  
  let successCount = 0;
  let skipCount = 0;
  const results = [];
  
  for (const filename of files) {
    try {
      const filepath = path.join(rejectedDir, filename);
      const article = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      
      // PASS/PASS 기사만 처리
      if (article.desk_decision?.verdict !== 'PASS' || article.copy_edit?.verdict !== 'PASS') {
        console.log(`⏭️  스킵: ${filename} (verdict: ${article.desk_decision?.verdict || 'N/A'}/${article.copy_edit?.verdict || 'N/A'})`);
        skipCount++;
        continue;
      }
      
      console.log(`📤 발행 중: ${filename}...`);
      const ghostPost = await publishToGhost(article, filename);
      
      // 결과 저장
      const publishedArticle = {
        ...article,
        stage: 'published',
        publish_result: {
          ghost_post_id: ghostPost.id,
          ghost_url: ghostPost.url,
          status: 'published',
          republished_at: new Date().toISOString(),
          from_rejected: true
        }
      };
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, filename);
      fs.writeFileSync(outputPath, JSON.stringify(publishedArticle, null, 2));
      
      // rejected에서 삭제
      fs.unlinkSync(filepath);
      
      console.log(`✅ 성공: ${ghostPost.title} (ID: ${ghostPost.id})`);
      successCount++;
      results.push({ filename, success: true, title: ghostPost.title });
      
      // API 호출 간격 (rate limit 회피)
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ 실패: ${filename}`);
      console.error(`   에러: ${error.message}\n`);
      results.push({ filename, success: false, error: error.message });
    }
  }
  
  // 결과 보고
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 재발행 완료:`);
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`⏭️  스킵: ${skipCount}개`);
  console.log(`❌ 실패: ${results.filter(r => !r.success).length}개`);
  console.log(`${'='.repeat(60)}`);
  
  if (successCount > 0) {
    console.log('\n✨ 성공한 기사:');
    results.filter(r => r.success).forEach(r => {
      console.log(`  → ${r.filename}`);
    });
  }
  
  if (results.filter(r => !r.success).length > 0) {
    console.log('\n⚠️  실패한 기사:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  → ${r.filename}: ${r.error}`);
    });
  }
}

main().catch(console.error);
