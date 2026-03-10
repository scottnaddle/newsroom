/**
 * cms/markdown.js — Markdown 파일 출력 (CMS 없이 사용)
 */

const fs = require('fs');
const path = require('path');

class MarkdownCMS {
  constructor(config) {
    this.outputDir = config.output_dir || './output';
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 기사를 Markdown 파일로 저장
   */
  async createPost(article) {
    const date = new Date().toISOString().slice(0, 10);
    const slug = article.title
      .toLowerCase()
      .replace(/[^\w\s가-힣-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60);
    
    const filename = `${date}_${slug}.md`;
    const filePath = path.join(this.outputDir, filename);

    // Frontmatter + content
    const content = `---
title: "${article.title}"
date: ${new Date().toISOString()}
status: ${article.status || 'draft'}
tags: [${(article.tags || []).map(t => `"${typeof t === 'string' ? t : t.name}"`).join(', ')}]
meta_title: "${article.meta_title || ''}"
meta_description: "${article.meta_description || ''}"
---

${this.htmlToMarkdown(article.html)}
`;

    fs.writeFileSync(filePath, content);

    return {
      id: filename,
      url: filePath,
      title: article.title,
      status: article.status || 'draft'
    };
  }

  /**
   * 간단한 HTML → Markdown 변환
   */
  htmlToMarkdown(html) {
    return html
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '\n> $1\n')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async testConnection() {
    return { connected: true, site: `Markdown output: ${this.outputDir}` };
  }
}

module.exports = MarkdownCMS;
