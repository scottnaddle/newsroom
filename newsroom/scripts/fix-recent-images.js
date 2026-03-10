#!/usr/bin/env node
/**
 * 최근 기사들의 깨진/없는 이미지 수정
 * 사용법: node fix-recent-images.js
 */

const fs = require('fs');
const path = require('path');
const { getFeatureImageUrl } = require('/root/.openclaw/workspace/newsroom/scripts/get-feature-image.js');

const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';
const AUDIT_FILE = '/root/.openclaw/workspace/newsroom/pipeline/_status/image-audit-recent.json';
const usedImagesPath = '/root/.openclaw/workspace/newsroom/shared/config/used-images.json';

async function fixRecentImages() {
  try {
    console.log('🔧 최근 기사들 이미지 수정 시작\n');

    // 감사 결과 읽기
    if (!fs.existsSync(AUDIT_FILE)) {
      console.log('❌ 감사 결과 파일이 없습니다. 먼저 audit-recent-images.js를 실행하세요.');
      process.exit(1);
    }

    const audit = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
    const problemArticles = audit.problemArticles;

    console.log(`📋 수정할 기사: ${problemArticles.length}개\n`);

    let fixedCount = 0;
    let errors = [];

    for (const problem of problemArticles) {
      try {
        const filepath = path.join(PUBLISHED_DIR, problem.filename);
        
        if (!fs.existsSync(filepath)) {
          console.log(`⚠️  파일 없음: ${problem.filename}`);
          continue;
        }

        const article = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        
        // 새 이미지 URL 생성
        const newImageUrl = getFeatureImageUrl({
          headline: article.draft?.headline,
          tags: article.draft?.ghost_tags,
          recentIdsFile: usedImagesPath
        });

        if (!newImageUrl) {
          console.log(`❌ ${article.draft?.headline}: 이미지 생성 실패`);
          errors.push({ filename: problem.filename, error: 'image_generation_failed' });
          continue;
        }

        // 수정
        article.draft.feature_image = newImageUrl;
        if (!article.draft.og_image) {
          article.draft.og_image = 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=630&fit=crop&q=85';
        }

        // 저장
        fs.writeFileSync(filepath, JSON.stringify(article, null, 2));
        
        console.log(`✅ ${article.draft?.headline}`);
        console.log(`   이미지: ${newImageUrl.substring(0, 60)}...`);
        fixedCount++;

      } catch (e) {
        console.log(`❌ 오류: ${problem.filename}: ${e.message}`);
        errors.push({ filename: problem.filename, error: e.message });
      }
    }

    console.log('\n═'.repeat(100));
    console.log(`\n✅ 수정 완료`);
    console.log(`   수정된 기사: ${fixedCount}/${problemArticles.length}`);
    
    if (errors.length > 0) {
      console.log(`❌ 오류: ${errors.length}개\n`);
      errors.forEach(e => console.log(`   - ${e.filename}: ${e.error}`));
    }

  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

fixRecentImages().catch(console.error);
