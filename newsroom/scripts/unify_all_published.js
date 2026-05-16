#!/usr/bin/env node
/**
 * Unify ALL published Ghost articles to match the 5/13 Chinese AI article format.
 * 
 * 통일 포맷:
 *   <blockquote>한줄 출처</blockquote>
 *   <p>본문...</p>
 *   <p>원문 보기: <a href="URL">URL</a></p>
 *   <p>본 기사는 AI로 작성되었습니다...</p>
 */

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const ENV_FILE = '/root/.openclaw/workspace/newsroom/.env';
const env = fs.readFileSync(ENV_FILE, 'utf8');
const apiKey = env.match(/GHOST_ADMIN_API_KEY=(.+)/)[1].trim();
const ghostUrl = new URL(env.match(/GHOST_URL=(.+)/)[1].trim());
const [id, secret] = apiKey.split(':');
const jwt = require('jsonwebtoken');
const token = jwt.sign({}, Buffer.from(secret, 'hex'), { keyid: id, algorithm: 'HS256', expiresIn: '5m', audience: '/admin/' });

function ghostReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: ghostUrl.hostname,
      path,
      method,
      headers: { 'Authorization': 'Ghost ' + token, 'Content-Type': 'application/json' }
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve({}); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getAllPosts() {
  let all = [];
  let page = 1;
  while (true) {
    const r = await ghostReq('GET', `/ghost/api/admin/posts/?limit=200&page=${page}&formats=html`);
    const posts = r.posts || [];
    if (!posts.length) break;
    all = all.concat(posts);
    page++;
  }
  return all;
}

