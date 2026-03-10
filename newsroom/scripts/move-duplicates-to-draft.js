#!/usr/bin/env node
/**
 * 중복 기사를 Draft로 옮기기
 * 사용법: node move-duplicates-to-draft.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const ANALYSIS_FILE = '/root/.openclaw/workspace/newsroom/pipeline/_status/duplicate-analysis.json';
const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
const DRAFT_DIR = '/root/.openclaw/workspace/newsroom/pipeline/04-drafted';

const GHOST_CONFIG = {
  host: 'insight.ubion.global',
  key: '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625',
  version: 'v5.0'
};

/**
 * Ghost JWT 생성
 */
function createGhostJWT() {
  const [id, secret] = GHOST_CONFIG.key.split(':');
  
  const header = Buffer.from(JSON.stringify({
    alg: 'HS256',
    kid: id,
    typ: 'JWT'
  })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: '/admin/'
  })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  const signature = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${header}.${payload}.${signature}`;
}

/**
 * Ghost API 요청
 */
function ghostRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const jwt = createGhostJWT();
    
    const options = {
      hostname: GHOST_CONFIG.host,
      path: `/ghost/api/${GHOST_CONFIG.version}${path}`,
      method,
      headers: {
        'Authorization': `Ghost ${jwt}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Ghost API Error (${res.statusCode}): ${body}`));
        } else {
          resolve(JSON.parse(body || '{}'));
        }
      });
    });
    
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * 중복 기사를 Draft로 옮기기
 */
async function moveDuplicates() {
  try {
    console.log('📖 분석 결과 로드 중...\n');
    
    if (!fs.existsSync(ANALYSIS_FILE)) {
      console.log('❌ 분석 파일이 없습니다. 먼저 find-duplicates-local.js를 실행하세요.');
      process.exit(1);
    }
    
    const analysis = JSON.parse(fs.readFileSync(ANALYSIS_FILE, 'utf8'));
    
    console.log(`✅ 분석 완료: ${analysis.articlesToMove}개 기사를 Draft로 옮길 예정\n`);
    
    let moveCount = 0;
    let ghostUpdateCount = 0;
    let errorCount = 0;
    
    // 각 그룹별로 처리
    for (const group of analysis.groups) {
      console.log(`\n📌 그룹 ${group.groupId}:`);
      console.log(`   유지: ${group.keep.headline}`);
      console.log(`   이동 대상: ${group.moveToDraft.length}개\n`);
      
      // Draft로 옮길 기사들
      for (const article of group.moveToDraft) {
        try {
          const sourceFile = path.join(PUBLISHED_DIR, article.filename);
          
          if (!fs.existsSync(sourceFile)) {
            console.log(`   ⚠️ 파일 없음: ${article.filename}`);
            continue;
          }
          
          // 1. Ghost에서 unpublish (만약 존재한다면)
          if (article.id && article.id !== 'undefined') {
            try {
              // Ghost post를 draft로 변경
              const updateData = {
                posts: [{
                  status: 'draft'
                }]
              };
              
              await ghostRequest('PUT', `/posts/${article.id}`, updateData);
              console.log(`   ✅ Ghost unpublish: ${article.headline}`);
              ghostUpdateCount++;
            } catch (e) {
              // Ghost에 없을 수 있으므로 무시
              console.log(`   ℹ️  Ghost 업데이트 생략: ${article.headline}`);
            }
          }
          
          // 2. 로컬 파이프라인에서 04-drafted로 이동
          const destFile = path.join(DRAFT_DIR, article.filename);
          
          fs.copyFileSync(sourceFile, destFile);
          fs.unlinkSync(sourceFile);
          
          console.log(`   ✓ 이동 완료: ${article.filename}`);
          moveCount++;
          
        } catch (error) {
          console.error(`   ❌ 오류 (${article.filename}):`, error.message);
          errorCount++;
        }
      }
    }
    
    console.log('\n═'.repeat(100));
    console.log(`\n✅ 작업 완료!\n`);
    console.log(`📊 결과:`);
    console.log(`   - 파일 이동: ${moveCount}개`);
    console.log(`   - Ghost 업데이트: ${ghostUpdateCount}개`);
    console.log(`   - 오류: ${errorCount}개`);
    console.log(`\n📁 변경 사항:`);
    console.log(`   - 08-published에서 ${moveCount}개 파일 제거`);
    console.log(`   - 04-drafted에 ${moveCount}개 파일 추가`);
    console.log(`\n🎯 다음 단계:`);
    console.log(`   1. Draft 파이프라인 확인: /newsroom/pipeline/04-drafted/`);
    console.log(`   2. 필요하면 Editor-Desk에서 재검토 후 재발행`);
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

moveDuplicates().catch(console.error);
