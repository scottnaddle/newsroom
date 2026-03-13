#!/usr/bin/env node
/**
 * validate-and-fix-image-urls.js
 * 
 * 모든 파이프라인 단계의 기사에서 404 이미지 URL을 찾아 유효한 URL로 교체
 * 
 * 사용법:
 *   node scripts/validate-and-fix-image-urls.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { getFeatureImageUrl } = require('./get-feature-image.js');

const PIPELINE_DIR = '/root/.openclaw/workspace/newsroom/pipeline';
const MEMORY_DIR = path.join(PIPELINE_DIR, 'memory');
const USED_IMAGES_FILE = path.join(MEMORY_DIR, 'used-images.json');

const DIRS = {
  sourced: path.join(PIPELINE_DIR, '01-sourced'),
  reported: path.join(PIPELINE_DIR, '03-reported'),
  drafted: path.join(PIPELINE_DIR, '04-drafted'),
  factChecked: path.join(PIPELINE_DIR, '05-fact-checked'),
  deskApproved: path.join(PIPELINE_DIR, '06-desk-approved'),
  copyEdited: path.join(PIPELINE_DIR, '07-copy-edited'),
  published: path.join(PIPELINE_DIR, '08-published'),
};

// ─── URL 유효성 검증 ───────────────────────────────────────────────
function checkImageUrl(url) {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string') {
      resolve(false);
      return;
    }
    
    try {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000
      };
      const req = https.request(options, (res) => {
        const isValid = res.statusCode >= 200 && res.statusCode < 400;
        resolve(isValid);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

// ─── 기사 처리 ─────────────────────────────────────────────────────
async function processArticle(filePath) {
  const fileName = path.basename(filePath);
  
  try {
    const article = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let fixed = false;
    
    // draft 객체 확인
    if (!article.draft) {
      return { status: 'no_draft', fileName };
    }
    
    const draft = article.draft;
    const headline = draft.headline || article.source?.title || 'AI 교육 뉴스';
    const tags = draft.ghost_tags || article.tags || [];
    
    // feature_image 검증 및 수정
    if (draft.feature_image) {
      const isValid = await checkImageUrl(draft.feature_image);
      if (!isValid) {
        console.log(`⚠️  [${fileName}] feature_image 404 감지: ${draft.feature_image}`);
        const newImage = getFeatureImageUrl({
          headline,
          tags,
          recentIdsFile: USED_IMAGES_FILE
        });
        draft.feature_image = newImage;
        fixed = true;
        console.log(`   ✅ 교체: ${newImage}`);
      }
    }
    
    // og_image 검증 및 수정
    if (draft.og_image) {
      const isValid = await checkImageUrl(draft.og_image);
      if (!isValid) {
        console.log(`⚠️  [${fileName}] og_image 404 감지: ${draft.og_image}`);
        const newImage = getFeatureImageUrl({
          headline,
          tags,
          recentIdsFile: USED_IMAGES_FILE
        });
        draft.og_image = newImage;
        fixed = true;
        console.log(`   ✅ 교체: ${newImage}`);
      }
    }
    
    // 이미지가 없으면 자동 생성
    if (!draft.feature_image || !draft.og_image) {
      const newImage = getFeatureImageUrl({
        headline,
        tags,
        recentIdsFile: USED_IMAGES_FILE
      });
      
      if (!draft.feature_image) {
        draft.feature_image = newImage;
        fixed = true;
        console.log(`📌 [${fileName}] feature_image 없음 → 생성: ${newImage}`);
      }
      
      if (!draft.og_image) {
        draft.og_image = newImage;
        fixed = true;
        console.log(`📌 [${fileName}] og_image 없음 → 생성: ${newImage}`);
      }
    }
    
    // 수정 사항 저장
    if (fixed) {
      fs.writeFileSync(filePath, JSON.stringify(article, null, 2));
      return { status: 'fixed', fileName, count: 1 };
    }
    
    return { status: 'ok', fileName };
    
  } catch (e) {
    console.error(`❌ [${fileName}] 오류: ${e.message}`);
    return { status: 'error', fileName, error: e.message };
  }
}

// ─── 모든 단계 처리 ───────────────────────────────────────────────
async function main() {
  console.log('[validate-and-fix-image-urls] 시작: 404 이미지 URL 검증 및 수정\n');
  
  const results = {
    fixed: 0,
    ok: 0,
    no_draft: 0,
    error: 0
  };
  
  for (const [stage, dir] of Object.entries(DIRS)) {
    if (!fs.existsSync(dir)) continue;
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    if (files.length === 0) continue;
    
    console.log(`\n📂 ${stage}/ (${files.length}개 파일)`);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const result = await processArticle(filePath);
      
      if (result.status === 'fixed') {
        results.fixed += result.count;
        console.log(`   ✅ 수정됨`);
      } else if (result.status === 'ok') {
        results.ok++;
      } else if (result.status === 'no_draft') {
        results.no_draft++;
      } else {
        results.error++;
      }
      
      // Rate limiting (Unsplash 요청 제한 회피)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`\n[validate-and-fix-image-urls] 완료`);
  console.log(`  ✅ 수정됨: ${results.fixed}개`);
  console.log(`  ✓ 정상: ${results.ok}개`);
  console.log(`  ⊘ draft 없음: ${results.no_draft}개`);
  console.log(`  ❌ 오류: ${results.error}개`);
}

main().catch(e => {
  console.error(`[validate-and-fix-image-urls] 치명적 오류: ${e.message}`);
  process.exit(1);
});
