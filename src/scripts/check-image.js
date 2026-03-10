#!/usr/bin/env node
/**
 * check-image.js — 이미지 URL HTTP 상태 확인 (LLM 불필요)
 * 
 * 사용법: node check-image.js <json-file-path>
 * 
 * feature_image와 HTML 내 이미지 URL을 HEAD 요청으로 검증
 */

const fs = require('fs');
const https = require('https');
const http = require('http');

function checkUrl(url) {
  return new Promise((resolve) => {
    if (!url) return resolve({ url: null, status: 0, ok: false });
    
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
      resolve({ url, status: res.statusCode, ok: res.statusCode === 200 });
    });
    req.on('error', () => resolve({ url, status: 0, ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ url, status: 0, ok: false }); });
    req.end();
  });
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node check-image.js <json-file>');
    process.exit(2);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const html = data.draft?.html || data.html || '';
  
  // HTML에서 이미지 URL 추출
  const imgUrls = [];
  const imgRegex = /src="(https?:\/\/[^"]+)"/g;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    imgUrls.push(match[1]);
  }
  
  // feature_image 추가
  if (data.feature_image) imgUrls.push(data.feature_image);
  if (data.draft?.feature_image) imgUrls.push(data.draft.feature_image);

  const unique = [...new Set(imgUrls)];
  const results = await Promise.all(unique.map(checkUrl));
  
  const allOk = results.every(r => r.ok);
  const failed = results.filter(r => !r.ok);

  console.log(JSON.stringify({
    totalImages: unique.length,
    allOk,
    failed: failed.length,
    results
  }));

  process.exit(allOk ? 0 : 1);
}

main();
