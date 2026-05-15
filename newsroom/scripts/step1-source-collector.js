const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// ════════════════════════════════════════════
// Crawl4AI Discovery — 새로운 소스 URL 발견
// ════════════════════════════════════════════
try {
  console.log('\n🕷️ Crawl4AI 뉴스 크롤링 시작...');
  execSync('python3 scripts/crawl4ai-integration.py', {
    cwd: __dirname,
    stdio: 'inherit',
    timeout: 300000
  });
  console.log('✅ Crawl4AI 소스 발견 완료\n');
} catch (e) {
  console.warn('⚠️ Crawl4AI 소스 발견 실패 (선택사항, 계속 진행):', e.message);
}

// ════════════════════════════════════════════
// Crawl4AI Image Collection — 기사 이미지 수집
// ════════════════════════════════════════════
try {
  console.log('\n🖼️ Crawl4AI 이미지 수집 시작...');
  execSync('python3 scripts/crawl4ai-images.py', {
    cwd: __dirname,
    stdio: 'inherit',
    timeout: 300000
  });
  console.log('✅ Crawl4AI 이미지 수집 완료\n');
} catch (e) {
  console.warn('⚠️ Crawl4AI 이미지 수집 실패 (선택사항, 계속 진행):', e.message);
}

// Create directories if needed
['pipeline/01-sourced', 'pipeline/memory'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Load config
const sourcesConfig = JSON.parse(
  fs.readFileSync('shared/config/sources.json', 'utf8')
);

// Load recent items
let recentItems = [];
let publishedTitles = [];
try {
  const data = JSON.parse(fs.readFileSync('pipeline/memory/recent-items.json', 'utf8'));
  recentItems = Array.isArray(data) ? data : (data.items_72h || []);
} catch (e) {}
try {
  const data = JSON.parse(fs.readFileSync('pipeline/memory/published-titles.json', 'utf8'));
  publishedTitles = Array.isArray(data) ? data : (data.published_titles || []);
} catch (e) {}

// Brave Search API
const BRAVE_API_KEY = process.env.BRAVE_API_KEY || fs.readFileSync('.env', 'utf8').match(/BRAVE_API_KEY=(.+)/)?.[1]?.trim();

function braveSearch(query) {
  return new Promise((resolve, reject) => {
    const apiPath = `/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&freshness=pw`;
    
    const options = {
      hostname: 'api.search.brave.com',
      path: apiPath,
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    };
    
    const req = https.get(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let body;
        try {
          if (res.headers['content-encoding'] === 'gzip') {
            const zlib = require('zlib');
            body = zlib.gunzipSync(buffer).toString();
          } else {
            body = buffer.toString();
          }
        } catch (e) {
          body = buffer.toString();
        }
        try {
          const json = JSON.parse(body);
          const results = (json.web?.results || [])
            .filter(r => r.url && !r.url.includes('wikipedia.org') && !r.url.includes('youtube.com'))
            .map(r => ({
            title: r.title || '',
            url: r.url || '',
            description: r.description || '',
            source: new URL(r.url).hostname.replace('www.', ''),
            date: r.age || new Date().toISOString().split('T')[0]
          }));
          resolve(results);
        } catch (e) {
          console.error(`Brave parse error for "${query}": ${e.message}`);
          resolve([]);
        }
      });
    });
    req.on('error', e => {
      console.error(`Brave request error: ${e.message}`);
      resolve([]);
    });
    req.setTimeout(10000, () => {
      req.destroy();
      resolve([]);
    });
  });
}

