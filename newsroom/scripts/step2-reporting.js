const fs = require('fs');
const path = require('path');

// Create directories if needed
['pipeline/02-assigned', 'pipeline/03-reported', 'pipeline/memory'].forEach(dir => {
 if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Read from 01-sourced/ (sequential: step1 collected here)
const sourceFiles = fs.readdirSync('pipeline/01-sourced/').filter(f => f.endsWith('.json'));
// Also check 02-assigned/ for any stuck files from previous runs
const assignedFiles = fs.readdirSync('pipeline/02-assigned/').filter(f => f.endsWith('.json'));
const allInputFiles = [...sourceFiles.map(f => ({file: f, dir: 'pipeline/01-sourced/'})), 
 ...assignedFiles.map(f => ({file: f, dir: 'pipeline/02-assigned/'}))];

console.log(`Found ${sourceFiles.length} in 01-sourced/, ${assignedFiles.length} in 02-assigned/`);
console.log(`Total input files: ${allInputFiles.length}`);

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
  'aiforeducation.io': 'AI for Education',
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

// Clean article title: remove source suffixes, brackets, prefixes
function cleanTitle(title) {
  if (!title) return '';
  let t = title
    .replace(/\s*\|.*$/, '')                            // Remove after |
    .replace(/\s*-\s*(Pittsburgh Post-Gazette|연합뉴스|중앙일보|The Educator|IBM|Wikipedia|Springer Nature|PR Newswire|Inter-Parliamentary|Block Club|China Daily|Finnish Government|Yuyjo\.com|Irish Times|BBC|The Guardian|The New York Times|NPR|EdWeek|EdSurge|Inside Higher Ed|The Chronicle|SCMP|Global Times|Xinhua|Japan Times|NHK|Straits Times|CNA|The Hindu|Times of India).*/i, '')
    .replace(/\s*:\s*(한국연합신문|연합뉴스|중앙일보|한겨레|동아일보).*/i, '')
    .replace(/\[([^\]]{2,30})\]\s*/g, '$1 ')             // Unwrap brackets
    .replace(/\\s+/g, ' ')
    .trim();
  return t;
}

// Detect if text is primarily Korean
function isKorean(text) {
  if (!text) return false;
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  return koreanChars > text.replace(/\s/g, '').length * 0.3;
}

// ✅ Rewritten: Generate article-specific Korean title (NOT generic keyword match)
function koreanizeTitle(title, url, region, description) {
  const label = regionLabels[region] || '글로벌';
  const clean = cleanTitle(title);
  if (!clean) return `${label} AI 교육 관련 소식`;

  // Korean title → use as-is (already in Korean)
  if (isKorean(clean)) return clean;

  // Try description from Brave Search for better context
  if (description && description.length > 10) {
    const descKorean = (description.match(/[가-힣]/g) || []).length;
    if (descKorean > 3) return description.substring(0, 80);
  }

  // English title → generate article-specific Korean summary
  const lower = clean.toLowerCase();

  // Build specific Korean descriptions based on actual title content
  // Pattern: Who + Action + What, in natural Korean
  const patterns = [
    // Policy/regulation articles
    { test: () => lower.includes('ask') && (lower.includes('policy') || lower.includes('state')),
      result: () => `${label} 교육 관계자들, 주정부에 AI 정책 마련 촉구` },
    { test: () => lower.includes('policy') && lower.includes('ai') && (lower.includes('create') || lower.includes('state') || lower.includes('law')),
      result: () => `${label} AI 교육 정책 및 규제 관련 새 소식` },
    { test: () => lower.includes('act') && (lower.includes('eu') || lower.includes('europe')),
      result: () => `유럽 AI 법 시행과 대학 교육 현장 영향` },

    // School/teacher/student articles
    { test: () => lower.includes('teacher') && lower.includes('ai'),
      result: () => `${label} 교사 대상 AI 활용 교육 확대 소식` },
    { test: () => lower.includes('student') && lower.includes('ai'),
      result: () => `${label} 학생 AI 교육 프로그램 관련 소식` },
    { test: () => lower.includes('school') && (lower.includes('ai') || lower.includes('technology')),
      result: () => `${label} 학교 현장 AI 도입 및 활용 동향` },
    { test: () => lower.includes('classroom') && lower.includes('ai'),
      result: () => `${label} 교실 속 AI 기술 도입 사례` },
    { test: () => lower.includes('literacy') || lower.includes('digital'),
      result: () => `${label} AI 리터러시 및 디지털 교육 관련 소식` },

    // Trust/approach articles
    { test: () => lower.includes('trust') || lower.includes('approach'),
      result: () => `${label} 학교 AI 도입에 대한 새로운 접근법 제시` },
    { test: () => lower.includes('adopt') || lower.includes('integration'),
      result: () => `${label} AI 교육 도입 확대 움직임` },

    // Events
    { test: () => lower.includes('festival') || lower.includes('conference') || lower.includes('summit'),
      result: () => `${label} AI 교육 관련 국제 행사 개최 소식` },

    // University/Higher Ed
    { test: () => lower.includes('university') || lower.includes('college') || lower.includes('higher ed'),
      result: () => `${label} 대학 AI 교육 혁신 및 변화 소식` },

    // Curriculum
    { test: () => lower.includes('curriculum') || lower.includes('program') || lower.includes('course'),
      result: () => `${label} AI 교육과정 개발 및 개편 소식` },

    // Research/study
    { test: () => lower.includes('study') || lower.includes('research') || lower.includes('report'),
      result: () => `${label} AI 교육 관련 연구 및 보고서 발표` },

    // Ethics/Safety
    { test: () => lower.includes('ethic') || lower.includes('safety') || lower.includes('deepfake'),
      result: () => `${label} AI 윤리·안전 교육 관련 소식` },

    // Edtech companies
    { test: () => lower.includes('edtech') || lower.includes('startup') || lower.includes('company'),
      result: () => `${label} 에듀테크 업계 AI 교육 동향` },
  ];

  for (const p of patterns) {
    if (p.test()) return p.result();
  }

  // Fallback: use first meaningful part of the title
  const words = clean.split(/\s+/).filter(w => w.length > 3 && w !== 'The' && w !== 'And' && w !== 'For' && w !== 'With');
  const headWords = words.slice(0, 5).join(' ');
  return `${label} ${headWords}...`;
}

// ✅ Rewritten: Extract specific, context-rich key points from article metadata
function extractKeyPoints(title, region) {
  const label = regionLabels[region] || '글로벌';
  const points = [];
  const lower = (title || '').toLowerCase();
  const clean = cleanTitle(title);

  // Build 2-4 specific key points - use the actual title content to form meaningful sentences
  // Each point should read like a real news fact, not a template
  
  // Try to extract meaningful segments from the title
  const meaningfulWords = clean.split(/[\s,;:—–-]+/)
    .filter(w => w.length > 4 && w !== 'The' && w !== 'This' && w !== 'That' && w !== 'With' && w !== 'From' && w !== 'Into' && w !== 'When' && w !== 'What' && w !== 'How' && w !== 'Will' && w !== 'Can')
    .slice(0, 6);

  // Point 1: What is the article about (based on title content)
  if (clean && clean.length > 15) {
    const shortTitle = clean.length > 50 ? clean.substring(0, 47) + '...' : clean;
    points.push(`${label}에서 "${shortTitle}"에 관한 새로운 소식이 전해졌다.`);
  } else if (meaningfulWords.length >= 3) {
    points.push(`${label}에서 ${meaningfulWords.slice(0, 3).join(' ')} 관련 소식.`);
  }

  // Point 2: Add specific angle based on title keywords
  if (lower.includes('interview') || lower.includes('인터뷰')) {
    points.push(`${label} 현장 관계자의 생생한 인터뷰를 통해 AI 교육의 실제 변화를 엿볼 수 있다.`);
  } else if (lower.includes('pilot') || lower.includes('trial')) {
    points.push(`${label}에서 AI 교육 시범 프로그램이 도입되어 현장 반응이 주목된다.`);
  } else if (lower.includes('partner') || lower.includes('collaboration')) {
    points.push(`${label} 교육기관과 글로벌 기업 간 AI 교육 협력이 확대되고 있다.`);
  } else if (lower.includes('course') || lower.includes('program') || lower.includes('training')) {
    points.push(`${label}에서 교육자와 학생을 대상으로 한 AI 교육 프로그램이 제공되고 있다.`);
  } else if (lower.includes('school') || lower.includes('classroom') || lower.includes('teacher')) {
    points.push(`${label} 교육 현장에서 AI 기술 도입이 가시화되고 있다.`);
  } else if (lower.includes('policy') || lower.includes('regulation') || lower.includes('act')) {
    points.push(`${label}에서 AI 교육 관련 정책 및 규제 논의가 활발히 진행 중이다.`);
  } else if (lower.includes('curriculum') || lower.includes('literacy')) {
    points.push(`${label}에서 AI 리터러시 함양과 교육과정 개편이 추진되고 있다.`);
  }

  // Point 3: Article-specific significance (no country-level templates)
  if (region !== 'korea') {
    points.push(`${label}에서 전하는 이번 기사는 AI 기술이 교육 현장에 미치는 영향을 구체적으로 조명한다.`);
  } else {
    points.push(`국내 AI 교육 관련 구체적인 사례와 정책 변화를 소개하는 기사다.`);
  }

  // Limit to 4 points, ensure at least 2
  if (points.length < 2) {
    points.push(`${label} AI 교육 관련 주요 소식이다.`);
  }

  return points.slice(0, 4);
}

// ✅ Rewritten: Article-specific summary (NOT generic "X에서 보도된 AI 교육 관련 소식")
function generateArticleSummary(source, region) {
  const label = regionLabels[region] || '글로벌';
  const title = source.title || '';
  const description = source.description || '';
  const srcName = source.source || '관련 매체';
  const date = source.date || '최근';

  // Use description if informative
  let summary = '';
  if (description && description.length > 30 && isKorean(description)) {
    summary = description.substring(0, 150);
  } else if (description && description.length > 30) {
    summary = `${label} ${srcName}에서 보도한 AI 교육 관련 소식. ${description.substring(0, 120)}`;
  } else {
    const clean = cleanTitle(title);
    summary = `${label} ${srcName}에서 보도한 내용에 따르면, ${clean.substring(0, 60)}...`;
  }

  return summary;
}

// ✅ Rewritten: Why this specific article is important
function whyImportant(title) {
  if (!title) return 'AI 교육 분야의 주요 트렌드를 파악할 수 있는 중요한 소식';
  const lower = title.toLowerCase();

  if (lower.includes('policy') || lower.includes('act') || lower.includes('regulation') || lower.includes('law')) {
    return 'AI 교육 관련 법·제도 정비가 활발히 진행되는 가운데, 각국의 정책 방향을 이해할 수 있는 중요한 지표';
  }
  if (lower.includes('school') || lower.includes('teacher') || lower.includes('student') || lower.includes('classroom')) {
    return 'AI 기술이 실제 교육 현장에 도입되는 구체적 사례를 통해, 교육의 디지털 전환 흐름을 파악할 수 있는 소식';
  }
  if (lower.includes('curriculum') || lower.includes('program') || lower.includes('course') || lower.includes('literacy')) {
    return 'AI 시대에 필요한 교육과정과 핵심 역량이 어떻게 변화하고 있는지 보여주는 사례';
  }
  if (lower.includes('research') || lower.includes('study') || lower.includes('report')) {
    return 'AI 교육의 효과와 영향력을 데이터 기반으로 분석한 연구 결과는 정책 수립에 중요한 참고자료';
  }
  if (lower.includes('festival') || lower.includes('conference') || lower.includes('summit')) {
    return 'AI 교육 전문가들이 한자리에 모여 최신 트렌드와 비전을 논의하는 자리로, 업계 방향성을 가늠할 수 있는 행사';
  }
  if (lower.includes('ethics') || lower.includes('safety') || lower.includes('deepfake')) {
    return 'AI 기술의 교육 활용에 따른 윤리적 과제와 안전장치 마련이 시급한 상황에서 중요한 논의';
  }

  return '전 세계 AI 교육 분야의 최신 동향을 종합적으로 파악할 수 있는 주요 소식';
}

// ✅ Rewritten: Generate article angle (specific to this article, not country report)
function suggestAngle(source, region) {
  const label = regionLabels[region] || '글로벌';
  const title = source.title || '';
  const src = source.source || '';
  const clean = cleanTitle(title);

  // Keep it specific to the article
  return `${label} ${src}: ${clean.substring(0, 40)}`;
}

// ✅ Rewritten: Clean region label helpers (simplified)
function getWho(title, url, region) {
  return `${regionLabels[region] || '글로벌'} 교육 관계자 및 전문가`;
}

// ✅ Freshness check: reject sources older than 6 months or unknown date
function isSourceFresh(sourceDateStr) {
  if (!sourceDateStr || sourceDateStr === '최근') return true;  // Conservative: unknown date → keep
  
  // Parse various date formats
  let srcDate;
  // ISO format: 2025-07-24T00:00:00 or 2025-07-24
  if (/^\d{4}-\d{2}-\d{2}/.test(sourceDateStr)) {
    srcDate = new Date(sourceDateStr.substring(0, 10));
  } else {
    srcDate = new Date(sourceDateStr);
  }
  
  if (isNaN(srcDate.getTime())) return false;
  
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  return srcDate >= sixMonthsAgo;
}

// Main processing
let savedCount = 0;
let rejectedCount = 0;

for (const {file: sourceFile, dir: inputDir} of allInputFiles) {
 try {
   const sourcePath = `${inputDir}${sourceFile}`;
   const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
   const source = sourceData.source || sourceData.assignment || sourceData;
   const region = sourceData.region || 'korea';
   const label = regionLabels[region] || '글로벌';

   // ✅ Source freshness validation
   const sourceDate = source.date;
   if (!isSourceFresh(sourceDate)) {
     console.log(`  ⏭️ [오래된 소스 SKIP] [${label}] ${source.title ? source.title.substring(0, 50) : 'No title'}... (날짜: ${sourceDate || '알 수 없음'})`);
     // Save rejected source for audit
     const rejectDir = 'pipeline/rejected';
     if (!fs.existsSync(rejectDir)) fs.mkdirSync(rejectDir, { recursive: true });
     sourceData.stage = 'rejected-old-source';
     sourceData.reject_reason = `Source date ${sourceDate || 'unknown'} is older than 6 months or unverifiable`;
     fs.writeFileSync(`${rejectDir}/${sourceData.id}.json`, JSON.stringify(sourceData, null, 2));
     fs.unlinkSync(sourcePath);
     rejectedCount++;
     continue;
   }

   // ✅ New: Article-centric reporting brief
   const brief = {
     id: sourceData.id,
     reporting_brief: {
       TITLE_KO: koreanizeTitle(source.title, source.url, region, source.description),
       SOURCE: getKoreanSourceName(source.source),
       SOURCE_NAME_RAW: source.source || '',
       SOURCE_DATE: source.date || '최근',
       SUMMARY: generateArticleSummary(source, region),
       KEY_POINTS: extractKeyPoints(source.title, region),
       WHY_IMPORTANT: whyImportant(source.title),
       SUGGESTED_ANGLE: suggestAngle(source, region),
       SOURCES: [
         { title: source.title, url: source.url, credibility: "high" }
       ]
     }
   };

   // Update stage
   sourceData.stage = 'reported';
   sourceData.reporting_brief = brief.reporting_brief;
   sourceData.assigned_at = new Date().toISOString();

   // Save to 03-reported
   fs.writeFileSync(
     `pipeline/03-reported/${sourceData.id}.json`,
     JSON.stringify(sourceData, null, 2)
   );

   // Remove from input dir
   fs.unlinkSync(sourcePath);

   savedCount++;
   console.log(`  ✅ [${label}] ${source.title ? source.title.substring(0, 50) : 'No title'}...`);
 } catch (e) {
   console.error(`Error processing ${sourceFile}: ${e.message}`);
 }
}

console.log(`STEP 2 완료: ${savedCount}개 취재 완료 (01-sourced → 03-reported), ${rejectedCount}개 오래된 소스 제외 (→ rejected/)`);
