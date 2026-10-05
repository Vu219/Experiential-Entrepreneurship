import {chromium} from 'playwright-core';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {fixture} from './page-fixtures.mjs';
const baseline=process.argv.includes('--baseline'),dir=fileURLToPath(new URL('../../../docs/dark-mode-review/final/landing/',import.meta.url));fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-lcd-text','--font-render-hinting=none']});const results=[];
try{for(const width of [1440,390])for(const mode of baseline?['light']:['light','dark'])for(const theme of baseline?['ocean']:['ocean','aurora','sunset']){
 const ctx=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
 await ctx.route('**/api/aima/**',r=>{const u=new URL(r.request().url()),result=fixture(u.pathname.replace('/api/aima',''),r.request().method(),u.searchParams);return r.fulfill({status:result===undefined?404:200,json:{code:result===undefined?404:200,result}})});
 await ctx.addInitScript(({mode,theme})=>{localStorage.setItem('aima-color-mode',mode);localStorage.setItem('aima-theme',theme)},{mode,theme});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${baseline?3101:3100}/`,{waitUntil:'networkidle'});
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'+(mode==='light'?'.color-mode-toggle{display:none!important}':'')});
 await page.evaluate(()=>document.fonts.ready);
 const cta=page.locator('section').filter({has:page.locator('.cta-btn-demo')});await cta.scrollIntoViewIfNeeded();await page.waitForTimeout(100);
 const name=`${width}-${baseline?'baseline':mode}-${theme}`;
 await cta.screenshot({path:`${dir}/cta-${name}.png`});
 await page.locator('#resources').scrollIntoViewIfNeeded();await page.waitForTimeout(100);
 await page.locator('#resources').screenshot({path:`${dir}/footer-${name}.png`});
 const headerSrc=await page.locator('#home-bar img').getAttribute('src'),footerSrc=await page.locator('#resources img').first().getAttribute('src');
 if(!baseline){assert.equal(headerSrc,mode==='dark'?'/aima-v-dark.png':'/aima-logo.png');assert.equal(footerSrc,headerSrc);}
 const backgrounds=await page.evaluate(()=>['--c-landing-cta','--c-landing-footer'].map(v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim()));
 if(!baseline&&mode==='dark'){assert.match(backgrounds[0],/#111c31/);assert.match(backgrounds[1],/#0b0f1e/);}
 await page.emulateMedia({media:'print'});if(!baseline){assert.match(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--c-landing-cta')),/DBEAFE/);await page.waitForFunction(()=>document.querySelector('#home-bar img')?.getAttribute('src')==='/aima-logo.png');}
 assert.deepEqual(errors,[]);results.push({width,mode,theme,headerSrc,footerSrc,backgrounds,errors});console.log(name,'OK');await ctx.close();
}}finally{await browser.close();fs.writeFileSync(`${dir}/${baseline?'baseline':'current'}-results.json`,JSON.stringify(results,null,2));}
