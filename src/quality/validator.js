/**
 * quality/validator.js — HTML/컨텐츠 검증 (LLM 불필요)
 */

class Validator {
  constructor(config) {
    this.config = config;
    this.designConfig = config?.design || {};
  }

  /**
   * HTML 구조 검증
   */
  validateHTML(html) {
    const textContent = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const charCount = textContent.length;
    const koWordCount = Math.round(charCount / 3.5);

    const checks = {
      hasLeadBox: /border-left:\s*4px\s+solid/.test(html),
      h2Count: (html.match(/<h2[\s>]/g) || []).length,
      hasReferences: /참고\s*자료|References|참고자료/.test(html),
      hasAiFooter: /AI가 작성|AI 기본법|AI-generated/.test(html),
      hasNumericalCard: /display:\s*flex/.test(html) && /font-size:\s*3[0-9]px/.test(html),
      charCount,
      koWordCount
    };

    const issues = [];
    const minLength = this.config?.agents?.copy_editor?.min_content_length || 1500;
    const minWords = 200;

    if (!checks.hasLeadBox) issues.push('리드박스 없음');
    if (checks.h2Count < 2) issues.push(`h2 섹션 부족 (${checks.h2Count}개)`);
    if (!checks.hasReferences) issues.push('참고자료 없음');
    if (this.designConfig.show_ai_disclaimer && !checks.hasAiFooter) issues.push('AI 각주 없음');
    if (checks.hasNumericalCard) issues.push('금지된 수치 카드');
    if (charCount < minLength) issues.push(`본문 짧음 (${charCount}자 < ${minLength}자)`);
    if (koWordCount < minWords) issues.push(`단어 부족 (${koWordCount} < ${minWords})`);

    return { valid: issues.length === 0, checks, issues };
  }

  /**
   * 메타데이터 자동 생성
   */
  generateMeta(title, html) {
    const textContent = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    
    return {
      meta_title: title.length > 60 ? title.slice(0, 57) + '...' : title,
      meta_description: textContent.length > 150 ? textContent.slice(0, 147) + '...' : textContent,
      slug: title.toLowerCase().replace(/[^\w\s가-힣-]/g, '').replace(/\s+/g, '-').slice(0, 75)
    };
  }

  /**
   * 중복 검사 (Levenshtein 기반)
   */
  checkDuplicate(title1, title2, threshold = 85) {
    const similarity = this.calculateSimilarity(title1, title2);
    return {
      isDuplicate: similarity >= threshold,
      similarity: Math.round(similarity),
      threshold
    };
  }

  calculateSimilarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 100;
    const dist = this.levenshteinDistance(longer, shorter);
    return ((longer.length - dist) / longer.length) * 100;
  }

  levenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) { costs[j] = j; }
        else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }
}

module.exports = Validator;
