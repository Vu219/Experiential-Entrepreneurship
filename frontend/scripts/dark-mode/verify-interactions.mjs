import {chromium} from 'playwright-core';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {fixture,now} from './page-fixtures.mjs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-lcd-text','--font-render-hinting=none']});
const dir=fileURLToPath(new URL('../../../docs/dark-mode-review/final/interactions/',import.meta.url));fs.mkdirSync(dir,{recursive:true});
const results=[];
try{for(const width of [1440,390]){
 const ctx=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
 await ctx.route('**/api/aima/**',r=>{const u=new URL(r.request().url()),result=fixture(u.pathname.replace('/api/aima',''),r.request().method(),u.searchParams);return r.fulfill({status:result===undefined?404:200,json:{code:result===undefined?404:200,result}})});
 await ctx.addInitScript(()=>localStorage.setItem('aima-color-mode','dark'));
 const page=await ctx.newPage();page.setDefaultTimeout(4000);await page.clock.install({time:new Date(now)});let errors=[];page.on('pageerror',e=>errors.push(e.message));
 const button=name=>page.getByRole('button',{name,exact:true});
 const cases=[
  ['calendar-reschedule','/calendar',()=>button('Dời giờ').first().click()],
  ['calendar-confirm','/calendar',()=>button('Hủy lịch').first().click()],
  ['analytics-all','/analytics',()=>button('Xem tất cả bài viết').click()],
  ['analytics-filter','/analytics',()=>button('Bộ lọc').click()],
  ['analytics-range','/analytics',()=>button('Khoảng ngày').click()],
  ['trends-schedule','/trends',()=>button('Cài đặt lịch').click()],
  ['trends-session','/trends',()=>button('Xem chi tiết phiên research').click()],
  ['trends-idea','/trends',()=>button('Xem ý tưởng').first().click()],
  ['brand-view','/brand',()=>button('Xem').click()],
  ['brand-edit','/brand',()=>button('Chỉnh sửa').click()],
  ['brand-new','/brand',()=>button('Tạo hồ sơ').click()],
  ['settings-publishing','/settings',()=>button('Đăng bài').click()],
  ['settings-notifications','/settings',()=>button('Thông báo').last().click()],
  ['settings-connections','/settings',()=>button('Kết nối').click()],
  ['profile-password','/profile',()=>button('Đổi mật khẩu').click()],
  ['admin-user-create','/admin/users',()=>button('Thêm người dùng').click()],
  ['admin-user-menu','/admin/users',()=>page.getByRole('button',{name:/Thao tác —/}).click()],
  ['admin-plan-edit','/admin/plans',()=>button('Sửa gói').first().click()],
  ['admin-model-new','/admin/ai/models',()=>button('Thêm model').click()],
 ];
 for(const [name,route,action] of cases){errors=[];let failure=null;
  await page.goto('http://127.0.0.1:3100'+route,{waitUntil:'networkidle'});
  await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
  try{await action();await page.waitForTimeout(150);await page.evaluate(()=>document.fonts.ready);}catch(e){failure=e.message;}
  await page.screenshot({path:`${dir}/${name}-${width}.png`,fullPage:true});
  results.push({name,width,errors,failure});console.log(name,width,failure||errors.join(';')||'OK');
 }
 await ctx.close();
}}finally{await browser.close();fs.writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));}
if(results.some(r=>r.failure||r.errors.length))process.exitCode=1;
