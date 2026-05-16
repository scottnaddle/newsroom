#!/usr/bin/env node
/**
 * === FLUX 2 Dev 테스트 스크립트 ===
 * FAL AI API를 통해 FLUX 2 Dev로 이미지 생성 → 저장
 *
 * 사용법:
 *   node test-flux2-dev.js <프롬프트 텍스트>
 *   node test-flux2-dev.js --list  # 지원 모델 리스트
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── FAL AI API 설정 ─────────────────────────

// 키 로딩 우선순위: 1) 환경변수 2) .env.dev 3) .env
function getFalKey() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY;
  try {
    const files = ['/root/newsroom-analysis/newsroom/.env.dev', '/root/newsroom-analysis/newsroom/.env'];
    for (const f of files) {
      if (!fs.existsSync(f)) continue;
      const env = fs.readFileSync(f, 'utf8');
      const match = env.match(/FAL_KEY=(.+)/);
      if (match) return match[1].trim();
    }
  } catch(e) {}
  return null;
}

const FAL_KEY = getFalKey();
if (!FAL_KEY) {
  console.error('❌ FAL_KEY not found. Set env or add to .env.dev / .env');
  process.exit(1);
}

// ─── 지원 모델 ─────────────────────────

const MODELS = {
  'flux-dev': {
    id: 'fal-ai/flux/dev',
    name: 'FLUX.1 Dev',
    endpoint: '/fal-ai/flux/dev',
    params: { image_size: 'landscape_4_3', num_inference_steps: 28, guidance_scale: 3.5 }
  },
  'flux-pro': {
    id: 'fal-ai/flux-pro',
    name: 'FLUX.1 Pro',
    endpoint: '/fal-ai/flux-pro',
    params: { image_size: 'landscape_4_3', num_inference_steps: 25, sync_mode: true }
  },
  'flux-pro-v2': {
    id: 'fal-ai/flux',
    name: 'FLUX.1 Pro v2 (basic)',
    endpoint: '/fal-ai/flux',
    params: { image_size: 'landscape_4_3', num_inference_steps: 25, sync_mode: true }
  },
  'flux-realism': {
    id: 'fal-ai/flux-realism',
    name: 'FLUX.1 Realism',
    endpoint: '/fal-ai/flux-realism',
    params: { image_size: 'landscape_4_3', num_inference_steps: 28, guidance_scale: 7 }
  },
};

// ─── FAL AI API 호출 ─────────────────────────

function callFalQueue(endpoint, prompt, modelConfig) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      prompt: prompt,
      ...modelConfig.params,
      seed: Math.floor(Math.random() * 2147483647),
    });

    const options = {
      hostname: 'fal.run',
      path: endpoint,
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error || parsed.detail) {
            return reject(new Error(`FAL 오류: ${parsed.error?.message || parsed.detail || JSON.stringify(parsed)}`));
          }
          resolve(parsed);
        } catch(e) {
          reject(new Error(`JSON 파싱 오류: ${e.message}\n응답: ${data.substring(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── 결과 처리 ─────────────────────────

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const localPath = `/tmp/flux-test-${Date.now()}.png`;
    const file = fs.createWriteStream(localPath);
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 60000 }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadImage(response.headers.location).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) return reject(new Error(`Download HTTP ${response.statusCode}`));
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        if (fs.statSync(localPath).size > 1000) resolve(localPath);
        else reject(new Error('Downloaded file too small (< 1KB)'));
      });
    }).on('error', (err) => { file.close(); try { fs.unlinkSync(localPath); } catch(e) {} reject(err); });
  });
}

// ─── 메인 ─────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--list') {
    console.log('\n📋 지원 모델:\n');
    for (const [key, model] of Object.entries(MODELS)) {
      console.log(`  ${key.padEnd(20)} ${model.name}`);
      console.log(`  ${' '.repeat(20)} 모델ID: ${model.id}`);
      console.log(`  ${' '.repeat(20)} 엔드포인트: ${model.endpoint}`);
      console.log();
    }
    return;
  }

  const prompt = args[0];
  const modelKey = args[1] || 'flux-dev';

  if (!prompt) {
    console.error('사용법:');
    console.error('  node test-flux2-dev.js <프롬프트> [모델키]');
    console.error('  node test-flux2-dev.js --list');
    console.error(`\n기본 모델: flux-dev\n`);
    process.exit(1);
  }

  const modelConfig = MODELS[modelKey];
  if (!modelConfig) {
    console.error(`❌ 알 수 없는 모델: ${modelKey}`);
    console.error(`   사용 가능: ${Object.keys(MODELS).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n🎨 FAL AI FLUX 이미지 생성 시작`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`모델: ${modelConfig.name} (${modelKey})`);
  console.log(`프롬프트 (${prompt.length}자): ${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}`);
  console.log({});

  const startTime = Date.now();

  try {
    // Queue API 호출 (비동기 요청)
    const result = await callFalQueue(modelConfig.endpoint, prompt, modelConfig);
    const apiTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`  ✅ API 응답 완료 (${apiTime}s)`);

    // 응답에서 이미지 URL 추출
    let imageUrl = null;
    if (result.images && result.images[0] && result.images[0].url) {
      imageUrl = result.images[0].url;
    }
    if (!imageUrl && result.image && result.image.url) {
      imageUrl = result.image.url;
    }

    if (!imageUrl) {
      console.error('❌ 이미지 URL을 찾을 수 없습니다.');
      console.error(`   응답: ${JSON.stringify(result).substring(0, 500)}`);
      process.exit(1);
    }

    console.log(`  📍 이미지 URL: ${imageUrl}`);
    console.log(`  ⬇️ 다운로드 중...`);

    const localPath = await downloadImage(imageUrl);
    const dlTime = Math.round((Date.now() - startTime) / 1000);
    const sizeKB = Math.round(fs.statSync(localPath).size / 1024);

    console.log(`  ✅ 저장 완료 (${dlTime}s, ${sizeKB}KB): ${localPath}`);
    console.log(`\n📁 ${localPath}`);

  } catch (err) {
    console.error(`\n❌ 오류: ${err.message}`);
    process.exit(1);
  }
}

const http = require('http');
main();
