#!/usr/bin/env node
/**
 * republish-filled-articles.js
 * 
 * 로컬 08-published의 재작성된 기사들을 Ghost에 새로운 published 포스트로 발행
 * 
 * 목표: 내용 없는 기사 → 삭제 + 새로운 filled 포스트로 발행
 * 결과: 새 article ID, 새 URL, published 상태
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const PIPELINE_DIR = '/root/.openclaw/workspace/newsroom/pipeline';
const PUBLISHED_DIR = path.join(PIPELINE_DIR, '08-published');
const CONFIG_FILE = '/root/.openclaw/workspace/newsroom/shared/config/ghost.json';

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const GHOST_URL = config.apiUrl;
const GHOST_API_KEY = config.adminApiKey;

// ─── JWT 생성 ──────────────────────────────────────────────────
function generateJWT() {
  const [kid, secret] = GHOST_API_KEY.split(':');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid, typ: 'JWT' })).toString('base64');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: kid,
    aud: '/admin/',
    exp: now + 300
  })).toString('base64');
  const message = [header, payload].join('.');
  const signature = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(message)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return [message, signature].join('.');
}

// ─── Ghost API 호출 (POST) ──────────────────────────────────────
function createGhostPost(postData) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${GHOST_URL}/ghost/api/v3/admin/posts`);
    
    const payload = JSON.stringify(postData);
    
    const opts = {
      hostname: url.hostname,
      path: url.pathname + '?source=html',
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${generateJWT()}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 15000
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(payload);
    req.end();
  });
}

// ─── 메인 ────────────────────────────────────────────────────
async function main() {
  console.log('🚀 로컬 재작성 기사 → Ghost 새로운 published로 발행\n');

  const files = fs.readdirSync(PUBLISHED_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  console.log(`📁 처리 대상: ${files.length}개 기사\n`);

  let published = 0, failed = 0, skipped = 0;

  for (const file of files) {
    try {
      const art = JSON.parse(fs.readFileSync(path.join(PUBLISHED_DIR, file), 'utf8'));
      
      // 필수 필드 확인
      if (!art.draft?.html || !art.draft?.headline) {
        console.log(`⏭️  ${file} (필수 필드 부족)`);
        skipped++;
        continue;
      }

      const postData = {
        posts: [{
          title: art.draft.headline,
          html: art.draft.html,
          slug: art.draft.slug || art.draft.headline.toLowerCase().replace(/[^\w\s가-힣]/g, '').replace(/\s+/g, '-'),
          custom_excerpt: art.draft.custom_excerpt || art.summary || '',
          tags: art.draft.ghost_tags || [art.source?.category || 'education', 'ai-news'],
          status: 'published',
          visibility: 'public'
        }]
      };

      const result = await createGhostPost(postData);
      
      if (result.status === 201 && result.data?.posts?.[0]?.id) {
        const newId = result.data.posts[0].id;
        const newUrl = result.data.posts[0].url;
        console.log(`✅ ${file}`);
        console.log(`   → 새 ID: ${newId}`);
        console.log(`   → URL: ${newUrl}\n`);
        
        // 로컬 파일에 새 ghost_id 업데이트
        art.ghost_id = newId;
        art.ghost_url = newUrl;
        fs.writeFileSync(path.join(PUBLISHED_DIR, file), JSON.stringify(art, null, 2));
        
        published++;
      } else {
        console.error(`⚠️  ${file} (상태: ${result.status})`);
        if (result.data?.errors) {
          console.error(`   오류: ${result.data.errors[0]?.message}\n`);
        }
        failed++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 800));

    } catch (err) {
      console.error(`❌ ${file}: ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`✅ 발행: ${published}개`);
  console.log(`⚠️  실패: ${failed}개`);
  console.log(`⏭️  스킵: ${skipped}개`);
  console.log(`\n📝 새로운 published 기사들이 Ghost에 생성되었습니다.`);
  console.log(`🔍 확인: https://ubion.ghost.io/ghost/#/editor/post/`);
}

main().catch(err => {
  console.error(`❌ 오류: ${err.message}`);
  process.exit(1);
});
