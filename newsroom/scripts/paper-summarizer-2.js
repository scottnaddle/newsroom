const fs = require('fs');
const path = require('path');
const https = require('https');

const WORKSPACE = '/root/.openclaw/workspace/newsroom';
const SOURCED_DIR = path.join(WORKSPACE, 'paper-pipeline', '01-sourced');
const DRAFTED_DIR = path.join(WORKSPACE, 'paper-pipeline', '04-drafted');
const env = fs.readFileSync(path.join(WORKSPACE, '.env'), 'utf8');
const API_KEY = env.match(/DEEPSEEK_API_KEY=(.+)/)[1];

const CATEGORY_TAGS = {
  'cs.CY': '에듀테크', 'cs.HC': '에듀테크', 'cs.CL': '자연어처리',
  'cs.AI': 'AI연구', 'cs.LG': 'AI연구', 'cs.GR': 'AI연구',
};

function getTags(categories) {
  const tags = new Set(['ai-paper', '논문요약']);
  for (const cat of categories) if (CATEGORY_TAGS[cat]) tags.add(CATEGORY_TAGS[cat]);
  if (tags.size < 3) tags.add('AI연구');
  return Array.from(tags);
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50);
}

function callDeepSeek(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a Korean academic journalist. Write in native Korean, 3-4 paragraphs. Output ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7, max_tokens: 4096,
    });
    const opts = {
      hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d).choices?.[0]?.message?.content || ''); } catch(e) { reject(e); } });
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

async function processPaper(paper) {
  const src = paper.source;
  const p = paper.paper;
  const prompt = `You are writing an academic paper summary for Ghost CMS (Korean).

논문 정보:
- 제목: ${src.title}
- 저자: ${p.authors.slice(0, 3).join(', ')}
- arXiv ID: ${src.url.split('/').pop()}
- 카테고리: ${p.categories.join(', ')}
- 게시일: ${p.published}
- 초록: ${p.summary}

다음 JSON 형식으로 응답:
{
  "headline": "한국어 헤드라인 (30자 이내)",
  "html": "Ghost CMS 호환 HTML 전체 기사"
}

HTML 가이드라인:
1. <blockquote style="border-left:4px solid #7c3aed;background:#f5f3ff;padding:16px 20px;margin:0 0 24px 0;border-radius:4px;">로 리드 작성
2. 본문: 3~4개 <p>문단
3. <h2>소제목
4. 📖 <a href="${src.url}" target="_blank">arXiv 논문 원문 보기</a>
5. AI 각주: <p style="font-size:13px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:16px;margin-top:32px;">
6. NO h1, NO div wrappers, NO style tags
7. 전체 2,000~3,000자`;

  const response = await callDeepSeek(prompt);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  const draftData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  
  if (!draftData || !draftData.html || !draftData.headline) {
    throw new Error(`Invalid response: ${response.substring(0, 100)}`);
  }

  const tags = getTags(p.categories);
  const draft = {
    id: `paper-${Date.now()}-manual`,
    stage: 'drafted',
    source_type: 'academic',
    source: { title: src.title, url: src.url, source: 'arXiv' },
    region: 'global', regionName: '글로벌',
    draft: {
      headline: draftData.headline,
      html: draftData.html,
      slug: `arxiv-paper-${slugify(draftData.headline)}`,
      ghost_tags: tags,
      references: [{ title: src.title, url: src.url }],
      word_count: draftData.html.replace(/<[^>]+>/g, '').split(/\s+/).length,
      char_count: draftData.html.replace(/<[^>]+>/g, '').length,
    }
  };
  return draft;
}

async function main() {
  const files = fs.readdirSync(SOURCED_DIR).filter(f => f.endsWith('.json')).sort();
  
  // Process files 5 and 6 (index 4 and 5) only
  for (let i = 4; i < files.length; i++) {
    const fpath = path.join(SOURCED_DIR, files[i]);
    const paper = JSON.parse(fs.readFileSync(fpath, 'utf8'));
    console.log(`[${i+1}] ${paper.source.title.substring(0, 50)}`);
    
    const draft = await processPaper(paper);
    const outf = path.join(DRAFTED_DIR, `paper-${Date.now()}-${i}.json`);
    fs.writeFileSync(outf, JSON.stringify(draft, null, 2), 'utf8');
    console.log(`   ✅ "${draft.draft.headline}" (${draft.draft.ghost_tags.join(', ')})`);
    console.log(`   ${draft.draft.char_count}자, ${draft.draft.word_count}단어\n`);
  }

  const done = fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json')).length;
  console.log(`✅ 총 ${done}/6개 논문 요약 생성 완료`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
