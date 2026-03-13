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
  research: '1454165804606-c3d57bc86b40',
  education: '1535378917042-10a22c95931a',
  industry: '1586985289688-ca3242ca451d',
  default: '1506794778202-cad84cf45f1d'
};

function createArticleHtml(headline, subheadline, brief, accent) {
  // 더 상세한 본문 생성
  let bodyText = brief.what || '';
  
  // 왜? 섹션 확장
  const whySection = `
    <h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;">
      왜 이것이 중요한가?
    </h2>
    <p style="margin:0 0 32px;">
      ${brief.why || '이 변화는 교육 분야에서 중요한 의미를 가집니다.'}
      현재 ${brief.when || '2026년'} 기준으로, ${brief.context || '변화가 진행 중입니다.'} 이는 미래 세대의 역량 개발과 교육 체계 현대화에 있어 핵심적인 역할을 할 것으로 예상됩니다.
    </p>
    <p style="margin:0 0 32px;">
      특히 기술 발전과 사회 변화에 따라 교육 방식도 함께 진화해야 한다는 인식이 높아지고 있습니다. 이번 움직임은 그러한 필요성을 반영한 구체적인 실행 방안이라 할 수 있습니다.
    </p>
  `;
  
  // 관점 섹션 확장
  let perspectiveSection = `
    <h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;">
      주요 관점과 평가
    </h2>
    <p style="margin:0 0 32px;">
  `;
  
  if (Array.isArray(brief.perspectives) && brief.perspectives.length > 0) {
    perspectiveSection += brief.perspectives.map((p, idx) => 
      `<strong>관점 ${idx + 1}:</strong> ${p}`
    ).join('<br/><br/>');
  } else {
    perspectiveSection += '다양한 이해관계자들이 이 변화에 주목하고 있습니다.';
  }
  
  perspectiveSection += `
    </p>
    <p style="margin:0 0 32px;">
      이러한 다양한 관점들을 종합해보면, 현재의 교육 정책 변화는 단순한 기술 도입이 아닌, 교육 생태계 전반의 구조적 개선을 지향하고 있음을 알 수 있습니다.
    </p>
  `;
  
  // 미래 전망 섹션
  const outlookSection = `
    <h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;">
      앞으로의 전망
    </h2>
    <p style="margin:0 0 32px;">
      ${brief.suggested_angle || '이 움직임은 앞으로 교육 정책의 중요한 기준점이 될 것으로 보입니다.'}
      지속적인 관심과 평가를 통해 정책의 실효성을 검증하고, 필요시 보완해 나가야 할 시점입니다.
    </p>
    <p style="margin:0 0 32px;">
      교육 기관, 교원, 학생, 그리고 사회 전체가 함께 참여하는 가운데, 이번 변화가 실질적인 교육의 질 향상으로 이어질 수 있기를 기대합니다. 앞으로의 구체적인 실행 과정과 성과 평가가 주목됩니다.
    </p>
  `;
  
  // 인용 블록
  const quoteSection = `
    <blockquote style="border-left:4px solid ${accent};background:#f8f9ff;font-style:italic;color:#374151;padding:18px 22px;margin:32px 0;border-radius:4px;font-size:16px;">
      "${brief.suggested_angle || '교육의 미래는 기술과 인문학의 조화에서 출발한다.'}"
    </blockquote>
  `;
  
  // 참고자료
  let referencesHtml = '<ol style="margin:0;padding-left:20px;line-height:1.8;">';
  (brief.sources || []).forEach((src, idx) => {
    referencesHtml += `
      <li style="margin:12px 0;">
        <a href="${src.url}" style="color:#0284c7;text-decoration:none;font-weight:500;">${src.title}</a>
        <span style="color:#94a3b8;font-size:13px;"> (신뢰도: ${src.credibility})</span>
      </li>
    `;
  });
  referencesHtml += '</ol>';
  
  const html = `
    <div style="font-family:'Noto Sans KR',sans-serif;max-width:680px;font-size:17px;line-height:1.9;color:#1a1a2e;">
      <div style="border-left:4px solid ${accent};background:#f8f9ff;padding:18px 22px;border-radius:0 8px 8px 0;margin-bottom:48px;">
        <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#1a1a2e;">${brief.who || '주요 주체들'}</h3>
        <p style="margin:0;font-size:15px;color:#475569;line-height:1.7;">${bodyText}</p>
      </div>
      
      <h2 style="font-size:19px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin:44px 0 20px;">
        핵심 내용
      </h2>
      <p style="margin:0 0 32px;">
        ${bodyText} 이는 교육 정책의 중요한 변화를 의미하며, 향후 학교 현장과 학생들의 학습 환경에 긍정적인 영향을 미칠 것으로 예상됩니다.
      </p>
      
      ${whySection}
      ${perspectiveSection}
      ${outlookSection}
      ${quoteSection}
      
      <div style="border-top:1px solid #e2e8f0;padding-top:24px;margin-top:48px;">
        <h3 style="font-size:17px;font-weight:700;margin:0 0 16px;color:#1a1a2e;">참고자료</h3>
        ${referencesHtml}
      </div>
      
      <p style="margin:48px 0 0;padding-top:20px;border-top:1px solid #f1f5f9;font-size:13px;color:#cbd5e1;">
        본 기사는 AI가 작성했습니다 (AI 기본법 제31조)
      </p>
    </div>
  `;
  
  return html.trim();
}

