const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

// Create directories if needed
['pipeline/04-drafted', 'pipeline/memory'].forEach(dir => {
 if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Read from 03-reported/
const reportFiles = fs.readdirSync('pipeline/03-reported/').filter(f => f.endsWith('.json'));
console.log(`Found ${reportFiles.length} reports in 03-reported/`);

// Helpers
const str = (val, fallback = '') => {
 if (!val) return fallback;
 if (Array.isArray(val)) return val.join(' ');
 if (typeof val === 'string') return val;
 return String(val);
};

const sanitizeKorean = (text) => {
 if (!text) return '';
 return text
 .replace(/[\u3040-\u30ff]/g, '')
 .replace(/[\u4e00-\u9fff]/g, '')
 .replace(/[「『』」・、。]/g, '')
 .replace(/\s+/g, ' ')
 .trim();
};

const isKorean = (text) => {
 if (!text) return false;
 const koreanChars = (text.match(/[가-힣]/g) || []).length;
 return koreanChars > text.replace(/\s/g, '').length * 0.3;
};

const truncate = (h) => {
 if (h.length <= 30) return h;
 return h.substring(0, 28).replace(/[가-힣a-z0-9]$/, '') + '…';
};

const regionLabels = {
  usa: '미국', europe: '유럽', china: '중국', estonia: '에스토니아',
  singapore: '싱가포르', japan: '일본', finland: '핀란드', india: '인도', korea: '한국'
};

// Domain → Korean source name mapping
const sourceNameMap = {
  'asiae.co.kr': '아시아경제',
  'aiforeducation.io': 'AI for Education',
  'link.springer.com': 'Springer Nature',
  'en.clickpetroleoegas.com.br': 'Click Petróleo e Gás',
  'digitaljournal.com': 'Digital Journal',
  'e.vnexpress.net': 'VNExpress',
  'post-gazette.com': 'Pittsburgh Post-Gazette',
  'eurashe.eu': 'EURASHE',
  'manilatimes.net': 'Manila Times',
  'irishtimes.com': 'Irish Times',
  'sisadays.co.kr': '시사데이즈',
  'korea.kr': '한국 정부',
  'koreaherald.com': '코리아헤럴드',
  'koreatimes.co.kr': '코리아타임스',
  'mt.co.kr': '머니투데이',
  'dailyan.com': '데일리안',
  'kjob.news': 'KJob 뉴스',
  'ed.gov': '미국 교육부',
  'senate.gov': '미국 상원',
  'npr.org': 'NPR',
  'washingtonpost.com': 'Washington Post',
  'nytimes.com': 'New York Times',
  'edweek.org': 'Education Week',
  'edsurge.com': 'EdSurge',
  'insidehighered.com': 'Inside Higher Ed',
  'chronicle.com': 'Chronicle of Higher Education',
  'ec.europa.eu': '유럽연합 집행위',
  'euractiv.com': 'EURACTIV',
  'theguardian.com': '가디언',
  'bbc.com': 'BBC',
  'timeshighereducation.com': 'Times Higher Education',
  'pienews.net': 'PIE News',
  'scmp.com': '사우스차이나모닝포스트',
  'chinadaily.com.cn': '차이나데일리',
  'globaltimes.cn': '글로벌타임스',
  'xinhuanet.com': '신화통신',
  'err.ee': 'ERR',
  'estonianworld.com': 'Estonian World',
  'oecd.org': 'OECD',
  'moe.gov.sg': '싱가포르 교육부',
  'straitstimes.com': 'Straits Times',
  'channelnewsasia.com': 'Channel NewsAsia',
  'mext.go.jp': '일본 문부과학성',
  'japantimes.co.jp': '재팬타임스',
  'nhk.or.jp': 'NHK',
  'oph.fi': '핀란드 교육청',
  'helsinkitimes.fi': 'Helsinki Times',
  'goodnewsfinland.com': 'Good News Finland',
  'education.gov.in': '인도 교육부',
  'thehindu.com': 'The Hindu',
  'timesofindia.indiatimes.com': 'Times of India',
  'heartdayrest.com': '온쉼표저널',
  'aitimes.com': 'AI타임스',
  'huffpost.com': 'HuffPost',
  'europeanbusinessreview.com': 'European Business Review',
  'technologyreview.com': 'MIT Technology Review',
  'usnews.com': 'U.S. News',
  'oom.com.sg': 'OOM 싱가포르',
  'appleinsider.com': 'AppleInsider',
  'patch.com': 'Patch',
  'aiforeducation.io': 'AI for Education',
  'mk.co.kr': '매일경제',
  'fortune.com': 'Fortune',
  'globaleducationnews.org': 'Global Education News',
  'news.err.ee': 'ERR',
  'ajunews.com': '아주경제',
  'moneycompass.com.my': 'Money Compass',
  'ai.google': 'Google AI',
  'aischool.microsoft.com': 'Microsoft AI School',
  'learn.microsoft.com': 'Microsoft Learn',
  'openai.com': 'OpenAI',
  'blog.google': 'Google Blog',
  'about.google': 'Google',
  'industryjournal.co.kr': '산업종합저널',
  'edsource.org': 'EdSource',
  'emildai.eu': 'EMILDAI',
  'secondtalent.com': 'Second Talent',
  'chad.co.uk': 'Chad',
  'batamnewsasia.com': 'Batam News Asia',
  'e.vnexpress.net': 'VNExpress',
  'manilatimes.net': 'Manila Times',
  'post-gazette.com': 'Pittsburgh Post-Gazette',
  'irishtimes.com': 'Irish Times',
  'eurashe.eu': 'EURASHE',
  'sisadays.co.kr': '시사데이즈',
  'highereddive.com': 'Higher Ed Dive',
  'makersmuse.in': 'Makers Muse',
  'ellisinstitute.fi': 'ELLIS Institute',
  'en.vietnamplus.vn': 'VietnamPlus',
  'inews365.com': '충북일보',
'newyorker.com': 'New Yorker',
  'koreadaily.com': '미주중앙일보',
  'aijourn.com': 'AI Journal',
  'threads.com': 'Threads',
  'techaimag.com': 'TechAI Mag',
  'aframnews.com': 'Afram News',
'joongang.co.kr': '중앙일보',
  'myq105.com': 'MyQ105',
  'webdisclosure.com': 'Web Disclosure',
  'opportunitydesk.org': 'Opportunity Desk',
'gall.dcinside.com': '디시인사이드',
  'thecrimson.com': 'The Crimson',
  'edtechinnovationhub.com': 'EdTech Innovation Hub',
  'asahi.com': '아사히신문',
'hechingerreport.org': 'Hechinger Report',
  'imda.gov.sg': 'IMDA 싱가포르',
};

function getKoreanSourceName(domain) {
  if (!domain) return '관련 매체';
  const clean = domain.replace('www.', '').toLowerCase();
  return sourceNameMap[clean] || domain;
}

// ✅ Rewritten: Article-centered Korean headline using ORIGINAL article title
function generateKoreanHeadline(source, brief, regionInfo) {
  const srcTitle = (source.title || '').trim();
  const srcName = brief.SOURCE || getKoreanSourceName(source.source) || '';
  const srcNameRaw = brief.SOURCE_NAME_RAW || source.source || '';
  const label = regionInfo.label || '글로벌';

  // Clean original title: remove [Category], everything after |, URLs
  let cleanTitle = srcTitle
    .replace(/\[.*?\]\s*/g, '')
    .replace(/\s*\|.*$/, '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .trim();

  // Strategy 1: Use source name + key topic from ORIGINAL article title
  if (cleanTitle && cleanTitle.length > 5) {
    const koreanCount = (cleanTitle.match(/[가-힣]/g) || []).length;
    
    if (koreanCount > 3) {
      // Korean original title - use source name + first meaningful chunk
      const topic = cleanTitle.length > 18 ? cleanTitle.substring(0, 18) : cleanTitle;
      return truncate(`${srcName} ${topic}`);
    }

    // English original title - extract key meaningful words
    const stopWords = new Set(['that','this','with','from','have','been','will','their','what','about','could','would','should','into','over','such','than','also','after','then','just','more','most','some','these','those','very','well','here','there','your','they','them','its','a','an','the','and','or','for','not','but','can','has','had','its','new','how','why','who','all','are','was','did','get','got','may','per','via','too','two']);
    const words = cleanTitle.split(/\s+/).filter(w => {
      const lower = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      return lower.length > 2 && !stopWords.has(lower);
    });

    if (words.length >= 2) {
      return truncate(`${srcName} ${words.slice(0, 2).join(' ')}`);
    }
    if (words.length === 1) {
      return truncate(`${srcName} ${words[0]}`);
    }
    // No meaningful keywords - use first fragment before separator
    const firstFrag = cleanTitle.split(/[-–—|:;,]/)[0].trim();
    const fragWords = firstFrag.split(/\s+/).filter(w => w.length > 2).slice(0, 3);
    if (fragWords.length >= 2) {
      return truncate(`${srcName} ${fragWords.slice(0, 2).join(' ')}`);
    }
    return truncate(`${srcName} AI 교육 소식`);
  }

  // Strategy 2: Use TITLE_KO from brief (but WITHOUT region prefix)
  const titleKo = str(brief.TITLE_KO);
  if (titleKo && titleKo.length > 3 && /[가-힣]/.test(titleKo)) {
    const cleanKo = titleKo.replace(new RegExp('^' + label + '\\s*'), '');
    if (srcName && srcName.length > 2 && srcName !== srcNameRaw) {
      return truncate(`${srcName} ${cleanKo.substring(0, 18)}`);
    }
    return truncate(cleanKo);
  }

  // Strategy 3: Use source raw domain as last resort - make readable
  if (srcNameRaw && srcNameRaw.length > 2) {
    const cleanSrc = srcNameRaw.replace('www.', '').replace('.com', '').replace('.co.kr', '').replace('.kr', '').replace('.io', '').replace('.br', '').replace('.net', '');
    const disp = cleanSrc.charAt(0).toUpperCase() + cleanSrc.slice(1).substring(0, 12);
    return truncate(`${disp} AI 교육 소식`);
  }

  // 4. Ultimate fallback (never use region label alone)
  return truncate(`${label} AI 교육 관련 소식`);
}

// ✅ Rewritten: Extract usable sentences from raw HTML content for ANY language
function extractUsableContent(content, maxSentences = 12) {
  if (!content || content.length < 80) return { korean: [], english: [] };

  // Split into sentences
  const allSentences = content.split(/[.!?。]\\s+/)
    .filter(s => {
      const clean = s.trim();
      return clean.length > 25 && clean.length < 400;
    })
    .map(s => sanitizeKorean(s.trim()))
    .filter(s => s && s.length > 20);

  // Separate Korean and English sentences
  const korean = [];
  const english = [];
  
  for (const s of allSentences) {
    const koreanRatio = (s.match(/[가-힣]/g) || []).length / Math.max(s.length, 1);
    if (koreanRatio > 0.25) {
      korean.push(s);
    } else {
      // Check it's actually English (has mostly Latin chars)
      const englishRatio = (s.match(/[a-zA-Z]/g) || []).length / Math.max(s.length, 1);
      if (englishRatio > 0.5 && (s.match(/[가-힣]/g) || []).length < 5) {
        english.push(s);
      }
    }
  }

  return {
    korean: korean.slice(0, maxSentences),
    english: english.slice(0, maxSentences)
  };
}

// 🤖 LLM 기반 기사 생성: DeepSeek API 호출
function callDeepSeek(messages) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.DEEPSEEK_API_KEY || 
      require('fs').readFileSync('.env', 'utf8').match(/DEEPSEEK_API_KEY=(.+)/)?.[1]?.trim() || '';
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
    
    if (!apiKey) {
      console.error('  ❌ DEEPSEEK_API_KEY not found in .env');
      resolve(null);
      return;
    }
    
    const body = JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.7,
      max_tokens: 4096
    });
    
    const options = {
      hostname: new URL(baseUrl).hostname,
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          const content = data?.choices?.[0]?.message?.content;
          if (content) resolve(content);
          else {
            console.error(`  ⚠️ DeepSeek empty response: ${JSON.stringify(data).substring(0, 200)}`);
            resolve(null);
          }
        } catch (e) {
          console.error(`  ⚠️ DeepSeek parse error: ${e.message}`);
          resolve(null);
        }
      });
    });
    req.on('error', e => { console.error(`  ⚠️ DeepSeek request error: ${e.message}`); resolve(null); });
    req.setTimeout(60000, () => { req.destroy(); resolve(null); });
    req.write(body);
  });
}

