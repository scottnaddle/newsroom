#!/usr/bin/env python3
"""
국내 에듀테크 기업 뉴스 수집기 (Korean EdTech Company News Collector)
=====================================================================
korean-edtech-companies.json 기반으로 Brave Search를 통해
국내 에듀테크 기업 관련 뉴스를 수집하여 pipeline/01-sourced/에 저장.

Usage:
    python3 scripts/collect-korean-edtech.py [--dry-run]

Output format (per article JSON):
    {
        "id": "edtech-{timestamp}-{seq}",
        "stage": "sourced",
        "source": { "title", "url", "source": "domain.com", "date": "YYYY-MM-DD" },
        "score": int(0-100),
        "collected_at": "ISO datetime",
        "company_tag": {
            "name_ko": "뤼이드",
            "name_en": "Riiid",
            "category": "ai-tutoring"
        }
    }
"""

import json, os, re, time, urllib.request, urllib.parse, urllib.error, sys
from datetime import datetime, timezone, timedelta

WORKSPACE = "/root/.openclaw/workspace/newsroom"
COMPANIES_FILE = os.path.join(WORKSPACE, "shared/config/korean-edtech-companies.json")
SOURCES_DIR = os.path.join(WORKSPACE, "pipeline/01-sourced")
RECENT_ITEMS_FILE = os.path.join(WORKSPACE, "pipeline/memory/recent-items.json")
BRAVE_API_KEY = os.environ.get("BRAVE_API_KEY", "")

# Fallback: try .env
if not BRAVE_API_KEY:
    env_file = os.path.join(WORKSPACE, ".env")
    if os.path.exists(env_file):
        import re as _re
        m = _re.search(r'BRAVE_API_KEY=(.+)', open(env_file).read())
        if m:
            BRAVE_API_KEY = m.group(1).strip()

DEDUP_WINDOW_HOURS = 72

MAX_AGE_DAYS = 7  # ⏰ 7일 초과 기사는 제외


def parse_age_days(age_str):
    """Parse Brave Search API 'age' field into approximate days."""
    if not age_str:
        return None
    age_str = age_str.strip().lower()
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
    try:
        pub_date = datetime.strptime(age_str[:10], '%Y-%m-%d')
        delta = datetime.now() - pub_date
        return delta.days
    except (ValueError, IndexError):
        pass
    return None


def is_within_week(age_str):
    """Check if article age is within MAX_AGE_DAYS."""
    days = parse_age_days(age_str)
    if days is None:
        return True  # 보수적: 판단 불가면 통과
    return days <= MAX_AGE_DAYS


NON_EDU_SIGNALS = [
    '의료', '병원', '진단', '치료', '수술', '약물', '환자', '임상',
    '단백질', '유전자', '게놈', 'DNA', 'RNA', '세포', '바이러스',
    '방사선', 'MRI', 'CT', '의학', '제약', '신약',
    'medical', 'diagnosis', 'cancer', 'clinical', 'protein',
    'genome', 'genetic', 'drug', 'patient', 'surgery',
    'protein interaction', 'molecule', 'biomarker',
    'wildfire', '산불', '지진', '화재', '태풍', '홍수',
    'baseball', '축구', '야구', 'sports', 'entertainment',
    '주식', 'stock market', '부동산', 'real estate',
]


def load_companies():
    """Load company database"""
    with open(COMPANIES_FILE, encoding='utf-8') as f:
        db = json.load(f)
    return db["companies"], db.get("_meta", {})


def load_recent_items():
    """Load recent items for dedup"""
    try:
        with open(RECENT_ITEMS_FILE) as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        return data.get("items_72h", [])
    except:
        return []


def save_recent_items(items):
    """Save recent items"""
    try:
        existing = load_recent_items()
        all_items = items + existing
        # Keep only last 500
        all_items = all_items[:500]
        with open(RECENT_ITEMS_FILE, 'w') as f:
            json.dump({"items_72h": all_items, "updated_at": datetime.now().isoformat()}, f, ensure_ascii=False)
    except Exception as e:
        print(f"  ⚠️ Failed to save recent items: {e}")


