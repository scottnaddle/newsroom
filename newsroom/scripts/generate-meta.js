#!/usr/bin/env node
/**
 * generate-meta.js — 메타데이터 자동 생성 (LLM 불필요)
 * 
 * 사용법: node generate-meta.js <json-file-path>
 * 
 * 생성 항목:
 * - meta_title (제목 60자 이내)
 * - meta_description (본문 첫 150자)
 * - slug (한국어 → 영어 slug)
 * 
 * JSON 파일에 직접 추가하고 저장
 */

const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node generate-meta.js <json-file>');
  process.exit(2);
}

try {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const draft = data.draft || {};
  const html = draft.html || data.html || '';
  const title = draft.headline || data.title || '';

  // meta_title: 제목 60자 이내
  const metaTitle = title.length > 60 ? title.slice(0, 57) + '...' : title;

  // meta_description: HTML에서 텍스트 추출 후 첫 150자
  const textContent = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const metaDescription = textContent.length > 150 ? textContent.slice(0, 147) + '...' : textContent;

  // slug: 한국어 제목에서 생성
  const slug = title
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 75);

  // 데이터에 추가
  if (!data.draft) data.draft = {};
  data.draft.meta_title = metaTitle;
  data.draft.meta_description = metaDescription;
  if (!data.draft.slug) data.draft.slug = slug;

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  console.log(JSON.stringify({
    action: 'meta-generated',
    meta_title: metaTitle,
    meta_description: metaDescription.slice(0, 50) + '...',
    slug
  }));

  process.exit(0);
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
