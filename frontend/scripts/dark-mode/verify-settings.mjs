import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const production = process.argv.includes('--production');
const origin = `http://127.0.0.1:${production ? 3102 : 3100}`;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.route('**/api/aima/**', r => {
 const path = new URL(r.request().url()).pathname;
 const result = path.endsWith('/users/me') ? { id: 'qa', email: 'review@example.test', fullName: 'QA User', role: 'ADMIN', provider: 'LOCAL', profileCompleted: true, plan: 'FREE' }
   : path.endsWith('/token-usage') ? { used: 0, limit: 1000 } : path.endsWith('/unread-count') ? 0 : { content: [], totalElements: 0 };
 return r.fulfill({ json: { code: 200, message: 'Success', result } });
});
await ctx.addInitScript(() => localStorage.setItem('aima-color-mode', 'dark'));
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(origin + '/settings', {waitUntil:'networkidle'});
await page.getByText('Tự động thu gọn thanh bên', {exact:true}).waitFor();
if (production) {
 assert.equal(await page.locator('.color-mode-settings,.color-mode-toggle').count(), 0);
 assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);
} else {
 const toggle = page.getByRole('button', { name: 'Chế độ hiển thị', exact: true });
 await page.getByRole('radio', {name:'Sáng',exact:true}).check();
 await toggle.click();
 assert.equal(await page.getByRole('menuitemradio', {name:'Sáng',exact:true}).getAttribute('aria-checked'),'true');
 await page.getByRole('menuitemradio', {name:'Tối',exact:true}).click();
 assert.equal(await page.getByRole('radio', {name:'Tối',exact:true}).isChecked(),true);
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.getByRole('radio', {name:'Tối',exact:true}).isChecked(),true);
 assert.equal(await page.evaluate(() => localStorage.getItem('aima-color-mode')),'dark');
 await page.emulateMedia({media:'print'});
 assert.equal(await page.locator('.color-mode-settings legend').evaluate(el=>getComputedStyle(el).color),'rgb(33, 28, 56)');
 await page.emulateMedia({media:'screen'});
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:fileURLToPath(new URL('../../../docs/dark-mode-review/batch2/settings-app-dark.png',import.meta.url)),fullPage:true});
}
assert.deepEqual(errors, []);
console.log(production ? 'PASS: production Settings stays light and hides both mode controls.' : 'PASS: Settings/topbar synchronization, persistence, reload and print.');
} finally {await browser.close();}
