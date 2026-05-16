#!/usr/bin/env python3
"""
국내 에듀테크 기업 자동 발굴기 (Korean EdTech Company Auto-Discovery)
======================================================================
Brave Search로 에듀테크/교육 관련 기업을 검색하고, 
korean-edtech-companies.json에 없는 신규 기업을 자동으로 추가합니다.

Usage:
    python3 scripts/discover-korean-edtech-companies.py [--dry-run]
    
동작 방식:
    1. 기존 기업 DB 로드
    2. Brave Search로 에듀테크 기업 관련 키워드 검색
    3. DeepSeek LLM으로 신규 기업명/카테고리 추출
    4. 기존 DB와 중복 체크
    5. 조건 충족 시 korean-edtech-companies.json에 자동 추가
"""

import json, os, re, time, urllib.request, urllib.parse, urllib.error, sys
from datetime import datetime

WORKSPACE = "/root/.openclaw/workspace/newsroom"
COMPANIES_FILE = os.path.join(WORKSPACE, "shared/config/korean-edtech-companies.json")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
BRAVE_API_KEY = os.environ.get("BRAVE_API_KEY", "")

# Fallback: .env
if not BRAVE_API_KEY:
    m = re.search(r'BRAVE_API_KEY=(.+)', open(os.path.join(WORKSPACE, ".env")).read())
    if m: BRAVE_API_KEY = m.group(1).strip()
if not DEEPSEEK_API_KEY:
    m = re.search(r'DEEPSEEK_API_KEY=(.+)', open(os.path.join(WORKSPACE, ".env")).read())
    if m: DEEPSEEK_API_KEY = m.group(1).strip()

DISCOVERY_QUERIES = [
    # 한국 에듀테크 기업 리스트/동향
    "에듀테크 스타트업 기업 2026",
    "AI교육 스타트업 국내",
    "국내 에듀테크 기업 투자 유치",
    "교육 테크 스타트업 시리즈",
    "에듀테크 유니콘 한국",
    "AI 튜터링 기업 국내",
    "에듀테크 신규 창업",
    "스마트교육 스타트업",
    "코딩교육 기업 국내",
    "AI 디지털교과서 기업",
    "교육플랫폼 스타트업",
    "에듀테크 프리IPO",
    "국내 교육 AI 기업",
]

CATEGORY_KEYWORDS = {
    "ai-tutoring": "ai tutoring, personalized learning, ai tutor, 적응형 학습, AI 튜터, 개인화 학습",
    "edtech-platform": "edtech platform, smart education, learning platform, 에듀테크 플랫폼, 스마트교육",
    "publishing": "digital textbook, education content, publishing, 디지털교과서, 교육콘텐츠",
    "test-prep": "test prep, exam, entrance exam, 입시, 수능, 자격증",
    "corporate-edu": "corporate training, employee education, 직무교육, 기업교육",
    "coding-edu": "coding education, programming, software education, 코딩교육, SW교육",
    "special-edu": "special education, learning disability, 특수교육, 기초학력",
    "general": "edtech general, education technology, 에듀테크",
}


def load_existing_companies():
    """Load current company database"""
    with open(COMPANIES_FILE, encoding='utf-8') as f:
        db = json.load(f)
    return db["companies"], db.get("_meta", {})


