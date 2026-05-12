#!/usr/bin/env node
/**
 * === gen-article-images.js — 독립형 기사 이미지 생성 CLI (v1) ===
 *
 * 기사 JSON 파일(또는 디렉토리)을 읽어 → buildPrompt() + ComfyUI → Ghost 업로드 → 캐시 저장
 *
 * 사용법:
 *   단일 파일:  node gen-article-images.js --input path/to/article.json
 *   디렉토리:   node gen-article-images.js --dir pipeline/07-copy-edited/
 *   캐시 지정:  node gen-article-images.js --dir . --cache .imgcache/pending.json
 *   강제 재생성: node gen-article-images.js --dir . --force
 *   Ghost 미업로드 (로컬 PNG만): node gen-article-images.js --dir . --local-only
 *
 * 의존성: generate-article-image.js (같은 디렉토리)
 */

const fs = require('fs');
const path = require('path');
const { generateImageForArticle, detectCountryContext, buildPrompt } = require('./generate-article-image.js');

// ─── 설정 ───────────────────────────────

const DEFAULT_WORKSPACE = '/root/.openclaw/workspace/newsroom';
const DEFAULT_CACHE_PATH = '.imgcache/pending.json';
const VALID_STAGES = ['04-drafted', '05-fact-checked', '06-desk-approved', '07-copy-edited', '08-published'];

// ─── 유틸리티 ───────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { input: null, dir: null, cache: null, force: false, localOnly: false, verbose: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':     opts.input = args[++i]; break;
      case '--dir':       opts.dir = args[++i]; break;
      case '--cache':     opts.cache = args[++i]; break;
      case '--force':     opts.force = true; break;
      case '--local-only': opts.localOnly = true; break;
      case '--verbose':   opts.verbose = true; break;
      case '--help':
        console.log(`
Usage: node gen-article-images.js [options]

Options:
  --input <file>      단일 기사 JSON 파일 처리
  --dir <path>       디렉토리 내 모든 기사 JSON 처리
  --cache <path>     캐시 파일 경로 (기본: ${DEFAULT_CACHE_PATH})
  --force            캐시 무시하고 강제 재생성
  --local-only       Ghost 업로드 없이 로컬 PNG만 생성
  --verbose          상세 로그 출력
  --help             도움말 출력
`);
        process.exit(0);
    }
  }

  if (!opts.input && !opts.dir) {
    console.error('❌ --input 또는 --dir 옵션이 필요합니다.');
    process.exit(1);
  }

  return opts;
}

function loadArticle(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const article = JSON.parse(raw);

  // 다양한 JSON 구조 지원
  const draft = article.draft || article;
  const headline = draft.headline || draft.title || article.title || '';
  const bodyHtml = draft.html || draft.body || article.html || article.body || '';
  const tags = draft.ghost_tags || draft.tags || article.ghost_tags || article.tags || [];
  const stage = article.stage || '';

  return { headline, bodyHtml, tags, stage, filePath, article };
}

function loadCache(cachePath) {
  try {
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }
  } catch (e) {
    console.warn(`⚠️  캐시 읽기 실패 (무시하고 진행): ${cachePath}`);
  }
  return {};
}

function saveCache(cachePath, cache) {
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`  📝 캐시 저장: ${cachePath} (${Object.keys(cache).length} entries)`);
}

function log(verbose, ...args) {
  if (verbose) console.log(...args);
}

// ─── 메인 로직 ───────────────────────────────

async function processArticle(filePath, opts, cache) {
  const article = loadArticle(filePath);
  const { headline, bodyHtml, tags, stage } = article;
  const fileName = path.basename(filePath);

  if (!headline) {
    console.log(`  ⏭️  건너뜀 (헤드라인 없음): ${fileName}`);
    return { success: false, reason: 'no-headline' };
  }

  // 캐시 확인
  if (!opts.force && cache[headline]) {
    console.log(`  ✅ 캐시됨: ${headline.substring(0, 40)}...`);
    return { success: true, cached: true, url: cache[headline] };
  }

  console.log(`\n📸 [${fileName}] ${headline.substring(0, 60)}`);
  log(opts.verbose, `     태그: ${tags.join(', ')} | 단계: ${stage}`);

  try {
    // generate-article-image.js의 코어 로직 사용
    const result = await generateImageForArticle({
      headline,
      bodyHtml,
      tags,
      mode: 'news'
    });

    log(opts.verbose, `     국가: ${result.context.country}`);
    log(opts.verbose, `     이미지: ${result.url}`);

    // 캐시 저장
    cache[headline] = result.url;

    return { success: true, url: result.url, headline };

  } catch (err) {
    console.error(`  ❌ 실패: ${err.message}`);
    return { success: false, error: err.message, headline };
  }
}

async function main() {
  const opts = parseArgs();
  const workspace = process.cwd();
  const cachePath = opts.cache
    ? path.resolve(opts.cache)
    : path.join(workspace, DEFAULT_CACHE_PATH);

  console.log(`🍌 gen-article-images.js — BananaX 22-Style Image Generator`);
  console.log(`   작업 디렉토리: ${workspace}`);
  console.log(`   캐시: ${cachePath}`);
  if (opts.force) console.log(`   ⚠️  강제 재생성 모드`);
  if (opts.localOnly) console.log(`   💻 로컬 전용 모드 (Ghost 미업로드)`);

  // 입력 파일 수집
  let files = [];
  if (opts.input) {
    files = [path.resolve(opts.input)];
  } else if (opts.dir) {
    const dir = path.resolve(opts.dir);
    if (!fs.existsSync(dir)) {
      console.error(`❌ 디렉토리가 없습니다: ${dir}`);
      process.exit(1);
    }
    files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .map(f => path.join(dir, f));
  }

  if (files.length === 0) {
    console.log('처리할 기사 파일이 없습니다.');
    return;
  }

  console.log(`\n📂 총 ${files.length}개 기사 발견\n`);

  // 캐시 로드
  const cache = loadCache(cachePath);

  // 순차 처리 (ComfyUI SSH → 동시성 문제 방지)
  let successCount = 0;
  let failCount = 0;
  let cachedCount = 0;

  for (const filePath of files) {
    const result = await processArticle(filePath, opts, cache);
    if (result.success && result.cached) cachedCount++;
    else if (result.success) successCount++;
    else failCount++;
  }

  // 캐시 저장
  saveCache(cachePath, cache);

  // 요약
  console.log(`\n` + '='.repeat(50));
  console.log(`📊 요약`);
  console.log(`   ✅ 생성: ${successCount}`);
  console.log(`   💾 캐시 사용: ${cachedCount}`);
  console.log(`   ❌ 실패: ${failCount}`);
  console.log(`   📁 캐시 파일: ${cachePath}`);
  console.log('='.repeat(50));

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`\n❌ 치명적 오류: ${err.message}`);
  process.exit(1);
});
