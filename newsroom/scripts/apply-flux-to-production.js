#!/usr/bin/env node
/**
 * 개발 서버의 FLUX 이미지를 운영 Ghost에 업로드하고 기사에 연결
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

const DEV_IMAGES = [
  { id: '6a02c7f4ddba0bc2cb5ff245', devUrl: 'http://167.86.72.98:2380/content/images/2026/05/flux-article-1778575246587.png', title: 'AI 리터러시, 학교 교육의 새로운 우선순위로' },
  { id: '6a02c7f1ddba0bc2cb5ff220', devUrl: 'http://167.86.72.98:2380/content/images/2026/05/flux-article-1778575659999.png', title: '전국 69개 AI 배움터 가동' }, // 재생성된 버전
  { id: '6a02c7f0ddba0bc2cb5ff212', devUrl: 'http://167.86.72.98:2380/content/images/2026/05/flux-article-1778575240495.png', title: '영국 학교, AI 리터러시 훈련 프레임워크 발표' },
  { id: '6a02c7f1ddba0bc2cb5ff227', devUrl: 'http://167.86.72.98:2380/content/images/2026/05/flux-article-1778575275837.png', title: '美 CACE, AI 교육 위한 1년 교사 연수 시작' },
  { id: '6a02c7f6ddba0bc2cb5ff25b', devUrl: 'http://167.86.72.98:2380/content/images/2026/05/flux-article-1778575282051.png', title: 'AI와 읽기 이해, 비판적 읽기의 새로운 지평' },
];

const GHOST_ADMIN_API = '69ce149033b7cdcca26cd56a:4d650e8af38b31d732f0d70c74120efcf9786f22fc04ff9e4c7bf58bf7b11304';

// ─── JWT 토큰 ─────────────────────────

function getGhostToken(key) {
  const [id, secret] = key.split(':');
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:id})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:n,exp:n+300,aud:'/admin/'})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
}

// ─── 이미지 다운로드 ─────────────────────────

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const localPath = `/tmp/flux-op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const file = fs.createWriteStream(localPath);
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        try { fs.unlinkSync(localPath); } catch(e) {}
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(localPath); } catch(e) {}
        return reject(new Error(`Download HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        if (fs.statSync(localPath).size > 1000) resolve(localPath);
        else reject(new Error('File too small'));
      });
    }).on('error', (err) => { file.close(); try { fs.unlinkSync(localPath); } catch(e) {} reject(err); });
  });
}

// ─── Ghost 이미지 업로드 ─────────────────────────

function uploadToGhost(imagePath) {
  const token = getGhostToken(GHOST_ADMIN_API);
  const boundary = '----Boundary' + Math.random().toString(36).slice(2);
  const imgData = fs.readFileSync(imagePath);
  const ext = '.png';
  const mime = 'image/png';
  const filename = `flux-article-${Date.now()}${ext}`;

  const part1 = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`);
  const part3 = Buffer.from(`\r\n--${boundary}--\r\n`);
  const totalLen = part1.length + imgData.length + part3.length;

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
    req.write(part1);
    req.write(imgData);
    req.write(part3);
    req.end();
  });
}

// ─── 기사 feature_image 업데이트 ─────────────────────────

function updatePostFeatureImage(postId, imageUrl) {
  const token = getGhostToken(GHOST_ADMIN_API);
  const body = JSON.stringify({
    posts: [{
      feature_image: imageUrl,
      feature_image_alt: '',
      feature_image_caption: ''
    }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'newsroom.ubion.global',
      path: `/ghost/api/admin/posts/${postId}/`,
      method: 'PUT',
      headers: {
        'Authorization': `Ghost ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const d = JSON.parse(data);
          if (d.posts && d.posts[0]) resolve(d.posts[0].feature_image);
          else reject(new Error(`Update failed: ${data.substring(0, 200)}`));
        } catch(e) { reject(new Error(`Parse: ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── 메인 ─────────────────────────

async function main() {
  console.log('=== FLUX 이미지를 운영 Ghost에 적용 ===\n');

  for (const item of DEV_IMAGES) {
    console.log(`[${item.title}]`);
    console.log(`  → 개발서버 URL: ${item.devUrl}`);

    try {
      // 1. 다운로드
      console.log(`  ⬇️ 다운로드 중...`);
      const localPath = await downloadImage(item.devUrl);
      const sizeKB = Math.round(fs.statSync(localPath).size / 1024);
      console.log(`  ✅ 다운로드 완료 (${sizeKB}KB)`);

      // 2. 운영 Ghost에 업로드
      console.log(`  ☁️ 운영 Ghost에 업로드 중...`);
      const ghostUrl = await uploadToGhost(localPath);
      console.log(`  ✅ 운영 Ghost URL: ${ghostUrl}`);

      // 3. 기사 feature_image 업데이트
      console.log(`  🔗 기사(${item.id})에 연결 중...`);
      const updatedUrl = await updatePostFeatureImage(item.id, ghostUrl);
      console.log(`  ✅ 연결 완료: ${updatedUrl}`);

      try { fs.unlinkSync(localPath); } catch(e) {}
    } catch(err) {
      console.log(`  ❌ 오류: ${err.message}`);
    }
    console.log('');
  }

  console.log('=== 완료 ===');
}

main().catch(err => console.error('Fatal:', err.message));
