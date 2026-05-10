#!/usr/bin/env python3
"""
Academic Paper Collector for UBION Newsroom (v2 - using arXiv API + Semantic Scholar)
Outputs JSON to paper-pipeline/01-sourced/
"""
import json, os, re, time, urllib.request, urllib.parse, urllib.error, xml.etree.ElementTree as ET
from datetime import datetime

WORKSPACE = '/root/.openclaw/workspace/newsroom'
OUTPUT_DIR = os.path.join(WORKSPACE, 'paper-pipeline', '01-sourced')
MEMORY_DIR = os.path.join(WORKSPACE, 'paper-pipeline', 'memory')

QUERIES = [
    'ti:"AI literacy"',
    'ti:"large language model" AND ti:education',
    'ti:"machine learning" AND ti:education',
    'ti:"intelligent tutoring" AND ti:system',
    'ti:generative AND ti:classroom',
    'ti:AI AND ti:teaching',
]

def fetch_arxiv():
    """Fetch papers from arXiv API with retry logic"""
    papers = []
    
    for q_idx, q in enumerate(QUERIES):
        # Stagger start times to avoid burst
        if q_idx > 0:
            time.sleep(15)
        
        url = f'https://export.arxiv.org/api/query?search_query={urllib.parse.quote(q)}&max_results=3&sortBy=submittedDate&sortOrder=descending'
        
        # Retry loop with exponential backoff
        for attempt in range(5):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'UBION-PaperBot/1.0'})
                resp = urllib.request.urlopen(req, timeout=30)
                xml_data = resp.read().decode('utf-8')
                root = ET.fromstring(xml_data)
                ns = {'a': 'http://www.w3.org/2005/Atom'}
                entries = root.findall('.//a:entry', ns)
                
                for e in entries:
                    t = e.find('a:title', ns)
                    p = e.find('a:published', ns)
                    pid = e.find('a:id', ns)
                    summary = e.find('a:summary', ns)
                    updated = e.find('a:updated', ns)
                    
                    title_text = t.text.strip().replace('\n', ' ') if t is not None and t.text else ''
                    pub_date = p.text[:10] if p is not None and p.text else ''
                    pid_text = pid.text.split('/')[-1] if pid is not None and pid.text else ''
                    summary_text = summary.text.strip().replace('\n', ' ') if summary is not None and summary.text else ''
                    
                    authors = []
                    for a in e.findall('.//a:author', ns):
                        n = a.find('a:name', ns)
                        if n is not None and n.text:
                            authors.append(n.text.strip())
                    
                    categories = []
                    for cat in e.findall('.//a:category', ns):
                        cat_term = cat.get('term', '')
                        if cat_term:
                            categories.append(cat_term)
                    
                    # Get PDF link
                    pdf_url = ''
                    for link in e.findall('.//a:link', ns):
                        if link.get('title') == 'pdf':
                            pdf_url = link.get('href', '')
                            break
                    
                    paper = {
                        'id': pid_text.split('v')[0],  # Base ID without version
                        'title': title_text,
                        'published': pub_date,
                        'updated': updated.text[:10] if updated is not None and updated.text else pub_date,
                        'authors': authors,
                        'categories': categories,
                        'summary': summary_text,
                        'url': f'https://arxiv.org/abs/{pid_text}',
                        'pdf_url': pdf_url,
                        'source': 'arXiv',
                    }
                    
                    # Dedup by base ID
                    if paper['id'] and not any(p['id'] == paper['id'] for p in papers):
                        papers.append(paper)
                
                # Success - break retry loop
                break
                
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    wait = 15 * (attempt + 1)
                    print(f'  ⚠️ 429 rate limit (attempt {attempt+1}), waiting {wait}s...')
                    time.sleep(wait)
                else:
                    print(f'  ⚠️ HTTP error {e.code}: {e}')
                    break
            except Exception as e:
                print(f'  ⚠️ arXiv error: {e}')
                break
    
    return papers

