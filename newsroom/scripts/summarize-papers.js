#!/usr/bin/env node

/**
 * AI 교육 논문 요약 에이전트 (GLM-5 API 사용)
 * 
 * arXiv 논문을 한국어로 요약하고 Ghost 발행 형식으로 변환합니다.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const WORKSPACE = '/root/.openclaw/workspace/newsroom';
const SOURCED_DIR = `${WORKSPACE}/pipeline/papers/01-sourced`;
const SUMMARIZED_DIR = `${WORKSPACE}/pipeline/papers/02-summarized`;
const REJECTED_DIR = `${WORKSPACE}/pipeline/papers/04-rejected`;

// Z.AI API (GLM-5)
const ZAI_API_KEY = process.env.ZAI_API_KEY || '95087f94d2dd4c6dacc1689483d3313a.ouEapRwsgNG0xAJ5';
const ZAI_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// Ensure directories
[SUMMARIZED_DIR, REJECTED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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
3. **핵심 발견 3가지**: (줄바꿈으로 구분된 3개의 핵심 발견)
4. **교육적 시사점**: (이 연구가 교육 현장에 주는 시사점 2-3문장)

각 섹션을 명확히 구분해서 작성해주세요.`;

  const response = await callGLM(prompt);
  
  // Parse response
  let koreanTitle = paper.title;
  let koreanSummary = '';
  let keyFindings = [];
  let implications = '';
  
  try {
    // 한국어 제목 추출
    const titleMatch = response.match(/\*\*한국어 제목\*\*[:\s]*(.+?)(?=\n|\*\*한국어 요약)/s);
    if (titleMatch) koreanTitle = titleMatch[1].trim();
    
    // 한국어 요약 추출
    const summaryMatch = response.match(/\*\*한국어 요약\*\*[:\s]*(.+?)(?=\n\*\*핵심 발견|\n3\.)/s);
    if (summaryMatch) koreanSummary = summaryMatch[1].trim();
    
    // 핵심 발견 추출
    const findingsMatch = response.match(/\*\*핵심 발견.*?\*\*[:\s]*(.+?)(?=\n\*\*교육적|\n4\.)/s);
    if (findingsMatch) {
      keyFindings = findingsMatch[1]
        .split(/\n/)
        .map(l => l.replace(/^[\d\.\-\*]+\s*/, '').trim())
        .filter(l => l.length > 10)
        .slice(0, 3);
    }
    
    // 교육적 시사점 추출
    const implMatch = response.match(/\*\*교육적 시사점\*\*[:\s]*(.+?)$/s);
    if (implMatch) implications = implMatch[1].trim();
    
    // Fallback if parsing failed
    if (!koreanSummary || keyFindings.length === 0) {
      console.log('  ⚠️ 파싱 실패, 기본값 사용');
      koreanSummary = response.slice(0, 500);
      keyFindings = ['이 논문은 AI 교육 분야의 새로운 접근법을 제시합니다.'];
      implications = '이 연구는 AI 기술의 교육 현장 도입에 있어 중요한 시사점을 제공합니다.';
    }
  } catch (e) {
    console.error('  ⚠️ 응답 파싱 오류:', e.message);
    koreanSummary = response.slice(0, 500);
    keyFindings = ['이 논문은 AI 교육 분야의 새로운 접근법을 제시합니다.'];
    implications = '이 연구는 AI 기술의 교육 현장 도입에 있어 중요한 시사점을 제공합니다.';
  }
  
  return {
    korean_title: koreanTitle,
    korean_summary: koreanSummary,
    key_findings: keyFindings,
    implications
  };
}

// HTML template for paper summary
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
  console.log('📝 AI 교육 논문 요약 에이전트 시작 (GLM-5)\n');
  
  const files = fs.readdirSync(SOURCED_DIR).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.log('처리할 논문이 없습니다.');
    process.exit(0);
  }
  
  console.log(`📄 ${files.length}개 논문 발견\n`);
  
  for (const filename of files) {
    const sourcePath = path.join(SOURCED_DIR, filename);
    const paper = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    
    console.log(`📝 요약 중: ${paper.arxiv_id}`);
    console.log(`   제목: ${paper.title.slice(0, 60)}...`);
    
    try {
      const summary = await summarizePaper(paper);
      
      // Prepare Ghost data
      const ghostData = {
        ...paper,
        ...summary,
        stage: 'summarized',
        ghost: {
          headline: `[논문] ${summary.korean_title}`,
          html: generatePaperHtml({ ...paper, ...summary }),
          ghost_tags: ['ai-papers', 'arxiv'],
          meta_title: `${summary.korean_title} | AI 교육 논문`,
          meta_description: summary.korean_summary.slice(0, 150),
          feature_image_alt: 'AI 교육 논문'
        },
        audit_log: [
          ...(paper.audit_log || []),
          {
            agent: 'paper-summarizer',
            action: 'summarized',
            timestamp: new Date().toISOString(),
            model: 'glm-4-plus'
          }
        ]
      };
      
      // Save to summarized directory
      const summarizedPath = path.join(SUMMARIZED_DIR, filename);
      fs.writeFileSync(summarizedPath, JSON.stringify(ghostData, null, 2));
      
      // Delete from sourced
      fs.unlinkSync(sourcePath);
      
      console.log(`   ✅ 요약 완료\n`);
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.error(`   ❌ 요약 실패: ${error.message}\n`);
      
      // Move to rejected
      const rejectedPath = path.join(REJECTED_DIR, filename);
      fs.writeFileSync(rejectedPath, JSON.stringify({
        ...paper,
        stage: 'rejected',
        error: error.message,
        audit_log: [
          ...(paper.audit_log || []),
          {
            agent: 'paper-summarizer',
            action: 'rejected',
            timestamp: new Date().toISOString(),
            reason: error.message
          }
        ]
      }, null, 2));
      fs.unlinkSync(sourcePath);
    }
  }
  
  console.log('📊 요약 완료!');
}

main().catch(console.error);