def save_companies(companies, meta=None):
    """Save updated company database"""
    with open(COMPANIES_FILE, encoding='utf-8') as f:
        db = json.load(f)
    db["companies"] = companies
    if meta:
        db["_meta"]["last_updated"] = meta.get("last_updated", datetime.now().strftime("%Y-%m-%d"))
    with open(COMPANIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {COMPANIES_FILE} 저장 완료 ({len(companies)}개 기업)")


def call_llm(prompt, system_prompt="You are a precise data extraction assistant. Extract information in JSON format only."):
    """Call DeepSeek API"""
    if not DEEPSEEK_API_KEY:
        print("  ⚠️ DEEPSEEK_API_KEY not set")
        return None
    
    data = json.dumps({
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 2000,
    }).encode()

    req = urllib.request.Request(
        f"{DEEPSEEK_BASE_URL}/chat/completions",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
        }
    )
    try:
        resp = json.loads(urllib.request.urlopen(req, timeout=60).read())
        return resp["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"  ⚠️ LLM call failed: {e}")
        return None


def brave_search(query, freshness="month"):
    """Call Brave Search with monthly freshness"""
    params = urllib.parse.urlencode({
        "q": query,
        "count": 5,
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
            domain = urllib.parse.urlparse(r["url"]).netloc.replace("www.", "").lower()
            skip = ["wikipedia.org", "namu.wiki", "youtube.com", "instagram.com",
                   "facebook.com", "linkedin.com", "twitter.com", "x.com",
                   "slideshare.net", "github.com"]
            if any(d == domain or domain.endswith("." + d) for d in skip):
                continue
            results.append({
                "title": r.get("title", ""),
                "url": r["url"],
                "description": r.get("description", ""),
                "source": domain,
            })
        return results
    except Exception as e:
        return []


def extract_new_companies_llm(search_results_text):
    """Use LLM to extract new edtech company names + categories"""
    prompt = f"""You are analyzing Korean edtech news to discover new companies.

아래는 국내 에듀테크 관련 뉴스 제목과 설명입니다. 여기서 언급된 **교육/에듀테크 관련 기업/스타트업**을 추출하세요.

**규칙:**
1. 교육(학교, 학습, 튜터링, 교과서, 입시, 코딩 등)과 직접 관련된 기업만 추출
2. 대기업(삼성, LG, SK, KT, 네이버, 카카오)의 교육 사업부는 제외 (너무 일반적)
3. 순수 교육 기업(학원, 교습소, 출판사)이 아닌, **기술/플랫폼 기반 에듀테크 기업**만 포함
4. 영문명이 있으면 함께 추출
5. 한 번에 여러 기업이 나와도 모두 추출

**출력 형식 (반드시 아래 JSON 배열 형식으로만 출력):**
```json
[
  {{"name_ko": "회사명", "name_en": "영문명(없으면 빈칸)", "category": "ai-tutoring|edtech-platform|publishing|test-prep|corporate-edu|coding-edu|special-edu|general", "evidence": "이 기업이 발견된 뉴스 문장 1-2개"}}
]
```

**카테고리 설명:**
- ai-tutoring: AI 기반 개인화 학습/튜터링
- edtech-platform: 교육 플랫폼/스마트교육
- publishing: 디지털교과서/교육콘텐츠/출판
- test-prep: 입시/수능/자격증
- corporate-edu: 기업교육/직무교육
- coding-edu: 코딩/SW교육
- special-edu: 특수교육/기초학력
- general: 기타 에듀테크

**뉴스 데이터:**
{search_results_text}
"""

    response = call_llm(prompt)
    if not response:
        return []
    
    # Extract JSON from response
    try:
        # Find JSON array in response
        json_match = re.search(r'\[\s*\{.*\}\s*\]', response, re.DOTALL)
        if json_match:
            companies = json.loads(json_match.group())
        else:
            # Try parsing entire response
            companies = json.loads(response)
        
        if not isinstance(companies, list):
            companies = [companies]
        
        return companies
    except json.JSONDecodeError:
        print(f"  ⚠️ Failed to parse LLM response as JSON")
        return []


def is_duplicate_company(name_ko, name_en, existing_companies):
    """Check if company already exists in DB"""
    name_lower = name_ko.lower().strip()
    name_en_lower = (name_en or "").lower().strip()
    
    for c in existing_companies:
        if c["name_ko"].lower().strip() == name_lower:
            return True
        if name_en_lower and c.get("name_en", "").lower().strip() == name_en_lower:
            return True
        # Partial match on company names
        if len(name_lower) >= 3 and name_lower in c["name_ko"].lower():
            return True
    return False


def is_valid_company_name(name):
    """Basic validation: at least 2 chars, no obvious junk"""
    if not name or len(name.strip()) < 2:
        return False
    # Skip if looks like random text
    if re.match(r'^[a-zA-Z0-9_-]+$', name) and len(name) < 4:
        return False
    return True


def generate_query_terms(name_ko, name_en, category):
    """Auto-generate search query terms for a new company"""
    terms = []
    
    # Korean name
    if name_ko and len(name_ko) >= 2:
        if category and category not in ("general",):
            terms.append(f"{name_ko} 교육")
        terms.append(name_ko)
    
    # English name
    if name_en and len(name_en) >= 3:
        if category and category not in ("general",):
            terms.append(f"{name_en} edtech")
        terms.append(name_en)
    
    # Deduplicate and limit to 3
    seen = set()
    unique = []
    for t in terms:
        if t not in seen:
            seen.add(t)
            unique.append(t)
    
    return unique[:3]


def main():
    dry_run = "--dry-run" in sys.argv
    
    print("=" * 60)
    print(f"🔍 국내 에듀테크 기업 자동 발굴기")
    print(f"   {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    if dry_run:
        print("   🔍 DRY RUN 모드 (저장 안 함)")
    print("=" * 60)
    
    # 1️⃣ 기존 기업 DB 로드
    existing_companies, meta = load_existing_companies()
    existing_names = [c["name_ko"] for c in existing_companies]
    print(f"\n📋 기존 기업: {len(existing_companies)}개")
    print(f"   {' · '.join(existing_names[:10])}{' ...' if len(existing_names) > 10 else ''}")
    
    # 2️⃣ Brave Search로 에듀테크 기업 검색
    print(f"\n🔎 에듀테크 기업 검색 중...")
    all_results = []
    for i, query in enumerate(DISCOVERY_QUERIES):
        results = brave_search(query)
        if results:
            all_results.extend(results)
            print(f"  [{i+1}/{len(DISCOVERY_QUERIES)}] {query[:25]:25s} → {len(results)}건")
        else:
            print(f"  [{i+1}/{len(DISCOVERY_QUERIES)}] {query[:25]:25s} → 0건")
        time.sleep(0.5)  # Rate limit 방지
    
    # Remove duplicates
    seen_urls = set()
    unique_results = []
    for r in all_results:
        url = r["url"].lower().rstrip('/')
        if url not in seen_urls:
            seen_urls.add(url)
            unique_results.append(r)
    
    print(f"\n📦 총 {len(unique_results)}개 고유 결과 수집")
    
    if not unique_results:
        print("❌ 검색 결과 없음")
        return
    
    # 3️⃣ LLM으로 신규 기업 추출
    print(f"\n🧠 LLM으로 신규 기업 분석 중...")
    
    # Prepare search results text for LLM (limit to avoid token overflow)
    search_lines = []
    for r in unique_results[:40]:  # 최대 40개
        line = f"- [{r['source']}] {r['title']}"
        if r.get("description"):
            line += f"\n  {r['description'][:200]}"
        search_lines.append(line)
    search_text = "\n".join(search_lines)
    
    new_companies = extract_new_companies_llm(search_text)
    
    if not new_companies:
        print("  ℹ️ 신규 기업 발견되지 않음")
        return
    
    print(f"\n📊 LLM 추출 결과: {len(new_companies)}개")
    
    # 4️⃣ 중복 체크 및 유효성 검사
    truly_new = []
    for c in new_companies:
        name_ko = c.get("name_ko", "").strip()
        name_en = c.get("name_en", "").strip()
        category = c.get("category", "general")
        evidence = c.get("evidence", "")
        
        if not is_valid_company_name(name_ko):
            print(f"  ⏭️ 유효하지 않은 이름: '{name_ko}'")
            continue
        
        if is_duplicate_company(name_ko, name_en, existing_companies):
            print(f"  ⏭️ 기존 등록: {name_ko}")
            continue
        
        # Auto-generate query terms
        query_terms = generate_query_terms(name_ko, name_en, category)
        
        new_entry = {
            "name_ko": name_ko,
            "name_en": name_en or name_ko,
            "category": category,
            "query_terms": query_terms,
            "description": evidence[:100] if evidence else f"AI 자동 발굴된 에듀테크 기업",
            "public": False,
            "url_patterns": [],
            "_discovered_at": datetime.now().isoformat(),
            "_evidence": evidence
        }
        
        truly_new.append(new_entry)
        print(f"  🆕 {name_ko:15s} ({name_en:20s}) [{category:15s}]")
        if evidence:
            print(f"     근거: {evidence[:80]}...")
    
    if not truly_new:
        print("\n✅ 신규 기업 없음 (모두 기존 등록)")
        return
    
    print(f"\n📊 추가 대상: {len(truly_new)}개 신규 기업")
    
    if dry_run:
        print("\n🔍 DRY RUN — 저장하지 않음")
        print(f"\n=== 추가 예정 기업 목록 ===")
        for c in truly_new:
            print(f"  • {c['name_ko']} ({c['name_en']}) — [{c['category']}]")
        print(f"  검색어: {c['query_terms']}")
        sys.exit(0)
    
    # 5️⃣ 기업 DB 업데이트
    existing_companies.extend(truly_new)
    save_companies(existing_companies, {"last_updated": datetime.now().strftime("%Y-%m-%d")})
    
    print(f"\n🎉 {len(truly_new)}개 신규 에듀테크 기업 DB 추가 완료!")
    print(f"📋 전체 기업: {len(existing_companies)}개")
    print("=" * 60)


if __name__ == "__main__":
    main()