def is_education_relevant(title, description):
    """Check if article is education-related"""
    check_text = f"{title or ''} {description or ''}".lower()

    # 에듀테크/기업 관련 키워드는 가산점
    edu_keywords = [
        '에듀테크', '교육', '학교', '교실', '교사', '학생', '수업', '학원',
        '대학', '학습', '교과', '교육과정', '튜터', '강의', '강좌',
        '교육부', '교육청', '교과서', '방과후', '진학', '입시',
        '인재양성', '교육자', '교직', '교육기관', '교육계',
        'edtech', 'education', 'learning', 'teaching', 'classroom',
        'tutoring', 'tutor', 'curriculum', 'AI 교육', 'AI 학습',
        '에듀', 'edu', 'school', 'student', 'teacher',
    ]

    non_edu_keywords = [
        '의료', '병원', '진단', '치료', '수술', '약물', '환자',
        'medical', 'clinical', 'cancer', 'protein',
        '산불', 'wildfire', '태풍', '화재',
        '선거', 'election', 'poll',
        '부동산', 'real estate', '주식시장',
    ]

    edu_score = sum(2 for kw in edu_keywords if kw in check_text)
    non_edu_score = sum(3 for sig in non_edu_keywords if sig in check_text)

    return edu_score >= 2 and edu_score > non_edu_score


def is_duplicate(url, title, recent_items):
    """Check if article was recently collected"""
    url_lower = url.lower().rstrip('/')
    title_lower = title.lower().strip()

    for item in recent_items:
        item_url = (item.get("url", "") or "").lower().rstrip('/')
        if item_url == url_lower:
            return True
        item_title = (item.get("title", "") or "").lower().strip()
        if item_title and title_lower and (
            item_title == title_lower or
            item_title in title_lower or
            title_lower in item_title
        ):
            return True
    return False


