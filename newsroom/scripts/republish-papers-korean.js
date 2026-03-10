#!/usr/bin/env node

/**
 * 이미 발행된 논문을 한국어로 재번역해서 Ghost에 업데이트
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Configuration
const WORKSPACE = '/root/.openclaw/workspace/newsroom';
const PUBLISHED_DIR = `${WORKSPACE}/pipeline/papers/03-published`;
const API_KEY = '69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625';
const GHOST_URL = 'https://ubion.ghost.io';
const ZAI_API_KEY = process.env.ZAI_API_KEY || '95087f94d2dd4c6dacc1689483d3313a.ouEapRwsgNG0xAJ5';

// JWT Token Generation
function generateJWT() {
  const [kid, secret] = API_KEY.split(':');
  const header = Buffer.from(JSON.stringify({
    alg: 'HS256',
    typ: 'JWT',
    kid
  })).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iat: now,
    exp: now + 300,
    aud: '/admin/'
  })).toString('base64url');

  const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'hex'));
  hmac.update(header + '.' + payload);
  const signature = hmac.digest('base64url');

  return header + '.' + payload + '.' + signature;
}

// Call GLM-5 API
async function callGLM(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'glm-4-plus',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000
    });
    
    const options = {
      hostname: 'open.bigmodel.cn',
      port: 443,
      path: '/api/paas/v4/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAI_API_KEY}`
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0]) {
            resolve(parsed.choices[0].message.content);
          } else {
            reject(new Error('Invalid response: ' + data));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Summarize paper with GLM-5
async function summarizePaper(paper) {
  console.log(`  🤖 GLM-5로 요약 중...`);
  
  const prompt = `다음은 AI 교육 관련 학술 논문의 정보입니다. 이를 한국어로 요약해주세요.

제목: ${paper.title}

초록 (Abstract):
${paper.summary}

저자: ${paper.authors.slice(0, 5).join(', ')}

다음 형식으로 답변해주세요:

1. **한국어 제목**: (제목을 자연스러운 한국어로 번역)
2. **한국어 요약**: (3-5문장으로 핵심 내용을 한국어로 요약)
3. **한국어 초록**: (원문 초록을 자연스러운 한국어로 완전히 번역)
4. **핵심 발견 3가지**: (줄바꿈으로 구분된 3개의 핵심 발견)
5. **교육적 시사점**: (이 연구가 교육 현장에 주는 시사점 2-3문장)

각 섹션을 명확히 구분해서 작성해주세요.`;

  const response = await callGLM(prompt);
  
  // Parse response
  let koreanTitle = paper.title;
  let koreanSummary = '';
  let koreanAbstract = '';
  let keyFindings = [];
  let implications = '';
  
  try {
    // 한국어 제목 추출
    const titleMatch = response.match(/(?:1\.)?\s*\*\*한국어 제목\*\*[:\s]*(.+?)(?=\n(?:2\.)?\s*\*\*한국어 요약)/s);
    if (titleMatch) koreanTitle = titleMatch[1].trim();
    
    // 한국어 요약 추출
    const summaryMatch = response.match(/(?:2\.)?\s*\*\*한국어 요약\*\*[:\s]*(.+?)(?=\n(?:3\.)?\s*\*\*한국어 초록)/s);
    if (summaryMatch) koreanSummary = summaryMatch[1].trim();
    
    // 한국어 초록 추출 (원문 번역)
    const abstractMatch = response.match(/(?:3\.)?\s*\*\*한국어 초록\*\*[:\s]*(.+?)(?=\n(?:4\.)?\s*\*\*핵심 발견)/s);
    if (abstractMatch) koreanAbstract = abstractMatch[1].trim();
    
    // 핵심 발견 추출
    const findingsMatch = response.match(/(?:4\.)?\s*\*\*핵심 발견.*?\*\*[:\s]*(.+?)(?=\n(?:5\.)?\s*\*\*교육적)/s);
    if (findingsMatch) {
      keyFindings = findingsMatch[1]
        .split(/\n/)
        .map(l => l.replace(/^[\d\.\-\*]+\s*/, '').trim())
        .filter(l => l.length > 10)
        .slice(0, 3);
    }
    
    // 교육적 시사점 추출
    const implMatch = response.match(/(?:5\.)?\s*\*\*교육적 시사점\*\*[:\s]*(.+?)$/s);
    if (implMatch) implications = implMatch[1].trim();
    
    // Fallback if parsing failed
    if (!koreanSummary || keyFindings.length === 0) {
      console.log('  ⚠️ 파싱 부분 실패, 기본값 사용');
      if (!koreanSummary) koreanSummary = response.slice(0, 500);
      if (!koreanAbstract) koreanAbstract = paper.summary;
      if (keyFindings.length === 0) keyFindings = ['이 논문은 AI 교육 분야의 새로운 접근법을 제시합니다.'];
      if (!implications) implications = '이 연구는 AI 기술의 교육 현장 도입에 있어 중요한 시사점을 제공합니다.';
    }
  } catch (e) {
    console.error('  ⚠️ 응답 파싱 오류:', e.message);
    koreanSummary = response.slice(0, 500);
    koreanAbstract = paper.summary;
    keyFindings = ['이 논문은 AI 교육 분야의 새로운 접근법을 제시합니다.'];
    implications = '이 연구는 AI 기술의 교육 현장 도입에 있어 중요한 시사점을 제공합니다.';
  }
  
  return {
    korean_title: koreanTitle,
    korean_summary: koreanSummary,
    korean_abstract: koreanAbstract,
    key_findings: keyFindings,
    implications
  };
}

