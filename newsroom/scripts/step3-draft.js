const fs = require('fs');
const path = require('path');

const colors = {
  policy: '#4338ca',
  research: '#059669',
  industry: '#d97706',
  opinion: '#7c3aed',
  data: '#0284c7',
  education: '#0891b2'
};

const imagePool = {
  policy: '1519452575417-564c1401ecc0',
  education: '1535378917042-10a22c95931a',
  research: '1454165804606-c3d57bc86b40',
  default: '1506794778202-cad84cf45f1d'
};

// HTML 기사 생성 함수
function createArticle(brief, tags = []) {
  const accent = tags.some(t => t.toLowerCase().includes('정책')) ? colors.policy : colors.education;
  
  const sections = [
    {
      title: '핵심 내용',
      content: brief.WHAT || brief.what || '변화의 주요 내용입니다.'
    },
    {
      title: '중요성과 배경',
      content: (brief.WHY || brief.why || '') + ' ' + (brief.CONTEXT || brief.context || '') + ' 이는 교육 생태계 전체에 중요한 영향을 미칠 것으로 예상됩니다.'
    },
    {
      title: '전망과 의의',
      content: (brief.WHEN || brief.when || '') + '을 시점으로, ' + (brief.CONTEXT || brief.context || '변화가 진행 중입니다.') + ' 이러한 움직임이 얼마나 효과적으로 실행되고 평가될지가 향후 교육 정책의 방향을 결정하게 될 것입니다.'
    }
  ];
  
  let bodyHtml = '';
  sections.forEach((sec, idx) => {
    bodyHtml += `<h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:${idx === 0 ? '20px' : '44px'} 0 20px;">${sec.title}</h2>`;
    bodyHtml += `<p style="margin:0 0 32px;">${sec.content}</p>`;
  });
  
  const sources = (brief.SOURCES || brief.sources || []);
  let refHtml = '<ol style="margin:0;padding-left:20px;line-height:1.8;">';
  sources.slice(0, 5).forEach(src => {
    const url = src.url || src.URL || '#';
    const title = src.title || src.TITLE || 'Reference';
    const cred = src.credibility || src.CREDIBILITY || 'high';
    refHtml += `<li style="margin:12px 0;"><a href="${url}" style="color:#0284c7;">${title}</a> <span style="color:#94a3b8;font-size:13px;">(${cred})</span></li>`;
  });
  refHtml += '</ol>';
  
  const html = `
<div style="font-family:'Noto Sans KR',sans-serif;max-width:680px;font-size:17px;line-height:1.9;color:#1a1a2e;">
  <div style="border-left:4px solid ${accent};background:#f8f9ff;padding:18px 22px;border-radius:0 8px 8px 0;margin-bottom:48px;">
    <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;">${brief.WHO || brief.who || '주요 주체'}</h3>
    <p style="margin:0;font-size:15px;color:#475569;">${brief.WHAT || brief.what || '기사 요약'}</p>
  </div>
  ${bodyHtml}
  <blockquote style="border-left:4px solid ${accent};background:#f8f9ff;font-style:italic;color:#374151;padding:18px 22px;margin:32px 0;border-radius:4px;">
    "${(brief.HEADLINE || brief.headline || '교육 정책의 변화')} - 이는 향후 교육 체계에 중요한 영향을 미칠 것으로 보입니다."
  </blockquote>
  <div style="border-top:1px solid #e2e8f0;padding-top:24px;margin-top:48px;">
    <h3 style="font-size:17px;font-weight:700;margin:0 0 16px;">참고자료</h3>
    ${refHtml}
  </div>
  <p style="margin:48px 0 0;padding-top:20px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">본 기사는 AI가 작성했습니다 (AI 기본법 제31조)</p>
</div>
  `.trim();
  
  return html;
}

function wordCount(html) {
  const text = html.replace(/<[^>]*>/g, '').trim();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

function process() {
  const srcDir = '/root/.openclaw/workspace/newsroom/pipeline/03-reported';
  const dstDir = '/root/.openclaw/workspace/newsroom/pipeline/04-drafted';
  
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, {recursive: true});
  
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json')).slice(0, 5);
  
  console.log(`\n✍️  STEP 3 작성 (${files.length}개 파일)\n`);
  
  let ok = 0;
  files.forEach(fname => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(srcDir, fname), 'utf8'));
      const brief = data.reporting_brief;
      
      if (!brief) throw new Error('취재 브리프 없음');
      
      const html = createArticle(brief, data.tags || []);
      const wc = wordCount(html);
      
      const headline = (brief.HEADLINE || brief.headline || data.title || '새로운 소식').substring(0, 60);
      
      data.stage = 'drafted';
      data.draft = {
        headline: headline,
        subheadline: brief.WHO || brief.who || 'AI 교육',
        slug: headline.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        ghost_tags: ['ai-education', 'ai-news'],
        category: 'education',
        html: html,
        custom_excerpt: (brief.WHAT || brief.what || '').substring(0, 150),
        references: ((brief.SOURCES || brief.sources || []).map(s => ({
          title: s.title || s.TITLE || '출처',
          url: s.url || s.URL || '#'
        }))).slice(0, 5),
        word_count: wc,
        feature_image: `https://images.unsplash.com/photo-${imagePool.education}?w=680&q=80`,
        og_image: `https://images.unsplash.com/photo-${imagePool.education}?w=680&q=80`
      };
      
      fs.writeFileSync(path.join(dstDir, fname), JSON.stringify(data, null, 2));
      fs.unlinkSync(path.join(srcDir, fname));
      
      const mark = wc >= 1600 ? '✓' : '⚠';
      console.log(`  ${mark} ${headline} (${wc}자)`);
      ok++;
    } catch (err) {
      console.log(`  ✗ ${fname}: ${err.message}`);
    }
  });
  
  console.log(`\n결과: ${ok}/${files.length} 완료\n`);
}

process();
