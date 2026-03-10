#!/usr/bin/env node
/**
 * sync-published-to-ghost.js
 * 
 * 로컬 08-published 폴더의 재작성된 기사들을 Ghost CMS에 동기화
 * 
 * 목표: 내용 없는 Ghost 기사들을 로컬 재작성 내용으로 업데이트
 * 방법: Ghost API PUT으로 posts 업데이트
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const PIPELINE_DIR = '/root/.openclaw/workspace/newsroom/pipeline';
const PUBLISHED_DIR = path.join(PIPELINE_DIR, '08-published');

const GHOST_URL = 'https://insight.ubion.global';
const GHOST_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

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
  console.log('🔄 Ghost CMS 동기화 시작\n');

  // 로컬 발행 기사 읽기
  const files = fs.readdirSync(PUBLISHED_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  console.log(`📁 처리 대상: ${files.length}개 기사\n`);

  let synced = 0, failed = 0, skipped = 0;

  for (const file of files) {
    const filePath = path.join(PUBLISHED_DIR, file);
    
    try {
      const article = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const ghostId = article.ghost_id;
      
      // ghost_id 없으면 스킵
      if (!ghostId) {
        console.log(`⏭️  ${file} (ghost_id 없음, 스킵)`);
        skipped++;
        continue;
      }

      // Ghost에 업데이트할 데이터
      const postData = {
        posts: [{
          id: ghostId,
          html: article.draft?.html || '',
          status: 'draft'  // 반드시 draft 상태로
        }]
      };

      // Ghost API 호출
      const result = await updateGhostPost(ghostId, postData);
      
      if (result.status === 200 || result.status === 201) {
        console.log(`✅ ${file}`);
        synced++;
      } else {
        console.error(`⚠️  ${file} (상태: ${result.status})`);
        if (result.data?.errors) {
          console.error(`   오류: ${result.data.errors[0]?.message}`);
        }
        failed++;
      }

      // API 요청 간 딜레이 (Rate limiting 방지)
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err) {
      console.error(`❌ ${file}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`✅ 동기화 완료: ${synced}개`);
  console.log(`⚠️  실패: ${failed}개`);
  console.log(`⏭️  스킵: ${skipped}개`);
  console.log(`\n📝 모든 기사가 Ghost에서 draft 상태로 업데이트되었습니다.`);
  console.log(`🔍 확인: https://insight.ubion.global/ghost/#/editor/post/`);
}

main().catch(err => {
  console.error(`❌ 오류: ${err.message}`);
  process.exit(1);
});