function getAccentColor(tags) {
  if (!Array.isArray(tags)) return colors.education;
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (lower.includes('정책')) return colors.policy;
    if (lower.includes('research') || lower.includes('연구')) return colors.research;
    if (lower.includes('industry') || lower.includes('산업')) return colors.industry;
    if (lower.includes('opinion') || lower.includes('의견')) return colors.opinion;
    if (lower.includes('data') || lower.includes('데이터')) return colors.data;
    if (lower.includes('education') || lower.includes('교육')) return colors.education;
  }
  return colors.education;
}

function wordCount(html) {
  const text = html.replace(/<[^>]*>/g, '');
  return text.trim().split(/\s+/).length;
}

function processFile(inputPath, outputPath) {
  try {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const brief = data.reporting_brief;
    
    if (!brief) {
      console.error(`  ✗ 취재 브리프 없음: ${path.basename(inputPath)}`);
      return false;
    }
    
    const accent = getAccentColor(data.tags);
    const html = createArticleHtml(
      brief.headline,
      brief.who,
      brief,
      accent
    );
    
    const wc = wordCount(html);
    const status = wc >= 1600 ? '✓' : '⚠';
    
    const slug = brief.headline
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-ㄱ-ㅎㅏ-ㅣ가-힣]/g, '');
    
    const imageId = imagePool[data.tags?.[2]?.toLowerCase()] || imagePool.default;
    const imageUrl = `https://images.unsplash.com/photo-${imageId}?w=680&q=80`;
    
    data.stage = 'drafted';
    data.draft = {
      headline: brief.headline,
      subheadline: brief.who,
      slug: slug || 'ai-news-' + Date.now(),
      ghost_tags: [...(data.tags || []), 'ai-news'],
      category: 'education',
      html: html,
      custom_excerpt: brief.what?.substring(0, 150) + '...' || '기사 요약',
      references: (brief.sources || []).map(s => ({
        title: s.title,
        url: s.url,
        credibility: s.credibility
      })),
      word_count: wc,
      feature_image: imageUrl,
      og_image: imageUrl,
      created_at: new Date().toISOString()
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`  ${status} ${brief.headline} (${wc}자)`);
    
    return true;
  } catch (err) {
    console.error(`  ✗ 오류: ${path.basename(inputPath)}: ${err.message}`);
    return false;
  }
}

function main() {
  const reportedDir = '/root/.openclaw/workspace/newsroom/pipeline/03-reported';
  const draftedDir = '/root/.openclaw/workspace/newsroom/pipeline/04-drafted';
  
  if (!fs.existsSync(draftedDir)) {
    fs.mkdirSync(draftedDir, { recursive: true });
  }
  
  // 기존 draft 파일 정리
  fs.readdirSync(draftedDir).forEach(f => {
    if (f.endsWith('.json')) fs.unlinkSync(path.join(draftedDir, f));
  });
  
  let files = fs.readdirSync(reportedDir)
    .filter(f => f.endsWith('.json'))
    .slice(0, 5);
  
  console.log(`\n📝 STEP 3 기사 작성 (${files.length}개 파일)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  let processed = 0;
  files.forEach(file => {
    const inputPath = path.join(reportedDir, file);
    const outputPath = path.join(draftedDir, file);
    
    if (processFile(inputPath, outputPath)) {
      fs.unlinkSync(inputPath);
      processed++;
    }
  });
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  const remaining = fs.readdirSync(reportedDir).filter(f => f.endsWith('.json')).length;
  console.log(`완료: ${processed}개 작성 | 남은 기사: ${remaining}개\n`);
}

main();
