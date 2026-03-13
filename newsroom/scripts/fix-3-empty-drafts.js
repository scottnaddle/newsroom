#!/usr/bin/env node
/**
 * fix-3-empty-drafts.js
 * 
 * draft_002, 003, 004의 3개 기사를 draft로 옮기고
 * 로컬 내용으로 업데이트
 * 
 * 3개만 직접 처리하는 간단한 스크립트
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const CONFIG_FILE = '/root/.openclaw/workspace/newsroom/shared/config/ghost.json';
const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';

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

// ─── Ghost API 호출 (PUT) ──────────────────────────────────────
function updateGhostPost(postId, postData) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${GHOST_URL}/ghost/api/v3/admin/posts/${postId}`);
    
    const payload = JSON.stringify(postData);
    
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'PUT',
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
  console.log('🔧 오늘 올라온 3개 에듀테크(AI) 기사 → Draft + 내용 업데이트\n');

  const articles = [
    { file: 'draft_002.json', ghostId: '69af6192ff4fbf0001ab7d4c' },
    { file: 'draft_003.json', ghostId: '69af6193ff4fbf0001ab7d56' },
    { file: 'draft_004.json', ghostId: '69af6193ff4fbf0001ab7d60' }
  ];

  let success = 0, failed = 0;

  for (const article of articles) {
    try {
      const filePath = path.join(PUBLISHED_DIR, article.file);
      const art = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      console.log(`📝 ${article.file}`);
      console.log(`   제목: ${art.draft.headline}`);
      
      if (!art.draft?.html) {
        console.log(`   ❌ HTML 없음\n`);
        failed++;
        continue;
      }

      // Ghost 업데이트
      const postData = {
        posts: [{
          id: article.ghostId,
          html: art.draft.html,
          status: 'draft'
        }]
      };

      const result = await updateGhostPost(article.ghostId, postData);
      
      if (result.status === 200) {
        console.log(`   ✅ draft로 변경 + HTML 업데이트`);
        success++;
      } else {
        console.log(`   ⚠️  상태: ${result.status}`);
        if (result.data?.errors) {
          console.log(`   오류: ${result.data.errors[0]?.message}`);
        }
        failed++;
      }
      
      console.log('');
      
      // 딜레이
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (err) {
      console.error(`   ❌ ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\n═════════════════════════════════════`);
  console.log(`✅ 성공: ${success}/3`);
  console.log(`❌ 실패: ${failed}/3`);
  console.log(`\n🔗 Ghost에서 확인: https://ubion.ghost.io/ghost/#/editor/post/`);
}

main().catch(err => {
  console.error(`❌ 오류: ${err.message}`);
  process.exit(1);
});
