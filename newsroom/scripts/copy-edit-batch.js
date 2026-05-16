#!/usr/bin/env node
/**
 * Copy-editor batch script
 * Reads from 06-desk-approved, applies copy-editing fixes, writes to 07-copy-edited
 */
const fs = require('fs');
const path = require('path');

const WORKSPACE = '/root/.openclaw/workspace/newsroom';
const srcDir = path.join(WORKSPACE, 'pipeline', '06-desk-approved');
const dstDir = path.join(WORKSPACE, 'pipeline', '07-copy-edited');

fs.mkdirSync(dstDir, { recursive: true });

// Helper: Remove Chinese/Japanese characters and fix garbled text
const sanitizeKorean = (text) => {
  if (!text) return '';
  let result = text;
  
  // Step 1: Remove all Japanese Hiragana (U+3040-U+30FF) and Katakana
  result = result.replace(/[\u3040-\u30ff]/g, '');
  // Step 2: Remove all Chinese characters
  result = result.replace(/[\u4e00-\u9fff]/g, '');
  // Step 3: Remove Japanese punctuation marks
  result = result.replace(/[「『』」・、。]/g, '');
  
  // Step 4: Fix Korean particles that got separated by Japanese chars
  // Pattern: Korean particle at word boundary followed by remaining Japanese/corrupted text
  // e.g., "는のに" -> "는", "다는は" -> "다", "라는は" -> "라"
  result = result.replace(/(는)에\b/g, '는');
  result = result.replace(/(다)는\b/g, '다');
  result = result.replace(/(라)는\b/g, '라');
  result = result.replace(/(으로)에\b/g, '으로');
  result = result.replace(/(으로)のに\b/g, '으로');
  result = result.replace(/(이)에\b/g, '이');
  result = result.replace(/(이)のに\b/g, '이');
  result = result.replace(/(를)에\b/g, '를');
  result = result.replace(/(를)のに\b/g, '를');
  
  // Step 5: Fix dangling Korean particles at end of garbled segments
  // When Japanese was removed from the end, particles may be left hanging
  // e.g., "critics들은を" -> "critics들" (remove dangling 은)
  result = result.replace(/( critiques?[a-z]*)은$/i, '$1');
  result = result.replace(/( critiques?[a-z]*)는$/i, '$1');
  result = result.replace(/( critiques?[a-z]*)을$/i, '$1');
  result = result.replace(/( critiques?[a-z]*)를$/i, '$1');
  result = result.replace(/( critiques?[a-z]*)이$/i, '$1');
  result = result.replace(/( critiques?[a-z]*)가$/i, '$1');
  result = result.replace(/( critiques?[a-z]*)의$/i, '$1');
  
  // Step 6: Fix common garbled Korean+Japanese patterns
  // "というは" is Japanese grammar, not Korean - remove trailing "は" when preceded by Korean
  result = result.replace(/(는)이というは/g, '$1이');
  result = result.replace(/(다)이というは/g, '$1다');
  result = result.replace(/(이)에というは/g, '$1에');
  
  // Step 7: Clean up any remaining Japanese particles that got stranded
  result = result.replace(/は$/g, '');
  result = result.replace(/はに$/g, '');
  result = result.replace(/より$/g, '');
  
  // Step 8: Remove any remaining isolated non-Korean at word boundaries
  // Clean up double spaces and trailing/leading particles
  result = result.replace(/\s+/g, ' ');
  result = result.replace(/\s+은\b/g, '');
  result = result.replace(/\s+는\b/g, '');
  result = result.replace(/\s+을\b/g, '');
  result = result.replace(/\s+를\b/g, '');
  result = result.replace(/\s+이\b/g, '');
  result = result.replace(/\s+가\b/g, '');
  result = result.replace(/\s+의\b/g, '');
  result = result.replace(/\s+으로\b/g, '');
  result = result.replace(/\s+로\b/g, '');
  
  return result.trim();
};

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json')).slice(0, 5);

