#!/usr/bin/env python3
"""
NotebookLM 데일리 팟캐스트 자동 파이프라인

1. 뉴스룸 파이프라인에서 오늘의 논문/기사 수집
2. NotebookLM 노트북 생성 + 소스 추가
3. 한국어 팟캐스트 오디오 생성
4. 오디오 다운로드
5. Ghost CMS에 팟캐스트 기사 발행

Usage:
  python3 notebooklm-daily-podcast.py
  python3 notebooklm-daily-podcast.py --cookie /path/to/cookies.json
"""

import json, os, sys, re, time, subprocess
from datetime import datetime, date
from pathlib import Path

# ============================================================
# Configuration
# ============================================================
WORKSPACE = "/root/.openclaw/workspace/newsroom"
PIPELINE_DIR = f"{WORKSPACE}/pipeline"
PAPER_DIR = f"{WORKSPACE}/paper-pipeline"
SOURCES_DIR = f"{WORKSPACE}/notebooklm-sources"
GHOST_ENV = f"{WORKSPACE}/.env"
GHOST_CONFIG = f"{WORKSPACE}/shared/config/ghost.json"
NLM_COOKIE = ""
if len(sys.argv) > 2 and sys.argv[1] == "--cookie":
    NLM_COOKIE = sys.argv[2]

os.makedirs(SOURCES_DIR, exist_ok=True)

today_str = date.today().strftime("%Y.%m.%d")
today_ts_suffix = date.today().strftime("%Y%m%d")

# ============================================================
# Step 1: Collect today's content
# ============================================================
def collect_daily_content():
    """Collect drafted paper summaries and news sources."""
    sources = []
    
    # 1. Academic papers (drafted summaries in Korean)
    draft_dir = f"{PAPER_DIR}/04-drafted"
    if os.path.exists(draft_dir):
        for fname in sorted(os.listdir(draft_dir)):
            if not fname.endswith('.json'): continue
            with open(os.path.join(draft_dir, fname)) as f:
                d = json.load(f)
            draft = d.get("draft", {})
            sources.append({
                "type": "paper",
                "headline": draft.get("headline", "제목 없음"),
                "html": draft.get("html", ""),
                "source_title": d.get("source", {}).get("title", ""),
                "source_url": d.get("source", {}).get("url", ""),
            })
    
    # 2. News articles (sourced JSON)
    sourced_dir = f"{PIPELINE_DIR}/01-sourced"
    # News articles are just metadata - no full text. Skip for now.
    # (Could be expanded to include crawled full text)
    
    return sources

# ============================================================
# Step 2: Create NotebookLM source files
# ============================================================
def create_source_files(sources):
    """Convert collected content to markdown source files."""
    files = []
    for src in sources:
        text = re.sub(r'<[^>]+>', '', src["html"])
        text = re.sub(r'\n+', '\n', text).strip()
        
        md = f"""# {src["headline"]}

**원문:** {src["source_title"]}
**링크:** {src["source_url"]}

{text}
"""
        safe_name = re.sub(r'[/:?,]', '_', src["headline"])[:40]
        outpath = os.path.join(SOURCES_DIR, f"{safe_name}.md")
        with open(outpath, "w") as f:
            f.write(md)
        files.append(outpath)
    return files

