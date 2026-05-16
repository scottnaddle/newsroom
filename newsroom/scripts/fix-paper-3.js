const fs = require('fs');
const path = require('path');
const https = require('https');

const WORKSPACE = '/root/.openclaw/workspace/newsroom';
const SOURCED_DIR = path.join(WORKSPACE, 'paper-pipeline', '01-sourced');
const DRAFTED_DIR = path.join(WORKSPACE, 'paper-pipeline', '04-drafted');
const env = fs.readFileSync(path.join(WORKSPACE, '.env'), 'utf8');
const API_KEY = env.match(/DEEPSEEK_API_KEY=(.+)/)[1];

function callDeepSeek(messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.7, max_tokens: 4096 });
    const opts = {
      hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

async function main() {
  // Read paper #3 (index 2) from sourced
  const files = fs.readdirSync(SOURCED_DIR).filter(f => f.endsWith('.json')).sort();
  const fpath = path.join(SOURCED_DIR, files[2]);
  const paper = JSON.parse(fs.readFileSync(fpath, 'utf8'));
  
  const src = paper.source;
  const p = paper.paper;
  const url = src.url;
  
  console.log(`📄 Regenerating: ${src.title.substring(0, 50)}`);
  console.log(`   URL: ${url}\n`);
  
  const messages = [
    { role: 'system', content: 'You are a Korean academic journalist. Write in native Korean. Output ONLY valid JSON. No markdown code blocks.' },
    { role: 'user', content: `Write a Korean summary for this academic paper.

Paper:
Title: ${src.title}
Authors: ${p.authors.slice(0, 3).join(', ')}
arXiv: ${url.split('/').pop()}
Categories: ${p.categories.join(', ')}
Date: ${p.published}
Abstract: ${p.summary}

Respond with ONLY this JSON:
{
  "headline": "한국어 헤드라인 (30자 이내)",
  "html": "Full HTML article"
}

HTML structure:
- <blockquote> with engaging hook sentence
- 4~5 paragraphs (<p>), each 400~600 chars, **total 2,000+ chars required**
- <h2> 소제목 1~2개 (연구 배경, 핵심 발견, 시사점)
- <p>📖 <strong>원문 보기:</strong> <a href="${url}">논문 제목</a>
- <p>본 요약은 AI로 작성되었습니다 (AI 기본법 제31조). arXiv 논문의 내용을 바탕으로 재구성되었습니다.
- NO h1, NO div, NO style attributes, NO markdown syntax
- MUST be at least 2,000 Korean characters of content` }
  ];
  
  const response = await callDeepSeek(messages);
  const content = response.choices?.[0]?.message?.content || '';
  
  // Extract JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  let data;
  try {
    data = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch(e) {
    console.log(`❌ JSON parse failed: ${e.message}`);
    console.log(`Response: ${content.substring(0, 300)}`);
    return;
  }
  
  if (!data || !data.html || !data.headline || data.html.length < 500) {
    console.log(`❌ Invalid response (${data?.html?.length || 0} chars)`);
    console.log(`HTML: ${data?.html?.substring(0, 200)}`);
    return;
  }
  
  const tags = ['ai-paper', '논문요약', '에듀테크', 'AI연구'];
  
  const draft = {
    id: `paper-${Date.now()}-2`,
    stage: 'drafted',
    source_type: 'academic',
    source: { title: src.title, url: src.url, source: 'arXiv' },
    region: 'global', regionName: '글로벌',
    draft: {
      headline: data.headline,
      html: data.html,
      slug: `arxiv-paper-wildfire-risk`,
      ghost_tags: tags,
      references: [{ title: src.title, url: src.url }],
      word_count: data.html.replace(/<[^>]+>/g, '').split(/\s+/).length,
      char_count: data.html.replace(/<[^>]+>/g, '').length,
    }
  };
  
  // Delete old #3
  const oldFiles = fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json'));
  for (const f of oldFiles) {
    const d = JSON.parse(fs.readFileSync(path.join(DRAFTED_DIR, f), 'utf8'));
    if (d.source?.url === src.url || d.draft?.headline?.includes('산불')) {
      fs.unlinkSync(path.join(DRAFTED_DIR, f));
      console.log(`   🗑️ Removed old: ${f}`);
    }
  }
  
  const outf = path.join(DRAFTED_DIR, `paper-${Date.now()}-2.json`);
  fs.writeFileSync(outf, JSON.stringify(draft, null, 2), 'utf8');
  console.log(`   ✅ "${data.headline}" (${draft.draft.char_count}자)`);
  console.log(`   ✅ Saved to 04-drafted/`);
}

main().catch(e => console.error('❌', e.message));
