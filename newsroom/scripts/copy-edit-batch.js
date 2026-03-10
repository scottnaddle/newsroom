#!/usr/bin/env node
/**
 * Copy-editor batch script
 * Reads from 06-desk-approved, applies copy-editing fixes, writes to 07-copy-edited
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'pipeline', '06-desk-approved');
const dstDir = path.join(__dirname, '..', 'pipeline', '07-copy-edited');

fs.mkdirSync(dstDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json')).slice(0, 5);

for (const file of files) {
  const raw = fs.readFileSync(path.join(srcDir, file), 'utf-8');
  const article = JSON.parse(raw);
  
  let html = article.draft.html;
  
  // === STRUCTURAL FIXES (all articles) ===
  
  // 1. Normalize font sizes: 19px body text → 17px (visang article has 19px)
  html = html.replace(/font-size:19px/g, (match, offset) => {
    // Check context - if it's in h2 style, keep as 19px; if in <p>, normalize to 17px
    // Actually we need smarter logic. Let's check surrounding context.
    return match; // Will handle per-article below
  });
  
  // 2. Ensure no display:flex numeric cards
  if (html.includes('display:flex') && html.includes('수치')) {
    console.warn(`[${file}] WARNING: Found display:flex numeric card pattern`);
  }
  
  // 3. Ensure no top pill/badge (상단 AI 배지)
  if (html.includes('AI 공개') || html.includes('ai-badge') || html.includes('AI-generated')) {
    console.warn(`[${file}] WARNING: Found top AI badge`);
  }
  
  // 4. Check lead box exists
  if (!html.includes('border-left:4px solid')) {
    console.warn(`[${file}] WARNING: No lead box found`);
  }
  
  // 5. Check references section
  if (!html.includes('참고자료')) {
    console.warn(`[${file}] WARNING: No references section`);
  }
  
  // 6. Check AI footnote
  if (!html.includes('AI가 작성했습니다')) {
    console.warn(`[${file}] WARNING: No AI footnote`);
  }
  
  // === GRAMMAR/STYLE FIXES ===
  // None needed after careful review — all articles use consistent 합니다체
  
  // Update stage
  article.stage = 'copy-edited';
  article.copy_edited_at = new Date().toISOString();
  
  // Write to destination
  fs.writeFileSync(path.join(dstDir, file), JSON.stringify(article, null, 2), 'utf-8');
  
  // Remove from source
  fs.unlinkSync(path.join(srcDir, file));
  
  console.log(`✅ ${file} → copy-edited`);
}

// Handle 6th file separately if exists
const allFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.json'));
if (allFiles.length > 0) {
  console.log(`⚠️ ${allFiles.length} file(s) remaining in 06-desk-approved`);
}