function unifyHtml(html) {
  if (!html) return html;
  let h = html;

  // Step 1: Remove ALL inline styles
  h = h.replace(/\s+style="[^"]*"/g, '');
  h = h.replace(/\s+style='[^']*'/g, '');

  // Step 2: Remove h2, h3, hr - convert content to paragraphs
  h = h.replace(/<h[23][^>]*>/g, '');
  h = h.replace(/<\/h[23]>/g, '');
  h = h.replace(/<hr\s*\/?>/g, '');
  h = h.replace(/\n{2,}/g, '\n');

  // Step 3: Consolidate blockquote - remove inner tags, flatten to one line
  h = h.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g, (m, inner) => {
    inner = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return `<blockquote>${inner}</blockquote>`;
  });

  // Step 4: Remove empty paragraphs
  h = h.replace(/<p>\s*<\/p>/g, '');

  // Step 5: Fix "📖 원문 보기: <a href="URL">text</a>" → "원문 보기: <a href="URL">URL</a>"
  h = h.replace(/📖\s*/g, '');
  
  // Fix: 원문 보기: <a href="URL">some text</a> → 원문 보기: <a href="URL">URL</a>
  h = h.replace(/원문\s*보기\s*:?\s*<a\s+href="([^"]+)"[^>]*>[^<]*<\/a>/g, (m, url) => {
    return `원문 보기: <a href="${url}">${url}</a>`;
  });

  // Fix: <p><a href="URL">원문 보기...</a></p> → <p>원문 보기: <a href="URL">URL</a></p>
  h = h.replace(/<p>\s*<a\s+href="([^"]+)"[^>]*>원문\s*보기[^<]*<\/a>\s*<\/p>/g, (m, url) => {
    return `<p>원문 보기: <a href="${url}">${url}</a></p>`;
  });

  // Fix: <p><a href="URL">https://...</a></p> → <p>원문 보기: <a href="URL">URL</a></p>
  h = h.replace(/<p>\s*<a\s+href="([^"]+)"[^>]*>https?:\/\/\.\.\.<\/a>\s*<\/p>/g, (m, url) => {
    return `<p>원문 보기: <a href="${url}">${url}</a></p>`;
  });

  // Step 6: Fix AI notice inside <a> tag
  // Pattern: <a href="URL">본 기사는 AI로 작성...</a>
  // OR: <p><a href="URL">본 기사는 AI로 작성...</a></p>
  h = h.replace(/<a\s+href="([^"]+)"[^>]*>(본\s*기사는\s*AI[^<]*?)<\/a>/g, (m, url, aiText) => {
    // Remove the source-link paragraph that had the same URL
    // The AI text should be its own paragraph
    return `${aiText}`;
  });

  // Step 7: Ensure paragraphs are properly formatted
  // Remove duplicate source links (same URL appearing twice)
  const urls = [...h.matchAll(/<a\s+href="([^"]+)"/g)].map(m => m[1]);
  if (urls.length >= 2) {
    const [firstUrl, secondUrl] = [urls[0], urls[1]];
    if (firstUrl === secondUrl) {
      // Remove the duplicate AI notice paragraph that contains same URL
      h = h.replace(new RegExp(`<p><a\\s+href="${escapeRegex(firstUrl)}"[^>]*>[^<]*</a></p>`, 'g'), '');
      // Remove the stray AI text that was detached
      h = h.replace(/본\s*기사는\s*AI[^<]*/, (match) => {
        return `<p>${match}.</p>`;
      });
    }
  }

  // Step 8: Ensure AI notice is a proper paragraph
  if (h.includes('본 기사는 AI') && !h.includes('<p>본 기사는 AI')) {
    h = h.replace(/본\s*기사는\s*AI[^<]*/g, (match) => {
      return `<p>${match}</p>`;
    });
  }

  // Step 9: Fix broken URLs in display text (https://... pattern)
  h = h.replace(/(https?:\/\/[^"<]+)\.\.\.(<\/a>)/g, '$1$2');
  h = h.replace(/\.\.\.(<\/a>)/g, '$1');
  h = h.replace(/\.\.\./g, '');

  // Step 10: Ensure "원문 보기:" paragraph comes before AI notice
  // If AI notice paragraph comes before source link, swap them
  const sourceMatch = h.match(/<p>원문 보기[^<]*<a[^>]+>[^<]*<\/a><\/p>/);
  const aiMatch = h.match(/<p>본 기사는 AI[^<]*<\/p>/);
  
  if (sourceMatch && aiMatch) {
    const sourceBeforeAi = h.indexOf(sourceMatch[0]) < h.indexOf(aiMatch[0]);
    if (!sourceBeforeAi) {
      // Swap: move source link before AI notice
      h = h.replace(aiMatch[0], '')
           .replace(sourceMatch[0], sourceMatch[0] + '\n' + aiMatch[0]);
    }
  }

  // Step 11: Final cleanup
  h = h.replace(/<p>\s*<\/p>/g, '');
  h = h.replace(/\n{2,}/g, '\n');
  
  // Ensure no empty paragraphs at start/end
  h = h.replace(/^(<p>\s*<\/p>\s*)+/, '');
  h = h.replace(/(<p>\s*<\/p>\s*)+$/, '');
  
  // Ensure AI notice has proper punctuation if missing
  h = h.replace(/(본\s*기사는\s*AI[^.]*?)(\s*<)/g, '$1.$2');
  h = h.replace(/(본\s*기사는\s*AI[^.]*?)$/g, '$1.');

  return h.trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  console.log('📥 Fetching all Ghost posts...');
  const posts = await getAllPosts();
  console.log(`📊 Total posts: ${posts.length}`);
  console.log('');

  let changed = 0, skipped = 0, errors = 0, unchanged = 0;
  const problematic = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const slug = post.slug || '?';
    const html = post.html || '';
    
    if (!html) { skipped++; continue; }

    const newHtml = unifyHtml(html);
    if (newHtml === html) { unchanged++; continue; }

    // Save to Ghost
    const r = await ghostReq('PUT', `/ghost/api/admin/posts/${post.id}/?source=html`, {
      posts: [{ html: newHtml, updated_at: post.updated_at }]
    });

    if (r.posts && r.posts[0]) {
      changed++;
      // Check for remaining issues
      const issues = [];
      if (newHtml.includes('style=')) issues.push('inline-styles');
      if (newHtml.includes('📖')) issues.push('📖');
      if (/<a[^>]*>[^<]*본 기사는 AI/.test(newHtml)) issues.push('AI-in-a');
      if (/https?:\/\/\.\.\./.test(newHtml)) issues.push('...url');
      if (newHtml.includes('https://...')) issues.push('truncated');
      
      if (issues.length) problematic.push({ slug, issues });

      if (changed <= 5 || (i % 20 === 0)) {
        const icon = issues.length ? '⚠️' : '✅';
        console.log(`  ${icon} [${i+1}/${posts.length}] ${slug.substring(0, 40)}`);
        if (issues.length) console.log(`     Issues: ${issues.join(', ')}`);
      }
    } else {
      errors++;
      console.log(`  ❌ [${i+1}/${posts.length}] ${slug.substring(0, 40)} — update failed`);
    }

    if ((i + 1) % 100 === 0) {
      console.log(`\n📊 Progress: ${i+1}/${posts.length} — changed: ${changed}, errors: ${errors}, unchanged: ${unchanged}\n`);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 최종 결과');
  console.log('='.repeat(50));
  console.log(`✅ 변환 완료: ${changed}개`);
  console.log(`⏭️  스킵 (HTML 없음): ${skipped}개`);
  console.log(`🔄 변경 없음: ${unchanged}개`);
  console.log(`❌ 오류: ${errors}개`);

  if (problematic.length) {
    console.log(`\n⚠️ 변환 후에도 문제 있는 기사 (${problematic.length}개):`);
    for (const { slug, issues } of problematic.slice(0, 10)) {
      console.log(`  ${slug.substring(0, 40)}: ${issues.join(', ')}`);
    }
    if (problematic.length > 10) console.log(`  ... and ${problematic.length - 10} more`);
  }

  // Show reference comparison
  const ref = await ghostReq('GET', `/ghost/api/admin/posts/?limit=1&formats=html&filter=slug:junggug-geulrobeol-ai-gyoyug-seobiseu-peulraespom-gaeseol`);
  if (ref.posts && ref.posts[0]) {
    console.log(`\n${'='.repeat(50)}`);
    console.log('📋 5/13 중국 기사 (기준 포맷)');
    console.log('='.repeat(50));
    console.log(ref.posts[0].html.substring(0, 500));
  }

  // Show a sample converted article
  const sample = await ghostReq('GET', `/ghost/api/admin/posts/?limit=1&formats=html&filter=slug:anyanggwaceon-gyosa-neteuweokeu-ai-sueob-hyeogsin-bangan-nonyi`);
  if (sample.posts && sample.posts[0]) {
    console.log(`\n${'='.repeat(50)}`);
    console.log('📋 5/14 안양과천 (변환 후)');
    console.log('='.repeat(50));
    console.log(sample.posts[0].html.substring(0, 500));
  }
}

main().catch(console.error);
