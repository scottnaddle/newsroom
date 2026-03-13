#!/usr/bin/env node
/**
 * Markdown to HTML 변환기
 * 팩트체크된 기사를 HTML로 변환
 */

const fs = require('fs');
const path = require('path');

const FACT_CHECKED_DIR = './pipeline/05-fact-checked';

function markdownToHtml(markdown) {
  let html = markdown;
  
  // 리드박스 (강조 처리)
  html = html.replace(/^\*\*([^*]+)\*\*\n\n/m, '<div class="lead-box"><p><strong>$1</strong></p>');
  
  // h2 제목
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  
  // h3 제목
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  
  // 강조 텍스트
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // 기울임
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // 링크
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  // 구분선
  html = html.replace(/^---$/gm, '<hr />');
  
  // 문단 분리
  const paragraphs = html.split('\n\n').map(para => {
    if (para.startsWith('<h') || para.startsWith('<hr') || para.startsWith('<div')) {
      return para;
    }
    return para ? `<p>${para}</p>` : '';
  });
  
  html = paragraphs.join('\n');
  
  return html;
}

function generateHtml(articleData) {
  const title = articleData.source?.title || articleData.reporting_brief?.SUGGESTED_ANGLE || '제목 없음';
  let draft = articleData.draft || '';
  // draft가 이미 객체면 markdown 필드 추출
  if (typeof draft === 'object' && draft.markdown) {
    draft = draft.markdown;
  }
  const content = markdownToHtml(draft);
  const photoUrl = articleData.photo?.url || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&h=630&fit=crop';
  
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif;
            line-height: 1.8;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        article {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            font-size: 2em;
            margin-bottom: 20px;
            color: #1a1a1a;
        }
        h2 {
            font-size: 1.4em;
            margin-top: 30px;
            margin-bottom: 15px;
            color: #0066cc;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 10px;
        }
        h3 {
            font-size: 1.1em;
            margin-top: 20px;
            margin-bottom: 10px;
            color: #333;
        }
        p {
            margin-bottom: 15px;
            line-height: 1.8;
        }
        .lead-box {
            background: #f0f7ff;
            border-left: 4px solid #0066cc;
            padding: 15px 20px;
            margin-bottom: 30px;
            border-radius: 4px;
        }
        .lead-box p {
            margin: 0;
            font-size: 1.1em;
            font-weight: 500;
        }
        .article-meta {
            color: #666;
            font-size: 0.9em;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        .featured-image {
            width: 100%;
            height: auto;
            margin-bottom: 30px;
            border-radius: 8px;
        }
        strong {
            color: #000;
            font-weight: 600;
        }
        em {
            font-style: italic;
            color: #666;
        }
        a {
            color: #0066cc;
            text-decoration: none;
            border-bottom: 1px dotted #0066cc;
        }
        a:hover {
            color: #004499;
            border-bottom-color: #004499;
        }
        .references {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 4px;
            margin-top: 30px;
        }
        .references h3 {
            margin-top: 0;
        }
        .references ul {
            list-style: none;
            padding: 0;
        }
        .references li {
            margin-bottom: 10px;
            padding-left: 20px;
            position: relative;
        }
        .references li:before {
            content: "📎";
            position: absolute;
            left: 0;
        }
        .ai-footnote {
            background: #f0f0f0;
            border: 1px solid #ddd;
            padding: 15px;
            margin-top: 30px;
            border-radius: 4px;
            font-size: 0.9em;
            color: #666;
        }
        hr {
            border: none;
            border-top: 2px solid #eee;
            margin: 30px 0;
        }
    </style>
</head>
<body>
    <article>
        <div class="article-meta">
            <span>발행일: ${new Date().toLocaleDateString('ko-KR')}</span> 
            <span>카테고리: AI 교육</span>
        </div>
        
        <h1>${title}</h1>
        
        <img src="${photoUrl}" alt="${title}" class="featured-image">
        
        <div class="article-content">
            ${content}
        </div>
    </article>
</body>
</html>`;

  return html;
}

function processFile(filename) {
  const filePath = path.join(FACT_CHECKED_DIR, filename);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const articleData = JSON.parse(content);
    
    // HTML 생성
    const html = generateHtml(articleData);
    
    // HTML을 JSON의 draft.html 필드로 추가
    articleData.draft = {
      markdown: articleData.draft,
      html: html,
      format: 'html5'
    };
    
    // 업데이트된 JSON 저장
    fs.writeFileSync(filePath, JSON.stringify(articleData, null, 2));
    
    console.log(`✅ [${filename}] HTML 변환 완료`);
    return { success: true, filename };
  } catch (error) {
    console.error(`❌ [${filename}] 오류: ${error.message}`);
    return { success: false, filename, error: error.message };
  }
}

// 메인 실행
console.log('🔄 HTML 변환 시작...\n');

const files = fs.readdirSync(FACT_CHECKED_DIR)
  .filter(f => f.endsWith('-factchecked.json'));

const results = files.map(processFile);
const success = results.filter(r => r.success).length;

console.log(`\n✨ 완료: ${success}/${results.length}`);