// 🔍 교육 관련성 필터: 제목/설명에 교육 관련 키워드가 있는지 확인
function isEducationRelevant(title, description) {
  const checkText = (title + ' ' + description).toLowerCase();

  // 교육 관련 키워드 (한국어)
  const koreanEduKeywords = [
    '교육', '학교', '교실', '교사', '학생', '수업', '학원', '대학', '에듀테크',
    '교과', '교육과정', '리터러시', '학습', '교수', '대학교', '강의', '튜터',
    '강좌', '직업교육', '학술', '교재', '입시', '학부모', '교육청', '교육부',
    '학령', '교원', '학위', '학년', '교과서', '방과후', '진학', '장학',
    '연수', '자격증', '면학', '평생교육', '인재양성', '인재', '교육자',
    '교직', '교육학', '교육기관', '교육계', '교육현장'
  ];

  // 교육 관련 키워드 (영어)
  const englishEduKeywords = [
    'education', 'school', 'classroom', 'teacher', 'student', 'curriculum',
    'literacy', 'learning', 'teaching', 'pedagogy', 'pedagogical',
    'academic', 'university', 'college', 'training', 'course', 'edtech',
    'k-12', 'k–12', 'k12', 'lecture', 'tutorial', 'tutoring', 'tutor',
    'graduate', 'undergraduate', 'degree', 'scholarship', 'campus',
    'lesson', 'homework', 'exam', 'coursework', 'classroom',
    'higher education', 'vocational', 'homeschool', 'preschool',
    'kindergarten', 'elementary', 'secondary', 'high school',
    'student learning', 'student outcomes', 'instructional',
    'online learning', 'remote learning', 'educational technology',
    'teacher training', 'faculty', 'professor', 'lecturer',
    'didactic', 'course design', 'learning outcomes',
    'educational', 'schooling', 'classroom ai'
  ];

  // 중국어 교육 키워드
  const chineseEduKeywords = [
    '教育', '学校', '课堂', '老师', '学生', '课程',
    '学习', '教学', '大学', '学院'
  ];

  // 의료/생물학/순수 AI산업 신호 (교육과 무관한 AI 기사 걸러내기)
  const nonEduSignals = [
    '의료', '병원', '진단', '치료', '수술', '약물', '환자', '임상',
    '단백질', '유전자', '게놈', 'DNA', 'RNA', '세포', '바이러스',
    '진단', '방사선', 'MRI', 'CT', '의학', '제약', '신약',
    'medical', 'diagnosis', 'cancer', 'clinical', 'protein',
    'genome', 'genetic', 'drug', 'patient', 'surgery',
    'protein interaction', 'molecule', 'biomarker',
    'startup funding', 'series a', 'series b', 'venture capital',
    'IPO', 'funding round', 'acquisition'
  ];

  // 교육 키워드 점수 계산
  let eduScore = 0;
  for (const kw of koreanEduKeywords) {
    if (checkText.includes(kw)) eduScore += 2;
  }
  for (const kw of englishEduKeywords) {
    if (checkText.includes(kw)) eduScore += 1;
  }
  for (const kw of chineseEduKeywords) {
    if (checkText.includes(kw)) eduScore += 2;
  }

  // 비교육 신호 감점
  let nonEduScore = 0;
  for (const sig of nonEduSignals) {
    if (checkText.includes(sig)) nonEduScore += 2;
  }

  // 결정: 교육 점수가 2점 이상이고 비교육 점수보다 높아야 통과
  // (최소 1개의 한국어/중국어 교육 키워드 또는 2개의 영어 키워드)
  return eduScore >= 2 && eduScore > nonEduScore;
}

// 🌍 지역-도메인 검증: URL이 실제로 해당 지역에 속하는지 확인
const regionDomainMap = {
  korea: ['.kr', '.co.kr', '.or.kr', '.go.kr', '.ac.kr'],
  usa: ['.us', '.gov', '.mil', '.edu'],
  china: ['.cn', '.com.cn', '.org.cn'],
  estonia: ['.ee'],
  singapore: ['.sg'],
  japan: ['.jp', '.co.jp', '.or.jp', '.go.jp', '.ac.jp'],
  finland: ['.fi'],
  india: ['.in'],
  europe: ['.eu', '.europa.eu', '.ac.uk', '.co.uk', '.org.uk', '.de', '.fr', '.it', '.es', '.nl', '.ch', '.at', '.be', '.dk', '.no', '.se', '.pl', '.cz', '.hu', '.ro', '.pt', '.gr', '.ie', '.lu', '.hr']
};