def is_education_relevant(paper):
    """Filter papers to only education-relevant topics"""
    title = paper.get('title', '').lower()
    summary = paper.get('summary', '').lower()
    categories = paper.get('categories', [])
    
    # 강력한 교육 키워드 (이 중 하나라도 있으면 통과)
    edu_keywords = [
        'education', 'classroom', 'teaching', 'learning', 'student', 'teacher',
        'curriculum', 'pedagogy', 'literacy', 'tutoring', 'school',
        'educational', 'learners', 'course', 'class', 'academic',
        '교육', '학습', '교실', '교사', '학생', '튜터링',
        'ai literacy', 'ai education',
    ]
    
    # 제외 키워드 (교육과 무관한 주제)
    exclude_keywords = [
        'wildfire', 'wild fire', 'forest fire', 'earthquake', 'natural disaster',
        'climate risk', 'flood', 'hurricane', 'tornado',
        'protein folding', 'drug discovery', 'molecular', 'genomic',
        'clinical trial', 'diagnosis', 'pathology', 'radiology',
        'autonomous driving', 'self-driving', 'autonomous vehicle',
        'stock market', 'financial', 'crypto', 'blockchain',
        '산불', '지진', '홍수', '기후 재해',
        '단백질', '신약', '임상', '진단',
        '자율주행', '주식', '암호화폐',
    ]
    
    # 교육 카테고리
    edu_cats = {'cs.CY', 'cs.HC', 'cs.CY,cs.AI'}
    
    title_summary = title + ' ' + summary
    
    # 제외 키워드 체크 (먼저)
    for kw in exclude_keywords:
        if kw in title_summary:
            return False
    
    # 교육 키워드 체크
    for kw in edu_keywords:
        if kw in title_summary:
            return True
    
    # 카테고리 기반 (cs.CY, cs.HC 등 교육 관련 카테고리)
    for cat in categories:
        if cat in edu_cats:
            return True
    
    return False

def check_recent_memory(papers):
    """Filter out already-collected papers (72h window)"""
    memory_file = os.path.join(MEMORY_DIR, 'recent-items.json')
    try:
        with open(memory_file, 'r') as f:
            memory = json.load(f)
        recent_urls = set(memory.get('items_72h', []))
    except:
        recent_urls = set()
    
    filtered = [p for p in papers if p['url'] not in recent_urls]
    
    new_urls = list(recent_urls) + [p['url'] for p in filtered]
    new_urls = new_urls[-200:]
    with open(memory_file, 'w') as f:
        json.dump({'items_72h': new_urls}, f)
    
    return filtered

def save_papers(papers):
    """Save to paper-pipeline/01-sourced/"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    saved = 0
    
    for i, paper in enumerate(papers[:8]):
        timestamp = int(time.time() * 1000)
        fname = f'paper-{timestamp}-{i}.json'
        
        # Determine region based on authors? Use global for now
        source_data = {
            'id': f'source-{timestamp}-{i}',
            'stage': 'sourced',
            'source_type': 'academic',
            'source': {
                'title': paper['title'][:200],
                'url': paper['url'],
                'source': paper['source'],
            },
            'paper': {
                'authors': paper['authors'],
                'published': paper['published'],
                'updated': paper.get('updated', paper['published']),
                'categories': paper['categories'][:5],
                'pdf_url': paper.get('pdf_url', ''),
                'summary': paper['summary'][:1000],
            },
            'region': 'global',
            'regionName': '글로벌',
            'tags': ['ai-paper', '논문요약', 'AI연구'],
        }
        
        fpath = os.path.join(OUTPUT_DIR, fname)
        with open(fpath, 'w', encoding='utf-8') as f:
            json.dump(source_data, f, ensure_ascii=False, indent=2)
        saved += 1
        
        print(f'  📄 [{paper["published"]}] {paper["title"][:60]}')
        print(f'     {", ".join(paper["authors"][:2])}')
        print(f'     {", ".join(paper["categories"][:3])}')
        print()
    
    return saved

def main():
    print('📚 Academic Paper Collection v2 시작...\n')
    
    print('🔍 arXiv 검색 중...')
    papers = fetch_arxiv()
    print(f'   → {len(papers)}개 논문 수집\n')
    
    if not papers:
        print('⚠️ 수집된 논문 없음')
        return 0
    
    # ⏰ 1년 이내 논문만 필터
    from datetime import datetime as _dt, timedelta
    one_year_ago = _dt.now() - timedelta(days=365)
    before_year = len(papers)
    papers_filtered = []
    for p in papers:
        try:
            pub_date = _dt.strptime(p['published'][:10], '%Y-%m-%d')
            if pub_date >= one_year_ago:
                papers_filtered.append(p)
        except:
            papers_filtered.append(p)  # 보수적: 날짜 파싱 실패시 통과
    papers = papers_filtered
    print(f'   → 1년 이내 필터: {before_year}→{len(papers)}개')
    print()
    
    if not papers:
        print('⚠️ 1년 이내 논문 없음')
        return 0
    
    papers = check_recent_memory(papers)
    print(f"   → 메모리 필터 후 {len(papers)}개")
    print()

    # 교육 관련성 필터링
    before = len(papers)
    papers = [p for p in papers if is_education_relevant(p)]
    print(f"   → 교육 관련성 필터: {before}→{len(papers)}개")
    print()

    if not papers:
        print('⚠️ 새로운 논문 없음')
        return 0
    
    saved = save_papers(papers[:6])
    print(f'✅ STEP 1 완료: {saved}개 논문 저장 → paper-pipeline/01-sourced/')
    return saved

if __name__ == '__main__':
    main()