// 🤖 LLM으로 기사 생성
async function generateWithLLM(source, originalContent, regionInfo, brief) {
  const label = regionInfo.label || '글로벌';
  const srcName = brief?.SOURCE || getKoreanSourceName(source.source) || '관련 매체';
  const title = source.title || '';
  const url = source.url || '';
  const description = source.description || '';
  const srcDate = brief?.SOURCE_DATE || source.date || '최근';
  
  // 원문 내용 요약 (토큰 절약)
  const contentPreview = originalContent ? originalContent.substring(0, 4000) : '';
  const descPreview = description ? description.substring(0, 500) : '';
  
  const prompt = `당신은 한국어 에듀테크(AI+교육) 전문 저널리스트입니다. 다음 원문 자료를 바탕으로 2,500~3,000자 분량의 한국어 분석 기사를 작성해주세요.

## 원문 정보
- 제목: ${title}
- 출처: ${srcName} (${url})
- 요약: ${descPreview}
- 지역: ${label}

## 원문 본문
${contentPreview}

## 작성 규칙
1. **2,500~3,000자** 분량의 완성도 높은 기사로 작성
2. 다음 구조로 작성:
   - **도입부**: 독자의 흥미를 끄는 리드(Lead) - 3~4문장
   - **본문 1**: 기사의 핵심 내용과 주요 사실 전달
   - **본문 2**: 추가 맥락, 데이터, 전문가 의견 등 깊이 있는 분석
   - **시사점**: 이 기사가 에듀테크 업계에 주는 의미와 향후 전망
3. 객관적이고 사실에 기반한 저널리즘 스타일
4. 한국어 자연스러운 문장 (번역체/직역체 피할 것)
5. HTML 태그 없이 순수 텍스트로 작성
6. **절대** 원문을 단순 번역/요약하지 말 것. 자체 분석과 해설을 추가할 것
7. "~했다" 체의 평서문 사용 (~입니다 체 사용 금지)

## 출력 형식
[제목]
한 줄 띄움
[도입부 문단]
한 줄 띄움
[본문 문단들...]
한 줄 띄움
[시사점 문단]`;

  console.log(`  🤖 DeepSeek API 호출 중...`);
  const llmContent = await callDeepSeek([
    { role: 'system', content: 'You are a Korean education technology journalist. Write articles in Korean with depth and analysis.' },
    { role: 'user', content: prompt }
  ]);
  
  if (!llmContent) {
    console.log(`  ⚠️ LLM 실패, 기존 템플릿 방식으로 폴백`);
    return null;
  }
  
  console.log(`  ✅ LLM 응답 수신: ${llmContent.length}자`);
  
  // LLM 응답 파싱: 첫 줄 = 제목, 나머지 = 본문
  const lines = llmContent.trim().split('\n');
  let llmHeadline = lines[0].replace(/^#+\s*/, '').replace(/^\[제목\]\s*/i, '').trim();
  let llmBody = lines.slice(1).join('\n').trim();
  
  // 제목이 너무 길면 앞 50자로 제한
  if (llmHeadline.length > 80) llmHeadline = llmHeadline.substring(0, 77) + '...';
  
  // 본문을 HTML 문단으로 변환 (마크다운 h2 처리)
  const paragraphs = llmBody.split(/\n\n+/).filter(p => p.trim().length > 5);
  const bodyHTML = paragraphs.map(p => {
    const trimmed = p.trim();
    // 마크다운 h2 → HTML h2
    if (/^##\s/.test(trimmed) || /^###\s/.test(trimmed)) {
      const level = trimmed.startsWith('###') ? 'h3' : 'h2';
      const text = trimmed.replace(/^#+\s*/, '');
      return `<${level}>${text}</${level}>`;
    }
    // 일반 문단
    return `<p>${trimmed}</p>`;
  }).join('\n');
  
  // Blockquote lead 형식의 HTML 생성
  const leadHTML = `<blockquote style="border-left:4px solid #0891b2;padding:16px 20px;background:#f8f9ff;margin:0 0 24px 0;border-radius:0 4px 4px 0;font-style:normal;">
  <p style="font-size:13px;color:#0891b2;font-weight:600;margin:0 0 4px 0;">${srcName} 보도${srcDate !== '최근' ? ` | ${srcDate}` : ''}</p>
  <p style="font-size:17px;color:#1a1a2e;line-height:1.6;margin:0;"><strong>${llmHeadline}</strong></p>
</blockquote>`;
  
  return {
    headline: llmHeadline,
    bodyHTML: leadHTML + '\n' + bodyHTML,
    generatedAt: new Date().toISOString()
  };
}

// ✅ Update: Simplified tag building with correct region logic

// ✅ Update: Simplified tag building with correct region logic
function buildGhostTags(region) {
  const tags = ['ai-edu'];

  // 국내/해외 대분류
  if (region === 'korea') {
    tags.push('국내');
  } else {
    tags.push('해외');
  }

  // 지역 태그
  const regionTagMap = {
    'usa': '미국', 'europe': '유럽', 'china': '중국',
    'japan': '일본', 'estonia': '에스토니아', 'singapore': '싱가포르',
    'finland': '핀란드', 'india': '인도'
  };
  if (regionTagMap[region]) tags.push(regionTagMap[region]);

  return tags;
}

// Determine article category based on region
function getCategory(region) {
 const map = {
   'korea': { category: 'policy', label: '한국' },
   'usa': { category: 'industry', label: '미국' },
   'europe': { category: 'policy', label: '유럽' },
   'china': { category: 'research', label: '중국' },
   'estonia': { category: 'education', label: '에스토니아' },
   'singapore': { category: 'education', label: '싱가포르' },
   'japan': { category: 'policy', label: '일본' },
   'finland': { category: 'education', label: '핀란드' },
   'india': { category: 'industry', label: '인도' },
   'social': { category: 'opinion', label: 'SNS' }
 };
 return map[region] || { category: 'education', label: '글로벌' };
}

// Fetch article content from URL
function fetchArticleContent(url) {
 return new Promise((resolve) => {
   if (!url || url === '#') { resolve(''); return; }
   
   try {
     const parsed = new URL(url);
     const options = {
       hostname: parsed.hostname,
       path: parsed.pathname + parsed.search,
       headers: {
         'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
         'Accept': 'text/html,text/plain',
         'Accept-Encoding': 'identity'  // Avoid gzip issues
       }
     };
     
     const req = https.get(options, (res) => {
       if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
         fetchArticleContent(res.headers.location).then(resolve);
         return;
       }
       const chunks = [];
       res.on('data', c => chunks.push(c));
       res.on('end', () => {
         try {
           const buffer = Buffer.concat(chunks);
           let body = buffer.toString('utf8');
           body = body.replace(/<script[\s\S]*?<\/script>/gi, '');
           body = body.replace(/<style[\s\S]*?<\/style>/gi, '');
           body = body.replace(/<nav[\s\S]*?<\/nav>/gi, '');
           body = body.replace(/<footer[\s\S]*?<\/footer>/gi, '');
           body = body.replace(/<header[\s\S]*?<\/header>/gi, '');
           body = body.replace(/<[^>]+>/g, ' ');
           body = body.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
           body = body.replace(/\s+/g, ' ').trim();
           resolve(body.substring(0, 5000));
         } catch (e) { resolve(''); }
       });
     });
     req.setTimeout(10000, () => { req.destroy(); resolve(''); });
     req.on('error', () => resolve(''));
   } catch (e) { resolve(''); }
 });
}

// ✅ Updated: Generate news-intro style HTML
function generateArticleHTML(data) {
 const { headline, region, regionLabel, sections, references, ghostTags, srcName, srcDate } = data;

 const accentColors = {
   'policy': '#4338ca', 'research': '#059669', 'industry': '#d97706',
   'opinion': '#7c3aed', 'data': '#0284c7', 'education': '#0891b2'
 };
 const color = accentColors[data.accent] || '#0891b2';
 const date = new Date().toISOString().split('T')[0];

 // Convert English date to Korean
 const dateText = srcDate !== '최근' ? srcDate
   .replace(/^(\d+)\s*hours?\s*ago$/, '$1시간 전')
   .replace(/^(\d+)\s*hour?\s*ago$/, '$1시간 전')
   .replace(/^(\d+)\s*days?\s*ago$/, '$1일 전')
   .replace(/^(\d+)\s*weeks?\s*ago$/, '$1주 전')
   .replace(/^(\d+)\s*months?\s*ago$/, '$1개월 전') : '최근';

 // Build tag pills
 const tagPills = (ghostTags || []).filter(t => t !== 'ai-edu').map(t => 
   `<span style="display:inline-block;background:${color}15;color:${color};font-size:12px;padding:2px 10px;border-radius:12px;margin-right:6px;">${t}</span>`
 ).join('');

 const referencesHTML = references.map(ref =>
   `<li><a href="${ref.url}" target="_blank" rel="noopener noreferrer">${ref.title}</a></li>`
 ).join('\n');

const sectionsHTML = sections.map(s => {
  let html = '';
  if (s.title) html = `<h2>${s.title}</h2>`;
  if (s.paragraphs) {
    for (const p of s.paragraphs) {
      html += `\n<p>${p}</p>`;
    }
  }
  if (s.quote) {
    html += `\n<blockquote>${s.quote}</blockquote>`;
  }
  return html;
}).join('\n');

 return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${headline}</title>
<style>
body { font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; }
.wrapper { max-width: 680px; margin: 0 auto; font-size: 17px; line-height: 1.9; color: #1a1a2e; }
.lead-box { border-left: 4px solid ${color}; background: #f8f9ff; padding: 18px 22px; border-radius: 0 8px 8px 0; margin-bottom: 32px; }
.date-line { font-size: 14px; color: #64748b; margin-bottom: 12px; }
.source-line { font-size: 15px; color: ${color}; font-weight: 600; margin-bottom: 6px; }
h2 { font-size: 19px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin: 36px 0 18px 0; }
p { margin: 0 0 22px 0; text-align: justify; }
blockquote { border-left: 4px solid ${color}; background: #f8f9ff; padding: 16px 20px; font-style: italic; color: #374151; margin: 28px 0; border-radius: 0 4px 4px 0; }
.references { border-top: 1px solid #e2e8f0; margin-top: 40px; padding-top: 28px; }
.references a { color: ${color}; text-decoration: none; }
.references a:hover { text-decoration: underline; }
.ai-footer { margin: 40px 0 0; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #94a3b8; }
</style>
</head>
<body>
<div class="wrapper">
<blockquote style="border-left:4px solid ${color};padding:18px 22px;background:#f8f9ff;margin:0 0 32px 0;border-radius:0 8px 8px 0;font-style:normal;">
  <p style="font-size:13px;color:${color};font-weight:600;margin:0 0 4px 0;">${srcName} 보도${dateText !== '최근' ? ` | ${dateText}` : ''}</p>
  <p style="font-size:15px;color:#64748b;margin:0 0 8px 0;">${date} | 교육팀 ${tagPills}</p>
  <p style="font-size:17px;color:#1a1a2e;line-height:1.6;margin:0 0 8px 0;"><strong>${headline}</strong></p>
  <p style="font-size:15px;color:#475569;margin:0;">${srcName}이(가) 전하는 AI 교육 현장의 주요 소식을 소개한다.</p>
</blockquote>
${sectionsHTML}
<div class="references">
<h3>참고자료</h3>
<ol>${referencesHTML}</ol>
</div>
<p class="ai-footer">본 기사는 AI로 작성되었습니다 (AI 기본법 제31조). 원문 기사의 내용을 요약·소개하는 방식으로 구성되었습니다.</p>
</div>
</body>
</html>`;
}

// Main processing
(async () => {
 let savedCount = 0;

 for (const reportFile of reportFiles) {
   try {
     const reportPath = `pipeline/03-reported/${reportFile}`;
     const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
     
     const brief = reportData.reporting_brief || reportData.brief || {};
     const source = reportData.source || reportData.assignment || {};
     const title = source.title || source.headline || 'AI 교육 소식';
     const region = reportData.region || 'korea';
     const regionInfo = getCategory(region);
     
     console.log(` 📝 "${title.substring(0, 50)}..." [${regionInfo.label}]`);
     
     // Fetch original article content for richer context
     let originalContent = '';
     if (source.url) {
       console.log(` 원문 수집: ${source.url.substring(0, 50)}...`);
       originalContent = await fetchArticleContent(source.url);
       console.log(` → ${originalContent.length}자 수집`);
     }
     
     // 🤖 LLM 기반 기사 생성
     const srcName = brief.SOURCE || getKoreanSourceName(source.source) || '관련 매체';
     const srcDate = brief.SOURCE_DATE || source.date || '최근';
     
     // Build references & tags (fallback에서도 사용)
     const sources = brief.SOURCES || [];
     const references = sources.length > 0
       ? sources.map(s => {
         if (typeof s === 'string') return { title: sanitizeKorean(s), url: '#' };
         return { title: sanitizeKorean(s.title || s.name || ''), url: s.url || '#' };
       })
       : (source.url ? [{ title: sanitizeKorean(title), url: source.url }] : []);
     const ghostTags = buildGhostTags(region);
     
     const llmResult = await generateWithLLM(source, originalContent, regionInfo, brief);
     
    let headline, bodyHTML;
    if (llmResult) {
      headline = llmResult.headline;
      bodyHTML = llmResult.bodyHTML;
      console.log(`  ✅ LLM 기사 생성 완료 (${bodyHTML.length}자)`);
    } else {
      // Fallback: 이전 템플릿 방식
      console.log(`  ⚠️ 템플릿 방식으로 폴백`);
      headline = generateKoreanHeadline(source, brief, regionInfo);
      const sectionsFallback = buildSections(source, brief, originalContent, regionInfo);
      bodyHTML = generateArticleHTML({
        headline, region, regionLabel: regionInfo.label, sections: sectionsFallback,
        accent: regionInfo.category, references, ghostTags, srcName, srcDate
      });
      customExcerpt = '';
    }
     
     // Calculate stats
     const plainText = bodyHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
     const wordCount = plainText.split(/\s+/).length;
     const charCount = plainText.length;
     
     // Create slug
     const slug = sanitizeKorean(headline)
       .toLowerCase()
       .replace(/[^가-힣a-z0-9\s-]/g, '')
       .replace(/\s+/g, '-')
       .substring(0, 60);
     
     const articleId = reportData.id || reportFile.replace('.json', '');
     reportData.stage = 'drafted';
     reportData.draft = {
       headline,
       html: bodyHTML,
       slug,
      ghost_tags: ghostTags,
      references,
       word_count: wordCount,
       char_count: charCount,
       category: regionInfo.category,
       region,
       region_label: regionInfo.label
     };
     
     fs.writeFileSync(
       `pipeline/04-drafted/${articleId}.json`,
       JSON.stringify(reportData, null, 2)
     );
     fs.unlinkSync(reportPath);
     
     console.log(` ✅ 작성 완료 (${charCount}자, ${wordCount}단어)`);
     console.log(` 📰 헤드라인: "${headline}" (${headline.length}자)`);
     console.log(` 🏷️ 태그: ${ghostTags.join(', ')}`);
     savedCount++;
   } catch (e) {
     console.error(` ❌ Error: ${e.message}`);
   }
 }

 console.log(`\n✅ STEP 3 완료: ${savedCount}개 기사 작성 완료 (03-reported → 04-drafted)`);
})();
