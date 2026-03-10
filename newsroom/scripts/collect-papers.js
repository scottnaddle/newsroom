#!/usr/bin/env node

/**
 * AI 교육 논문 수집기 (다중 소스)
 * 
 * 소스: arXiv + Semantic Scholar
 * 필수: 교육 관련 키워드가 제목 또는 초록에 반드시 포함
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const WORKSPACE = '/root/.openclaw/workspace/newsroom';
const SOURCED_DIR = `${WORKSPACE}/pipeline/papers/01-sourced`;
const RECENT_FILE = `${WORKSPACE}/pipeline/papers/recent-arxiv-ids.json`;

// Ensure directories
if (!fs.existsSync(SOURCED_DIR)) fs.mkdirSync(SOURCED_DIR, { recursive: true });

// ============================================
// 교육 전용 검색 쿼리 (더 구체적)
// ============================================

// 필수 교육 키워드 (少나도 하나는 제목에 포함되어야 함)
const EDUCATION_KEYWORDS = [
  'education', 'educational', 'learning', 'teaching', 'student', 'students',
  'classroom', 'school', 'schools', 'university', 'universities', 'college',
  'tutor', 'tutoring', 'pedagogy', 'curriculum', 'teacher', 'teachers',
  'literacy', 'instruction', 'instructional', 'academic', 'learner', 'learners',
  'training', 'course', 'courses', 'lecture', 'lectures', 'homework',
  'assessment', 'grading', 'feedback', 'learning outcome', 'educational technology',
  'e-learning', 'online learning', 'distance learning', 'MOOC', 'K-12'
];

// AI + 교육 결합 쿼리 (arXiv용 - 더 엄격)
const ARXIV_QUERIES = [
  // LLM + 교육
  'ti:"large language model" AND (education OR learning OR teaching)',
  'ti:chatgpt AND (student OR classroom OR school)',
  'ti:GPT AND (education OR learning OR tutoring)',
  'abs:LLM AND abs:education',
  
  // AI 튜터링 시스템
  'ti:"intelligent tutoring system"',
  'ti:"AI tutor" OR ti:"AI tutoring"',
  'ti:"conversational agent" AND (education OR learning)',
  
  // 교육용 AI 도구
  'ti:"educational AI" OR ti:"AI education"',
  'ti:"AI-assisted learning" OR ti:"AI assisted learning"',
  'ti:"generative AI" AND (education OR classroom)',
  
  // 자연어처리 + 교육
  'ti:"natural language processing" AND (education OR learning OR student)',
  'ti:NLP AND (education OR learning)',
  
  // 기계학습 + 교육
  'ti:"machine learning" AND (education OR learning analytics OR student)',
  'ti:"deep learning" AND (education OR classroom)',
  
  // AI 리터러시
  'ti:"AI literacy" OR ti:"artificial intelligence literacy"',
  'ti:"AI competency" AND (student OR teacher)',
  
  // 자동 평가/피드백
  'ti:"automated essay scoring"',
  'ti:"automated assessment" AND education',
  'ti:"AI feedback" AND (student OR writing)',
  
  // 개인화 학습
  'ti:"personalized learning" AND (AI OR intelligent OR adaptive)',
  'ti:"adaptive learning" AND (AI OR intelligent)',
  
  // 교육 데이터 마이닝
  'ti:"learning analytics" AND (AI OR machine learning OR prediction)',
  'ti:"educational data mining"',
  
  // 교사 지원 AI
  'ti:"teacher support" AND (AI OR intelligent OR automated)',
  'ti:"lesson planning" AND (AI OR GPT OR LLM)'
];

// Semantic Scholar용 쿼리
const S2_QUERIES = [
  'large language models education classroom',
  'AI tutoring systems students learning',
  'ChatGPT education academic performance',
  'intelligent tutoring systems K-12',
  'AI literacy students teachers curriculum',
  'automated essay scoring feedback writing',
  'learning analytics prediction student success',
  'generative AI higher education teaching',
  'NLP educational applications reading comprehension',
  'machine learning personalized adaptive learning'
];

// ============================================
// 관련성 점수 계산 (더 엄격)
// ============================================

function calculateRelevance(paper) {
  const title = paper.title.toLowerCase();
  const summary = (paper.summary || '').toLowerCase();
  const fullText = `${title} ${summary}`;
  
  let score = 0;
  let hasEducationInTitle = false;
  let hasAIInTitle = false;
  
  // 1. 제목에 교육 키워드 있는지 확인 (필수 조건)
  for (const kw of EDUCATION_KEYWORDS) {
    if (title.includes(kw.toLowerCase())) {
      hasEducationInTitle = true;
      score += 20;
      break;
    }
  }
  
  // 2. 제목에 AI 키워드
  const aiKeywords = ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 
                      'nlp', 'natural language', 'llm', 'gpt', 'chatgpt', 'language model',
                      'intelligent', 'automated', 'generative', 'neural'];
  for (const kw of aiKeywords) {
    if (title.includes(kw)) {
      hasAIInTitle = true;
      score += 15;
      break;
    }
  }
  
  // 3. 초록에 교육 키워드 개수
  let eduKeywordCount = 0;
  for (const kw of EDUCATION_KEYWORDS) {
    if (summary.includes(kw.toLowerCase())) {
      eduKeywordCount++;
    }
  }
  score += Math.min(eduKeywordCount * 3, 30); // 최대 30점
  
  // 4. 초록에 AI 키워드
  let aiKeywordCount = 0;
  for (const kw of aiKeywords) {
    if (summary.includes(kw)) {
      aiKeywordCount++;
    }
  }
  score += Math.min(aiKeywordCount * 2, 20); // 최대 20점
  
  // 5. 최신성 보너스 (30일 이내)
  if (paper.published) {
    const daysAgo = (Date.now() - new Date(paper.published)) / (1000 * 60 * 60 * 24);
    if (daysAgo < 7) score += 10;
    else if (daysAgo < 14) score += 5;
  }
  
  // 6. 교육+AI 둘 다 제목에 있으면 보너스
  if (hasEducationInTitle && hasAIInTitle) {
    score += 15;
  }
  
  // 7. 제목에 교육 키워드가 없으면 감점
  if (!hasEducationInTitle && eduKeywordCount < 3) {
    score -= 20;
  }
  
  return Math.max(0, Math.min(score, 100));
}

// ============================================
// arXiv API
// ============================================

async function fetchArxiv(query) {
  return new Promise((resolve, reject) => {
    const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=15&sortBy=submittedDate&sortOrder=descending`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseArxivXml(xml) {
  const papers = [];
  const entries = xml.split('<entry>').slice(1);
  
  for (const entry of entries) {
    try {
      const id = entry.match(/<id>.*?\/abs\/([^<]+)<\/id>/)?.[1];
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, ' ');
      const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().replace(/\s+/g, ' ');
      const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
      const updated = entry.match(/<updated>([^<]+)<\/updated>/)?.[1];
      
      const authors = [];
      const authorMatches = entry.matchAll(/<author>[\s\S]*?<name>([^<]+)<\/name>/g);
      for (const match of authorMatches) {
        authors.push(match[1].trim());
      }
      
      const categories = [];
      const catMatches = entry.matchAll(/category term="([^"]+)"/g);
      for (const match of catMatches) {
        categories.push(match[1]);
      }
      
      if (id && title && summary) {
        papers.push({
          arxiv_id: id,
          title,
          summary,
          authors,
          categories,
          published,
          updated,
          pdf_url: `https://arxiv.org/pdf/${id}`,
          abs_url: `https://arxiv.org/abs/${id}`,
          source: 'arxiv'
        });
      }
    } catch (e) {
      // Skip malformed entries
    }
  }
  
  return papers;
}

// ============================================
// Semantic Scholar API
// ============================================

async function fetchSemanticScholar(query) {
  return new Promise((resolve, reject) => {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=10&fields=title,abstract,authors,year,publicationDate,url,openAccessPdf&year=2024-`;
    
    https.get(url, {
      headers: { 'User-Agent': 'UBION-AI-Education-Newsroom/1.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.data || []);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

function parseS2Papers(s2Data) {
  return s2Data.map(paper => ({
    arxiv_id: `s2-${paper.paperId}`,
    title: paper.title,
    summary: paper.abstract || 'Abstract not available',
    authors: (paper.authors || []).map(a => a.name),
    categories: [],
    published: paper.publicationDate || `${paper.year}-01-01`,
    updated: paper.publicationDate || `${paper.year}-01-01`,
    pdf_url: paper.openAccessPdf?.url || paper.url,
    abs_url: paper.url,
    source: 'semantic-scholar'
  }));
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('📚 AI 교육 논문 수집기 (다중 소스)\n');
  console.log(`📅 ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n`);
  
  // Load recent IDs
  let recentData = { ids: [] };
  if (fs.existsSync(RECENT_FILE)) {
    recentData = JSON.parse(fs.readFileSync(RECENT_FILE, 'utf8'));
  }
  const recentIds = new Set(recentData.ids);
  const allPapers = [];
  
  // ============================================
  // 1. arXiv 검색
  // ============================================
  console.log('📖 arXiv 검색 중...\n');
  
  const arxivQueries = ARXIV_QUERIES.slice(0, 5); // 5개 쿼리만
  for (const query of arxivQueries) {
    try {
      console.log(`  🔍 ${query.slice(0, 50)}...`);
      const xml = await fetchArxiv(query);
      const papers = parseArxivXml(xml);
      
      for (const paper of papers) {
        const idKey = paper.arxiv_id;
        if (!recentIds.has(idKey)) {
          paper.relevance_score = calculateRelevance(paper);
          paper.source_query = query;
          paper.collected_at = new Date().toISOString();
          allPapers.push(paper);
          recentIds.add(idKey);
        }
      }
      
      await new Promise(r => setTimeout(r, 1500)); // Rate limiting
    } catch (e) {
      console.log(`    ❌ 실패: ${e.message}`);
    }
  }
  
  // ============================================
  // 2. Semantic Scholar 검색
  // ============================================
  console.log('\n📖 Semantic Scholar 검색 중...\n');
  
  for (const query of S2_QUERIES.slice(0, 3)) {
    try {
      console.log(`  🔍 "${query}"`);
      const s2Data = await fetchSemanticScholar(query);
      const papers = parseS2Papers(s2Data);
      
      for (const paper of papers) {
        const idKey = paper.arxiv_id;
        if (!recentIds.has(idKey)) {
          paper.relevance_score = calculateRelevance(paper);
          paper.source_query = query;
          paper.collected_at = new Date().toISOString();
          allPapers.push(paper);
          recentIds.add(idKey);
        }
      }
      
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.log(`    ❌ 실패: ${e.message}`);
    }
  }
  
  // ============================================
  // 3. 필터링 및 저장
  // ============================================
  
  // 관련성 70점 이상만 (이전 60점 → 70점으로 상향)
  const filteredPapers = allPapers
    .filter(p => p.relevance_score >= 70)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 10);
  
  console.log(`\n📊 수집 결과:`);
  console.log(`   전체: ${allPapers.length}개`);
  console.log(`   필터링 후 (70점+): ${filteredPapers.length}개\n`);
  
  for (const paper of filteredPapers) {
    const filename = `${new Date().toISOString().slice(0, 10)}_${paper.arxiv_id.replace('/', '-')}.json`;
    const filepath = path.join(SOURCED_DIR, filename);
    
    const sourcedPaper = {
      ...paper,
      stage: 'sourced',
      audit_log: [{
        agent: 'paper-collector',
        action: 'sourced',
        timestamp: new Date().toISOString(),
        source: paper.source,
        relevance_score: paper.relevance_score
      }]
    };
    
    fs.writeFileSync(filepath, JSON.stringify(sourcedPaper, null, 2));
    console.log(`  ✅ [${paper.source}] ${paper.relevance_score}점`);
    console.log(`     ${paper.title.slice(0, 70)}...`);
    console.log(`     저장: ${filename}\n`);
  }
  
  // Save recent IDs
  fs.writeFileSync(RECENT_FILE, JSON.stringify({
    ids: Array.from(recentIds).slice(-1000),
    last_updated: new Date().toISOString()
  }, null, 2));
  
  console.log(`✅ 완료: ${filteredPapers.length}개 논문 수집`);
}

main().catch(console.error);
