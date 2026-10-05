import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fixture, now } from './page-fixtures.mjs';
const baseline=process.argv.includes('--baseline'), disabled=process.argv.includes('--disabled');
const port=baseline?3101:disabled?3102:3100;
const dir=fileURLToPath(new URL('../../../docs/dark-mode-review/final',import.meta.url));
fs.mkdirSync(dir,{recursive:true});
export const routes=['/dashboard','/create','/create/new','/create/qa-draft','/create/qa-content','/calendar','/analytics','/trends','/brand','/failed-posts','/settings','/settings/usage','/profile','/billing','/billing/checkout?plan=PLUS','/billing/return?paymentId=qa-payment','/billing/mock/qa-payment','/admin','/admin/users','/admin/posts','/admin/system','/admin/logs','/admin/api-versions','/admin/revenue','/admin/revenue?tab=orders','/admin/plans','/admin/landing','/admin/usage','/admin/usage/users/qa-admin','/admin/ai/providers','/admin/ai/models','/admin/ai/usage','/','/pricing','/login','/register','/forgot-password','/complete-profile','/privacy','/terms','/data-deletion','/auth/google/callback'];
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-lcd-text','--font-render-hinting=none']});
const results=[],unhandled=new Set();
const onlyArg=process.argv.indexOf('--only');
const only=onlyArg<0?null:process.argv[onlyArg+1].split(',');
try {
for(const width of baseline?[1440]:[1440,390]) for(const mode of baseline?['light']:disabled?['dark']:['light','dark']) {
 const ctx=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh'});
 let authed=true,completing=false;
 await ctx.route('**/api/aima/**',async r=>{
  const req=r.request(),url=new URL(req.url()),p=url.pathname.replace('/api/aima','');
  if(p==='/users/me'&&!authed)return r.fulfill({status:401,json:{code:401,message:'Unauthenticated'}});
  let body={};try{body=req.postDataJSON()??{};}catch{}
  let result=fixture(p,req.method(),url.searchParams,body);
  if(p==='/users/me'&&completing)result={...result,profileCompleted:false};
  if(result===undefined){unhandled.add(p);return r.fulfill({status:404,json:{code:404,message:'UI review fallback'}});}
  return r.fulfill({json:{code:200,message:'Success',result}});
 });
 await ctx.addInitScript(({mode,collapsedPaths})=>{localStorage.setItem('aima-color-mode',mode);localStorage.setItem('aima-theme','ocean');localStorage.setItem('aima.sidebarCollapsed',collapsedPaths.includes(location.pathname)?'1':'0');},{mode,collapsedPaths:routes.slice(9,32).map(r=>r.split('?')[0])});
 const page=await ctx.newPage();page.setDefaultTimeout(5000);
 await page.clock.install({time:new Date(now)});
 await page.clock.setFixedTime(new Date(now));
 await page.addInitScript(()=>Object.defineProperty(performance,'now',{value:()=>1000}));
 let errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [i,route] of routes.entries()) {
  if(only&&!only.includes(route.split('?')[0]))continue;
  errors=[];authed=!['/login','/register','/forgot-password','/auth/google/callback'].includes(route);completing=route==='/complete-profile';
  let failure=null;
  try {
   await page.goto(`http://127.0.0.1:${port}${route}`,{waitUntil:'networkidle',timeout:20000});
   await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'+(mode==='light'?'.color-mode-toggle{display:none!important}':'')});
   if(mode==='light')await page.locator('.color-mode-settings').evaluateAll(els=>els.forEach(el=>el.parentElement.style.display='none'));
   await page.evaluate(async()=>{await Promise.all([300,400,500,600,700,800].flatMap(w=>["Be Vietnam Pro","Plus Jakarta Sans"].map(f=>document.fonts.load(`${w} 14px '${f}'`))));await document.fonts.ready;});
   await page.waitForTimeout(150);
   const dark=await page.evaluate(()=>document.documentElement.classList.contains('dark'));
   if(dark!==(!baseline&&!disabled&&mode==='dark'))failure=`wrong mode: ${dark}`;
  }catch(e){failure=e.message;}
  const audit=await page.evaluate(()=>({url:location.pathname,rootCount:document.querySelectorAll('#root').length,bodyBg:getComputedStyle(document.body).backgroundColor,svgColors:[...document.querySelectorAll('svg text[fill^="var("]')].slice(0,3).map(el=>getComputedStyle(el).fill),whitePanels:[...document.querySelectorAll('*')].filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>150&&r.height>60&&s.backgroundColor==='rgb(255, 255, 255)';}).slice(0,8).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,45)}))}));
  const name=`${String(i).padStart(2,'0')}-${route.split('?')[0].replaceAll('/','_')||'landing'}${route.includes('tab=orders')?'-orders':''}-${width}-${baseline?'baseline':disabled?'disabled':mode}`;
  await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
  results.push({route,width,mode,name,errors,failure,...audit});
  console.log(`${name} ${failure||errors.join(';')||'OK'}`);
 }
 await ctx.close();
}
}finally{
 await browser.close();
 const file=`${dir}/${baseline?'baseline':disabled?'disabled':'current'}-results.json`;
 if(only&&fs.existsSync(file)){
  const prev=JSON.parse(fs.readFileSync(file));
  for(const r of results){const i=prev.results.findIndex(v=>v.route===r.route&&v.width===r.width&&v.mode===r.mode);if(i>=0)prev.results[i]=r;else prev.results.push(r);}
  fs.writeFileSync(file,JSON.stringify({...prev,unhandled:[...new Set([...prev.unhandled,...unhandled])]},null,2));
 }else fs.writeFileSync(file,JSON.stringify({results,unhandled:[...unhandled]},null,2));
}
if(results.some(r=>r.failure||r.errors.length))process.exitCode=1;
