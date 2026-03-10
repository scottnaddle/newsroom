#!/usr/bin/env node
/**
 * Publisher Agent — 2026-03-06 3개 파일만 처리
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PIPELINE_BASE = '/root/.openclaw/workspace/newsroom/pipeline';
const INPUT_DIR = path.join(PIPELINE_BASE, '07-copy-edited');
const OUTPUT_DIR = path.join(PIPELINE_BASE, '08-published');
const REJECTED_DIR = path.join(PIPELINE_BASE, 'rejected');
const CONFIG_FILE = '/root/.openclaw/workspace/newsroom/shared/config/ghost.json';

const { apiUrl, adminApiKey } = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const GHOST_URL = apiUrl;
const API_KEY = adminApiKey;
const ADMIN_API_URL = `${GHOST_URL}/ghost/api/admin`;

// ===== 대상 파일 (크론 요청한 3개)
const TARGET_FILES = [
  '2026-03-06_0437_lg-ai-graduate-school.json',
  '2026-03-06_0437_moe-ai-ethics-guideline.json',
  '2026-03-06_0437_seoul-ai-education-guideline.json'
];

function log(msg, level = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${msg}`);
}

function generateJWT(apiKey) {
  const [id, secret] = apiKey.split(':');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function getSlugFromFilename(filename) {
  const match = filename.match(/^\d{4}-\d{2}-\d{2}_\d{4}_(.+)\.json$/);
  return match ? match[1] : filename.replace('.json', '');
}

function getHigherEdKeywords() {
  return [
    '대학', '대학원', '고등교육', '대입', '학부', '캠퍼스', '교수', '강의',
    'university', 'college', 'higher education', 'undergraduate', 'graduate',
    'campus', 'professor', 'faculty', 'academic'
  ];
}

function isFeaturedArticle(headline, tags = []) {
  const keywords = getHigherEdKeywords();
  const text = `${headline} ${(tags || []).join(' ')}`.toLowerCase();
  return keywords.some(kw => text.includes(kw));
}

function extractImageFromHtml(html) {
  const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i;
  const match = html.match(imgRegex);
  return match ? match[1] : null;
}

async function generateOGCard(headline, category, date) {
  try {
    log(`🎨 OG 카드 생성: "${headline}"`);
    const { generateOGCard } = require('/root/.openclaw/workspace/newsroom/scripts/generate-og-card.js');
    const outputPath = `/tmp/og-card-${Date.now()}.png`;
    const cardUrl = await generateOGCard({ headline, category, outputPath, date });
    if (cardUrl) {
      log(`✅ OG 카드 생성 완료: ${cardUrl}`);
      return cardUrl;
    }
  } catch (err) {
    log(`⚠️  OG 카드 생성 스킵: ${err.message}`);
  }
  return 'https://images.unsplash.com/photo-1516321318423-f06f70674e90?w=1200&h=630&fit=crop&q=85&auto=format';
}

function cleanHTMLContent(html) {
  let cleaned = html.replace(/<div[^>]*>[\s]*<span[^>]*>🤖\s+AI[^<]*<\/span>[\s]*<\/div>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*style="[^"]*display\s*:\s*flex[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  return cleaned;
}

async function publishToGhost(draft, copyEdit, jwt, filename) {
  try {
    log(`🚀 Ghost 발행: "${draft.headline}"`);
    
    // 이미지 처리
    const bodyHtml = copyEdit?.final_html || draft.html;
    const featureImage = extractImageFromHtml(bodyHtml) || 
      'https://images.unsplash.com/photo-1516321318423-f06f70674e90?w=1200&h=630&fit=crop&q=85&auto=format';
    
    const category = draft.ghost_tags?.[0] || 'policy';
    const ogImage = await generateOGCard(draft.headline, category, new Date().toLocaleDateString('ko-KR'));
    
    // HTML 정제
    const cleanedHtml = cleanHTMLContent(bodyHtml);
    
    // Ghost 요청
    const postData = {
      posts: [{
        title: copyEdit?.final_headline || draft.headline,
        html: cleanedHtml,
        status: 'published',
        featured: isFeaturedArticle(draft.headline, draft.ghost_tags),
        tags: [
          { id: '69a7a9ed659ea80001153c13' },
          ...((draft.ghost_tags || []).map(tag => ({ name: tag })))
        ],
        meta_title: copyEdit?.meta_suggestion?.meta_title || draft.headline.substring(0, 70),
        meta_description: copyEdit?.meta_suggestion?.meta_description || draft.subheadline,
        custom_excerpt: draft.subheadline,
        slug: getSlugFromFilename(filename),
        feature_image: featureImage,
        og_image: ogImage,
        twitter_image: ogImage,
        codeinjection_foot: ''
      }]
    };
    
    const response = await fetch(`${ADMIN_API_URL}/posts/?source=html`, {
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ghost API error: ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    const postId = result.posts[0].id;
    const postUrl = `${GHOST_URL}/ghost/#/editor/post/${postId}`;
    
    log(`✅ Ghost PUBLISHED: ${postId}`);
    log(`🔗 ${postUrl}`);
    
    return {
      ghost_post_id: postId,
      ghost_draft_url: postUrl,
      status: 'published',
      published_at: new Date().toISOString(),
      feature_image: featureImage,
      og_image: ogImage
    };
  } catch (err) {
    log(`❌ Ghost 발행 오류: ${err.message}`, 'error');
    throw err;
  }
}

async function processArticle(filename) {
  const inputFile = path.join(INPUT_DIR, filename);
  
  try {
    log(`\n📰 처리: ${filename}`);
    
    const content = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const { draft, copy_edit: copyEdit } = content;
    
    const jwt = generateJWT(API_KEY);
    const publishResult = await publishToGhost(draft, copyEdit || {}, jwt, filename);
    
    // 결과 저장
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    const resultContent = {
      ...content,
      stage: 'published',
      publish_result: publishResult,
      audit_log: [
        ...(content.audit_log || []),
        {
          agent: 'publisher',
          action: 'published',
          timestamp: new Date().toISOString(),
          note: `Ghost published: ${publishResult.ghost_draft_url}`
        }
      ]
    };
    
    const outputFile = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(outputFile, JSON.stringify(resultContent, null, 2), 'utf8');
    
    // 원본 삭제
    fs.unlinkSync(inputFile);
    log(`✅ 완료: "${draft.headline}"`);
    
    return { success: true, headline: draft.headline, postId: publishResult.ghost_post_id };
  } catch (err) {
    log(`❌ 실패: ${err.message}`, 'error');
    
    if (!fs.existsSync(REJECTED_DIR)) {
      fs.mkdirSync(REJECTED_DIR, { recursive: true });
    }
    
    const rejectedFile = path.join(REJECTED_DIR, filename);
    fs.copyFileSync(inputFile, rejectedFile);
    fs.unlinkSync(inputFile);
    
    return { success: false, headline: filename, error: err.message };
  }
}

async function main() {
  log('🚀 Publisher Agent (2026-03-06 크론 작업)');
  
  const results = [];
  for (const file of TARGET_FILES) {
    if (fs.existsSync(path.join(INPUT_DIR, file))) {
      const result = await processArticle(file);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      log(`⚠️  파일 없음: ${file}`);
    }
  }
  
  // 최종 보고
  log(`\n${'='.repeat(60)}`);
  log(`📊 최종 보고`);
  log(`${'='.repeat(60)}`);
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  log(`✅ 성공: ${successful.length}개`);
  successful.forEach(r => log(`  - ${r.headline}`));
  
  if (failed.length > 0) {
    log(`\n❌ 실패: ${failed.length}개`, 'error');
    failed.forEach(r => log(`  - ${r.headline}: ${r.error}`, 'error'));
  }
  
  log(`\n🎉 완료`);
}

main().catch(err => {
  log(`🔥 오류: ${err.message}`, 'error');
  console.error(err);
  process.exit(1);
});