// 글로벌/범지역 도메인 — 어느 지역에나 나타날 수 있음
const globalDomains = [
  'grow.google', 'ai.google', 'blog.google', 'about.google', 'google.com',
  'openai.com', 'microsoft.com', 'learn.microsoft.com', 'aischool.microsoft.com',
  'github.com', 'linkedin.com', 'youtube.com', 'x.com', 'twitter.com',
  'technologyreview.com', 'oecd.org', 'unesco.org', 'weforum.org',
  'frontiersin.org', 'springer.com', 'link.springer.com', 'nature.com',
  'arxiv.org', 'researchgate.net', 'acm.org', 'ieee.org',
  'forbes.com', 'bloomberg.com', 'reuters.com', 'apnews.com',
  'cnn.com', 'bbc.com', 'bbc.co.uk', 'theguardian.com',
  'prnewswire.com', 'businesswire.com', 'globenewswire.com',
  'edweek.org', 'edsurge.com', 'insidehighered.com', 'chronicle.com',
  'timeshighereducation.com', 'highereddive.com',
  'edtechinnovationhub.com', 'globaleducationnews.org',
  'digitaljournal.com', 'patch.com', 'huffpost.com',
  'usnews.com', 'newsweek.com', 'theconversation.com',
  'europeanbusinessreview.com', 'eurashe.eu',
  'mit.edu', 'harvard.edu', 'stanford.edu', 'ox.ac.uk', 'cam.ac.uk',
  'columbia.edu', 'upenn.edu', 'berkeley.edu'
];

// 특정 지역에 속하는 것으로 알려진 주요 도메인 (TLD만으로 판별 안 되는 경우)
const knownRegionDomains = {
  korea: ['asiae.co.kr', 'aitimes.com', 'mk.co.kr', 'mt.co.kr', 'joongang.co.kr', 
           'korea.kr', 'koreaherald.com', 'koreatimes.co.kr', 'sisadays.co.kr',
           'dailyan.com', 'ajunews.com', 'inews365.com', 'koreadaily.com',
           'devtimes.co.kr', 'industryjournal.co.kr', 'heartdayrest.com',
           'kjob.news', 'gall.dcinside.com', 'fnnews.com', 'etnews.com',
           'imaeil.com', 'getnews.co.kr', 'gnnews.co.kr', 'smartbizn.com',
           'itbiznews.com', 'venturesquare.net', 'dailybizon.com',
           'edaily.co.kr', 'hankyung.com', 'yna.co.kr', 'dongA.com',
           'seoul.co.kr', 'munhwa.com', 'kyunghyang.com', 'hani.co.kr',
           'ohmynews.com', 'donga.com', 'chosun.com', 'joins.com',
           'mediatoday.co.kr', 'news1.kr', 'newsis.com', 'sedaily.com',
           'thebell.co.kr', 'heraldcorp.com', 'digitaltoday.co.kr',
           'zdnet.co.kr', 'bloter.net', 'platum.kr', 'venturesquare.net'],
  usa: ['npr.org', 'washingtonpost.com', 'nytimes.com', 'edweek.org',
         'edsurge.com', 'insidehighered.com', 'chronicle.com',
         'post-gazette.com', 'abcnews.com', 'abcnews.go.com',
         'nbcnews.com', 'cbsnews.com', 'wsj.com', 'latimes.com',
         'chicagotribune.com', 'usatoday.com', 'sfchronicle.com',
         'edsource.org', 'hechingerreport.org', 'newyorker.com',
         'thecrimson.com', 'senate.gov', 'ed.gov', 'usnews.com',
         'appleinsider.com', 'fortune.com', 'technologyreview.com'],
  europe: ['theguardian.com', 'bbc.com', 'bbc.co.uk', 'irishtimes.com',
            'scmp.com', 'europeanbusinessreview.com', 'ec.europa.eu',
            'euractiv.com', 'timeshighereducation.com', 'pienews.net',
            'eurashe.eu', 'chad.co.uk'],
  china: ['chinadaily.com.cn', 'globaltimes.cn', 'xinhuanet.com',
           'scmp.com', 'e.chinadaily.com.cn'],
  estonia: ['err.ee', 'estonianworld.com', 'news.err.ee'],
  singapore: ['straitstimes.com', 'channelnewsasia.com', 'moe.gov.sg',
               'imda.gov.sg', 'oom.com.sg'],
  japan: ['japantimes.co.jp', 'nhk.or.jp', 'asahi.com', 'mext.go.jp'],
  finland: ['helsinkitimes.fi', 'goodnewsfinland.com', 'oph.fi',
              'ellisinstitute.fi'],
  india: ['thehindu.com', 'timesofindia.indiatimes.com', 'education.gov.in',
           'makersmuse.in']
};

