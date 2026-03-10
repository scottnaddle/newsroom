#!/usr/bin/env node
/**
 * 깊은 중복 검사 - 제목 + 내용 비교
 */

const fs = require('fs');
const path = require('path');

const PUBLISHED_DIR = '/root/.openclaw/workspace/newsroom/pipeline/08-published';

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ').replace(/<[^>]*>/g, '');
}

function textSimilarity(str1, str2) {
  const s1 = normalize(str1);
  const s2 = normalize(str2);
  
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

const files = fs.readdirSync(PUBLISHED_DIR)
  .filter(f => f.endsWith('.json'))
  .sort();

const articles = files.map(file => {
  const content = JSON.parse(fs.readFileSync(path.join(PUBLISHED_DIR, file), 'utf8'));
  return {
    filename: file,
    title: content.draft?.headline || '',
    html: content.draft?.html || ''
  };
});

console.log(`🔍 ${articles.length}개 기사 깊은 중복 검사\n`);
console.log(`기준: 제목 + 본문 70% 이상 유사 = 중복\n`);

const duplicates = [];

for (let i = 0; i < articles.length; i++) {
  for (let j = i + 1; j < articles.length; j++) {
    const titleSim = textSimilarity(articles[i].title, articles[j].title);
    const bodySim = textSimilarity(articles[i].html, articles[j].html);
    const combined = (titleSim * 0.3) + (bodySim * 0.7);
    
    if (combined >= 0.70) {
      duplicates.push({
        file1: articles[i].filename,
        file2: articles[j].filename,
        title1: articles[i].title,
        title2: articles[j].title,
        titleSim: (titleSim * 100).toFixed(1),
        bodySim: (bodySim * 100).toFixed(1),
        combined: (combined * 100).toFixed(1)
      });
    }
  }
}

if (duplicates.length === 0) {
  console.log('✅ 중복 기사 없음 (70% 기준)\n');
} else {
  console.log(`⚠️ 중복 의심 기사: ${duplicates.length}건\n`);
  duplicates.forEach((dup, idx) => {
    console.log(`${idx + 1}. 유사도: ${dup.combined}% (제목: ${dup.titleSim}%, 본문: ${dup.bodySim}%)`);
    console.log(`   [1] ${dup.title1}`);
    console.log(`       ${dup.file1}`);
    console.log(`   [2] ${dup.title2}`);
    console.log(`       ${dup.file2}\n`);
  });
}

// 결과 저장
fs.writeFileSync(
  '/root/.openclaw/workspace/newsroom/pipeline/_status/deep-duplicate-check.json',
  JSON.stringify({
    timestamp: new Date().toISOString(),
    totalArticles: articles.length,
    duplicateCount: duplicates.length,
    duplicates: duplicates
  }, null, 2)
);

console.log(`\n📊 결과 저장: /newsroom/pipeline/_status/deep-duplicate-check.json`);
