#!/usr/bin/env node
'use strict';
/**
 * pipeline-runner.js - Rules-based pipeline processor
 * 
 * Handles stages 4-6 (editor, copy-edit, publish) WITHOUT LLM.
 * Stages 1-3 (report, write, fact-check) require LLM and are handled
 * by the pipeline orchestrator cron prompt.
 *
 * Usage:
 *   node pipeline-runner.js                           # process all stages
 *   node pipeline-runner.js --from=05-fact-checked    # from specific stage
 *   node pipeline-runner.js <filepath>                # single file
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const NEWSROOM = '/root/.openclaw/workspace/newsroom';
const PIPELINE = path.join(NEWSROOM, 'pipeline');
const MEMORY = path.join(PIPELINE, 'memory');
const { getFeatureImageUrl } = require('./get-feature-image.js');
const USED_IMAGES_FILE = path.join(MEMORY, 'used-images.json');

const DIRS = {
  sourced:      path.join(PIPELINE, '01-sourced'),
  reported:     path.join(PIPELINE, '03-reported'),
  drafted:      path.join(PIPELINE, '04-drafted'),
  factChecked:  path.join(PIPELINE, '05-fact-checked'),
  deskApproved: path.join(PIPELINE, '06-desk-approved'),
  copyEdited:   path.join(PIPELINE, '07-copy-edited'),
  published:    path.join(PIPELINE, '08-published'),
  rejected:     path.join(PIPELINE, 'rejected'),
};
Object.values(DIRS).forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Logging ─────────────────────────────────────────────────────
function log(level, msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${msg}`);
  try {
    fs.appendFileSync(path.join(PIPELINE, 'pipeline-runner.log'),
      `[${ts}] [${level}] ${msg}\n`);
  } catch (_) {}
}

// ── Utils ───────────────────────────────────────────────────────
function readJSON(fp) { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
function writeJSON(fp, d) { fs.writeFileSync(fp, JSON.stringify(d, null, 2)); }

function textLen(html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().length;
}

function levenshtein(a, b) {
  const m = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      m[i][j] = b[i - 1] === a[j - 1] ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
  return m[b.length][a.length];
}

function titleSim(a, b) {
  if (!a || !b) return 0;
  const na = a.toLowerCase().replace(/[^\w\s가-힣]/g, '').trim();
  const nb = b.toLowerCase().replace(/[^\w\s가-힣]/g, '').trim();
  const mx = Math.max(na.length, nb.length);
  return mx === 0 ? 100 : ((mx - levenshtein(na, nb)) / mx) * 100;
}

function checkDuplicate(headline) {
  const f = path.join(MEMORY, 'published-titles.json');
  let titles = [];
  try {
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    titles = Array.isArray(data) ? data : (data.titles || []);
  } catch (_) {}
  let maxSim = 0, matchTitle = '';
  for (const item of titles) {
    const sim = titleSim(headline, item.title || '');
    if (sim > maxSim) { maxSim = sim; matchTitle = item.title || ''; }
  }
  return { kill: maxSim >= 85, similarity: maxSim, matchTitle };
}

function cleanHtml(html) {
  if (!html) return html;
  // Remove article tags
  html = html.replace(/<article([^>]*)>/gi, '<div$1>');
  html = html.replace(/<\/article>/gi, '</div>');
  // Remove AI badge pills (small divs with border-radius)
  html = html.replace(/<div[^>]*border-radius\s*:\s*\d+px[^>]*>[^<]{0,60}<\/div>/gi, '');
  return html;
}

// ── Stage 4: Editor/Desk (rules-based) ──────────────────────────
function stageEditorDesk(fp) {
  const fn = path.basename(fp);
  log('INFO', `[Stage4:에디터] ${fn}`);
  const art = readJSON(fp);
  const draft = art.draft;
  if (!draft || !draft.html) {
    log('WARN', `[Stage4] draft.html 없음 -> rejected: ${fn}`);
    art.stage = 'rejected';
    art.desk_decision = { verdict: 'FAIL', reason: 'draft.html 없음' };
    writeJSON(path.join(DIRS.rejected, fn), art);
    fs.unlinkSync(fp);
    return null;
  }
  
  // ⚠️ CRITICAL: 이미지 자동 할당 (없으면 생성)
  if (!draft.feature_image || !draft.og_image) {
    const headline = draft.headline || art.source?.title || 'AI 교육 뉴스';
    const tags = draft.ghost_tags || art.tags || [];
    const featureImage = getFeatureImageUrl({
      headline,
      tags,
      recentIdsFile: USED_IMAGES_FILE
    });
    draft.feature_image = featureImage;
    draft.og_image = featureImage;
    log('INFO', `[Stage4:이미지] 자동 할당: ${featureImage}`);
  }

  const headline = draft.headline || '';
  const dup = checkDuplicate(headline);
  if (dup.kill) {
    log('WARN', `[Stage4] 중복 KILL (${dup.similarity.toFixed(1)}%): ${fn}`);
    art.stage = 'rejected';
    art.desk_decision = {
      verdict: 'FAIL',
      reason: `중복: ${dup.matchTitle} (${dup.similarity.toFixed(1)}%)`,
      decided_at: new Date().toISOString()
    };
    writeJSON(path.join(DIRS.rejected, fn), art);
    fs.unlinkSync(fp);
    return null;
  }

  const tl = textLen(draft.html);
  const hasFootnote = draft.html.includes('본 기사는 AI가 작성했습니다');
  const hasRef = draft.html.includes('참고') || draft.html.includes('출처');
  const factScore = art.fact_check?.score || 0;

  // Auto-reject conditions
  if (tl < 1600) {
    log('WARN', `[Stage4] 본문 ${tl}자 미만 -> rejected: ${fn}`);
    art.stage = 'rejected';
    art.desk_decision = { verdict: 'FAIL', reason: `본문 ${tl}자 (1600자 미만)` };
    writeJSON(path.join(DIRS.rejected, fn), art);
    fs.unlinkSync(fp);
    return null;
  }

  if (art.fact_check?.verdict === 'FLAG' && factScore < 75) {
    log('WARN', `[Stage4] FLAG+점수<75 -> rejected: ${fn}`);
    art.stage = 'rejected';
    art.desk_decision = { verdict: 'FAIL', reason: `FLAG + 점수 ${factScore}` };
    writeJSON(path.join(DIRS.rejected, fn), art);
    fs.unlinkSync(fp);
    return null;
  }

  // Generate meta
  const metaTitle = headline.slice(0, 60);
  const metaDesc = draft.html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 150);

  art.stage = 'desk-approved';
  art.desk_decision = {
    verdict: 'PASS',
    reason: `본문 ${tl}자, 팩트점수 ${factScore}, 중복 ${dup.similarity.toFixed(1)}%`,
    meta_title: metaTitle,
    meta_description: metaDesc,
    decided_at: new Date().toISOString()
  };
  art.draft.meta_title = metaTitle;
  art.draft.meta_description = metaDesc;

  const dest = path.join(DIRS.deskApproved, fn);
  writeJSON(dest, art);
  fs.unlinkSync(fp);
  log('OK', `[Stage4:에디터] PASS -> 06-desk-approved/: ${fn}`);
  return dest;
}

// ── Stage 5: Copy Edit (rules-based) ────────────────────────────
function stageCopyEditor(fp) {
  const fn = path.basename(fp);
  log('INFO', `[Stage5:교열] ${fn}`);
  const art = readJSON(fp);
  const draft = art.draft;
  if (!draft || !draft.html) {
    log('WARN', `[Stage5] draft.html 없음 -> rejected: ${fn}`);
    art.stage = 'rejected';
    writeJSON(path.join(DIRS.rejected, fn), art);
    fs.unlinkSync(fp);
    return null;
  }
  
  // ⚠️ CRITICAL: 이미지 자동 할당 (없으면 생성)
  if (!draft.feature_image || !draft.og_image) {
    const headline = draft.headline || art.source?.title || 'AI 교육 뉴스';
    const tags = draft.ghost_tags || art.tags || [];
    const featureImage = getFeatureImageUrl({
      headline,
      tags,
      recentIdsFile: USED_IMAGES_FILE
    });
    draft.feature_image = featureImage;
    draft.og_image = featureImage;
    log('INFO', `[Stage5:이미지] 자동 할당: ${featureImage}`);
  }

  // Clean HTML
  let html = cleanHtml(draft.html);
  const changes = [];

  // Remove AI badge pills
  const before = html;
  html = html.replace(/<div[^>]*border-radius[^>]*>.*?AI.*?<\/div>/gis, '');
  if (html !== before) changes.push('AI 배지 pill 제거');

  // Remove display:flex stat cards (multiple flex items)
  const flexPattern = /<div[^>]*display\s*:\s*flex[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi;
  const flexBefore = html;
  html = html.replace(flexPattern, '');
  if (html !== flexBefore) changes.push('수치 카드(flex) 제거');

  // Ensure AI footnote exists
  if (!html.includes('본 기사는 AI가 작성했습니다')) {
    html += '\n<p style="margin:48px 0 0;padding-top:20px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">본 기사는 AI가 작성했습니다 (AI 기본법 제31조)</p>';
    changes.push('AI 각주 추가');
  }

  // Check text length
  const tl = textLen(html);
  if (tl < 1600) {
    log('WARN', `[Stage5] 본문 ${tl}자 미만 -> rejected: ${fn}`);
    art.stage = 'rejected';
    art.copy_edit = { verdict: 'FAIL', reason: `본문 ${tl}자 미만` };
    writeJSON(path.join(DIRS.rejected, fn), art);
    fs.unlinkSync(fp);
    return null;
  }

  draft.html = html;
  art.stage = 'copy-edited';
  art.draft = draft;
  art.copy_edit = {
    verdict: 'PASS',
    changes: changes,
    text_length: tl,
    checked_at: new Date().toISOString()
  };

  const dest = path.join(DIRS.copyEdited, fn);
  writeJSON(dest, art);
  fs.unlinkSync(fp);
  log('OK', `[Stage5:교열] PASS (${tl}자, ${changes.length} changes) -> 07-copy-edited/: ${fn}`);
  return dest;
}

// ── Stage 6: Publish ────────────────────────────────────────────
function stagePublish(fp) {
  const fn = path.basename(fp);
  log('INFO', `[Stage6:발행] ${fn}`);

  const r = spawnSync('node', [
    path.join(NEWSROOM, 'scripts', 'publish-one.js'), fp
  ], { encoding: 'utf8', timeout: 60000, maxBuffer: 5 * 1024 * 1024, cwd: NEWSROOM });

  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);

  if (r.status !== 0) {
    log('ERROR', `[Stage6] 발행 실패 (exit ${r.status}): ${fn}`);
    return null;
  }

  let ghostUrl = null;
  const m = (r.stdout || '').match(/RESULT:(\{.*\})/);
  if (m) {
    try { ghostUrl = JSON.parse(m[1]).ghostUrl; } catch (_) {}
  }
  log('OK', `[Stage6:발행] done${ghostUrl ? ' URL: ' + ghostUrl : ''}: ${fn}`);
  return ghostUrl;
}

// ── Process single article through remaining stages ─────────────
function processArticle(fp, fromStage) {
  const fn = path.basename(fp);
  log('INFO', `=== 기사: ${fn} (from: ${fromStage}) ===`);
  const t0 = Date.now();
  let currentPath = fp;

  try {
    // Stage 4: Editor desk
    if (['05-fact-checked'].includes(fromStage)) {
      currentPath = stageEditorDesk(currentPath);
      if (!currentPath) return { status: 'rejected', stage: 'editor' };
    }

    // Stage 5: Copy editor
    if (['05-fact-checked', '06-desk-approved'].includes(fromStage)) {
      currentPath = stageCopyEditor(currentPath);
      if (!currentPath) return { status: 'rejected', stage: 'copyedit' };
    }

    // Stage 6: Publish
    if (['05-fact-checked', '06-desk-approved', '07-copy-edited'].includes(fromStage)) {
      const ghostUrl = stagePublish(currentPath);
      if (!ghostUrl) return { status: 'error', stage: 'publish' };
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      log('OK', `=== 완료: ${fn} (${elapsed}s) ===`);
      return { status: 'published', ghostUrl, elapsed };
    }

    return { status: 'skipped' };
  } catch (e) {
    log('ERROR', `=== 실패: ${fn} -- ${e.message} ===`);
    if (fs.existsSync(currentPath)) {
      try { fs.renameSync(currentPath, path.join(DIRS.rejected, fn)); } catch (_) {}
    }
    return { status: 'error', error: e.message };
  }
}

// ── Main ────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  let fromStage = null;
  let specificFile = null;

  for (const arg of args) {
    if (arg.startsWith('--from=')) fromStage = arg.replace('--from=', '');
    else specificFile = arg;
  }

  log('INFO', 'Pipeline Runner 시작');
  let files = [];

  if (specificFile) {
    if (!fs.existsSync(specificFile)) {
      log('ERROR', `파일없음: ${specificFile}`);
      process.exit(1);
    }
    files = [specificFile];
    if (!fromStage) {
      if (specificFile.includes('05-fact-checked')) fromStage = '05-fact-checked';
      else if (specificFile.includes('06-desk-approved')) fromStage = '06-desk-approved';
      else if (specificFile.includes('07-copy-edited')) fromStage = '07-copy-edited';
    }
  } else {
    // Collect from starting directory
    const dirMap = {
      '05-fact-checked': DIRS.factChecked,
      '06-desk-approved': DIRS.deskApproved,
      '07-copy-edited': DIRS.copyEdited,
    };
    // Default: process all pending stages
    if (!fromStage) {
      // Process all stages in order
      for (const [stage, dir] of Object.entries(dirMap)) {
        if (fs.existsSync(dir)) {
          const jsons = fs.readdirSync(dir)
            .filter(f => f.endsWith('.json') && !f.startsWith('REVISE_') && !f.startsWith('COPY_'));
          for (const f of jsons) {
            files.push({ path: path.join(dir, f), stage });
          }
        }
      }
    } else {
      const dir = dirMap[fromStage];
      if (dir && fs.existsSync(dir)) {
        files = fs.readdirSync(dir)
          .filter(f => f.endsWith('.json') && !f.startsWith('REVISE_') && !f.startsWith('COPY_'))
          .map(f => ({ path: path.join(dir, f), stage: fromStage }));
      }
    }
  }

  if (files.length === 0) {
    log('INFO', '처리할 기사 없음');
    process.exit(0);
  }

  log('INFO', `처리 대상: ${files.length}개 기사`);
  const results = { published: 0, rejected: 0, error: 0, skipped: 0 };
  const ghostUrls = [];

  for (const item of files) {
    const fp = typeof item === 'string' ? item : item.path;
    const stage = typeof item === 'string' ? fromStage : item.stage;
    const r = processArticle(fp, stage);
    results[r.status] = (results[r.status] || 0) + 1;
    if (r.ghostUrl) ghostUrls.push(r.ghostUrl);
  }

  log('INFO', '=== Pipeline Runner 완료 ===');
  log('INFO', `Published: ${results.published}, Rejected: ${results.rejected}, Error: ${results.error || 0}`);
  if (ghostUrls.length > 0) log('INFO', `Ghost URLs: ${ghostUrls.join(', ')}`);
}

main();