function validateArticleRegion(url, domain, claimedRegion) {
  if (!url || !claimedRegion) return false;
  
  const hostname = domain || new URL(url).hostname.replace('www.', '').toLowerCase();
  
  // 1. 글로벌 도메인 체크 — 어느 지역에도 속하지 않음
  if (globalDomains.some(gd => hostname === gd || hostname.endsWith('.' + gd))) {
    return false;
  }
  
  // 2. 알려진 지역 도메인 체크
  for (const [region, domains] of Object.entries(knownRegionDomains)) {
    if (domains.some(d => hostname === d || hostname.endsWith('.' + d))) {
      return region === claimedRegion;
    }
  }
  
  // 3. TLD 기반 체크 (단, europe은 제외 — .eu TLD가 다양해서 신뢰도 낮음)
  if (claimedRegion !== 'europe') {
    const regionTlds = regionDomainMap[claimedRegion] || [];
    const matchesTld = regionTlds.some(tld => hostname.endsWith(tld));
    if (matchesTld) return true;
  }
  
  // 4. 유럽 지역은 좀 더 관대하게 — EU TLD나 주요 유럽 ccTLD면 유럽으로 인정
  if (claimedRegion === 'europe') {
    const europeTlds = regionDomainMap.europe || [];
    if (europeTlds.some(tld => hostname.endsWith(tld))) return true;
  }
  
  // 5. 한국어 컨텐츠 체크 — 제목에 한글이 많으면 한국으로 간주
  // (이미 교육 필터를 통과한 상태이므로 title에 한글이 있다는 건 한국 매체일 가능성 높음)
  // 하지만 이건 수집 전 title 기준이므로 URL 기준으로 먼저 판단
  
  return false;
}

// 📰 PR/마케팅 소스 감지: 진짜 저널리즘 기사인지 확인
const journalismSignals = {
  // PR/마케팅 배포 채널 (신뢰도 낮음)
  PRDomains: [
    'prnewswire.com', 'prnewswire.co.kr', 'businesswire.com', 
    'globenewswire.com', 'newsfilecorp.com', 'accesswire.com',
    'newswire.com', 'prweb.com', 'marketwired.com', 'digitaljournal.com',
    'einpresswire.com', 'pr.com', 'sbwire.com', 'releasewire.com',
    'openpr.com', 'prlog.org', 'pr-inside.com'
  ],
  // 자체 마케팅/홍보 도메인 (학교 자체 블로그, 기업 뉴스룸)
  selfPromoDomains: [
    'htlinternationalschool.com', 'blog.google', 'about.google',
    'ai.google', 'grow.google', 'microsoft.com', 'openai.com',
    'learn.microsoft.com', 'aischool.microsoft.com',
    'frontiersin.org', 'springer.com', 'link.springer.com',
    'edtechinnovationhub.com', 'aiforeducation.io'
  ],
  // PR 키워드 (제목/설명)
  PRKeywords: [
    'press release', 'media release', 'news release', 'announces the launch',
    'announces partnership', 'announces new', 'proud to announce',
    'is pleased to announce', 'today announced', 'announced today',
    'product launch', 'new partnership', 'strategic partnership',
    'celebrates', 'commemorates', 'grand opening', 'opens its doors',
    'welcomes you to', 'registration now open', 'early bird'
  ]
};

function isActualJournalism(title, description, url, domain) {
  if (!url && !title) return false;
  
  const hostname = domain || (url ? new URL(url).hostname.replace('www.', '').toLowerCase() : '');
  const checkText = ((title || '') + ' ' + (description || '')).toLowerCase();
  
  // 1. PR 배포 채널 → 필터링
  if (journalismSignals.PRDomains.some(pd => hostname === pd || hostname.endsWith('.' + pd))) {
    return false;
  }
  
  // 2. 자체 마케팅/홍보 → 필터링 (단, 검증된 뉴스 매체가 아닌 경우에만)
  if (journalismSignals.selfPromoDomains.some(sd => hostname === sd || hostname.endsWith('.' + sd))) {
    return false;
  }
  
  // 3. 제목에 PR 키워드 포함 → 감점, but 완전 차단은 아님
  const prKeywordMatches = journalismSignals.PRKeywords.filter(kw => checkText.includes(kw)).length;
  if (prKeywordMatches >= 2) {
    return false;  // PR 키워드 2개 이상 = 명백한 PR 자료
  }
  
  return true;
}

