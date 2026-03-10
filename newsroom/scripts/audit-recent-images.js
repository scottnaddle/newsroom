#!/usr/bin/env node
/**
 * 최근 발행된 기사들의 이미지 점검
 * 사용법: node audit-recent-images.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';

/**
 * URL이 유효한지 HTTP HEAD 요청으로 확인
 */
function checkImageUrl(url) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) {
      resolve({ url, valid: false, reason: 'invalid_url' });
      return;
    }

    const timeout = setTimeout(() => {
      resolve({ url, valid: false, reason: 'timeout' });
    }, 5000);

    const protocol = url.startsWith('https') ? https : require('http');
    
    const req = protocol.request(url, { method: 'HEAD' }, (res) => {
      clearTimeout(timeout);
      const valid = res.statusCode === 200;
      resolve({
        url,
        valid,
        statusCode: res.statusCode,
        reason: valid ? 'ok' : `http_${res.statusCode}`
      });
    });
    
    req.on('error', (e) => {
      clearTimeout(timeout);
      resolve({ url, valid: false, reason: 'network_error', error: e.message });
    });
    
    req.end();
  });
}

async function auditRecentImages() {
  try {
    console.log('📸 최근 발행된 기사들 이미지 점검 시작\n');

    // 파일 읽기 (최신순)
    const files = fs.readdirSync(PUBLISHED_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 30); // 최근 30개

    console.log(`✅ ${files.length}개 기사 검사\n`);

    const results = [];
    let problemCount = 0;

    for (const filename of files) {
      const filepath = path.join(PUBLISHED_DIR, filename);
      const article = JSON.parse(fs.readFileSync(filepath, 'utf8'));

      const title = article.draft?.headline || '제목없음';
      const featureImage = article.draft?.feature_image || article.publish_result?.feature_image || null;
      const ogImage = article.draft?.og_image || article.publish_result?.og_image || null;

      const result = {
        filename,
        title,
        featureImage: null,
        ogImage: null,
        problems: []
      };

      // Feature Image 검사
      if (!featureImage) {
        result.problems.push('feature_image 없음');
        problemCount++;
      } else {
        const check = await checkImageUrl(featureImage);
        result.featureImage = check;
        if (!check.valid) {
          result.problems.push(`feature_image ${check.reason}`);
          problemCount++;
        }
      }

      // OG Image 검사
      if (!ogImage) {
        result.problems.push('og_image 없음');
        problemCount++;
      } else {
        const check = await checkImageUrl(ogImage);
        result.ogImage = check;
        if (!check.valid) {
          result.problems.push(`og_image ${check.reason}`);
          problemCount++;
        }
      }

      results.push(result);

      // 진행 상황 출력
      if (result.problems.length > 0) {
        console.log(`⚠️  ${title}`);
        result.problems.forEach(p => console.log(`   ❌ ${p}`));
        console.log();
      }
    }

    console.log('\n═'.repeat(100));
    console.log(`\n📊 이미지 점검 결과\n`);
    console.log(`✅ 정상: ${results.length - problemCount.count}개`);
    console.log(`❌ 문제 있음: ${results.filter(r => r.problems.length > 0).length}개\n`);

    // 상세 결과
    const problemArticles = results.filter(r => r.problems.length > 0);
    
    if (problemArticles.length > 0) {
      console.log('📋 문제 있는 기사 목록:\n');
      problemArticles.forEach((article, idx) => {
        console.log(`${idx + 1}. ${article.title}`);
        console.log(`   파일: ${article.filename}`);
        console.log(`   문제:`);
        article.problems.forEach(p => console.log(`     - ${p}`));
        console.log();
      });
    } else {
      console.log('✅ 모든 기사의 이미지가 정상입니다!\n');
    }

    // 결과 저장
    fs.writeFileSync(
      '/root/.openclaw/workspace/newsroom/pipeline/_status/image-audit-recent.json',
      JSON.stringify({
        timestamp: new Date().toISOString(),
        articlesChecked: results.length,
        problemCount: problemArticles.length,
        problemArticles: problemArticles.map(a => ({
          filename: a.filename,
          title: a.title,
          problems: a.problems,
          featureImage: a.featureImage,
          ogImage: a.ogImage
        }))
      }, null, 2)
    );

    console.log('💾 결과 저장: /newsroom/pipeline/_status/image-audit-recent.json');

  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

auditRecentImages().catch(console.error);
