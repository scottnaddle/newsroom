#!/usr/bin/env node
/**
 * === 기존 발행 기사 이미지 일괄 재생성 ===
 * 모든 뉴스룸 기사의 feature_image를 AI 생성 이미지로 교체
 * (국가/지역 컨텍스트 반영, FLUX.1-schnell)
 * 
 * Usage: node retroactive-images.js [--limit N] [--manga-only]
 */

const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const { generateImageForArticle } = require('/root/newsroom-analysis/newsroom/scripts/generate-article-image.js');
const IMAGE_GEN_PATH = '/root/newsroom-analysis/newsroom/scripts/generate-article-image.js';

// JWT 생성
function getJWT() {
  const env = fs.readFileSync('/root/.openclaw/workspace/newsroom/.env', 'utf8');
  const match = env.match(/GHOST_ADMIN_API_KEY=(\S+)/);
  const [id, secret] = match[1].trim().split(':');
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:id})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:n,exp:n+300,aud:'/admin/'})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
}

function ghostAPI(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const token = getJWT();
    const opts = {
      hostname: 'newsroom.ubion.global',
      path: '/ghost/api/admin/' + endpoint,
      method,
      headers: {
        'Authorization': 'Ghost ' + token,
        'Content-Type': 'application/json'
      }
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error(`Parse error: ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function updateFeatureImage(postId, featureImageUrl) {
  // Ghost PUT requires updated_at from the original post (optimistic locking)
  const post = await ghostAPI(`posts/${postId}/?fields=id,updated_at`);
  if (post.errors) throw new Error(`Get post failed: ${post.errors[0].message}`);
  const updatedAt = post.posts[0].updated_at;

  const result = await ghostAPI(`posts/${postId}/`, 'PUT', {
    posts: [{ 
      id: postId, 
      feature_image: featureImageUrl,
      updated_at: updatedAt
    }]
  });
  if (result.errors) {
    throw new Error(`Update failed: ${result.errors[0].message}`);
  }
  return result.posts && result.posts[0];
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) || 5 : 999;
  const mangaOnly = args.includes('--manga-only');

  console.log('=== 🖼️ 기존 기사 이미지 일괄 재생성 ===');
  console.log(`Limit: ${limit === 999 ? 'all' : limit} articles`);
  if (mangaOnly) console.log('Mode: manga/webtoon only');

  // 0. Warm-up: generate a small test image to load FLUX model into VRAM
  console.log('\n🔥 Warming up ComfyUI (loading FLUX model)...');
  try {
    const warmUpResult = await generateImageForArticle({
      headline: "Warmup - loading FLUX model",
      bodyHtml: "A simple test image to load the FLUX model into VRAM cache",
      tags: [],
      mode: 'news'
    });
    console.log(`   ✅ Model loaded (${warmUpResult.url.substring(0, 40)}...)\n`);
  } catch (err) {
    console.log(`   ⚠️ Warm-up may have failed: ${err.message}\n`);
  }

  // 1. Fetch all published articles
  console.log('\n📡 Fetching articles from Ghost...');
  const data = await ghostAPI('posts/?limit=100&order=published_at%20desc&formats=html,plaintext');
  const allPosts = data.posts || [];
  console.log(`   Found ${allPosts.length} articles`);

  // Filter: skip test articles, skip webtoon if not manga mode
  let posts = allPosts.filter(p => {
    if (p.slug === 'html' || p.slug.includes('test')) return false;
    if (mangaOnly) return p.slug.includes('webtoon') || p.slug.includes('manga');
    return true;
  });

  // Take limit
  if (posts.length > limit) posts = posts.slice(0, limit);
  console.log(`   Processing ${posts.length} articles\n`);

  let success = 0, failed = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const tags = (post.tags || []).map(t => t.name);
    const isManga = post.slug.includes('webtoon') || tags.some(t => t.includes('웹툰') || t.includes('manga'));
    const mode = isManga ? 'manga' : 'news';

    console.log(`[${i + 1}/${posts.length}] 🔄 ${post.title}`);
    console.log(`   Slug: ${post.slug} | Mode: ${mode} | Tags: ${tags.slice(0, 3).join(', ')}`);

    try {
      const bodyText = post.plaintext || post.html || '';
      const result = await generateImageForArticle({
        headline: post.title,
        bodyHtml: bodyText,
        tags: tags,
        mode: mode
      });

      // Update Ghost post with new feature image
      const updated = await updateFeatureImage(post.id, result.url);

      if (updated) {
        console.log(`   ✅ Updated → ${result.url.substring(0, 50)}... (${result.context.country})`);
        console.log(`   🔗 https://newsroom.ubion.global/${post.slug}/\n`);
        success++;
      } else {
        console.log(`   ⚠️ Update returned no post\n`);
        failed++;
      }
    } catch (err) {
      console.error(`   ❌ ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\n=== 📊 결과 ===`);
  console.log(`✅ 성공: ${success}개`);
  console.log(`❌ 실패: ${failed}개`);
  console.log(`총 처리: ${posts.length}개`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