async function collectSources() {
  console.log('📡 글로벌 AI 교육 뉴스 소스 수집 시작...\n');
  console.log('📋 교육 관련성 필터 활성화: 교육 키워드 기반 자동 필터링\n');
  
  const allArticles = [];
  let filteredCount = 0;
  const regions = sourcesConfig.regions;
  const recencyDays = sourcesConfig.recency_days || 2;
  
  // Search each region
  for (const [regionKey, region] of Object.entries(regions)) {
    console.log(`🔍 ${region.name} 소스 검색 중...`);
    
    // Pick 1-2 random queries per region to avoid API rate limits
    const queries = region.search_queries;
    const selectedQueries = queries.sort(() => Math.random() - 0.5).slice(0, 2);
    
    for (const query of selectedQueries) {
      try {
        const results = await braveSearch(query);
        
        let regionPassed = 0;
        let regionFiltered = 0;
        for (const r of results) {
          // 🚨 교육 관련성 필터 적용
          if (!isEducationRelevant(r.title, r.description)) {
            regionFiltered++;
            continue;
          }
          
          // 🚨 지역-도메인 검증: URL이 해당 지역과 일치하는지 확인
          if (!validateArticleRegion(r.url, r.source, regionKey)) {
            console.log(`   ⚠️ 지역 불일치 필터링: [${regionKey}] ${r.title?.substring(0, 50)} (${r.url})`);
            regionFiltered++;
            continue;
          }
          
          // 🚨 저널리즘 필터: PR/마케팅 자료인지 확인
          if (!isActualJournalism(r.title, r.description, r.url, r.source)) {
            console.log(`   ⚠️ PR/마케팅 필터링: ${r.title?.substring(0, 50)} (${r.url})`);
            regionFiltered++;
            continue;
          }
          
          // Filter: only recent articles (check URL/host against region sources)
          const isKnownSource = region.sources.some(s => r.url.includes(s) || r.source.includes(s));
          
          allArticles.push({
            ...r,
            region: regionKey,
            regionName: region.name,
            relevance_score: isKnownSource ? 85 : 70 + Math.random() * 20,
            collected_at: new Date().toISOString()
          });
          regionPassed++;
        }
        
        filteredCount += regionFiltered;
        console.log(`   "${query.substring(0, 40)}..." → ${results.length}개 (통과:${regionPassed} / 필터링:${regionFiltered})`);
        
        // Rate limit: wait 300ms between requests
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.error(`   ❌ 검색 실패: ${e.message}`);
      }
    }
  }
  
  console.log(`\n📊 교육 관련성 필터링 결과: 총 ${filteredCount}개 제외됨 (교육 무관 내용)`);
  
  // Also search social media discussions
  console.log(`\n🔍 SNS 소스 검색 중...`);
  const socialQueries = [
    "AI education policy site:x.com OR site:twitter.com",
    "AI education site:threads.net",
    "edtech AI 2026 site:x.com"
  ];
  
  for (const query of socialQueries) {
    try {
      const results = await braveSearch(query);
      let socialPassed = 0;
      let socialFiltered = 0;
      for (const r of results) {
        // 🚨 교육 관련성 필터 적용 (SNS도 동일)
        if (!isEducationRelevant(r.title, r.description)) {
          socialFiltered++;
          continue;
        }
        allArticles.push({
          ...r,
          region: 'social',
          regionName: 'SNS',
          relevance_score: 65 + Math.random() * 20,
          collected_at: new Date().toISOString()
        });
        socialPassed++;
      }
      filteredCount += socialFiltered;
      console.log(`   "${query.substring(0, 40)}..." → ${results.length}개 (통과:${socialPassed} / 필터링:${socialFiltered})`);
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(`   ❌ SNS 검색 실패: ${e.message}`);
    }
  }
  
  // Deduplicate by URL
  const seenUrls = new Set(recentItems.map(item => item?.url).filter(Boolean));
  const uniqueArticles = [];
  for (const article of allArticles) {
    if (seenUrls.has(article.url)) continue;
    seenUrls.add(article.url);
    uniqueArticles.push(article);
  }
  
  // Filter by title similarity with published titles
  const filteredArticles = uniqueArticles.filter(article => {
    const titleScore = publishedTitles.some(pub => {
      if (typeof pub !== 'string') return false;
      const words = article.title.split(/\s+/);
      const matches = words.filter(word => pub.includes(word)).length;
      return matches / words.length > 0.7;
    });
    return !titleScore;
  });
  
  // Sort by relevance score and limit
  const maxTotal = sourcesConfig.max_total_articles || 5;
  const maxPerRegion = sourcesConfig.max_articles_per_region || 3;
  
  // Ensure regional diversity: pick top articles per region
  const regionGroups = {};
  for (const a of filteredArticles) {
    if (!regionGroups[a.region]) regionGroups[a.region] = [];
    regionGroups[a.region].push(a);
  }
  
  // Sort each region by relevance
  for (const key of Object.keys(regionGroups)) {
    regionGroups[key].sort((a, b) => b.relevance_score - a.relevance_score);
  }
  
  // Pick from each region round-robin
  const selectedArticles = [];
  
  // 🇰🇷 한국 기사 우선 할당: 한국 기사가 있으면 최소 1개는 항상 포함
  if (regionGroups.korea && regionGroups.korea.length > 0) {
    selectedArticles.push(regionGroups.korea[0]);
  }
  
  const regionKeys = Object.keys(regionGroups);
  const regionIdx = {};
  regionKeys.forEach(k => regionIdx[k] = 0);
  
  // 한국은 이미 1개 할당했으므로 인덱스 증가
  if (regionGroups.korea && regionGroups.korea.length > 0) {
    regionIdx.korea = 1;
  }
  
  while (selectedArticles.length < maxTotal) {
    let added = false;
    for (const key of regionKeys) {
      if (selectedArticles.length >= maxTotal) break;
      const idx = regionIdx[key];
      if (idx < Math.min(regionGroups[key].length, maxPerRegion)) {
        selectedArticles.push(regionGroups[key][idx]);
        regionIdx[key]++;
        added = true;
      }
    }
    if (!added) break;
  }
  
  return selectedArticles;
}

