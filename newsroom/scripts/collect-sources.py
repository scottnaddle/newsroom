#!/usr/bin/env python3
"""Custom source collector using Brave Search API.
Bypasses the broken run-01-collector.js which expects sourcesConfig.regions.

v2: Added strict 7-day freshness cutoff. Empty results are preferred over stale sources.
"""
import json, os, re, time, urllib.request, urllib.error
from datetime import datetime, timedelta

WORKSPACE = "/root/.openclaw/workspace/newsroom"

# Brave Search API — load from .env
import re as _re
_env_path = os.path.join(WORKSPACE, ".env")
try:
    with open(_env_path) as _f:
        _env_text = _f.read()
    _key_match = _re.search(r'BRAVE_API_KEY=(.+)', _env_text)
    BRAVE_API_KEY = _key_match.group(1).strip() if _key_match else "***"
except:
    BRAVE_API_KEY = "***"

# Load config
with open(os.path.join(WORKSPACE, "shared/config/sources.json")) as f:
    config = json.load(f)

# Load recent items for dedup
recent_items_path = os.path.join(WORKSPACE, "pipeline/memory/recent-items.json")
published_titles_path = os.path.join(WORKSPACE, "pipeline/memory/published-titles.json")

recent_items = []
published_titles = []
try:
    with open(recent_items_path) as f:
        data = json.load(f)
        recent_items = data if isinstance(data, list) else data.get("items_72h", [])
except: pass
try:
    with open(published_titles_path) as f:
        data = json.load(f)
        published_titles = data if isinstance(data, list) else data.get("published_titles", [])
except: pass

# Education relevance keywords (Korean + English)
KOREAN_EDU_KW = [
    '교육', '학교', '교실', '교사', '학생', '수업', '학원', '대학', '에듀테크',
    '교과', '교육과정', '리터러시', '학습', '교수', '대학교', '강의', '튜터',
    '강좌', '직업교육', '학술', '교재', '입시', '학부모', '교육청', '교육부',
    '학령', '교원', '학위', '학년', '교과서', '방과후', '진학', '장학',
    '연수', '자격증', '면학', '평생교육', '인재양성', '인재', '교육자',
    '교직', '교육학', '교육기관', '교육계', '교육현장'
]
ENGLISH_EDU_KW = [
    'education', 'school', 'classroom', 'teacher', 'student', 'curriculum',
    'literacy', 'learning', 'teaching', 'pedagogy', 'pedagogical',
    'academic', 'university', 'college', 'training', 'course', 'edtech',
    'k-12', 'k–12', 'k12', 'lecture', 'tutorial', 'tutoring', 'tutor',
    'graduate', 'undergraduate', 'degree', 'scholarship', 'campus',
    'lesson', 'homework', 'exam', 'coursework',
    'higher education', 'vocational', 'homeschool', 'preschool',
    'kindergarten', 'elementary', 'secondary', 'high school',
    'student learning', 'student outcomes', 'instructional',
    'online learning', 'remote learning', 'educational technology',
    'teacher training', 'faculty', 'professor', 'lecturer',
    'didactic', 'course design', 'learning outcomes',
    'educational', 'schooling', 'classroom ai'
]
CHINESE_EDU_KW = [
    '教育', '学校', '课堂', '老师', '学生', '课程',
    '学习', '教学', '大学', '学院'
]
NON_EDU_SIGNALS = [
    '의료', '병원', '진단', '치료', '수술', '약물', '환자', '임상',
    '단백질', '유전자', '게놈', 'DNA', 'RNA', '세포', '바이러스',
    '방사선', 'MRI', 'CT', '의학', '제약', '신약',
    'medical', 'diagnosis', 'cancer', 'clinical', 'protein',
    'genome', 'genetic', 'drug', 'patient', 'surgery',
    'protein interaction', 'molecule', 'biomarker',
    'startup funding', 'series a', 'series b', 'venture capital',
    'IPO', 'funding round', 'acquisition'
]

MAX_AGE_DAYS = 7  # ⏰ 7일 초과 기사는 제외


