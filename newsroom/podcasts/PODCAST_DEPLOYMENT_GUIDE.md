# 📻 에듀테크 인사이트 팟캐스트 배포 가이드

## 🎉 생성 완료!

**날짜**: 2026-03-09 23:00 KST  
**팟캐스트**: 에듀테크 인사이트: 규제와 혁신이 만나는 순간  
**길이**: 4분 32초  
**진행자**: 헤일리(여성) + 전문가(남성)

---

## 📝 Ghost CMS 배포 방법

### Step 1: Ghost 관리자 페이지 접속
1. https://askedtech.ghost.io/ghost 접속
2. 로그인 (필요시)

### Step 2: 새 페이지 생성
1. **Pages** → **New page** 클릭
2. **제목**: `📻 에듀테크 인사이트 팟캐스트 - 규제와 혁신`
3. **Slug** (URL): `edyutech-podcast-today`

### Step 3: HTML 콘텐츠 붙여넣기

**옵션 A: 리치 에디터 사용**
1. 에디터의 **HTML** 탭으로 전환
2. 아래 HTML 코드를 복사해서 붙여넣기:

```html
<!-- 아래 HTML을 Ghost 에디터에 붙여넣기 -->
<div style="font-family: 'Noto Sans KR', sans-serif; max-width: 680px; font-size: 17px; line-height: 1.9; color: #1a1a2e; margin: 0 auto;">

  <!-- 리드 박스 -->
  <div style="border-left: 4px solid #0891b2; padding: 18px 22px; background: #f8f9ff; border-radius: 0 8px 8px 0; margin-bottom: 48px;">
    <p style="margin: 0; font-weight: 500;">
      📻 <strong>에듀테크 인사이트 팟캐스트</strong><br/>
      글로벌 규제(EU AI Act)와 투자(미국 NSF), 한국의 현장 혁신(안산원곡초)이 동시에 움직이는 2026년, 
      에듀테크 산업의 기회와 과제를 3-5분 팟캐스트로 만나보세요.
    </p>
  </div>

  <!-- 팟캐스트 플레이어 -->
  <div style="text-align: center; margin: 44px 0; padding: 20px; background: #f1f5f9; border-radius: 8px;">
    <h3 style="margin-top: 0;">🎙️ 팟캐스트 듣기</h3>
    <audio controls style="width: 100%; max-width: 500px; margin: 20px 0;">
      <source src="https://askedtech.ghost.io/podcasts/20260309-edyutech.mp3" type="audio/mpeg">
      Your browser does not support the audio element.
    </audio>
    <p style="margin: 12px 0 0; color: #64748b; font-size: 14px;">
      진행자: 헤일리(여성) + 전문가(남성) | 재생시간: 4:32
    </p>
  </div>

  <!-- 주요 내용 -->
  <h2 style="font-size: 19px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin: 44px 0 20px;">
    📌 이 팟캐스트에서 배우는 것
  </h2>

  <p style="margin: 0 0 32px;">
    • <strong>EU AI Act의 교육 분야 적용</strong> — 2026년 8월부터 대학의 AI 거버넌스 의무화<br/>
    • <strong>미국의 NSF AI Education Act</strong> — 100만 명 AI 인력 양성 계획<br/>
    • <strong>안산원곡초 사례</strong> — AI로 다문화 교실의 언어 장벽 극복하기<br/>
    • <strong>에듀테크 기업을 위한 4가지 기회</strong> — 규제, 포용성, 정책, 협력
  </p>

  <!-- 전문가 인사이트 -->
  <h2 style="font-size: 19px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin: 44px 0 20px;">
    💡 핵심 포인트
  </h2>

  <div style="border-left: 4px solid #0891b2; padding: 12px 16px; background: #f8f9ff; margin-bottom: 24px; border-radius: 0 4px 4px 0;">
    <p style="margin: 0; font-style: italic; color: #374151;">
      "2026년은 규제(EU), 투자(미국), 혁신(한국)이 동시에 일어나는 황금 기회의 시기입니다. 
      AI가 교육에 들어왔을 때, 누가 책임지는가라는 질문에 각자 다르게 답하고 있거든요."
    </p>
  </div>

  <p style="margin: 0 0 32px;">
    이 팟캐스트는 <strong>매일 오전 9시</strong>에 업데이트되는 에듀테크 인사이트 기사를 바탕으로 만들어집니다.
    바쁜 당신도 출근길에 귀로만 듣고 에듀테크의 최신 트렌드를 따라잡을 수 있어요! 🎧
  </p>

  <!-- 참고 자료 -->
  <h2 style="font-size: 19px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin: 44px 0 20px;">
    📚 참고 자료
  </h2>

  <ul style="margin: 0 0 32px; padding-left: 20px;">
    <li style="margin-bottom: 12px;">
      <a href="https://insight.ubion.global/edyutekeu-insaiteu-gyujewa-hyeogsini-mannaneun-sungan/" target="_blank" style="color: #0284c7; text-decoration: none;">
        📖 원문: 에듀테크 인사이트 - 규제와 혁신이 만나는 순간
      </a>
    </li>
    <li style="margin-bottom: 12px;">
      <a href="https://www.theeducationmagazine.com/ai-governance-in-higher-education/" target="_blank" style="color: #0284c7; text-decoration: none;">
        🎓 EU AI Governance in Higher Education 2026 프레임워크
      </a>
    </li>
    <li style="margin-bottom: 12px;">
      <a href="https://www.commerce.senate.gov/2026/3/cantwell-moran-introduce-bill-to-boost-ai-education" target="_blank" style="color: #0284c7; text-decoration: none;">
        🇺🇸 상원 상무위원회 - AI Education Act of 2026
      </a>
    </li>
    <li>
      <a href="https://insight.ubion.global/" target="_blank" style="color: #0284c7; text-decoration: none;">
        🔗 더 많은 에듀테크 인사이트 보기
      </a>
    </li>
  </ul>

  <!-- AI 각주 -->
  <p style="margin: 48px 0 0; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #cbd5e1;">
    본 팟캐스트 스크립트는 AI가 생성했으며, 한국어 TTS로 여성/남성 진행자 목소리로 제작되었습니다. 
    (AI 기본법 제31조 준수)
  </p>

</div>
```

