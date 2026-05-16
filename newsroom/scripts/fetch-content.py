#!/usr/bin/env python3
"""Fetch article content from URLs using curl"""
import json, subprocess, sys, re, os

os.chdir("/root/.openclaw/workspace/newsroom")

# Read source files
import glob
sources = []
for f in sorted(glob.glob("pipeline/01-sourced/*.json")):
    with open(f) as fh:
        data = json.load(fh)
    source = data.get("source", {})
    sources.append({
        "file": os.path.basename(f),
        "id": data.get("id", ""),
        "title": source.get("title", ""),
        "url": source.get("url", ""),
        "domain": source.get("source", ""),
        "region": data.get("region", ""),
        "regionName": data.get("regionName", ""),
        "description": source.get("description", ""),
        "content": ""
    })

ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

for i, s in enumerate(sources):
    url = s["url"]
    if not url:
        continue
    
    sys.stdout.write(f"{i+1}. {s['domain'][:20]:20s} | fetching...\n")
    sys.stdout.flush()
    
    try:
        result = subprocess.run(
            ["curl", "-s", "-L", "--max-time", "10", "-H", f"User-Agent: {ua}", url],
            capture_output=True, text=True, timeout=15
        )
        html = result.stdout
        
        # Extract text from <p> tags
        ps = re.findall(r'<p[^>]*>(.*?)</p>', html, re.DOTALL)
        
        # Try article tag if p tags are few
        if len(ps) < 3:
            art = re.findall(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
            if art:
                ps = re.findall(r'<p[^>]*>(.*?)</p>', art[0], re.DOTALL)
        
        # Try content div
        if len(ps) < 3:
            for cls in ['content', 'article', 'post', 'entry', 'main']:
                divs = re.findall(rf'<div[^>]*class=\"[^\"]*{cls}[^\"]*\"[^>]*>(.*?)</div>', html, re.DOTALL)
                if divs:
                    ps = re.findall(r'<p[^>]*>(.*?)</p>', divs[0], re.DOTALL)
                    if len(ps) >= 3:
                        break
        
        texts = []
        for p in ps:
            clean = re.sub(r'<[^>]+>', '', p)
            clean = re.sub(r'&[a-z]+;', ' ', clean)
            clean = re.sub(r'\s+', ' ', clean).strip()
            if len(clean) > 40:
                texts.append(clean)
        
        content = '\n'.join(texts[:40])
        if content and len(content) > 100:
            s["content"] = content[:5000]
            sys.stdout.write(f"  ✅ {len(content)} chars\n")
        else:
            sys.stdout.write(f"  ⚠️ Short ({len(content)}), using description\n")
            s["content"] = s.get("description", "")
    except Exception as e:
        sys.stdout.write(f"  ❌ {str(e)[:50]}\n")
        s["content"] = s.get("description", "")
    
    sys.stdout.flush()

# Save
with open("/tmp/newsroom_fetched.json", "w", encoding="utf-8") as f:
    json.dump(sources, f, ensure_ascii=False, indent=2)

success = sum(1 for s in sources if len(s.get("content","")) > 200)
sys.stdout.write(f"\n✅ Fetched: {success}/{len(sources)}\n")
sys.stdout.write(f"Sizes: {[len(s.get('content','')) for s in sources]}\n")
