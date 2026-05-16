#!/usr/bin/env python3
import json, re, os

# Read the malformed JSON to extract what we can
os.chdir("/root/.openclaw/workspace/newsroom")

# The article body text (from the broken JSON content field)
article_title = "美 힐스버러 카운티 학교들, 7,000명 교사에 AI 교육 플랫폼 '매직 스쿨' 도입"
headline_short = "미 플로리다 교사 7,000명 AI 플랫폼"[:30]

body = """
<p>미국 플로리다주 힐스버러 카운티 교육구가 인공지능(AI) 교육 플랫폼 '매직 스쿨(Magic School)'을 지역 내 약 7,000명의 교사에게 공식 도입했다고 현지 매체 92.5 MAXIMA가 23일(현지시간) 보도했다.</p>

<p>이번 도입은 지난 2월 힐스버러 카운티 교육위원회의 승인을 거쳐 이뤄졌으며, 앞서 진행된 시범 운영에서 긍정적인 결과가 확인됨에 따라 전면 확대된 것으로 알려졌다.</p>

<h2>'한 시간 걸리던 작업이 2~3분으로'</h2>

<p>매직 스쿨은 교사들이 수업 지도안, 학습지, 차트, 프레젠테이션 자료 등을 손쉽게 제작할 수 있도록 지원하는 AI 기반 플랫폼이다. 특히 반복적이고 시간이 많이 소요되는 수업 준비 과정을 대폭 단축해주는 것이 핵심 강점으로 꼽힌다.</p>

<p>화튼 고등학교(Wharton High School)에서 AICE 사회학을 가르치는 켈리 휘튼(Kelly Whitton) 교사는 시범 운영 단계부터 이 플랫폼을 사용해왔다. 그는 Bay News 9와의 인터뷰에서 "예전에는 한 시간이 걸리던 작업이 이제는 2~3분이면 끝난다. 파워포인트 자료 제작은 수년간 엄두를 못 냈는데, 이제 AI가 대신 해준다"며 만족감을 나타냈다.</p>

<p>휘튼 교사는 처음에는 AI 도구 도입에 회의적이었다고 고백하면서도, 거의 한 학기 동안 사용한 결과 수업 준비보다 실제 가르침에 더 집중할 수 있게 됐다고 강조했다.</p>

<h2>'AI는 교사를 대체하지 않는다'</h2>

<p>게리 브래디(Gary Brady) 힐스버러 카운티 교육청 최고학술책임자는 AI 도입이 교사 대체가 아닌 지원을 목적으로 한다는 점을 분명히 했다.</p>

<p>브래디 책임자는 "인간의 상호작용, 협업, 비판적 사고를 대체할 수 있는 것은 아무것도 없다"며 "AI는 교사들을 위한 도구일 뿐이며, 강력한 교사의 역할을 대신할 수 있는 것은 결코 없다"고 말했다.</p>

<p>또한 교육청 관계자에 따르면, 매직 스쿨 플랫폼에는 플로리다주의 모든 교육 기준(teaching standards)이 탑재되어 있어 AI가 생성하는 모든 자료가 주 교육과정과 일관성을 유지하도록 설계됐다.</p>

<h2>가르침의 본질에 집중할 시간을</h2>

<p>힐스버러 카운티 교육구의 이번 결정은 최근 미국 교육 현장에서 AI 도입이 가속화되는 흐름을 반영한다. 행정 업무에 과도하게 할애되던 교사들의 시간을 줄이고, 본질적인 교육 활동에 집중할 수 있는 환경을 조성하겠다는 취지다.</p>

<p>휘튼 교사는 "AI 덕분에 내가 진정으로 사랑하는 일, 즉 가르치는 일에 더 많은 시간을 쏟을 수 있게 됐다"고 전했다.</p>
"""

# Build full HTML wrapper
accent = "#0891b2"
tag_pills = '<span style="display:inline-block;background:#0891b215;color:#0891b2;font-size:12px;padding:2px 10px;border-radius:12px;margin-right:6px;">해외</span><span style="display:inline-block;background:#0891b215;color:#0891b2;font-size:12px;padding:2px 10px;border-radius:12px;margin-right:6px;">미국</span>'

