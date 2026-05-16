#!/usr/bin/env node
/**
 * === FLUX 2 Dev 테스트 스크립트 (v3 - data: URI 지원) ===
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

function getFalKey() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY;
  for (const f of ['/root/newsroom-analysis/newsroom/.env.dev', '/root/newsroom-analysis/newsroom/.env']) {
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/FAL_KEY=(.+)/);
    if (m) return m[1].trim();
  }
  return null;
}

const FAL_KEY = getFalKey();
if (!FAL_KEY) { console.error('❌ FAL_KEY not found.'); process.exit(1); }

const MODELS = {
  'flux-dev': {
    name: 'FLUX.1 Dev', endpoint: '/fal-ai/flux/dev',
    params: { image_size: 'landscape_4_3', num_inference_steps: 28, guidance_scale: 3.5 }
  },
  'flux-pro': {
    name: 'FLUX.1 Pro', endpoint: '/fal-ai/flux-pro',
    params: { image_size: 'landscape_4_3', num_inference_steps: 25, enable_safety_checker: false }
  },
  'flux-pro-v2': {
    name: 'FLUX.1 Pro v2', endpoint: '/fal-ai/flux',
    params: { image_size: 'landscape_4_3', num_inference_steps: 25, sync_mode: true, enable_safety_checker: false }
  },
  'flux-realism': {
    name: 'FLUX.1 Realism', endpoint: '/fal-ai/flux-realism',
    params: { image_size: 'landscape_4_3', num_inference_steps: 28, guidance_scale: 7, enable_safety_checker: false }
  },
};

function falRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'fal.run', port: 443, path, method,
      headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' }
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          if (p.error || p.detail) return reject(new Error(p.error?.message || p.detail));
          resolve(p);
        } catch(e) { reject(new Error(`JSON: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function callFal(prompt, modelConfig) {
  const body = JSON.stringify({
    prompt, ...modelConfig.params,
    seed: Math.floor(Math.random() * 2147483647),
  });

  if (modelConfig.params.sync_mode) {
    console.log('  ⚡ Sync 모드...');
    return await falRequest('POST', modelConfig.endpoint, body);
  }

  console.log('  📤 Queue 제출...');
  const submit = await falRequest('POST', modelConfig.endpoint, body);
  const statusUrl = submit.status_url;
  const requestId = submit.request_id;
  if (!statusUrl && !requestId) {
    if (submit.images) return submit;
    throw new Error('No queue URL: ' + JSON.stringify(submit).substring(0, 200));
  }
  const pollPath = statusUrl || `/fal-ai/requests/${requestId}/status`;
  console.log(`  ⏳ 대기 중 (${requestId || '...'})`);

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const status = await falRequest('GET', pollPath);
    if (status.status === 'COMPLETED' || status.completed_at) {
      const resultPath = statusUrl ? statusUrl.replace('/status', '') : `/fal-ai/requests/${requestId}/result`;
      return await falRequest('GET', resultPath);
    }
    if (status.status === 'FAILED') throw new Error('Queue failed');
    if (i % 5 === 4) process.stdout.write(`  ⏳ ${(i+1)*3}s...\n`);
  }
  throw new Error('Timeout (90s)');
}

function saveResult(result) {
  // 여러 형식 지원
  let imageUrl = result.images?.[0]?.url || result.image?.url || result.url;
  let b64Data = result.images?.[0]?.content || result.base64;

  // data: URI 처리
  if (imageUrl && imageUrl.startsWith('data:')) {
    const match = imageUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (match) b64Data = match[2];
    imageUrl = null;
  }

  if (b64Data) {
    const out = `/tmp/flux-test-${Date.now()}.png`;
    fs.writeFileSync(out, Buffer.from(b64Data, 'base64'));
    if (fs.statSync(out).size > 1000) return out;
    throw new Error('Base64 too small');
  }

  if (imageUrl) {
    return new Promise((resolve, reject) => {
      const out = `/tmp/flux-test-${Date.now()}.png`;
      const file = fs.createWriteStream(out);
      const mod = imageUrl.startsWith('https') ? https : http;
      mod.get(imageUrl, { timeout: 60000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
          return downloadImage(res.headers.location).then(resolve).catch(reject);
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        res.pipe(file);
        file.on('finish', () => { file.close();
          if (fs.statSync(out).size > 1000) resolve(out);
          else reject(new Error('Too small')); });
      }).on('error', reject);
    });
  }

  throw new Error('No downloadable result: ' + JSON.stringify(result).substring(0, 200));
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--list') {
    console.log('\n📋 지원 모델:\n');
    for (const [k, m] of Object.entries(MODELS)) console.log(`  ${k.padEnd(20)} ${m.name}`);
    return;
  }

  const prompt = args[0];
  const modelKey = args[1] || 'flux-dev';
  if (!prompt) { console.error('Usage: node test-flux.js <prompt> [model]'); process.exit(1); }

  const model = MODELS[modelKey];
  if (!model) { console.error(`Unknown: ${modelKey}`); process.exit(1); }

  console.log(`\n🎨 모델: ${model.name} (${modelKey})`);
  console.log(`프롬프트: ${prompt.substring(0, 150)}...`);

  const start = Date.now();
  const result = await callFal(prompt, model);
  console.log(`  ✅ 응답 (${Math.round((Date.now()-start)/1000)}s)`);

  const path = await saveResult(result);
  const kb = Math.round(fs.statSync(path).size / 1024);
  console.log(`  ✅ 저장 (${Math.round((Date.now()-start)/1000)}s, ${kb}KB): ${path}`);
  console.log(`\n📁 ${path}`);
}

main().catch(err => { console.error(`\n❌ ${err.message}`); process.exit(1); });
