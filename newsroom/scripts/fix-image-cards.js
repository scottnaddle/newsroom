const fs = require('fs');
const path = require('path');

const publishedDir = '/root/.openclaw/workspace/newsroom/pipeline/08-published';

const imageCard = `<figure class="kg-card kg-image-card kg-width-full">
  <img src="https://images.unsplash.com/photo-1580485944550-73107b027a9f?w=1200&h=630&fit=crop&q=85&auto=format" class="kg-image" alt="AI와 교육">
  <figcaption>AI 기술과 교육의 만남</figcaption>
</figure>`;

console.log('🔧 이미지 카드 고정 (figcaption 추가)');
console.log('');

const files = fs.readdirSync(publishedDir).filter(f => f.endsWith('.json'));

let fixed = 0;

files.forEach((file, index) => {
  const filePath = path.join(publishedDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  if (!data.draft || !data.draft.html) {
    return;
  }
  
  let html = data.draft.html;
  
  // 기존 이미지 카드 제거 (모두 제거)
  // 패턴 1: <!--kg-card-begin: image-->...<!--kg-card-end: image-->
  html = html.replace(/<!--kg-card-begin: image-->[\s\S]*?<!--kg-card-end: image-->/g, '');
  
  // 패턴 2: <figure class="kg-card kg-image-card...">...figcaption 없는 경우
  html = html.replace(/<figure class="kg-card kg-image-card[^>]*>[\s\S]*?<\/figure>\n?/g, (match) => {
    // figcaption이 있으면 유지, 없으면 제거
    if (match.includes('<figcaption>')) {
      return match;
    } else {
      return '';
    }
  });
  
  // 새 이미지 카드를 리드박스 직후에 삽입
  if (!html.includes('kg-image-card')) {
    if (html.includes('<!--kg-card-end: html-->')) {
      html = html.replace(
        '<!--kg-card-end: html-->',
        `<!--kg-card-end: html-->\n${imageCard}`
      );
      
      data.draft.html = html;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      fixed++;
      
      if (fixed <= 10 || fixed % 10 === 0) {
        console.log(`${fixed}. ✅ "${data.draft.headline.substring(0, 40)}..."`);
      }
    }
  }
});

console.log('');
console.log(`✅ 완료: ${fixed}개 파일 수정`);