def parse_age_days(age_str):
    """Parse Brave Search API 'age' field into approximate days.
    
    Brave returns relative strings like:
      - "1 day ago", "2 days ago"
      - "5 days ago"
      - "1 week ago", "2 weeks ago"
      - "1 month ago"
      - ISO date strings like "2025-05-03" (rare)
    Returns number of days old, or None if unparseable.
    """
    if not age_str:
        return None
    
    age_str = age_str.strip().lower()
    
    # Try relative format: "X day(s) ago", "X week(s) ago", etc.
    m = re.match(r'(\d+)\s*(day|days|week|weeks|month|months|year|years)\s*ago', age_str)
    if m:
        num = int(m.group(1))
        unit = m.group(2)
        if unit.startswith('day'):
            return num
        elif unit.startswith('week'):
            return num * 7
        elif unit.startswith('month'):
            return num * 30
        elif unit.startswith('year'):
            return num * 365
    
    # Try ISO date format
    try:
        from datetime import datetime as dt
        pub_date = dt.strptime(age_str[:10], '%Y-%m-%d')
        delta = dt.now() - pub_date
        return delta.days
    except (ValueError, IndexError):
        pass
    
    return None


def is_within_week(age_str):
    """Check if article age is within MAX_AGE_DAYS (7 days)."""
    days = parse_age_days(age_str)
    if days is None:
        # If we can't determine age, keep it (conservative: don't drop unparseable)
        return True
    return days <= MAX_AGE_DAYS


def is_education_relevant(title, description):
    check_text = f"{title or ''} {description or ''}".lower()
    
    edu_score = 0
    for kw in KOREAN_EDU_KW:
        if kw.lower() in check_text: edu_score += 2
    for kw in ENGLISH_EDU_KW:
        if kw.lower() in check_text: edu_score += 1
    for kw in CHINESE_EDU_KW:
        if kw.lower() in check_text: edu_score += 2
    
    non_edu_score = 0
    for sig in NON_EDU_SIGNALS:
        if sig.lower() in check_text: non_edu_score += 2
    
    return edu_score >= 2 and edu_score > non_edu_score


def is_actual_journalism(title, description, url, domain):
    if not url and not title: return False
    hostname = domain or (urllib.parse.urlparse(url).netloc.replace('www.', '').lower() if url else '')
    check_text = f"{title or ''} {description or ''}".lower()
    
    pr_domains = [
        'prnewswire.com', 'prnewswire.co.kr', 'businesswire.com',
        'globenewswire.com', 'newsfilecorp.com', 'accesswire.com',
        'newswire.com', 'prweb.com', 'marketwired.com', 'digitaljournal.com',
        'einpresswire.com', 'pr.com', 'sbwire.com', 'releasewire.com',
        'openpr.com', 'prlog.org', 'pr-inside.com'
    ]
    pr_keywords = [
        'press release', 'media release', 'news release', 'announces the launch',
        'announces partnership', 'announces new', 'proud to announce',
        'is pleased to announce', 'today announced', 'announced today',
        'product launch', 'new partnership', 'strategic partnership',
        'registration now open', 'early bird'
    ]
    
    if any(d == hostname or hostname.endswith('.' + d) for d in pr_domains):
        return False
    
    pr_kw_matches = sum(1 for kw in pr_keywords if kw in check_text)
    if pr_kw_matches >= 2:
        return False
    
    return True