def brave_search(query, freshness="pw"):
    """Call Brave Search API"""
    params = urllib.parse.urlencode({
        "q": query,
        "count": 10,
        "freshness": freshness,
    })
    req = urllib.request.Request(
        f"https://api.search.brave.com/res/v1/web/search?{params}",
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
            if not r.get("url"):
                continue
            # Skip non-news sources
            domain = urllib.parse.urlparse(r["url"]).netloc.replace("www.", "").lower()
            skip_domains = ["wikipedia.org", "namu.wiki", "youtube.com", "instagram.com",
                           "facebook.com", "linkedin.com", "twitter.com", "x.com"]
            if any(d == domain or domain.endswith("." + d) for d in skip_domains):
                continue

            # ⏰ 7일 하드 컷오프
            age_str = r.get("age", "")
            if not is_within_week(age_str):
                continue

            results.append({
                "title": r.get("title", ""),
                "url": r["url"],
                "description": r.get("description", ""),
                "source": domain,
                "age": age_str,
                "date": r.get("age", datetime.now().strftime("%Y-%m-%d"))
            })
        return results
    except urllib.error.HTTPError as e:
        if e.code == 422:
            print(f"  ⚠️ Brave API subscription invalid (422) for '{query[:30]}...'")
        else:
            print(f"  ⚠️ Brave API HTTP {e.code} for '{query[:30]}...'")
        return []
    except Exception as e:
        print(f"  ⚠️ Brave search error for '{query[:30]}...': {e}")
        return []


def main():
    dry_run = "--dry-run" in sys.argv

    print("=" * 60)
    print(f"🇰🇷 국내 에듀테크 기업 뉴스 수집기")
    print(f"   {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    if dry_run:
        print("   🔍 DRY RUN 모드 (저장 안 함)")
    print("=" * 60)

    # Load company database
    companies, meta = load_companies()
    print(f"\n📋 기업 DB: {len(companies)}개 항목")
    categories = meta.get("categories", {})

    # Load recent items for dedup
    recent_items = load_recent_items()
    existing_urls = set(item.get("url", "").lower().rstrip('/') for item in recent_items)
    print(f"📦 기존 수집 URL: {len(existing_urls)}개 (72h 윈도우)")

    # Collect per company
    all_new = []
    companies_with_news = 0
    total_search_calls = 0

    for company in companies:
        query_terms = company.get("query_terms", [])
        if not query_terms:
            continue

        company_news = []
        for query in query_terms:
            total_search_calls += 1
            results = brave_search(query)
            if not results:
                continue

            for r in results:
                title = r.get("title", "")
                url = r.get("url", "")
                description = r.get("description", "")

                # Skip duplicates
                if is_duplicate(url, title, recent_items):
                    continue

                check_text = f"{title} {description}".lower()
                company_name = company.get("name_ko", "").lower()
                company_name_en = company.get("name_en", "").lower()

                # 📌 핵심: 회사명(또는 대표 제품명)이 title이나 description에 실제로 등장해야 함
                # 검색어만으로 가져오지 않고, 기사 내용에 회사명이 있는지 확인
                company_mentioned = any(
                    t.lower() in check_text
                    for t in query_terms
                    if len(t) >= 2
                )

                if not company_mentioned:
                    # 회사명이 기사에 없으면 키워드 기반 일반 에듀테크 뉴스로만 처리
                    # '에듀테크 일반' 카테고리인 경우는 예외 (이미 충분히 넓은 쿼리)
                    if company.get("category") != "general":
                        continue

                # Education relevance filter
                is_relevant = is_education_relevant(title, description)

                # Non-education signals filter
                check_lower = check_text
                non_edu_score = sum(3 for sig in NON_EDU_SIGNALS if sig.lower() in check_lower)

                if non_edu_score > 2:
                    continue

                if not is_relevant and not company_mentioned:
                    continue

                # Score: base 50 + bonuses
                score = 50
                edu_words = ['교육', '에듀', '학교', '대학', '학생', '학습', '튜터',
                            '투자', '유치', '펀딩', '출시', '파트너십', 'MOU',
                            '실적', '매출', '인수', '합병', '계약']
                score += sum(10 for w in edu_words if w in title.lower())
                if company_mentioned:
                    score += 20
                score = min(score, 100)

                # 최소 점수 필터 (60점 미만 스킵)
                if score < 60:
                    continue

                article = {
                    "id": f"edtech-{int(time.time())}-{len(all_new) + len(company_news)}",
                    "stage": "sourced",
                    "source": {
                        "title": title,
                        "url": url,
                        "source": r.get("source", ""),
                        "date": r.get("date", datetime.now().strftime("%Y-%m-%d"))
                    },
                    "score": score,
                    "collected_at": datetime.now(timezone.utc).isoformat(),
                    "company_tag": {
                        "name_ko": company["name_ko"],
                        "name_en": company["name_en"],
                        "category": company.get("category", "general")
                    }
                }

                company_news.append(article)
                all_new.append(article)

            # Avoid rate limiting
            time.sleep(0.3)

        if company_news:
            companies_with_news += 1
            print(f"  📰 {company['name_ko']:12s} → {len(company_news)}건")

    print(f"\n📊 수집 결과:")
    print(f"   Brave Search 호출: {total_search_calls}회")
    print(f"   뉴스 발견 기업: {companies_with_news}/{len(companies)}개")
    print(f"   신규 수집: {len(all_new)}건")

    if dry_run:
        print("\n🔍 DRY RUN — 저장하지 않음")
        print("\n=== 샘플 (최대 3개) ===")
        for i, a in enumerate(all_new[:3]):
            print(f"\n  [{i+1}] {a['source']['title'][:50]}")
            print(f"      회사: {a['company_tag']['name_ko']} ({a['company_tag']['category']})")
            print(f"      URL: {a['source']['url'][:60]}")
            print(f"      점수: {a['score']}")
        sys.exit(0)

    if not all_new:
        print("\n✅ 신규 기사 없음")
        return

    # Save to 01-sourced/
    os.makedirs(SOURCES_DIR, exist_ok=True)
    saved = 0
    for article in all_new:
        # Create readable filename
        company_slug = article["company_tag"]["name_en"].lower().replace(" ", "-")[:20]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        seq = str(all_new.index(article)).zfill(3)
        filename = f"edtech-{timestamp}-{company_slug}-{seq}.json"
        filepath = os.path.join(SOURCES_DIR, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(article, f, ensure_ascii=False, indent=2)
        saved += 1

    # Update recent items
    new_items = [{
        "url": a["source"]["url"],
        "title": a["source"]["title"],
        "collected_at": a["collected_at"],
        "company": a["company_tag"]["name_ko"]
    } for a in all_new]
    save_recent_items(new_items)

    print(f"\n✅ 저장 완료: {saved}건 → pipeline/01-sourced/")
    print("📡 다음 파이프라인 단계(Reporter)가 자동 처리합니다.")
    print("=" * 60)


if __name__ == "__main__":
    main()
