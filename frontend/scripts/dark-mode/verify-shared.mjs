import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { de2000 } from './color-difference.mjs';

const out = fileURLToPath(new URL('../../../docs/dark-mode-review/batch2', import.meta.url));
fs.mkdirSync(out, { recursive: true });
const baseline = process.argv.includes('--baseline');
const origin = `http://127.0.0.1:${baseline ? 3101 : 3100}`;
const html = (await (await fetch(origin + '/index.html')).text()).replace('/src/main.tsx', baseline ? '/SharedPreview.tsx' : '/scripts/dark-mode/SharedPreview.tsx');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-lcd-text', '--font-render-hinting=none'] });
const errors = [], apiWrites = [], comparisons = [];
const user = { id: 'shared-review', email: 'review@example.test', role: 'ADMIN', fullName: 'System Administrator', provider: 'LOCAL', status: 'ACTIVE', plan: 'FREE', profileCompleted: true };
try {
for (const width of [1440, 390]) {
 const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', reducedMotion: 'reduce' });
 // Disable HMR reloads in the QA entry while preserving Vite's CSS module injection.
 await ctx.route('**/@vite/client', (r) => r.fulfill({ contentType: 'text/javascript', body: `
 export const createHotContext = () => ({ accept() {}, dispose() {}, prune() {}, invalidate() {}, data: {} });
 export const injectQuery = (url) => url;
 export function updateStyle(id, css) { let el = document.getElementById(id); if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); } el.textContent = css; }
 export function removeStyle(id) { document.getElementById(id)?.remove(); }
 ` }));
 await ctx.route('**/settings?preview=*', (r) => r.fulfill({ contentType: 'text/html', body: html }));
 await ctx.route('**/api/aima/**', (r) => {
   const path = new URL(r.request().url()).pathname;
   if (r.request().method() !== 'GET') apiWrites.push(path);
   return r.fulfill({ json: { code: 200, message: 'Success', result: path.endsWith('/users/me') ? user : [] } });
 });
 await ctx.addInitScript(() => { localStorage.setItem('aima-color-mode', 'light'); localStorage.setItem('aima-theme', 'ocean'); });
 const page = await ctx.newPage();
 page.on('pageerror', (e) => { errors.push(e.message); console.log('Page error:', e.message); });
 await page.clock.install({ time: new Date('2026-10-05T09:00:00+07:00') });
 async function shot(kind, mode) {
   await page.mouse.move(0, 0);
   await page.screenshot({ path: `${out}/${baseline ? 'baseline-' : ''}${kind}-${mode}-${width}.png`, fullPage: true });
 }
 async function dark() {
   await page.locator('[data-dark]').evaluate((el) => el.click());
   await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
 }
 async function open(kind) {
   console.log('Checking', baseline ? 'baseline' : 'current', width, kind);
   await page.goto(`${origin}/settings?preview=${kind}`, { waitUntil: 'networkidle' });
   await page.locator('[data-trigger]').waitFor();
   await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} [data-dark]{display:none}' });
   await page.evaluate(async () => {
     await Promise.all([document.fonts.load('800 19px "Plus Jakarta Sans"'), document.fonts.load('700 14px "Be Vietnam Pro"'), document.fonts.load('600 13px "Be Vietnam Pro"')]);
     await document.fonts.ready;
   });
 }
 for (const kind of ['modal', 'drawer', 'docked', 'confirm', 'onboarding', 'date', 'toast', 'password', 'settings']) {
   await open(kind);
   if (kind === 'date') await page.getByRole('textbox', { name: 'Ngày đăng' }).click();
   if (kind === 'settings' && !baseline) {
     await page.locator('.color-mode-settings').evaluate((el) => el.parentElement.style.display = 'none');
   }
   await shot(kind, 'light');
   if (baseline) continue;
   if (kind === 'settings') await page.locator('.color-mode-settings').evaluate((el) => el.parentElement.style.display = '');
   await dark();
   if (kind === 'date' && await page.locator('[data-datepicker-panel]').count() === 0) await page.getByRole('textbox', { name: 'Ngày đăng' }).click();
   await shot(kind, 'dark');
   if (kind === 'date') {
     const panel = page.locator('[data-datepicker-panel]');
     assert.equal(await panel.evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(18, 24, 41)');
     await panel.getByRole('button', { name: '16', exact: true }).hover();
     assert.equal(await panel.getByRole('button', { name: '16', exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(24, 32, 54)');
     await shot('date-hover', 'dark');
     assert.equal(await panel.getByRole('button', { name: '4', exact: true }).isDisabled(), true);
     await panel.getByRole('button', { name: '16', exact: true }).click();
     assert.equal(await page.locator('output').textContent(), '2026-10-16');
     await page.getByRole('textbox', { name: 'Ngày đăng' }).click();
     await panel.getByRole('button', { name: 'Xóa', exact: true }).click();
     assert.equal(await page.locator('output').textContent(), '');
   } else if (['modal', 'drawer', 'confirm'].includes(kind)) {
     const dialog = page.getByRole('dialog');
     const focusables = dialog.locator('button,input');
     await focusables.last().focus();
     await page.keyboard.press('Tab');
     assert.equal(await focusables.first().evaluate((el) => el === document.activeElement), true);
     await page.keyboard.press('Escape');
     assert.equal(await dialog.count(), 0);
     assert.equal(await page.evaluate(() => document.body.style.overflow), '');
     await page.locator('[data-trigger]').click();
     await page.getByRole('dialog').waitFor();
     await page.mouse.click(1, 1);
     assert.equal(await page.getByRole('dialog').count(), 0);
   } else if (kind === 'toast') {
     assert.equal(await page.locator('[role="status"],[role="alert"]').count(), 5);
     await page.locator('[role="status"],[role="alert"]').first().getByRole('button').click();
     await page.waitForFunction(() => document.querySelectorAll('[role="status"],[role="alert"]').length === 4);
     assert.equal(await page.locator('[role="status"],[role="alert"]').count(), 4);
   } else if (kind === 'password') {
     await page.locator('form button[type="submit"]').click();
     await page.getByText('Vui lòng nhập mật khẩu hiện tại', { exact: true }).waitFor();
     await shot('password-error', 'dark');
     await page.locator('form input').fill('Current1!');
     await page.locator('form button[type="submit"]').click();
     await page.locator('input[inputmode="numeric"]').fill('123456');
     await shot('password-otp', 'dark');
     await page.locator('form button[type="submit"]').click();
     await page.locator('.password-suggest').waitFor();
     await page.locator('.password-suggest').hover();
     await shot('password-suggest', 'dark');
     await page.locator('form input').first().fill('Strong123!');
     await page.locator('form input').last().fill('Strong123!');
     await shot('password-new', 'dark');
     await page.locator('form button[type="submit"]').click();
     await page.getByText('Đã đổi mật khẩu', { exact: true }).waitFor();
   } else if (kind === 'settings') {
     const light = page.getByRole('radio', { name: 'Sáng', exact: true });
     await light.check();
     assert.equal(await page.evaluate(() => localStorage.getItem('aima-color-mode')), 'light');
     const system = page.getByRole('radio', { name: 'Theo hệ thống', exact: true });
     await system.check();
     await page.emulateMedia({ colorScheme: 'dark' });
     await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
     await page.emulateMedia({ colorScheme: 'light' });
     await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
     await light.focus();
     await page.keyboard.press('ArrowRight');
     assert.equal(await page.getByRole('radio', { name: 'Tối', exact: true }).isChecked(), true);
     assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
   }
 }
 await ctx.close();
}
assert.deepEqual(errors, []);
if (!baseline) {
 for (const width of [1440, 390]) for (const kind of ['modal','drawer','docked','confirm','onboarding','date','toast','password','settings']) {
   const old = PNG.sync.read(fs.readFileSync(`${out}/baseline-${kind}-light-${width}.png`));
   const next = PNG.sync.read(fs.readFileSync(`${out}/${kind}-light-${width}.png`));
   assert.equal(old.width, next.width); assert.equal(old.height, next.height);
   let changed = 0, over3 = 0, max = 0;
   const cache = new Map();
   for (let i = 0; i < old.data.length; i += 4) {
     const a = old.data.subarray(i,i+3), b = next.data.subarray(i,i+3);
     if (a.equals(b)) continue;
     changed++;
     const key = `${a}-${b}`;
     let delta = cache.get(key);
     if (delta === undefined) { delta = de2000('#' + a.toString('hex'), '#' + b.toString('hex')); assert.ok(Number.isFinite(delta)); cache.set(key, delta); }
     max = Math.max(max,delta); if (delta > 3) over3++;
   }
   comparisons.push({kind,width,changed,over3,max});
 }
 fs.writeFileSync(`${out}/results.json`, JSON.stringify({errors,apiWrites,comparisons},null,2));
 assert.equal(comparisons.reduce((n,c) => n+c.over3,0),0,JSON.stringify(comparisons));
}
console.log(baseline ? 'Shared baseline screenshots saved.' : 'Shared UI functional checks and light comparison passed.');
} finally { await browser.close(); }