// Main
(async () => {
  try {
    const articles = await collectSources();
    
    console.log(`\n📊 수집 결과: ${articles.length}개 기사 선정\n`);
    
    let savedCount = 0;
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const sourceData = {
        id: `source-${Date.now()}-${i}`,
        stage: 'sourced',
        source: article,
        score: article.relevance_score,
        region: article.region,
        regionName: article.regionName,
        collected_at: new Date().toISOString()
      };
      
      fs.writeFileSync(
        `pipeline/01-sourced/${sourceData.id}.json`,
        JSON.stringify(sourceData, null, 2)
      );
      
      console.log(`  ${savedCount + 1}. [${article.regionName}] ${article.title.substring(0, 60)}... (${article.source})`);
      savedCount++;
    }
    
    // Update recent-items
    const updatedRecent = [...recentItems, ...articles].slice(-100);
    fs.writeFileSync('pipeline/memory/recent-items.json', JSON.stringify({
      last_updated: new Date().toISOString(),
      items_72h: updatedRecent
    }, null, 2));
    
    // Update published-titles
    const updatedPublished = [...publishedTitles, ...articles.map(a => a.title)].slice(-100);
    fs.writeFileSync('pipeline/memory/published-titles.json', JSON.stringify({
      last_updated: new Date().toISOString(),
      published_titles: updatedPublished
    }, null, 2));
    
    console.log(`\n✅ STEP 1 완료: ${savedCount}개 기사 수집`);
  } catch (e) {
    console.error('❌ 수집 실패:', e.message);
    process.exit(1);
  }
})();
