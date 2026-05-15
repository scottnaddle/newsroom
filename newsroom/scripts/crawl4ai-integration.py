#!/usr/bin/env python3
"""
Crawl4AI Newsroom Integration v2 — 이미지 수집 분리
====================================================
  Task 1. Deep crawl known news sites for article DISCOVERY
  Task 2. Crawl edtech company sites for updates

  ⚠️ 콘텐츠 추출/이미지 수집은 crawl4ai-images.py가 전담
  ⚠️ 본 스크립트는 URL 발견(discovery) + 기업 사이트 크롤링만 수행

Output: pipeline/01-sourced/{id}.json (discovery items)
"""

import asyncio, json, os, re, sys
from datetime import datetime, timezone

NEWSROOM_DIR = "/root/.openclaw/workspace/newsroom"
SOURCED_DIR = f"{NEWSROOM_DIR}/pipeline/01-sourced"
RECENT_FILE = f"{NEWSROOM_DIR}/pipeline/memory/recent-items.json"

# === 교육 뉴스 사이트 (discovery): category page → article link 수집 ===
NEWS_SITES = {
    "global": [
        "https://www.forbes.com/education/",
        "https://www.edsurge.com/",
        "https://www.edweek.org/",
        "https://www.insidehighered.com/",
        "https://www.universityworldnews.com/",
        "https://www.oecd.org/education/",
        "https://www.unesco.org/en/digital-education",
    ],
    "korea": [
        "https://www.etnews.com/",
        "https://www.kedglobal.com/education",
        "https://www.hankyung.com/education",
        "https://www.edaily.co.kr/",
    ],
    "china": [
        "https://global.chinadaily.com.cn/education",
        "https://www.xinhuanet.com/english/education",
    ],
    "japan": [
        "https://japantoday.com/category/education",
    ]
}

EDTECH_COMPANIES = [
    {"name": "Riiid", "url": "https://riiid.co/blog"},
    {"name": "Knewton", "url": "https://www.knewton.com/resources/"},
    {"name": "Duolingo", "url": "https://blog.duolingo.com/"},
    {"name": "Coursera", "url": "https://blog.coursera.org/"},
]


def load_recent():
    try:
        with open(RECENT_FILE) as f:
            data = json.load(f)
            items = data.get("items_72h", []) if isinstance(data, dict) else data
        return set(item.get("url", "") for item in items if isinstance(item, dict))
    except:
        return set()


def is_edu_relevant(text):
    keywords = ["education", "ai", "learning", "student", "teacher", "school",
                "edtech", "digital", "classroom", "curriculum", "online course",
                "tutoring", "mooc", "educational", "university", "training",
                "인공지능", "교육", "학습", "에듀테크", "교실", "학교", "교사"]
    t = text.lower()
    return sum(1 for kw in keywords if kw in t) >= 2


def save_sourced(title, url, source_name, region, score=75):
    ts = int(datetime.now().timestamp())
    item = {
        "id": f"crawl4ai-{ts}-{abs(hash(url)) % 1000:03d}",
        "stage": "sourced",
        "source": {
            "title": title,
            "url": url,
            "source": source_name,
            "date": datetime.now().strftime("%Y-%m-%d"),
        },
        "score": score,
        "region": region,
        "regionName": {"korea": "Korea", "global": "Global", "china": "China",
                       "japan": "Japan"}.get(region, region),
        "collected_at": datetime.now(timezone.utc).isoformat()
    }
    fname = f"{SOURCED_DIR}/{item['id']}.json"
    with open(fname, "w") as f:
        json.dump(item, f, indent=2, ensure_ascii=False)
    return fname


async def discover_articles(crawler, url, region):
    """
    사이트 방문 → 페이지 타이틀 추출 (discovery 목적)
    콘텐츠 추출/이미지 수집은 crawl4ai-images.py가 담당
    """
    from crawl4ai import CrawlerRunConfig, CacheMode

    config = CrawlerRunConfig(
        word_count_threshold=10,
        cache_mode=CacheMode.ENABLED,
        excluded_tags=["nav", "footer", "header", "aside", "script", "style",
                       "noscript", "form", "button", "svg", "dialog", "iframe"],
    )
    result = await crawler.arun(url=url, config=config)
    if not result or not result.success:
        return None

    md = result.markdown or ""
    if len(md) < 100:
        return None

    # Extract first meaningful line as title
    title = ""
    for line in md.split("\n"):
        s = line.strip()
        if s.startswith("# ") and len(s) > 5:
            title = s.lstrip("# ").strip()
            break
    if not title:
        title = url
    if len(title) > 120:
        title = title[:120]

    return title


async def crawl_discovery():
    """Task 1: 뉴스 사이트 방문 → 새로운 기사 URL 발견"""
    from crawl4ai import AsyncWebCrawler
    seen = load_recent()
    results = []

    async with AsyncWebCrawler() as crawler:
        for region, urls in NEWS_SITES.items():
            for url in urls:
                if url in seen:
                    continue
                print(f"  🔗 {region}: {url[:60]}...")
                title = await discover_articles(crawler, url, region)
                if not title:
                    print(f"     ⚠️ 방문 실패 (또는 콘텐츠 없음)")
                    continue

                source_name = re.sub(r'https?://(www\.)?', '', url).split('/')[0]
                fpath = save_sourced(title, url, source_name, region)
                print(f"     ✅ 발견 → {os.path.basename(fpath)}")
                results.append({"url": url, "title": title, "file": fpath})
                seen.add(url)

    print(f"\n📊 소스 발견 완료: {len(results)}개 사이트")
    return results


async def crawl_companies():
    """Task 2: 에듀테크 기업 사이트 방문 → 업데이트 발견"""
    from crawl4ai import AsyncWebCrawler
    seen = load_recent()
    results = []

    async with AsyncWebCrawler() as crawler:
        for company in EDTECH_COMPANIES:
            url = company["url"]
            if url in seen:
                continue
            print(f"  🏢 {company['name']}: {url[:60]}...")
            title = await discover_articles(crawler, url, "global")

            if not title:
                print(f"     ⚠️ 방문 실패")
                continue

            display_title = f"{company['name']} - Update"
            fpath = save_sourced(display_title, url, company["name"].lower().replace(" ", "-"), "global", score=80)
            print(f"     ✅ 발견 → {os.path.basename(fpath)}")
            results.append({"company": company["name"], "url": url, "file": fpath})
            seen.add(url)

    print(f"\n📊 기업 사이트 발견 완료: {len(results)}개")
    return results


async def main():
    os.makedirs(SOURCED_DIR, exist_ok=True)
    print("=" * 60)
    print("🚀 Crawl4AI Newsroom Discovery v2")
    print("=" * 60)

    print("\n[1/2] 뉴스 사이트 방문 (소스 발견)...")
    news = await crawl_discovery()

    print("\n[2/2] 에듀테크 기업 사이트 방문...")
    companies = await crawl_companies()

    total = len(news) + len(companies)
    print(f"\n{'=' * 60}")
    print(f"✅ 완료! 총 {total}개 새 사이트 방문")
    print(f"   - 뉴스: {len(news)}개")
    print(f"   - 기업: {len(companies)}개")
    print(f"   - 저장: {SOURCED_DIR}/")
    if total == 0:
        print("   (중복 제외)")
    print(f"{'=' * 60}")

    # 참고: 이미지 수집은 별도 실행
    print(f"\n💡 이미지 수집: python3 scripts/crawl4ai-images.py")


if __name__ == "__main__":
    asyncio.run(main())
