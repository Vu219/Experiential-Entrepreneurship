import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fixture } from './page-fixtures.mjs';

const dir = fileURLToPath(new URL('../../../docs/dark-mode-review/toast-offset/', import.meta.url));
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const prior = process.argv.includes('--remaining') && fs.existsSync(`${dir}/results.json`) ? JSON.parse(fs.readFileSync(`${dir}/results.json`)) : [];
const results = [...prior];
const measure = page => page.evaluate(() => {
  const header = document.querySelector('.app-topbar')?.getBoundingClientRect();
  const toast = document.querySelector('.toast-stack').getBoundingClientRect();
  return { headerBottom: header?.bottom ?? 0, top: toast.top, gap: toast.top - (header?.bottom ?? 0), right: innerWidth - toast.right, width: toast.width };
});
try {
  for (const width of [1440, 760, 390]) for (const mode of ['light', 'dark']) {
    if (prior.some(r => r.width === width && r.mode === mode)) continue;
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(mode => { localStorage.setItem('aima-color-mode', mode); localStorage.setItem('aima-theme', 'aurora'); }, mode);
    let signedIn = false;
    await ctx.route('**/api/aima/**', route => {
      const url = new URL(route.request().url()), path = url.pathname.replace('/api/aima', '');
      if (path === '/auth/login') { signedIn = true; return route.fulfill({ status: 200, json: { code: 200, result: {} } }); }
      if (path === '/users/me' && !signedIn) return route.fulfill({ status: 401, json: { code: 401, message: 'QA guest' } });
      const result = fixture(path, route.request().method(), url.searchParams);
      return route.fulfill({ status: result === undefined ? 404 : 200, json: { code: result === undefined ? 404 : 200, result } });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:3100/login', { waitUntil: 'networkidle' });
    await page.evaluate(async () => (await import('/src/components/toast/ToastProvider.tsx')).globalToast.info('Thông báo trước đăng nhập', { duration: 60000 }));
    await page.locator('.toast-stack').waitFor();
    const guest = await measure(page); assert.equal(guest.top, 16);
    await page.locator('.toast-close').click();
    await page.locator('input[name="email"]').fill('review@example.test');
    await page.locator('input[name="password"]').fill('ReviewPassword123!');
    await page.getByRole('button', { name: 'ĐĂNG NHẬP', exact: true }).click();
    await page.waitForURL('**/dashboard');
    await page.locator('.app-topbar').waitFor();
    await page.getByText('Đăng nhập thành công', { exact: true }).waitFor();
    const login = await measure(page);
    assert.equal(login.headerBottom, width < 760 ? 62 : 70); assert.equal(login.gap, 16); assert.equal(login.right, 16);
    await page.screenshot({ path: `${dir}/login-${width}-${mode}.png`, clip: { x: 0, y: 0, width, height: 260 } });
    await page.evaluate(async () => {
      const toast = (await import('/src/components/toast/ToastProvider.tsx')).globalToast;
      for (const type of ['success', 'error', 'warning', 'info', 'loading']) toast[type]('Kiểm tra vị trí ' + type, { duration: 60000 });
    });
    const stacked = await measure(page); assert.equal(stacked.gap, 16);
    await page.evaluate(() => window.scrollTo(0, 500));
    const scrolled = await measure(page); assert.equal(scrolled.gap, 16);
    const alternateWidth = width < 760 ? 1440 : 390;
    await page.setViewportSize({ width: alternateWidth, height: 1000 });
    const resized = await measure(page); assert.equal(resized.gap, 16); assert.equal(resized.top, alternateWidth < 760 ? 78 : 86);
    await page.goto('http://127.0.0.1:3100/admin', { waitUntil: 'domcontentloaded' });
    await page.locator('.app-topbar').waitFor();
    await page.evaluate(async () => (await import('/src/components/toast/ToastProvider.tsx')).globalToast.success('Thông báo quản trị', { duration: 60000 }));
    await page.locator('.toast-stack').waitFor();
    const admin = await measure(page); assert.equal(admin.gap, 16); assert.deepEqual(errors, []);
    results.push({ width, mode, guest, login, stacked, scrolled, resized, admin, errors });
    console.log(width, mode, 'guest → login → dashboard → resize → admin OK');
    await ctx.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(`${dir}/results.json`, JSON.stringify(results, null, 2));
}
