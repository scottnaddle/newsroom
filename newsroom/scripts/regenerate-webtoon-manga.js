#!/usr/bin/env node
/**
 * 웹툰 재생성: FLUX.1-dev 망가 모드로 16개 패널 + Ghost 업로드
 * Storyboard 기반 장면별 프롬프트 + 말풍선 후처리
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const SSH_HOST = 'axc@axc-macstudio.tailea4ca3.ts.net';
const STORYBOARD_PATH = '/root/hermes/scripts/webtoon-pipeline/output/소프트웨어가-블랙박스가-된-80년의-역사-1장/storyboard.json';

// 망가 스타일 (고정)
const MANGA_STYLE = 'Japanese manga style, black and white line art, high contrast, clean composition, rough ink texture, cinematic manga panel, screentone shading, detailed linework';

// 캐릭터 일관성 정의
const CHARS = {
  JEAN: 'Jean Jennings: a young Caucasian woman in her early 20s, short bobbed haircut, 1940s-era blouse and A-line skirt, intelligent eyes, medium build',
  KAY: 'Kay McNulty: a tall woman with wavy dark hair and round glasses, 1940s dress with collar, scholarly appearance',
  BETTY: 'Betty Snyder: sharp-featured woman, hair pulled back in a bun, 1940s dress with collar, determined expression',
  GOLDSTINE: 'Herman Goldstine: US Army officer in uniform, late 30s, short military haircut, authoritative posture',
  MAUCHLY: 'John Mauchly: middle-aged man in 1940s suit and tie, receding hairline, round glasses, confident smile',
  ECKERT: 'J. Presper Eckert: young man in 1940s suit, slicked-back hair, energetic expression',
  KATHY: 'Kathy Kleiman: a university graduate student in 1980s, casual sweater and jeans, curious determined look',
  GROUP: 'Six women in their 20s wearing 1940s vintage business attire and skirts, standing together proudly',
};

function detectChars(text) {
  const found = [];
  if (/진|제닝스/i.test(text)) found.push(CHARS.JEAN);
  if (/케이|맥널티|캐슬린/i.test(text)) found.push(CHARS.KAY);
  if (/베티|스나이더/i.test(text)) found.push(CHARS.BETTY);
  if (/골드스틴/i.test(text)) found.push(CHARS.GOLDSTINE);
  if (/모클리/i.test(text)) found.push(CHARS.MAUCHLY);
  if (/에커트/i.test(text)) found.push(CHARS.ECKERT);
  if (/캐시|클라이먼/i.test(text)) found.push(CHARS.KATHY);
  if (/여섯|여성 프로그래머|여성들|ENIAC.?Six/i.test(text)) found.push(CHARS.GROUP);
  return found.length ? found.join('. ') : '1940s era people in period-appropriate attire';
}

function buildPanelPrompt(panel, pageNum, panelIdx) {
  const desc = panel.scene_description || '';
  const mood = panel.mood || 'neutral';
  const comp = panel.composition || '';
  const chars = detectChars(desc);

  return [
    `${MANGA_STYLE}.`,
    `Scene: ${desc}`,
    `Characters: ${chars}`,
    `Composition: ${comp}`,
    `Mood: ${mood}`,
    `Setting: 1940s America, university and military research environment.`,
    'No text, no letters, no writing, no speech bubbles in this image.',
    'Black and white only, no color, Japanese manga art style.',
  ].join('\n');
}

function getGhostToken() {
  const env = fs.readFileSync('/root/.openclaw/workspace/newsroom/.env', 'utf8');
  const match = env.match(/GHOST_ADMIN_API_KEY=(\S+)/);
  const [id, secret] = match[1].trim().split(':');
  const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid:id})).toString('base64url');
  const n = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({iat:n,exp:n+600,aud:'/admin/'})).toString('base64url');
  const s = crypto.createHmac('sha256', Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');
  return h+'.'+p+'.'+s;
}

function uploadToGhost(imagePath) {
  const token = getGhostToken();
  const boundary = '----Boundary' + Math.random().toString(36).slice(2);
  const imgData = fs.readFileSync(imagePath);
  const filename = `webtoon-panel-${Date.now()}.png`;
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`,
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
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          const d = JSON.parse(b);
          if (d.images && d.images[0] && d.images[0].url) resolve(d.images[0].url);
          else reject(new Error(`Upload failed: ${b.substring(0,200)}`));
        } catch(e) { reject(new Error(`Parse error: ${b.substring(0,200)}`)); }
      });
    });
    req.on('error', reject);
    // Retry logic for transient network errors
    const tryWrite = (attempt = 0) => {
      try {
        req.write(Buffer.from(parts[0]));
        req.write(Buffer.from(parts[1]));
        req.write(Buffer.from(parts[2]));
        req.end();
      } catch(err) {
        if (attempt < 3) setTimeout(() => tryWrite(attempt + 1), 1000);
        else reject(err);
      }
    };
    tryWrite();
  });
}

function generateImage(prompt) {
  const promptFile = `/tmp/manga-in-${Date.now()}.txt`;
  const b64 = Buffer.from(prompt).toString('base64');
  fs.writeFileSync(promptFile + '.b64', b64, 'utf8');

  // Copy to Mac Studio
  execSync(`scp "${promptFile}.b64" ${SSH_HOST}:/tmp/comfy-prompt.b64`, { timeout: 15000 });

  // Generate with manga mode (FLUX.1-dev, 50 steps)
  const cmd = `ssh ${SSH_HOST} "python3 -c 'import base64,sys; sys.stdout.write(base64.b64decode(sys.stdin.read()).decode())' < /tmp/comfy-prompt.b64 > /tmp/comfy-prompt-in.txt && bash /tmp/comfyui-gen-v2.sh manga /tmp/comfy-prompt-in.txt" 2>&1`;

  try {
    const output = execSync(cmd, { timeout: 480000, shell: '/bin/bash', maxBuffer: 2 * 1024 * 1024 }).toString().trim();
    const lines = output.split('\n').map(l => l.trim()).filter(Boolean);
    const genPath = lines.find(l => l.startsWith('/tmp/gen-'));
    
    if (genPath) {
      const localPath = `/tmp/manga-panel-${Date.now()}.png`;
      execSync(`scp ${SSH_HOST}:"${genPath}" "${localPath}"`, { timeout: 30000 });
      if (fs.existsSync(localPath) && fs.statSync(localPath).size > 5000) {
        try { fs.unlinkSync(promptFile + '.b64'); } catch(e) {}
        return localPath;
      }
    }
    
    // Fallback
    const latest = execSync(`ssh ${SSH_HOST} "ls -t /Users/axc/ComfyUI/output/ComfyUI-manga-*.png 2>/dev/null | head -1"`, { timeout: 10000 }).toString().trim();
    if (latest) {
      const localPath = `/tmp/manga-fb-${Date.now()}.png`;
      execSync(`scp ${SSH_HOST}:"${latest}" "${localPath}"`, { timeout: 30000 });
      if (fs.existsSync(localPath) && fs.statSync(localPath).size > 5000) return localPath;
    }
    throw new Error(`No output. Raw: ${output.substring(0,200)}`);
  } catch (err) {
    if (err.message.includes('ETIMEDOUT') || err.message.includes('Command timed out')) {
      throw new Error('Generation timeout (480s)');
    }
    throw err;
  } finally {
    try { fs.unlinkSync(promptFile + '.b64'); } catch(e) {}
  }
}

async function updateGhostPost(postId, newFeatureImage, htmlContent) {
  const token = getGhostToken();
  const post = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'newsroom.ubion.global',
      path: `/ghost/api/admin/posts/${postId}/?fields=id,updated_at`,
      headers: { 'Authorization': `Ghost ${token}` }
    }, (res) => {
      let b=''; res.on('data',c=>b+=c); res.on('end',()=>resolve(JSON.parse(b)));
    });
    req.on('error', reject);
    req.end();
  });
  if (post.errors) throw new Error(`Get failed: ${post.errors[0].message}`);

  const body = JSON.stringify({
    posts: [{
      id: postId,
      feature_image: newFeatureImage,
      updated_at: post.posts[0].updated_at
    }]
  });

  const result = await new Promise((resolve, reject) => {
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
      let b=''; res.on('data',c=>b+=c); res.on('end',()=>resolve(JSON.parse(b)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  if (result.errors) throw new Error(`Update failed: ${result.errors[0].message}`);
  return result.posts[0];
}

async function main() {
  console.log('=== 🎨 웹툰 FLUX.1-dev 재생성 ===\n');

  // 1. 스토리보드 로드
  const storyboard = JSON.parse(fs.readFileSync(STORYBOARD_PATH, 'utf8'));
  console.log(`📖 ${storyboard.length} pages loaded\n`);

  let panelNum = 1;
  const results = [];

  for (const page of storyboard) {
    const panels = page.panels || [];
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      const prompt = buildPanelPrompt(panel, page.page_number, i);

      console.log(`[${panelNum}/16] Page ${page.page_number}, Panel ${i+1}`);
      console.log(`   "${(panel.narration || panel.dialogue || '').substring(0, 50)}..."`);

      // Generate
      console.log('   Generating via FLUX.1-dev manga (50 steps)...');
      const start = Date.now();
      try {
        const imgPath = generateImage(prompt);
        const elapsed = Math.round((Date.now() - start) / 1000);
        const sizeKB = Math.round(fs.statSync(imgPath).size / 1024);
        console.log(`   ✅ ${elapsed}s, ${sizeKB}KB: ${path.basename(imgPath)}`);

        // Upload to Ghost
        console.log('   Uploading to Ghost...');
        const ghostUrl = await uploadToGhost(imgPath);
        console.log(`   ✅ Ghost: ${ghostUrl.substring(0, 60)}...`);

        results.push({
          panel: panelNum,
          page: page.page_number,
          localPath: imgPath,
          ghostUrl,
          narration: panel.narration || '',
          dialogue: panel.dialogue || ''
        });
      } catch (err) {
        console.log(`   ❌ ${err.message}`);
        results.push({ panel: panelNum, error: err.message });
      }

      panelNum++;
    }
  }

  // 결과 저장
  fs.writeFileSync('/tmp/webtoon-results.json', JSON.stringify(results, null, 2));

  const success = results.filter(r => r.ghostUrl).length;
  const failed = results.filter(r => r.error).length;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ ${success}/16 panels generated`);
  console.log(`❌ ${failed}/16 failed`);
  console.log(`Results: /tmp/webtoon-results.json`);

  // 각 패널 Ghost URL 출력
  results.filter(r => r.ghostUrl).forEach(r => {
    console.log(`  Panel ${String(r.panel).padStart(2)} (p${r.page}): ${r.ghostUrl}`);
  });
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