console.log(`Copy-editor: found ${files.length} files in 06-desk-approved`);

for (const file of files) {
  const raw = fs.readFileSync(path.join(srcDir, file), 'utf-8');
  const article = JSON.parse(raw);
  
  // Support both nested (draft.html) and flat (html) structures
  const rawHtml = article.draft ? article.draft.html : article.html;
  let html = rawHtml;
  const headline = article.draft ? article.draft.headline : article.headline;
  const refs = article.draft ? article.draft.references : article.references;

  // === FIX 1: Remove duplicate title after lead-box ===
  if (headline) {
    const escapedHeadline = headline.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Remove second occurrence of headline in <p><strong> or just repeated text
    const regex = new RegExp(`(<\\/div>\\s*)(<p[^>]*>\\s*)<strong>\\s*${escapedHeadline}\\s*</strong>(\\s*</p>)`, 'i');
    html = html.replace(regex, '$1');
  }

  // === FIX 2: Add proper links to references ===
  html = html.replace(/<p class="reference">(\d+)\.\s*([^<「『」]+?)([,，]\s*[^<,，]+)?\s*<\/p>/g, (match, num, title, rest) => {
    const ref = refs && refs[parseInt(num) - 1];
    if (ref && ref.url && ref.url !== '#' && ref.url !== '') {
      return `<p class="reference"><a href="${ref.url}" target="_blank">${num}. ${title}${rest || ''}</a></p>`;
    }
    return match;
  });

  html = html.replace(/<li>([^<]+?)<\/li>/g, (match, text) => {
    const refMatch = text.match(/^(\d+)\.\s*(.+)/);
    if (refMatch) {
      const ref = refs && refs[parseInt(refMatch[1]) - 1];
      if (ref && ref.url && ref.url !== '#' && ref.url !== '') {
        return `<li><a href="${ref.url}" target="_blank">${text}</a></li>`;
      }
    }
    return match;
  });

  // === FIX 3: Simplify AI footnote ===
  const simpleAIFootnote = '본 기사는 AI 에이전트 시스템 활용하여 작성됐다.';
  html = html.replace(/<div class="ai-footnote">[\s\S]*?<\/div>/g, `<p class="ai-footer">${simpleAIFootnote}</p>`);
  html = html.replace(/<p class="ai-footer">[\s\S]*?<\/p>/g, (m) => {
    if (m.includes('AI') && m.includes('각주')) return `<p class="ai-footer">${simpleAIFootnote}</p>`;
    return m;
  });

  // === FIX 4: Clean Chinese/Japanese characters from entire HTML ===
  // Be careful not to remove Korean characters
  html = html.replace(/[\u4e00-\u9fff]/g, '');
  html = html.replace(/[\u3040-\u30ff]/g, '');
  html = html.replace(/[「『』」・、。]/g, '');

  // === FIX 5: Apply sanitizeKorean to text content inside <p> and <h2> tags ===
  html = html.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/g, (match, open, content, close) => {
    // Skip if it's a reference or has existing links
    if (content.includes('class="reference"') || content.includes('<a ')) return match;
    return open + sanitizeKorean(content) + close;
  });
  html = html.replace(/(<h2[^>]*>)([\s\S]*?)(<\/h2>)/g, (match, open, content, close) => {
    return open + sanitizeKorean(content) + close;
  });

  // Update the article - handle both structures
  if (article.draft) {
    article.draft.html = html;
  } else {
    article.html = html;
  }
  article.stage = 'copy-edited';
  article.copy_edited_at = new Date().toISOString();

  // Write to destination
  fs.writeFileSync(path.join(dstDir, file), JSON.stringify(article, null, 2), 'utf-8');

  // Remove from source
  fs.unlinkSync(path.join(srcDir, file));

  console.log(`✅ ${file} → copy-edited`);
}

const allFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.json'));
if (allFiles.length > 0) {
  console.log(`⚠️ ${allFiles.length} file(s) remaining in 06-desk-approved`);
}
