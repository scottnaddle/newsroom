#!/usr/bin/env node

/**
 * 논문 1개 처리 (요약 + 발행)
 * 매시간 실행되어 1개씩만 처리
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Configuration
const WORKSPACE = '/root/.openclaw/workspace/newsroom';
const SOURCED_DIR = `${WORKSPACE}/pipeline/papers/01-sourced`;
const SUMMARIZED_DIR = `${WORKSPACE}/pipeline/papers/02-summarized`;
const PUBLISHED_DIR = `${WORKSPACE}/pipeline/papers/03-published`;
const REJECTED_DIR = `${WORKSPACE}/pipeline/papers/04-rejected`;

// Z.AI API
const ZAI_API_KEY = process.env.ZAI_API_KEY || '95087f94d2dd4c6dacc1689483d3313a.ouEapRwsgNG0xAJ5';

// Ghost API
const GHOST_URL = 'https://ubion.ghost.io';
const GHOST_API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';

// Ensure directories
[SUMMARIZED_DIR, PUBLISHED_DIR, REJECTED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// JWT for Ghost
function generateJWT() {
  const [kid, secret] = GHOST_API_KEY.split(':');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'hex'));
  hmac.update(header + '.' + payload);
  return header + '.' + payload + '.' + hmac.digest('base64url');
}

// Call GLM-5
async function callGLM(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'glm-4-plus',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000
    });
    
    const req = https.request({
      hostname: 'open.bigmodel.cn',
      port: 443,
      path: '/api/paas/v4/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAI_API_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices?.[0]) resolve(parsed.choices[0].message.content);
          else reject(new Error('Invalid response: ' + data));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Ghost API
async function ghostRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, GHOST_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Ghost ${generateJWT()}`
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          else resolve(parsed);
        } catch (e) {
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          else resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Summarize paper
async function summarizePaper(paper) {
  const prompt = `다음은 AI 교육 관련 학술 논문의 정보입니다. 이를 한국어로 요약해주세요.

제목: ${paper.title}

초록 (Abstract):
${paper.summary}

저자: ${paper.authors.slice(0, 5).join(', ')}

다음 형식으로 답변해주세요:

1. **한국어 제목**: (제목을 자연스러운 한국어로 번역)
2. **한국어 요약**: (3-5문장으로 핵심 내용을 한국어로 요약)
3. **핵심 발견 3가지**: (줄바꿈으로 구분된 3개의 핵심 발견)
4. **교육적 시사점**: (이 연구가 교육 현장에 주는 시사점 2-3문장)`;

  const response = await callGLM(prompt);
  
  let koreanTitle = paper.title;
  let koreanSummary = '';
  let keyFindings = [];
  let implications = '';
  
  try {
    const titleMatch = response.match(/\*\*한국어 제목\*\*[:\s]*(.+?)(?=\n|\*\*한국어 요약)/s);
    if (titleMatch) koreanTitle = titleMatch[1].trim();
    
    const summaryMatch = response.match(/\*\*한국어 요약\*\*[:\s]*(.+?)(?=\n\*\*핵심 발견|\n3\.)/s);
    if (summaryMatch) koreanSummary = summaryMatch[1].trim();
    
    const findingsMatch = response.match(/\*\*핵심 발견.*?\*\*[:\s]*(.+?)(?=\n\*\*교육적|\n4\.)/s);
    if (findingsMatch) {
      keyFindings = findingsMatch[1].split(/\n/).map(l => l.replace(/^[\d\.\-\*]+\s*/, '').trim()).filter(l => l.length > 10).slice(0, 3);
    }
    
    const implMatch = response.match(/\*\*교육적 시사점\*\*[:\s]*(.+?)$/s);
    if (implMatch) implications = implMatch[1].trim();
    
    if (!koreanSummary || keyFindings.length === 0) {
      koreanSummary = response.slice(0, 500);
      keyFindings = ['이 논문은 AI 교육 분야의 새로운 접근법을 제시합니다.'];
      implications = '이 연구는 AI 기술의 교육 현장 도입에 있어 중요한 시사점을 제공합니다.';
    }
  } catch (e) {
    koreanSummary = response.slice(0, 500);
    keyFindings = ['이 논문은 AI 교육 분야의 새로운 접근법을 제시합니다.'];
    implications = '이 연구는 AI 기술의 교육 현장 도입에 있어 중요한 시사점을 제공합니다.';
  }
  
  return { korean_title: koreanTitle, korean_summary: koreanSummary, key_findings: keyFindings, implications };
}

