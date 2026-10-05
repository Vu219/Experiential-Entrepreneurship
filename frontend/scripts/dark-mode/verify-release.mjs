import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {fixture} from './page-fixtures.mjs';
const disabled=process.argv.includes('--disabled'),port=disabled?3102:3103;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const ctx=await browser.newContext();let authed=true;
 await ctx.route('**/api/aima/**',r=>{const u=new URL(r.request().url()),p=u.pathname.replace('/api/aima','');if(p==='/users/me'&&!authed)return r.fulfill({status:401,json:{code:401}});const result=fixture(p,r.request().method(),u.searchParams);return r.fulfill({status:result===undefined?404:200,json:{code:result===undefined?404:200,result}})});
 await ctx.addInitScript(()=>localStorage.setItem('aima-color-mode','dark'));
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/dashboard','/settings','/admin','/','/pricing','/login','/privacy']){
  authed=route!=='/login';await page.goto(`http://127.0.0.1:${port}${route}`,{waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('dark')),!disabled,route);
  assert.equal(await page.locator('.color-mode-toggle').count(),disabled?0:1,route);
  if(route==='/settings')assert.equal(await page.getByRole('radio',{name:'Tối',exact:true}).count(),disabled?0:1);
 }
 assert.deepEqual(errors,[]);console.log(`PASS: production ${disabled?'flag off stays light and hides controls':'flag on applies saved dark mode'} across 7 app/admin/public/auth routes.`);
}finally{await browser.close();}
