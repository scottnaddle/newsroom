#!/usr/bin/env node
/**
 * fix-published-images.js — 발행된 기사의 이미지 정보 복구
 * 
 * 문제: 이전 발행 기사들에 draft.feature_image, draft.og_image가 저장되지 않음
 * 해결: 카테고리에 맞는 이미지 생성 후 draft 객체에 저장
 * 
 * 사용법:
 *   node fix-published-images.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getFeatureImageUrl, detectCategory } = require('./get-feature-image.js');

const PIPELINE_DIR = '/root/.openclaw/workspace/newsroom/pipeline';
const PUBLISHED_DIR = path.join(PIPELINE_DIR, '08-published');
const MEMORY_DIR = path.join(PIPELINE_DIR, 'memory');
const USED_IMAGES_FILE = path.join(MEMORY_DIR, 'used-images.json');

// ─── 메인 함수 ─────────────────────────────────────────────────────
async function fixPublishedImages() {
  console.log('[fix-published-images] 시작: 발행된 기사의 이미지 복구');
  
  // 08-published 디렉토리 확인
  if (!fs.existsSync(PUBLISHED_DIR)) {
    console.error('[fix-published-images] published 디렉토리 없음');
    process.exit(1);
  }
  
  const files = fs.readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.json'));
  console.log(`[fix-published-images] 처리할 파일: ${files.length}개`);
  
  let fixed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const file of files) {
    const filePath = path.join(PUBLISHED_DIR, file);
    
    try {
      const article = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // 이미 이미지가 있으면 스킵
      if (article.draft?.feature_image && article.draft?.og_image) {
        skipped++;
        continue;
      }
      
      const headline = article.draft?.headline || article.source?.title || 'AI 교육 뉴스';
      const tags = article.draft?.ghost_tags || article.tags || [];
      
      // 이미지 생성
      const featureImage = getFeatureImageUrl({
        headline,
        tags,
        recentIdsFile: USED_IMAGES_FILE
      });
      
      // draft 객체 초기화
      if (!article.draft) {
        article.draft = {};
      }
      
      // 이미지 정보 저장
      article.draft.feature_image = featureImage;
      article.draft.og_image = featureImage;
      article.draft.image_fixed_at = new Date().toISOString();
      article.draft.image_verified = false;  // URL 검증 생략 (이미 발행된 기사)
      
      // 파일 저장
      fs.writeFileSync(filePath, JSON.stringify(article, null, 2));
      
      console.log(`✅ ${file}`);
      console.log(`   제목: ${headline.slice(0, 50)}...`);
      console.log(`   이미지: ${featureImage}`);
      
      fixed++;
      
    } catch (e) {
      console.error(`❌ ${file}: ${e.message}`);
      errors++;
    }
  }
  
  console.log(`\n[fix-published-images] 완료`);
  console.log(`  고정됨: ${fixed}개`);
  console.log(`  스킵됨 (이미 있음): ${skipped}개`);
  console.log(`  오류: ${errors}개`);
  console.log(`  총: ${files.length}개`);
}

// ─── 실행 ─────────────────────────────────────────────────────────
fixPublishedImages().catch(e => {
  console.error(`[fix-published-images] 치명적 오류: ${e.message}`);
  process.exit(1);
});