// HTML template
function generatePaperHtml(paper) {
  const { title, summary, authors, published, arxiv_id, abs_url, pdf_url, korean_title, korean_summary, korean_abstract, key_findings, implications } = paper;
  
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

  <!-- 한국어 초록 (원문 번역) -->
  <h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:32px 0 20px;color:#1a1a2e;">📖 초록 (한국어 번역)</h2>
  <p style="margin:0 0 24px;line-height:1.9;background:#fefce8;padding:16px 20px;border-radius:8px;">${korean_abstract || summary}</p>

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

// Ghost API request
function ghostRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, GHOST_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Ghost ${generateJWT()}`,
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve({ raw: data });
          }
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Main
async function main() {
  console.log('🔄 논문 한국어 재번역 시작\n');
  
  const files = fs.readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.json'));
  
  console.log(`📄 ${files.length}개 논문 발견\n`);
  
  let success = 0;
  let failed = 0;
  
  for (const filename of files) {
    const filePath = path.join(PUBLISHED_DIR, filename);
    const paper = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    console.log(`📝 ${paper.arxiv_id}: ${paper.title.slice(0, 50)}...`);
    
    try {
      // 한국어 요약 생성
      const summary = await summarizePaper(paper);
      
      // HTML 생성
      const html = generatePaperHtml({ ...paper, ...summary });
      
      // Ghost에서 post ID 찾기
      const ghostPostId = paper.publish_result?.ghost_post_id;

      if (!ghostPostId) {
        console.log(`   ⚠️ Ghost post ID 없음, 스킵\n`);
        continue;
      }

      // 먼저 최신 포스트 정보 가져오기 (updated_at 충돌 방지)
      const postInfo = await ghostRequest('GET', `/ghost/api/admin/posts/${ghostPostId}/`);
      const currentUpdatedAt = postInfo.posts?.[0]?.updated_at;

      if (!currentUpdatedAt) {
        console.log(`   ⚠️ Ghost 포스트 조회 실패, 스킵\n`);
        continue;
      }

      // Ghost 업데이트
      await ghostRequest('PUT', `/ghost/api/admin/posts/${ghostPostId}/?source=html`, {
        posts: [{
          id: ghostPostId,
          title: `[논문] ${summary.korean_title}`,
          html: html,
          updated_at: currentUpdatedAt,
          meta_title: `${summary.korean_title} | AI 교육 논문`,
          meta_description: summary.korean_summary.slice(0, 150)
        }]
      });
      
      // 로컬 파일 업데이트
      paper.korean_title = summary.korean_title;
      paper.korean_summary = summary.korean_summary;
      paper.key_findings = summary.key_findings;
      paper.implications = summary.implications;
      paper.html = html;
      fs.writeFileSync(filePath, JSON.stringify(paper, null, 2));
      
      console.log(`   ✅ 업데이트 완료\n`);
      success++;
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 3000));
    } catch (error) {
      console.error(`   ❌ 실패: ${error.message}\n`);
      failed++;
    }
  }
  
  console.log('📊 완료!');
  console.log(`   성공: ${success}`);
  console.log(`   실패: ${failed}`);
}

main().catch(console.error);