// Generate HTML
function generatePaperHtml(paper) {
  const { title, summary, authors, published, arxiv_id, abs_url, pdf_url, korean_title, korean_summary, key_findings, implications } = paper;
  
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${korean_title || title}</title>
</head>
<body style="font-family:'Noto Sans KR',sans-serif;max-width:680px;margin:0 auto;padding:20px;font-size:17px;line-height:1.9;color:#1a1a2e;">

  <!-- 논문 정보 박스 -->
  <div style="background:#f8f9ff;border-left:4px solid #8b5cf6;padding:18px 22px;border-radius:0 8px 8px 0;margin-bottom:32px;">
    <p style="margin:0 0 12px;font-size:15px;color:#64748b;">
      <strong>📄 논문</strong> | ${authors.slice(0, 3).join(', ')}${authors.length > 3 ? ' et al.' : ''}
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">
      <strong>게재일:</strong> ${published ? new Date(published).toLocaleDateString('ko-KR') : 'N/A'} | 
      <strong>arXiv:</strong> <a href="${abs_url}" style="color:#8b5cf6;">${arxiv_id}</a>
    </p>
    <p style="margin:0;font-size:14px;color:#64748b;">
      <a href="${pdf_url}" style="color:#8b5cf6;margin-right:16px;">📥 PDF 다운로드</a>
      <a href="${abs_url}" style="color:#8b5cf6;">🔗 원문 보기</a>
    </p>
  </div>

  <!-- 한국어 요약 -->
  <h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:32px 0 20px;color:#1a1a2e;">📝 한국어 요약</h2>
  <p style="margin:0 0 24px;line-height:1.9;">${korean_summary}</p>

  <!-- 핵심 발견 -->
  <h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:32px 0 20px;color:#1a1a2e;">💡 핵심 발견</h2>
  <ul style="margin:0 0 24px;padding-left:24px;line-height:1.9;">
    ${key_findings.map(f => `<li style="margin-bottom:8px;">${f}</li>`).join('\n    ')}
  </ul>

  <!-- 교육적 시사점 -->
  <h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:32px 0 20px;color:#1a1a2e;">🎓 교육적 시사점</h2>
  <p style="margin:0 0 24px;line-height:1.9;">${implications}</p>

  <!-- 원문 초록 -->
  <h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:32px 0 20px;color:#1a1a2e;">📋 원문 초록 (Abstract)</h2>
  <p style="margin:0 0 24px;line-height:1.8;font-style:italic;color:#374151;background:#f8f9ff;padding:16px 20px;border-radius:8px;">${summary}</p>

  <!-- AI 각주 -->
  <p style="margin:48px 0 0;padding-top:20px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">
    본 요약은 AI가 작성했습니다. 원문은 위의 링크에서 확인하세요.
  </p>

</body>
</html>`;
}

// Main
async function main() {
  console.log('📚 논문 1개 처리 시작\n');
  
  // 1. 먼저 01-sourced 확인 (요약 필요)
  const sourcedFiles = fs.readdirSync(SOURCED_DIR).filter(f => f.endsWith('.json'));
  
  if (sourcedFiles.length > 0) {
    // 요약 단계
    const filename = sourcedFiles[0]; // 첫 번째만
    const sourcePath = path.join(SOURCED_DIR, filename);
    const paper = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    
    console.log(`📝 요약 중: ${paper.arxiv_id}`);
    console.log(`   제목: ${paper.title.slice(0, 60)}...`);
    
    try {
      const summary = await summarizePaper(paper);
      
      const summarizedData = {
        ...paper,
        ...summary,
        stage: 'summarized',
        audit_log: [
          ...(paper.audit_log || []),
          { agent: 'paper-summarizer', action: 'summarized', timestamp: new Date().toISOString(), model: 'glm-4-plus' }
        ]
      };
      
      // Save to summarized
      fs.writeFileSync(path.join(SUMMARIZED_DIR, filename), JSON.stringify(summarizedData, null, 2));
      
      // Delete from sourced
      fs.unlinkSync(sourcePath);
      
      console.log(`   ✅ 요약 완료 → 02-summarized\n`);
    } catch (error) {
      console.error(`   ❌ 요약 실패: ${error.message}\n`);
      fs.writeFileSync(path.join(REJECTED_DIR, filename), JSON.stringify({
        ...paper,
        stage: 'rejected',
        error: error.message
      }, null, 2));
      fs.unlinkSync(sourcePath);
    }
    return;
  }
  
  // 2. 02-summarized 확인 (발행 필요)
  const summarizedFiles = fs.readdirSync(SUMMARIZED_DIR).filter(f => f.endsWith('.json'));
  
  if (summarizedFiles.length > 0) {
    // 발행 단계
    const filename = summarizedFiles[0]; // 첫 번째만
    const summarizedPath = path.join(SUMMARIZED_DIR, filename);
    const paper = JSON.parse(fs.readFileSync(summarizedPath, 'utf8'));
    
    console.log(`🚀 발행 중: ${paper.arxiv_id}`);
    console.log(`   제목: ${paper.korean_title?.slice(0, 60) || paper.title.slice(0, 60)}...`);
    
    try {
      const html = generatePaperHtml(paper);
      
      // Ghost 발행
      const result = await ghostRequest('POST', '/ghost/api/admin/posts/?source=html', {
        posts: [{
          title: `[논문] ${paper.korean_title}`,
          html: html,
          status: 'published',
          tags: [{ id: '69ab5986ff4fbf0001ab711d' }, { id: '69ad581eff4fbf0001ab74d6' }],  // ai-papers + arxiv (ID 고정)
          meta_title: `${paper.korean_title} | AI 교육 논문`,
          meta_description: paper.korean_summary.slice(0, 150),
          feature_image_alt: 'AI 교육 논문'
        }]
      });
      
      const postId = result.posts?.[0]?.id;
      const slug = result.posts?.[0]?.slug;
      const publicUrl = `https://ubion.ghost.io/${slug}/`;
      
      // Save to published
      const publishedData = {
        ...paper,
        stage: 'published',
        html,
        publish_result: {
          ghost_post_id: postId,
          public_url: publicUrl,
          status: 'published',
          published_at: new Date().toISOString()
        },
        audit_log: [
          ...(paper.audit_log || []),
          { agent: 'paper-publisher', action: 'published', timestamp: new Date().toISOString() }
        ]
      };
      
      fs.writeFileSync(path.join(PUBLISHED_DIR, filename), JSON.stringify(publishedData, null, 2));
      fs.unlinkSync(summarizedPath);
      
      console.log(`   ✅ 발행 완료!`);
      console.log(`   🔗 ${publicUrl}\n`);
    } catch (error) {
      console.error(`   ❌ 발행 실패: ${error.message}\n`);
      fs.writeFileSync(path.join(REJECTED_DIR, filename), JSON.stringify({
        ...paper,
        stage: 'rejected',
        error: error.message
      }, null, 2));
      fs.unlinkSync(summarizedPath);
    }
    return;
  }
  
  // 3. 처리할 논문 없음
  console.log('📭 처리할 논문이 없습니다.\n');
  console.log('   01-sourced:', sourcedFiles.length);
  console.log('   02-summarized:', summarizedFiles.length);
}

main().catch(console.error);
