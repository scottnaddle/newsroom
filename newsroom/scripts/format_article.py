#!/usr/bin/env python3
"""
통일 기사 포맷 변환 모듈 (Unified Article Formatter)
====================================================
뉴스룸의 모든 기사 스크립트가 동일한 HTML 포맷을 따르도록 변환합니다.

통일 포맷 규칙:
- 리드 문단(첫 문단): <blockquote>
- 일반 소제목 (##): <h2>
- 숫자 소제목 (## 1. xxx, ## 2. xxx): <h3>
- 세부 소제목 (###): <h3>
- 본문: <p>
- 볼드: <strong>
- 링크: <a href="url">text</a>
- 구분선: <hr />
"""

import re

# ─── 헤더 분류 기준 ───
H2_KEYWORDS = ['키워드', '트렌드', 'TOP', '개요', '핵심 인사이트', '마무리', '인사이트', '요약',
               '🔥', '📊']
H3_PREFIX_PATTERN = re.compile(r'^##\s+\d+[\.\)]')  # "## 1. xxx", "## 2) xxx"


def markdown_links_to_html(text: str) -> str:
    """Convert [text](url) markdown links to <a> tags. Multiple passes for edge cases."""
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    text = re.sub(r'\[([^\]]+)\]\(\"([^)]+)\"\)', r'<a href="\2">\1</a>', text)
    text = re.sub(r'\[([^\]]*?)\]\(([^"\s][^\s]*?)\)', r'<a href="\2">\1</a>', text)
    return text


def bold_to_html(text: str) -> str:
    """Convert **bold** to <strong>."""
    return re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)


def resolve_header(line: str) -> str | None:
    """
    Deprecated: all headers are now converted to <p> for unified format.
    """
    return None


def text_to_html(text: str, *, use_blockquote_lead: bool = True,
                  skip_first_line: bool = False) -> str:
    """
    Convert markdown-style article text to Ghost-compatible HTML.
    
    UNIFIED 5/13 FORMAT:
      <blockquote>한줄 출처/리드</blockquote>
      <p>본문...</p>
      <p>원문 보기: <a href="URL">URL</a></p>
      <p>본 기사는 AI로 작성되었습니다...</p>
    
    No <h2>, <h3>, <hr> — all content is blockquote + paragraphs.
    All ## headers are converted to <p> (bold text preserved).

    Args:
        text: Raw article text with markdown formatting
        use_blockquote_lead: If True, first real paragraph becomes <blockquote>
        skip_first_line: If True, skip the first line (e.g., raw title)

    Returns:
        Ghost-compatible HTML string (unified format)
    """
    text = markdown_links_to_html(text)
    text = bold_to_html(text)

    # Remove all markdown/HTML headers, hr
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n-{3,}\n', '\n', text)
    text = re.sub(r'\n—{3,}\n', '\n', text)

    paragraphs = text.strip().split('\n\n')
    html_parts = []
    first_real = True

    for i, p in enumerate(paragraphs):
        p = p.strip()
        if not p:
            continue
        if skip_first_line and i == 0:
            continue

        # Skip standalone horizontal rules
        if p == '---' or p == '—':
            continue

        # Bold lead (if enabled)
        if use_blockquote_lead and first_real:
            html_parts.append(f'<blockquote>{p}</blockquote>')
            first_real = False
            continue

        html_parts.append(f'<p>{p}</p>')

    html = '\n'.join(html_parts)

    # Final cleanup
    html = re.sub(r'<p>\s*</p>', '', html)
    html = re.sub(r'\n{3,}', '\n\n', html)

    return html
