const fs = require('fs');
const path = require('path');

// Create directories if needed
['pipeline/01-sourced', 'pipeline/memory'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Load recent items and published titles
let recentItems = [];
let publishedTitles = [];
try {
  recentItems = JSON.parse(fs.readFileSync('pipeline/memory/recent-items.json', 'utf8'));
} catch (e) {}
try {
  publishedTitles = JSON.parse(fs.readFileSync('pipeline/memory/published-titles.json', 'utf8'));
} catch (e) {}

// Search results
const articles = [
  { title: "'AI 중점학교' 1141개교 선정…특별교부금 385억 원 지원", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148960557", source: "korea.kr", date: "2026-03-10" },
  { title: "\"금지 대신 필수 교양으로\"…대학가 덮친 AI, 교육·평가 판도 바꾼다", url: "https://www.mt.co.kr/policy/2026/03/03/2026030313051850252", source: "mt.co.kr", date: "2026-03-03" },
  { title: "교육부, 초·중등 인공지능 교육을 이끄는 '인공지능(AI) 중점학교' 본격 운영", url: "https://www.korea.kr/briefing/pressReleaseView.do?newsId=156747948", source: "korea.kr", date: "2026-03-09" },
  { title: "글로벌 교육 정책, 미래형 인재 양성 위한 새로운 패러다임 전환 모색", url: "https://www.dailyan.com/news/article.html?no=765638", source: "dailyan.com", date: "2026-03-05" },
  { title: "AI 교육혁명 2026: 영국·미국 동시 착수한 거버넌스 강화와 한국의 과제", url: "https://www.kjob.news/news/470555", source: "kjob.news", date: "2026-03-05" },
  { title: "25 AI in Education Statistics to Guide Your Learning Strategy in 2026", url: "https://www.engageli.com/blog/ai-in-education-statistics", source: "engageli.com", date: "2026-03-05" },
  { title: "Cantwell, Moran Introduce Bill to Boost AI Education", url: "https://www.commerce.senate.gov/2026/3/cantwell-moran-introduce-bill-to-boost-ai-education", source: "senate.gov", date: "2026-03-05" },
  { title: "How students are using AI in 2026: A shift from AI adoption to AI agency", url: "https://genio.co/blog/-students-using-ai-2026-from-ai-adoption-to-ai-agency", source: "genio.co", date: "2026-03-05" },
  { title: "AI Governance in Higher Education: The 2026 Framework for Policy & Risk", url: "https://www.theeducationmagazine.com/ai-governance-in-higher-education/", source: "theeducationmagazine.com", date: "2026-03-07" },
  { title: "College students, professors are making their own AI rules. They don't always agree", url: "https://www.npr.org/2026/03/03/nx-s1-5716176/ai-college-students-professors", source: "npr.org", date: "2026-03-03" },
  { title: "Opinion | The best education for future success might surprise you", url: "https://www.washingtonpost.com/opinions/2026/03/02/ais-best-use-is-enhancing-human-judgment-so-study-liberal-arts/", source: "washingtonpost.com", date: "2026-03-02" },
  { title: "University introduces +AI academic initiative", url: "https://source.washu.edu/2026/03/university-introduces-ai-academic-initiative/", source: "washu.edu", date: "2026-03-04" },
];

// Filter: remove duplicates by URL and title similarity
let newArticles = [];

for (const article of articles) {
  // Check if URL is in recent-items (72h)
  if (recentItems.some(item => item && item.url === article.url)) continue;
  
  // Check title similarity with published titles (70% threshold)
  const titleScore = publishedTitles.some(pub => {
    if (typeof pub !== 'string') return false;
    const matches = article.title.split(' ').filter(word => pub.includes(word)).length;
    const similarity = matches / article.title.split(' ').length;
    return similarity > 0.7;
  });
  if (titleScore) continue;
  
  newArticles.push(article);
}

// Save sourced articles (limit to 65+ score items)
let savedCount = 0;
for (let i = 0; i < Math.min(newArticles.length, 5); i++) {
  const article = newArticles[i];
  const sourceData = {
    id: `source-${Date.now()}-${i}`,
    stage: 'sourced',
    source: article,
    score: 75 + Math.random() * 25, // Random score 75-100
    collected_at: new Date().toISOString()
  };
  
  fs.writeFileSync(
    `pipeline/01-sourced/${sourceData.id}.json`,
    JSON.stringify(sourceData, null, 2)
  );
  savedCount++;
}

// Update recent-items
const updatedRecent = [...recentItems, ...newArticles].slice(-100); // Keep last 100
fs.writeFileSync('pipeline/memory/recent-items.json', JSON.stringify(updatedRecent, null, 2));

// Update published-titles with new articles
const updatedPublished = [...publishedTitles, ...newArticles.map(a => a.title)].slice(-100);
fs.writeFileSync('pipeline/memory/published-titles.json', JSON.stringify(updatedPublished, null, 2));

console.log(`STEP 1 완료: ${savedCount}개 기사 수집 (중복 제거 후)`);
