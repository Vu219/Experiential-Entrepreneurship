import {chromium} from 'playwright-core';
import fs from 'node:fs';
import {fixture,now} from './page-fixtures.mjs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-lcd-text','--font-render-hinting=none']});const result=[];
for(const port of [3101,3100]){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await ctx.route('**/api/aima/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:{code:200,result:fixture(u.pathname.replace('/api/aima',''),r.request().method(),u.searchParams)}})});
 await ctx.addInitScript(()=>{localStorage.clear();localStorage.setItem('aima-color-mode','light')});const page=await ctx.newPage();await page.clock.setFixedTime(new Date(now));
 await page.goto(`http://127.0.0.1:${port}/create/qa-draft`,{waitUntil:'networkidle'});
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}.color-mode-toggle{display:none!important}'});
 await page.evaluate(()=>document.fonts.ready);
 result.push({port,buttons:await page.getByRole('button',{name:/^(Quay lại|Lưu & về danh sách)$/}).evaluateAll(els=>els.map(e=>{const svg=e.querySelector('svg'),s=getComputedStyle(svg);return {text:e.textContent,box:e.getBoundingClientRect().toJSON(),svg:svg.getBoundingClientRect().toJSON(),stroke:s.stroke,width:s.strokeWidth,transform:s.transform,font:getComputedStyle(e).font,svgStyle:svg.getAttribute('style')}}))});
 await ctx.close();
}
await browser.close();fs.writeFileSync(new URL('../../../docs/dark-mode-review/final/wizard-svg-geometry.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
