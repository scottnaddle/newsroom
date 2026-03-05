#!/usr/bin/env node
/**
 * 생성된 JSON을 Ghost 페이지에 반영
 * 1분마다 실행 (cron)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const JSON_FILE = '/root/.openclaw/workspace/newsroom/public/status.json';
const DASH_HTML = '/root/.openclaw/workspace/newsroom/scripts/dashboard-page.html';
const PAGE_ID = '69a8cadce2eb440001d5584c';
const [kid,secret]='69a41252e9865e00011c166a:e74e50ce3e6c097ad370d5370633ccbc2a3e3c0627d7ce1fc12a81b4e6b01625'.split(':');

function tok(){const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT',kid})).toString('base64url');const now=Math.floor(Date.now()/1000);const p=Buffer.from(JSON.stringify({iat:now,exp:now+300,aud:'/admin/'})).toString('base64url');return h+'.'+p+'.'+crypto.createHmac('sha256',Buffer.from(secret,'hex')).update(h+'.'+p).digest('base64url');}

function ghostReq(method,path,body){return new Promise((res,rej)=>{const data=body?JSON.stringify(body):null;const req=https.request({hostname:'ubion.ghost.io',path,method,headers:{'Authorization':'Ghost '+tok(),'Accept-Version':'v5.0',...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{})}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d));}catch(e){res(null);}});});req.on('error',rej);if(data)req.write(data);req.end();});}

(async () => {
  try {
    // JSON 파일 읽기
    if (!fs.existsSync(JSON_FILE)) { return; }
    const statusData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
    
    // HTML 템플릿 읽기 (body는 유지, <script>의 데이터만 업데이트)
    let html = fs.readFileSync(DASH_HTML, 'utf-8');
    
    // HTML에서 데이터 변수 부분 찾아서 최신 JSON으로 바꾸기
    // <script> 태그 내의 const로 정의된 statusData를 찾아서 대체
    // 간단히: data를 render 함수 내에서 fetch 대신 로컬 객체로 사용
    
    // 더 간단한 방법: <script> 내에 statusData를 직접 embed
    const dataScript = `window.statusData = ${JSON.stringify(statusData)};`;
    
    // HTML에서 <script> 태그 찾아서 데이터 추가
    if (!html.includes('window.statusData')) {
      // render() 함수 바로 앞에 데이터 추가
      html = html.replace('<script>', `<script>\n${dataScript}\n`);
    } else {
      // 기존 데이터 업데이트
      html = html.replace(/window\.statusData = \{[\s\S]*?\};/, dataScript);
    }
    
    // fetch 호출을 로컬 데이터 사용으로 변경
    if (html.includes("const API='https://insight.ubion.global/content/newsroom/status.json';")) {
      html = html.replace(
        "const API='https://insight.ubion.global/content/newsroom/status.json';",
        "const API=null; // 로컬 데이터 사용"
      );
    }
    
    // fetch 로직을 데이터 직접 사용으로 변경
    const oldFetch = `async function render(){
  try{
    const r=await fetch(API);
    const d=await r.json();`;
    const newFetch = `async function render(){
  try{
    const d=window.statusData || {};`;
    
    html = html.replace(oldFetch, newFetch);
    
    // Ghost 페이지 업데이트
    const lexical = JSON.stringify({
      root: { children: [{ type:'html', version:1, html }],
        direction:'ltr', format:'', indent:0, type:'root', version:1 }
    });
    
    // 현재 페이지 정보 조회 (updated_at 필요)
    const pageData = await ghostReq('GET', `/ghost/api/admin/pages/${PAGE_ID}/`);
    const updated_at = pageData?.pages?.[0]?.updated_at;
    
    // 페이지 업데이트
    const result = await ghostReq('PUT', `/ghost/api/admin/pages/${PAGE_ID}/`, {
      pages: [{ lexical, updated_at }]
    });
    
    if (result?.pages?.[0]) {
      // 조용히 성공
    } else {
      // 조용히 실패
    }
  } catch (e) {
    // 오류 무시
  }
})();