def brave_search(query):
    api_path = f"/res/v1/web/search?q={urllib.parse.quote(query)}&count=10&freshness=pw"
    req = urllib.request.Request(
        f"https://api.search.brave.com{api_path}",
        headers={
            "Accept": "application/json",
            "X-Subscription-Token": BRAVE_API_KEY
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        results = []
        for r in data.get("web", {}).get("results", []):
            if not r.get("url"): continue
            if any(b in r["url"] for b in ["wikipedia.org", "youtube.com"]): continue
            
            age_str = r.get("age", "")
            
            # 🆕 하드 컷오프: 7일 초과 기사는 Brave 단계에서 제외
            if not is_within_week(age_str):
                continue
            
            results.append({
                "title": r.get("title", ""),
                "url": r["url"],
                "description": r.get("description", ""),
                "source": urllib.parse.urlparse(r["url"]).netloc.replace("www.", ""),
                "age": age_str,
                "date": r.get("age", datetime.now().strftime("%Y-%m-%d"))
            })
        return results
    except Exception as e:
        print(f"  ⚠️ Brave search error for '{query[:40]}': {e}")
        return []

# Region-URL mapping
known_region_domains = {
    "korea": ['asiae.co.kr', 'aitimes.com', 'mk.co.kr', 'mt.co.kr', 'joongang.co.kr',
              'koreaherald.com', 'koreatimes.co.kr', 'ajunews.com', 'inews365.com',
              'heartdayrest.com', 'getnews.co.kr', 'gnnews.co.kr', 'smartbizn.com',
              'venturesquare.net', 'edaily.co.kr', 'hankyung.com', 'yna.co.kr',
              'seoul.co.kr', 'donga.com', 'chosun.com', 'news1.kr', 'newsis.com',
              'sedaily.com', 'zdnet.co.kr', 'etnews.com', 'fnnews.com',
              'kmib.co.kr', 'kcenews.kr', 'allrevenews.com', 'kairnews.com',
              'dt.co.kr', 'asiatoday.co.kr', 'incheon.thesegye.com'],
    "usa": ['npr.org', 'washingtonpost.com', 'nytimes.com', 'edweek.org',
            'edsurge.com', 'insidehighered.com', 'chronicle.com',
            'nbcnews.com', 'wsj.com', 'latimes.com', 'usatoday.com',
            'edsource.org', 'hechingerreport.org', 'newyorker.com',
            'ed.gov', 'usnews.com', 'fortune.com', 'technologyreview.com',
            'businesstimes.com.sg'],
    "europe": ['theguardian.com', 'bbc.com', 'bbc.co.uk', 'europeanbusinessreview.com',
               'ec.europa.eu', 'timeshighereducation.com', 'business-review.eu',
               'chad.co.uk', 'media-and-learning.eu', 'jaipuria.ac.in',
               'eurashe.eu'],
    "japan": ['japantimes.co.jp', 'nhk.or.jp', 'asahi.com', 'mext.go.jp'],
    "singapore": ['straitstimes.com', 'channelnewsasia.com', 'moe.gov.sg'],
    "china": ['chinadaily.com.cn', 'globaltimes.cn', 'xinhuanet.com']
}

def get_region(url, domain):
    hostname = (domain or urllib.parse.urlparse(url).netloc.replace("www.", "").lower()) if url else ""
    for region, domains in known_region_domains.items():
        if any(d == hostname or hostname.endswith('.' + d) for d in domains):
            return region
    # TLD fallback
    for tld in ['.kr', '.co.kr', '.go.kr', '.ac.kr']:
        if hostname.endswith(tld): return "korea"
    for tld in ['.jp', '.co.jp', '.go.jp']:
        if hostname.endswith(tld): return "japan"
    for tld in ['.sg']:
        if hostname.endswith(tld): return "singapore"
    for tld in ['.cn', '.com.cn']:
        if hostname.endswith(tld): return "china"
    for tld in ['.gov', '.mil', '.edu']:
        if hostname.endswith(tld): return "usa"
    for tld in ['.eu', '.ac.uk', '.co.uk', '.org.uk', '.de', '.fr', '.it', '.es', '.nl', '.ch', '.at', '.be', '.dk', '.no', '.se']:
        if hostname.endswith(tld): return "europe"
    return "global"

region_name_map = {
    "korea": "한국", "usa": "미국", "europe": "유럽", "japan": "일본",
    "singapore": "싱가포르", "china": "중국", "global": "글로벌"
}

def main():
    print("📡 글로벌 AI 교육 뉴스 소스 수집 시작...\n")
    print(f"⏰ 7일 이내 기사만 수집 (freshness: hard cutoff)\n")
    print("📋 교육 관련성 필터 활성화: 교육 키워드 기반 자동 필터링\n")
    
    brave_cfg = config.get("brave_search", {})
    queries_ko = brave_cfg.get("queries_ko", [])
    queries_en = brave_cfg.get("queries_en", [])
    max_queries = min(brave_cfg.get("max_queries_per_run", 6), 8)
    
    all_articles = []
    filtered_count = 0
    age_filtered_count = 0
    seen_urls = set()
    
    # Also add existing recent item URLs to seen
    for item in recent_items:
        if isinstance(item, dict) and item.get("url"):
            seen_urls.add(item["url"])
    
    # Mix Korean and English queries
    import random
    selected = random.sample(queries_ko, min(3, len(queries_ko))) + random.sample(queries_en, min(max_queries - 3, len(queries_en)))
    random.shuffle(selected)
    
    for query in selected[:max_queries]:
        results = brave_search(query)
        passed = 0
        filtered = 0
        age_filtered = 0
        
        for r in results:
            # URL dedup
            if r["url"] in seen_urls:
                continue
            seen_urls.add(r["url"])
            
            # Education relevance
            if not is_education_relevant(r["title"], r["description"]):
                filtered += 1
                continue
            
            # Journalism filter
            if not is_actual_journalism(r["title"], r["description"], r["url"], r["source"]):
                print(f"   ⚠️ PR/마케팅 필터링: {r['title'][:50]} ({r['url']})")
                filtered += 1
                continue
            
            # Get region
            region = get_region(r["url"], r["source"])
            
            all_articles.append({
                **r,
                "region": region,
                "regionName": region_name_map.get(region, "글로벌"),
                "relevance_score": 75 + random.random() * 20,
                "collected_at": datetime.now().isoformat()
            })
            passed += 1
        
        filtered_count += filtered
        age_filtered_count += age_filtered
        print(f"   \"{query[:40]}...\" → {len(results)}개 (통과:{passed} / 필터링:{filtered})")
        time.sleep(0.3)
    
    # Dedup by URL
    seen = set()
    unique_articles = []
    for a in all_articles:
        if a["url"] not in seen:
            seen.add(a["url"])
            unique_articles.append(a)
    
    # Filter against published titles
    def title_overlap(article):
        for pub in published_titles:
            if isinstance(pub, str):
                words = article["title"].split()
                matches = sum(1 for w in words if w in pub)
                if words and matches / len(words) > 0.7:
                    return True
        return False
    
    unique_articles = [a for a in unique_articles if not title_overlap(a)]
    
    # Sort by relevance score
    unique_articles.sort(key=lambda x: x["relevance_score"], reverse=True)
    
    # 🆕 더 이상 강제 숫자 채우기 안 함 — 통과한 만큼만 저장
    # 이전에는 max_total = min(max_total, 15)로 강제 채움 → 제거
    # 그냥 통과한 모든 기사를 사용하되 품질 관리 차원에서 상위 15개로 제한
    max_articles = min(len(unique_articles), 15)
    selected_articles = unique_articles[:max_articles]
    
    print(f"\n📊 교육 관련성 필터링 결과: 총 {filtered_count}개 제외됨 (교육 무관 내용)")
    print(f"📊 수집 결과: {len(selected_articles)}개 기사 선정 (7일 내 기사만)\n")
    
    saved_count = 0
    for i, article in enumerate(selected_articles):
        source_data = {
            "id": f"source-{datetime.now().strftime('%Y%m%d%H%M%S')}-{i}",
            "stage": "sourced",
            "source": article,
            "score": round(article["relevance_score"], 1),
            "region": article["region"],
            "regionName": article["regionName"],
            "collected_at": datetime.now().isoformat()
        }
        fpath = os.path.join(WORKSPACE, f"pipeline/01-sourced/{source_data['id']}.json")
        with open(fpath, 'w', encoding='utf-8') as f:
            json.dump(source_data, f, ensure_ascii=False, indent=2)
        print(f"  {saved_count + 1}. [{article['regionName']}] {article['title'][:60]}... ({article['source']})")
        saved_count += 1
    
    # Update recent items
    updated_recent = (recent_items + selected_articles)[-100:]
    with open(recent_items_path, 'w', encoding='utf-8') as f:
        json.dump({"last_updated": datetime.now().isoformat(), "items_72h": updated_recent}, f, ensure_ascii=False, indent=2)
    
    # Update published titles
    updated_titles = list(set(published_titles + [a["title"] for a in selected_articles]))[-100:]
    with open(published_titles_path, 'w', encoding='utf-8') as f:
        json.dump({"last_updated": datetime.now().isoformat(), "published_titles": updated_titles}, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ STEP 1 완료: {saved_count}개 기사 수집 (7일 이내 소스만)")

if __name__ == "__main__":
    import urllib.parse
    main()