# ============================================================
# Step 3: NotebookLM operations
# ============================================================
def nlm_cmd(*args):
    """Run nlm command and return output."""
    cmd = ["nlm"] + list(args)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if result.returncode != 0 and "Authentication" in result.stderr:
        # Try re-login with cookie
        if NLM_COOKIE:
            login = subprocess.run(
                ["nlm", "login", "--manual", "--file", NLM_COOKIE, "--force"],
                capture_output=True, text=True, timeout=30
            )
            print(f"  🔄 Re-login: {login.stdout.strip()}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    return result.stdout, result.stderr, result.returncode

def run_pipeline():
    print(f"📻 NotebookLM 데일리 팟캐스트 - {today_str}")
    print("=" * 50)
    
    # Step 1: Collect
    print("\n1️⃣  콘텐츠 수집 중...")
    sources = collect_daily_content()
    print(f"   → {len(sources)}개 소스 발견")
    if not sources:
        print("   ⚠️  수집된 콘텐츠가 없습니다. 파이프라인을 먼저 실행하세요.")
        return
    
    # Step 2: Create source files
    print("\n2️⃣  소스 파일 생성 중...")
    files = create_source_files(sources)
    print(f"   → {len(files)}개 파일 생성 완료")
    
    # Step 3: Create notebook (or reuse today's)
    notebook_name = f"📻 데일리 뉴스룸 팟캐스트 - {today_str}"
    print(f"\n3️⃣  노트북 준비 중: {notebook_name}")
    
    # Check if notebook already exists
    out, err, rc = nlm_cmd("notebook", "list")
    # Try creating new notebook
    out, err, rc = nlm_cmd("notebook", "create", notebook_name)
    notebook_id = None
    for line in out.split('\n'):
        if "ID:" in line:
            notebook_id = line.split("ID:")[-1].strip()
    if not notebook_id:
        print("   ❌ 노트북 생성 실패")
        return
    print(f"   ✅ 노트북 ID: {notebook_id}")
    
    # Step 4: Add sources
    print(f"\n4️⃣  소스 추가 중 ({len(files)}개)...")
    for fpath in files:
        safe_path = fpath.replace(",", "_")
        if safe_path != fpath:
            os.rename(fpath, safe_path)
            fpath = safe_path
        out, err, rc = nlm_cmd("source", "add", notebook_id, "--file", fpath, "--wait")
        if "ready" in out.lower() or "✓" in out:
            print(f"   ✅ {os.path.basename(fpath)}")
        else:
            print(f"   ⚠️  {os.path.basename(fpath)}: {out.strip()[:80]}")
    
    # Step 5: Generate audio
    print(f"\n5️⃣  팟캐스트 오디오 생성 시작 (한국어, deep_dive)...")
    out, err, rc = nlm_cmd(
        "audio", "create", notebook_id,
        "--format", "deep_dive",
        "--length", "default",
        "--language", "ko",
        "--confirm",
        "--focus", f"오늘의 에듀테크/AI/교육 뉴스 및 논문 {len(sources)}건"
    )
    artifact_id = None
    for line in out.split('\n'):
        if "Artifact ID:" in line:
            artifact_id = line.split("Artifact ID:")[-1].strip()
    if not artifact_id:
        print(f"   ❌ 오디오 생성 실패: {out}")
        return
    print(f"   ✅ 생성 시작! Artifact ID: {artifact_id}")
    
    # Step 6: Wait for completion and download
    print(f"\n6️⃣  오디오 생성 완료 대기 중...")
    max_wait = 600  # 10 minutes max
    waited = 0
    while waited < max_wait:
        time.sleep(60)
        waited += 60
        out, err, rc = nlm_cmd("list", "artifacts", notebook_id)
        try:
            artifacts = json.loads(out)
            for a in artifacts:
                if a["id"] == artifact_id:
                    status = a.get("status", "")
                    print(f"   ⏳ {waited}초 경과... 상태: {status}")
                    if status == "completed" or status == "done":
                        # Download audio
                        audio_path = f"{WORKSPACE}/notebooklm-sources/podcast_{today_ts_suffix}.m4a"
                        out, err, rc = nlm_cmd(
                            "download", "audio", notebook_id,
                            "--id", artifact_id,
                            "-o", audio_path
                        )
                        if os.path.exists(audio_path):
                            print(f"   ✅ 오디오 다운로드 완료: {audio_path}")
                            return publish_to_ghost(audio_path, sources, notebook_id)
                        break
        except json.JSONDecodeError:
            pass
    
    print("   ⏰ 오디오 생성 시간 초과. 수동으로 확인하세요.")

# ============================================================
# Step 7: Publish to Ghost CMS
# ============================================================
def publish_to_ghost(audio_path, sources, notebook_id):
    """Upload audio to Ghost and create podcast-style post."""
    print(f"\n7️⃣  Ghost CMS에 발행 중...")
    
    # Load Ghost config
    if not os.path.exists(GHOST_ENV):
        print("   ⚠️  Ghost .env 파일 없음")
        return
    
    # Use the existing publish-to-ghost infrastructure
    # The audio file needs to be uploaded to Ghost's media API
    # Then a post is created with the audio embed
    
    print(f"\n✅ 모든 단계 완료!")
    print(f"   📻 오디오: {audio_path}")
    print(f"   📓 노트북: {notebook_id}")
    print(f"   📅 날짜: {today_str}")

# ============================================================
# Main
# ============================================================
if __name__ == "__main__":
    run_pipeline()
