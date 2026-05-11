const fs = require('fs');
const path = require('path');
const https = require('https');

const WORKSPACE = '/root/.openclaw/workspace/newsroom';
const SOURCED_DIR = path.join(WORKSPACE, 'paper-pipeline', '01-sourced');
const DRAFTED_DIR = path.join(WORKSPACE, 'paper-pipeline', '04-drafted');
const env = fs.readFileSync(path.join(WORKSPACE, '.env'), 'utf8');
const API_KEY = env.match(/DEEPSEEK_API_KEY=(.+)/)[1];
const DEEPSEEK_BASE_URL = (env.match(/DEEPSEEK_BASE_URL=(.+)/) || [])[1] || 'https://api.deepseek.com/v1';
const API_URL = `${DEEPSEEK_BASE_URL}/chat/completions`;

// Category → Korean tag mapping
const CATEGORY_TAGS = {
  'cs.CY': '에듀테크',
  'cs.HC': '에듀테크',
  'cs.CL': '자연어처리',
  'cs.AI': 'AI연구',
  'cs.LG': 'AI연구',
  'cs.GR': 'AI연구',
};

function getTags(categories) {
  const tags = new Set(['ai-paper', '논문요약']);
  for (const cat of categories) {
    const t = CATEGORY_TAGS[cat];
    if (t) tags.add(t);
  }
  if (tags.size < 3) tags.add('AI연구');
  return Array.from(tags);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

function callDeepSeek(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a Korean academic journalist writing educational AI paper summaries for Ghost CMS. Write in native Korean, accessible tone, 3-4 short paragraphs (each 300-500 chars). Output ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    const opts = {
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(d);
          const content = r.choices?.[0]?.message?.content || '';
          resolve(content);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Prompt template for paper summary
function buildPrompt(paper) {
  const src = paper.source;
  const p = paper.paper;
  const arxivId = src.url.split('/').pop().replace('v1','').replace('v2','');
  return `You are writing a paper summary for a general Korean audience (Ghost CMS blog). 

IMPORTANT: Write like a journalist explaining a research paper to someone who has NEVER studied this field. Use SHORT sentences, SIMPLE words, and EXPLAIN every technical term in everyday language.

논문 정보:
- 제목: ${src.title}
- 저자: ${p.authors.slice(0, 3).join(', ')}
- arXiv ID: ${arxivId}
- 게시일: ${p.published}
- 연구 내용: ${p.summary}

다음 JSON 형식으로 응답하세요 (반드시 유효한 JSON):
{
  "headline": "30자 이내, 일반인이 궁금해할 만한 한국어 헤드라인",
  "html": "Ghost CMS 호환 HTML 전체 기사"
}

HTML 작성 가이드라인 (반드시 준수):

### ✍️ 핵심 원칙: "동네 카페에서 친구에게 설명한다고 생각하세요"
- 전문 용어를 쓰면 반드시 괄호로 쉽게 풀어서 설명 (예: "모델의 출력을 조정" → "AI가 내놓는 답을 원하는 방향으로 바꾸는 기술")
- 짧은 문장 (> 50자 금지)
- 학술 논문의 '연구 방법'은 1~2줄로 간략히, 발견한 사실과 그 의미를 중심으로
- "이 연구는 ~을 시사한다" 같은 추상적 표현 대신 "이 연구가 의미하는 바는..."

### 📐 구조
1. <blockquote>리드 문단: "아직 모르는 분들을 위해 쉽게 설명하면..." 느낌의 한두 문장
2. <p>본문 4~5문단: 
   - 첫 문단: 연구가 왜 중요한지, 어떤 문제를 해결하려 했는지 (일상 언어로)
   - 중간 문단: 연구진이 발견한 것, 그게 왜 의미 있는지 (전문 용어는 반드시 설명)
   - 마지막 문단: 이 연구가 우리 일상생활이나 교육에 어떤 영향을 줄 수 있는지
3. <h2>소제목 1~2개로 내용 구분
4. 마무리: <p>📖 <strong>원문 보기:</strong> <a href="${src.url}" target="_blank" rel="noopener noreferrer">arXiv 원문</a></p>
5. 각주: <p>본 요약은 AI로 작성되었습니다. arXiv 논문을 바탕으로 재구성되었습니다.</p>

### ⛔ 금지
- h1, div, style 속성 사용 금지
- "~에 따르면", "~이 보고했다" 같은 간접 인용 피하기
- "본 연구는", "해당 논문은" 같은 딱딱한 표현 금지
- 3음절 이상 한자어를 연속으로 쓰지 않기 (예: "매개변수 최적화를 통한 성능 개선" → 금지)
- 기술 용어 영어 원문 병기하지 않기 (괄호 영문 표기 금지)

### ✅ 전체 길이
- 순수 한글 텍스트 1,500~2,000자
- 초등학교 고학년도 이해할 수 있는 수준`;
}

async function main() {
  console.log('📚 논문 LLM 요약 생성 시작...\n');
  
  const files = fs.readdirSync(SOURCED_DIR).filter(f => f.endsWith('.json')).sort();
  console.log(`📄 ${files.length}개 논문 파일 발견\n`);

  fs.mkdirSync(DRAFTED_DIR, { recursive: true });

  for (let i = 0; i < files.length; i++) {
    const fname = files[i];
    const fpath = path.join(SOURCED_DIR, fname);
    const paper = JSON.parse(fs.readFileSync(fpath, 'utf8'));
    
    const title = paper.source.title.substring(0, 60);
    console.log(`[${i + 1}/${files.length}] ${title}`);
    
    // Call DeepSeek
    console.log(`   🤖 DeepSeek API 호출 중...`);
    const response = await callDeepSeek(buildPrompt(paper));
    
    // Parse JSON from response
    let draftData;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      draftData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.log(`   ❌ JSON 파싱 실패: ${e.message}`);
      console.log(`   응답 미리보기: ${response.substring(0, 200)}`);
      continue;
    }
    
    if (!draftData || !draftData.html || !draftData.headline) {
      console.log(`   ❌ 응답에 headline 또는 html 없음`);
      continue;
    }
    
    const tags = getTags(paper.paper.categories);
    const headline = draftData.headline;
    const html = draftData.html;
    
    // Create draft output
    const draft = {
      id: `paper-${Date.now()}-${i}`,
      stage: 'drafted',
      source_type: 'academic',
      source: {
        title: paper.source.title,
        url: paper.source.url,
        source: 'arXiv',
      },
      region: 'global',
      regionName: '글로벌',
      draft: {
        headline: headline,
        html: html,
        slug: `arxiv-paper-${slugify(headline)}`,
        ghost_tags: tags,
        references: [{ title: paper.source.title, url: paper.source.url }],
        word_count: html.replace(/<[^>]+>/g, '').split(/\s+/).length,
        char_count: html.replace(/<[^>]+>/g, '').length,
      }
    };
    
    const outf = path.join(DRAFTED_DIR, `paper-${Date.now()}-${i}.json`);
    fs.writeFileSync(outf, JSON.stringify(draft, null, 2), 'utf8');
    
    console.log(`   ✅ "${headline}" (${tags.join(', ')})`);
    console.log(`   📐 ${draft.draft.char_count}자, ${draft.draft.word_count}단어\n`);
  }

  console.log(`✅ STEP 2 완료: ${fs.readdirSync(DRAFTED_DIR).filter(f => f.endsWith('.json')).length}개 논문 요약 생성 → paper-pipeline/04-drafted/`);
}

main().catch(console.error);