### Step 4: 메타데이터 설정
- **SEO Title**: `에듀테크 인사이트 팟캐스트 - 규제와 혁신`
- **Meta Description**: `글로벌 AI 규제와 교육 투자 트렌드를 3분 팟캐스트로 만나보세요`
- **OG Title**: `📻 에듀테크 팟캐스트`
- **OG Description**: `AI 교육의 미래를 한국어로!`

### Step 5: 발행
1. **Status** → **Published** 선택
2. **Publish** 클릭

---

## 🎙️ 팟캐스트 오디오 업로드

### 방법 1: Ghost Media Library에 업로드 (추천)
1. Ghost 관리자 → **Media Library**
2. MP3 파일 업로드
3. 생성된 URL을 HTML의 `<source src="">` 에 붙여넣기

### 방법 2: 외부 호스팅 (Anchor, Buzzsprout, Podbean 등)
- 서비스에 MP3 업로드
- 제공된 embed 코드를 Ghost에 삽입

### 방법 3: 로컬 서버에서 서빙
```bash
# podcasts 폴더를 웹 서버로 노출
cd /root/.openclaw/workspace/newsroom/podcasts
python3 -m http.server 8000
```
URL: `http://your-domain.com:8000/20260309-edyutech.mp3`

---

## ⚙️ 자동화 설정 (다음 단계)

### 일일 팟캐스트 생성 자동화
매일 오전 9시에 자동으로 팟캐스트를 생성하고 Ghost에 발행하려면:

```bash
# 크론 작업 설정
crontab -e

# 매일 오전 9시 실행
0 9 * * * cd /root/.openclaw/workspace/notebooklm-server && node generate-podcast.js
```

### Ghost API 자동화 (향후 개선)
- JWT 토큰 생성 방식 개선
- 안정적인 API 인증 구현
- 자동 오류 재시도 로직

---

## 📊 모니터링

### 생성된 파일 위치
- **팟캐스트 HTML**: `/root/.openclaw/workspace/notebooklm-server/podcast-*.html`
- **팟캐스트 스크립트**: `/root/.openclaw/workspace/newsroom/podcasts/edyutech-insight-20260309-script.txt`
- **NotebookLM API 로그**: NotebookLM 서버 콘솔

### 상태 확인
```bash
# NotebookLM API 서버 상태
curl http://127.0.0.1:3849/health

# 생성된 팟캐스트 목록
curl http://127.0.0.1:3849/api/podcasts
```

---

## 🎯 다음 단계

1. ✅ NotebookLM API 구축 완료
2. ✅ 팟캐스트 생성 완료
3. ⏳ Ghost CMS에 수동 발행 (위 Step 1-5 참고)
4. ⏳ 한국어 TTS 통합 (Google Cloud TTS 또는 Naver Clova)
5. ⏳ 일일 자동화 크론 설정
6. ⏳ 팟캐스트 채널 메타데이터 최적화

---

## 💬 문의

- NotebookLM 팟캐스트: `https://github.com/HarveyHunt/notebooklm-rest-api`
- Ghost CMS API: `https://ghost.org/docs/api/`
- TTS 솔루션: Google Cloud TTS, Naver Clova Voice

---

**마지막 업데이트**: 2026-03-09 23:00 KST  
**상태**: 프로토타입 완성, 자동화 준비 중
