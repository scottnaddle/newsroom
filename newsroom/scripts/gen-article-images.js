#!/usr/bin/env node
/**
 * === gen-article-images.js — 독립형 기사 이미지 생성 CLI (v2) ===
 *
 * GPT Image 1 Mini (OpenAI API)로 이미지 생성 → Ghost 업로드 → 캐시 저장
 * ComfyUI SSH 방식 대체 (2026-05-12)
 * BananaX 22-Style Palette + content-aware scene 유지
 *
 * 사용법:
 *   단일 파일:  node gen-article-images.js --input path/to/article.json
 *   디렉토리:   node gen-article-images.js --dir pipeline/07-copy-edited/
 *   캐시 지정:  node gen-article-images.js --dir . --cache .imgcache/pending.json
 *   강제 재생성: node gen-article-images.js --dir . --force
 *   건너뛰기:   node gen-article-images.js --dir . --dry-run
 *
 * 의존성: generate-article-image.js (같은 디렉토리, buildPrompt/분석 로직 재사용)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// generate-article-image.js에서 buildPrompt와 분석 함수만 임포트
const { detectCountryContext, buildPrompt } = require('./generate-article-image.js');

// ─── 설정 ───────────────────────────────

const DEFAULT_WORKSPACE = '/root/.openclaw/workspace/newsroom';
const DEFAULT_CACHE_PATH = '.imgcache/pending.json';
const ENV_PATH = '/root/.openclaw/workspace/newsroom/.env';

// GPT Image 1 Mini 엔드포인트
const OPENAI_API = 'https://api.openai.com/v1/images/generations';
const GPT_IMAGE_MODEL = 'gpt-image-1-mini';
const GPT_IMAGE_SIZE = '1024x1024';
const GPT_IMAGE_QUALITY = 'low'; // low=$0.005, medium=$0.011, high=$0.036

// ─── OpenAI API 키 로드 ───────────────────────────────

let cachedApiKey = null;
function getOpenAIKey() {
  if (cachedApiKey) return cachedApiKey;
  try {
    const env = fs.readFileSync(ENV_PATH, 'utf8');
    const match = env.match(/OPENAI_API_KEY=(sk-[^\s]+)/);
    if (match) {
      cachedApiKey = match[1].trim();
      return cachedApiKey;
    }
  } catch (e) {}
  throw new Error(`OPENAI_API_KEY를 찾을 수 없습니다. ${ENV_PATH}에 OPENAI_API_KEY=sk-...를 추가하세요.`);
}

// ─── OpenAI API 호출 ───────────────────────────────

function callOpenAI(prompt) {
  const apiKey = getOpenAIKey();
    const body = JSON.stringify({
      model: GPT_IMAGE_MODEL,
      prompt: prompt,
      n: 1,
      size: GPT_IMAGE_SIZE,
      quality: GPT_IMAGE_QUALITY
    });

  return new Promise((resolve, reject) => {
    const url = new URL(OPENAI_API);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(`OpenAI API 오류: ${parsed.error.message}`));
            return;
          }
          if (parsed.data && parsed.data[0] && parsed.data[0].url) {
            resolve({ url: parsed.data[0].url, revisedPrompt: parsed.data[0].revised_prompt });
          } else if (parsed.data && parsed.data[0] && parsed.data[0].b64_json) {
            // Base64 반환 시 (request에서 response_format='b64_json' 필요)
            resolve({ b64: parsed.data[0].b64_json });
          } else {
            reject(new Error(`OpenAI 응답 파싱 실패: ${data.substring(0, 300)}`));
          }
        } catch (e) {
          reject(new Error(`OpenAI 응답 JSON 파싱 오류: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── 이미지 저장 (URL 다운로드 or Base64 → 파일) ───────────────

function saveImageBase64(b64String) {
  const localPath = `/tmp/ai-gpt-${Date.now()}.png`;
  const buffer = Buffer.from(b64String, 'base64');
  fs.writeFileSync(localPath, buffer);
  if (fs.statSync(localPath).size > 1000) return localPath;
  throw new Error('Base64 디코딩 결과가 너무 작음 (< 1KB)');
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const localPath = `/tmp/ai-gpt-${Date.now()}.png`;
    const file = fs.createWriteStream(localPath);
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, { timeout: 30000 }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadImage(response.headers.location).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        if (fs.statSync(localPath).size > 1000) resolve(localPath);
        else reject(new Error('Downloaded file too small (< 1KB)'));
      });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(localPath);
      reject(err);
    });
  });
}

// ─── Ghost 이미지 업로드 ───────────────────────────────

function getGhostToken() {
  const crypto = require('crypto');
  const env = fs.readFileSync(ENV_PATH, 'utf8');
  const match = env.match(/GHOST_ADMIN_API_KEY=(\S+)/);
  if (!match) throw new Error('GHOST_ADMIN_API_KEY not found');
  const [id, secret] = match[1].trim().split(':');
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:id})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:n,exp:n+300,aud:'/admin/'})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
}

function uploadToGhost(imagePath) {
  const token = getGhostToken();
  const boundary = '----Boundary' + Math.random().toString(36).slice(2);
  const imgData = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase() || '.png';
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const filename = `ai-article-${Date.now()}${ext}`;

  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
    imgData,
    `\r\n--${boundary}--\r\n`
  ];

  const totalLen = Buffer.byteLength(Buffer.concat([
    Buffer.from(parts[0]), Buffer.from(parts[1]), Buffer.from(parts[2])
  ]));

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'newsroom.ubion.global',
      path: '/ghost/api/admin/images/upload/',
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalLen
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const d = JSON.parse(body);
          if (d.images && d.images[0] && d.images[0].url) resolve(d.images[0].url);
          else reject(new Error(`Upload failed: ${body.substring(0, 200)}`));
        } catch(e) { reject(new Error(`Parse error: ${body.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(Buffer.from(parts[0]));
    req.write(Buffer.from(parts[1]));
    req.write(Buffer.from(parts[2]));
    req.end();
  });
}

// ─── 유틸리티 ───────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { input: null, dir: null, cache: null, force: false, dryRun: false, verbose: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':     opts.input = args[++i]; break;
      case '--dir':       opts.dir = args[++i]; break;
      case '--cache':     opts.cache = args[++i]; break;
      case '--force':     opts.force = true; break;
      case '--dry-run':   opts.dryRun = true; break;
      case '--verbose':   opts.verbose = true; break;
      case '--help':
        console.log(`
Usage: node gen-article-images.js [options]

Options:
  --input <file>      단일 기사 JSON 파일 처리
  --dir <path>       디렉토리 내 모든 기사 JSON 처리
  --cache <path>     캐시 파일 경로 (기본: ${DEFAULT_CACHE_PATH})
  --force            캐시 무시하고 강제 재생성
  --dry-run          이미지 생성 안 하고 프롬프트만 출력
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
    if (opts.verbose) console.log(`  ✅ 캐시됨: ${headline.substring(0, 40)}...`);
    return { success: true, cached: true, url: cache[headline] };
  }

  console.log(`\n📸 [${fileName}] ${headline.substring(0, 60)}`);
  if (opts.verbose) console.log(`     태그: ${tags.join(', ')} | 단계: ${stage}`);

  // 프롬프트 생성
  const context = detectCountryContext(headline, bodyHtml, tags);
  const prompt = buildPrompt(headline, bodyHtml, tags, context);
  
  if (opts.verbose) {
    console.log(`     국가: ${context.country} (${context.region})`);
    console.log(`     프롬프트 (${prompt.length} chars): ${prompt.substring(0, 150)}...`);
  }

  // Dry-run: 프롬프트만 출력
  if (opts.dryRun) {
    console.log(`  🏷️  [DRY RUN] 프롬프트:\n     ${prompt}`);
    console.log(`     국가: ${context.country}`);
    return { success: true, dryRun: true, headline };
  }

  try {
    // 1. OpenAI GPT Image 1 Mini 호출
    const startTime = Date.now();
    const openAIResult = await callOpenAI(prompt);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  🤖 OpenAI 생성 완료 (${elapsed}s): ${openAIResult.url ? 'URL 반환' : 'Base64 반환'}`);

    let ghostUrl;

    if (openAIResult.url) {
      // 2a. URL에서 이미지 다운로드
      console.log(`  ⬇️  이미지 다운로드 중...`);
      const localPath = await downloadImage(openAIResult.url);
      const sizeKB = Math.round(fs.statSync(localPath).size / 1024);
      console.log(`  ✅ 다운로드 완료 (${sizeKB}KB): ${localPath}`);

      // 3. Ghost 업로드
      console.log(`  ☁️  Ghost 업로드 중...`);
      ghostUrl = await uploadToGhost(localPath);
      console.log(`  ✅ Ghost URL: ${ghostUrl}`);

      // 4. 임시 파일 정리
      try { fs.unlinkSync(localPath); } catch(e) {}
    } else if (openAIResult.b64) {
      // 2b. Base64 → 파일 저장
      console.log(`  💾 Base64 → 파일 저장 중...`);
      const localPath = saveImageBase64(openAIResult.b64);
      const sizeKB = Math.round(fs.statSync(localPath).size / 1024);
      console.log(`  ✅ 저장 완료 (${sizeKB}KB): ${localPath}`);

      // 3. Ghost 업로드
      console.log(`  ☁️  Ghost 업로드 중...`);
      ghostUrl = await uploadToGhost(localPath);
      console.log(`  ✅ Ghost URL: ${ghostUrl}`);

      // 4. 임시 파일 정리
      try { fs.unlinkSync(localPath); } catch(e) {}
    } else {
      throw new Error('OpenAI가 이미지 URL을 반환하지 않았습니다.');
    }

    // 5. 캐시 저장
    cache[headline] = ghostUrl;

    return { success: true, url: ghostUrl, headline, context };

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

  console.log(`🍌 gen-article-images.js v2 — GPT Image 1 Mini`);
  console.log(`   모델: ${GPT_IMAGE_MODEL} | 크기: ${GPT_IMAGE_SIZE} | 품질: ${GPT_IMAGE_QUALITY} | 가격: $0.005/장`);
  console.log(`   작업 디렉토리: ${workspace}`);
  console.log(`   캐시: ${cachePath}`);
  if (opts.force) console.log(`   ⚠️  강제 재생성 모드`);
  if (opts.dryRun) console.log(`   🔍 드라이 런 모드 (생성 안 함)`);

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

  // 순차 처리
  let successCount = 0;
  let failCount = 0;
  let cachedCount = 0;
  let dryRunCount = 0;

  for (const filePath of files) {
    const result = await processArticle(filePath, opts, cache);
    if (result.dryRun) dryRunCount++;
    else if (result.success && result.cached) cachedCount++;
    else if (result.success) successCount++;
    else failCount++;
  }

  // 캐시 저장
  if (!opts.dryRun) {
    saveCache(cachePath, cache);
  }

  // 요약
  console.log(`\n` + '='.repeat(50));
  console.log(`📊 요약`);
  if (dryRunCount > 0) console.log(`   🔍 드라이 런: ${dryRunCount}`);
  else {
    console.log(`   ✅ 생성: ${successCount} ($${(successCount * 0.005).toFixed(3)})`);
    console.log(`   💾 캐시 사용: ${cachedCount}`);
    console.log(`   ❌ 실패: ${failCount}`);
    console.log(`   📁 캐시 파일: ${cachePath}`);
  }
  console.log('='.repeat(50));

  if (failCount > 0) process.exit(1);
}

main().catch(err => {
  console.error(`\n❌ 치명적 오류: ${err.message}`);
  process.exit(1);
});