html = f'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{headline_short}</title>
<style>
body {{ font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; background: #fafafa; }}
.wrapper {{ max-width: 680px; margin: 0 auto; font-size: 17px; line-height: 1.9; color: #1a1a2e; }}
.lead-box {{ border-left: 4px solid {accent}; background: #f8f9ff; padding: 18px 22px; border-radius: 0 8px 8px 0; margin-bottom: 36px; }}
.source-line {{ font-size: 15px; color: {accent}; font-weight: 600; margin-bottom: 4px; }}
.date-line {{ font-size: 14px; color: #64748b; margin-bottom: 8px; }}
p {{ margin: 0 0 24px 0; text-align: justify; }}
h2 {{ font-size: 19px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin: 36px 0 16px 0; }}
.references {{ border-top: 1px solid #e2e8f0; margin-top: 40px; padding-top: 28px; }}
.ai-footer {{ margin: 40px 0 0; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #94a3b8; }}
blockquote {{ border-left: 4px solid {accent}; background: #f8f9ff; padding: 16px 20px; font-style: italic; color: #374151; margin: 28px 0; border-radius: 0 4px 4px 0; }}
</style>
</head>
<body>
<div class="wrapper">
<div class="lead-box">
  <div class="source-line">925MAXIMA 보도 | 1일 전</div>
  <div class="date-line">2026-04-24 | 교육팀 {tag_pills}</div>
  <h1 style="font-size:22px;font-weight:700;margin:8px 0 6px 0;line-height:1.4;">{headline_short}</h1>
  <p class="lead-text" style="font-size:16px;color:#475569;margin-top:10px;"><strong>수업 준비 1시간 → 3분… 플로리다 힐스버러 카운티, 교사 7,000명에 AI 교육 플랫폼 전격 도입</strong></p>
</div>
{body}
<div class="references">
<h3 style="font-size:16px;font-weight:600;margin:0 0 12px 0;">참고자료</h3>
<ol>
  <li><a href="https://925maxima.com/2026/04/23/hillsborough-county-schools-deploy-ai-platform-for-7000-teachers-2/" target="_blank" rel="noopener noreferrer">Hillsborough County Schools Deploy AI Platform for 7,000 Teachers - 92.5 MAXIMA</a></li>
</ol>
</div>
<p class="ai-footer">본 기사는 AI로 작성되었습니다 (AI 기본법 제31조). 원문 기사의 내용을 바탕으로 재구성되었습니다.</p>
</div>
</body>
</html>'''

plain = re.sub(r'<[^>]+>', ' ', html)
plain = re.sub(r'\s+', ' ', plain).strip()

data = {
    "id": "source-1777046571539-1",
    "stage": "drafted",
    "source": {
        "title": "Hillsborough County Schools Deploy AI Platform for 7,000 Teachers - 92.5 MAXIMA",
        "url": "https://925maxima.com/2026/04/23/hillsborough-county-schools-deploy-ai-platform-for-7000-teachers-2/",
        "source": "925maxima.com",
        "date": "2026-04-23"
    },
    "score": 90,
    "region": "usa",
    "regionName": "미국",
    "collected_at": "2026-04-24T16:02:51.539Z",
    "assigned_at": "2026-04-24T18:00:00Z",
    "draft": {
        "headline": headline_short,
        "html": html,
        "slug": "mi-peullorida-gyosa-7000myeong-ai",
        "ghost_tags": ["ai-edu", "해외", "미국"],
        "custom_excerpt": headline_short,
        "references": [{"title": "Hillsborough County Schools Deploy AI Platform for 7,000 Teachers", "url": "https://925maxima.com/2026/04/23/hillsborough-county-schools-deploy-ai-platform-for-7000-teachers-2/"}],
        "word_count": len(plain.split()),
        "char_count": len(plain)
    }
}

os.remove("pipeline/04-drafted/source-1777046571539-1-ko.json")
with open("pipeline/04-drafted/source-1777046571539-1.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ Saved: source-1777046571539-1.json ({len(plain)}자)")
print(f"   Headline: {headline_short}")
print(f"   Word count: {len(plain.split())}")
