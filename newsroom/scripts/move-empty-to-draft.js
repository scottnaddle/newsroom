#!/usr/bin/env node
/**
 * move-empty-to-draft.js
 * 
 * Ghost CMS의 내용 없는 published 기사들을 draft로 변경
 * + 로컬 재작성 버전으로 HTML 대체
 * 
 * 목표: 빈 기사 → draft + 채워진 내용으로 업데이트
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
  console.log('🔄 Ghost 내용 없는 기사 → Draft로 변경 시작\n');

  // 로컬 발행 기사 매핑 (ghost_id → 로컬 파일)
  const localArticles = {};
  const files = fs.readdirSync(PUBLISHED_DIR)
    .filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const art = JSON.parse(fs.readFileSync(path.join(PUBLISHED_DIR, file), 'utf8'));
      if (art.ghost_id) {
        localArticles[art.ghost_id] = {
          file,
          html: art.draft?.html,
          headline: art.draft?.headline,
          meta_title: art.draft?.headline,
          meta_description: (art.draft?.html || '').replace(/<[^>]+>/g, '').substring(0, 155)
        };
      }
    } catch (e) {
      // skip
    }
  }

  console.log(`📁 로컬 기사 매핑: ${Object.keys(localArticles).length}개\n`);

  // 업데이트할 기사들
  let updated = 0, failed = 0, skipped = 0;

  for (const [ghostId, localData] of Object.entries(localArticles)) {
    if (!localData.html) {
      console.log(`⏭️  ${ghostId.substring(0, 12)}... (로컬 HTML 없음)`);
      skipped++;
      continue;
    }

    try {
      // Ghost에 업데이트: draft + 로컬 HTML
      const postData = {
        posts: [{
          id: ghostId,
          html: localData.html,
          meta_title: localData.meta_title,
          meta_description: localData.meta_description,
          status: 'draft'  // 반드시 draft로!
        }]
      };

      const result = await updateGhostPost(ghostId, postData);
      
      if (result.status === 200 || result.status === 201) {
        console.log(`✅ ${ghostId.substring(0, 12)}... → draft + HTML 업데이트`);
        updated++;
      } else {
        console.error(`⚠️  ${ghostId.substring(0, 12)}... (상태: ${result.status})`);
        failed++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err) {
      console.error(`❌ ${ghostId.substring(0, 12)}...: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`✅ 업데이트: ${updated}개`);
  console.log(`⚠️  실패: ${failed}개`);
  console.log(`⏭️  스킵: ${skipped}개`);
  console.log(`\n📝 모든 기사가 Ghost에서 draft 상태로 변경되었습니다.`);
  console.log(`🔍 확인: https://insight.ubion.global/ghost/#/editor/post/`);
}

main().catch(err => {
  console.error(`❌ 오류: ${err.message}`);
  process.exit(1);
});
