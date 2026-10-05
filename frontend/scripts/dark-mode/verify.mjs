import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../../../docs/dark-mode-review', import.meta.url));
const origin = `http://127.0.0.1:${process.argv.includes('--baseline') ? '3101' : process.argv.includes('--production') ? '3102' : '3100'}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-lcd-text', '--font-render-hinting=none'] });
try {
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
let authed = true;
const summary = {
  stats: {
    total: { total: 20, deltaPct: null, series: [0, 2, 20, 0, 0, 0, 0] },
    posted: { total: 0, deltaPct: null, series: [0, 0, 0, 0, 0, 0, 0] },
    pending: { total: 14, deltaPct: null, series: [0, 1, 14, 0, 0, 0, 0] },
    rejected: { total: 0, deltaPct: null, series: [0, 0, 0, 0, 0, 0, 0] },
  },
  awaitingReview: 2, scheduled: 2, rangeDays: 7,
  performance: [{ date: '2026-10-04', reach: 0, engagement: 0 }],
  contentTypes: [{ label: 'OTHER', value: 23, sharePct: 100 }], topTopics: [],
  platforms: [
    { platform: 'FACEBOOK', connected: true, accountName: 'Trang Facebook mẫu', avatarUrl: null, status: 'ACTIVE' },
    { platform: 'INSTAGRAM', connected: true, accountName: 'Instagram mẫu', avatarUrl: null, status: 'ACTIVE' },
    { platform: 'THREADS', connected: false, accountName: null, avatarUrl: null, status: null },
  ],
  onboarding: { brand: true, connection: true, strategy: true, content: true, completed: 4, total: 4 },
};
await ctx.route('**/api/aima/**', async (route) => {
  const path = new URL(route.request().url()).pathname.replace('/api/aima', '');
  let result;
  if (path === '/users/me') {
    if (!authed) return route.fulfill({ status: 401, json: { code: 401, message: 'Unauthenticated' } });
    result = { id: 'dark-mode-review', email: 'review@example.test', role: 'ADMIN', fullName: 'System Administrator', phone: null, dateOfBirth: null, provider: 'LOCAL', avatarUrl: null, status: 'ACTIVE', plan: 'FREE', deletionDate: null, profileCompleted: true };
  } else if (path === '/dashboard/summary') result = { ...summary, rangeDays: Number(new URL(route.request().url()).searchParams.get('days') || 7) };
  else if (path === '/users/me/token-usage') result = { used: 0, limit: 1000 };
  else if (path === '/notifications/unread-count') result = 0;
  else if (path === '/notifications') result = { content: [], totalElements: 0, totalPages: 0, size: 5, number: 0 };
  else if (path === '/schedules') result = [{ id: 'one' }, { id: 'two' }];
  else if (path.endsWith('/public')) return route.fulfill({ status: 404, json: { code: 404, message: 'Use public fallback' } });
  else result = [];
  return route.fulfill({ json: { code: 200, message: 'Success', result } });
});
await ctx.addInitScript(() => {
  if (!localStorage.getItem('aima-color-mode')) localStorage.setItem('aima-color-mode', 'light');
  localStorage.setItem('aima-theme', 'ocean');
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.clock.install({ time: new Date('2026-10-04T09:00:00+07:00') });
const dark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));
const toggle = () => page.getByRole('button', { name: 'Chế độ hiển thị', exact: true });
async function choose(name) {
  await toggle().click();
  await page.getByRole('menuitemradio', { name, exact: true }).click();
}
async function shot(name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
}
await page.goto(origin + '/dashboard', { waitUntil: 'networkidle' });
await page.getByText('Top chủ đề hiệu quả', { exact: true }).waitFor();
await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
await page.evaluate(async () => {
  await Promise.all([
    document.fonts.load("800 28px 'Plus Jakarta Sans'"),
    document.fonts.load("700 19px 'Plus Jakarta Sans'"),
    document.fonts.load("600 14px 'Be Vietnam Pro'"),
  ]);
  await document.fonts.ready;
});
await page.waitForTimeout(500);
if (process.argv.includes('--baseline')) {
  await shot('dashboard-baseline-light');
  await browser.close();
  process.exit(0);
}
if (process.argv.includes('--production')) {
  await page.evaluate(() => localStorage.setItem('aima-color-mode', 'dark'));
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await dark(), false);
  assert.equal(await page.locator('.color-mode-toggle').count(), 0);
  console.log('PASS: production with unset flag stays light, hides toggle, despite saved dark preference');
  await browser.close();
  process.exit(0);
}
await shot('dashboard-light');
const hiddenToggle = await page.addStyleTag({ content: '.color-mode-toggle{display:none!important}' });
await shot('dashboard-light-no-toggle');
await hiddenToggle.evaluate((el) => el.remove());
await choose('Tối');
assert.equal(await dark(), true);
await shot('dashboard-dark');
const svg = await page.locator('svg text[fill="var(--c-chart-axis)"]').first().evaluate((el) => ({ attr: el.getAttribute('fill'), fill: getComputedStyle(el).fill }));
assert.equal(svg.attr, 'var(--c-chart-axis)');
console.log('SVG axis', svg);
await page.reload({ waitUntil: 'networkidle' });
assert.equal(await dark(), true);
assert.equal(await page.evaluate(() => localStorage.getItem('aima-color-mode')), 'dark');
await choose('Theo hệ thống');
await page.emulateMedia({ colorScheme: 'light' });
await page.waitForTimeout(100);
assert.equal(await dark(), false);
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(100);
assert.equal(await dark(), true);
await choose('Sáng');
assert.equal(await dark(), false);
await choose('Tối');
await toggle().click();
await page.keyboard.press('Home');
assert.equal(await page.getByRole('menuitemradio', { name: 'Sáng', exact: true }).evaluate((el) => el === document.activeElement), true);
await page.keyboard.press('ArrowUp');
assert.equal(await page.getByRole('menuitemradio', { name: 'Theo hệ thống', exact: true }).evaluate((el) => el === document.activeElement), true);
await page.keyboard.press('End');
await page.keyboard.press('Escape');
assert.equal(await page.getByRole('menu').count(), 0);
assert.equal(await toggle().evaluate((el) => el === document.activeElement), true);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Tab');
assert.equal(await page.getByRole('menu').count(), 0);
for (const width of [1440, 1280, 1024, 800, 390, 320]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(200);
  const overflow = await page.locator('header').evaluate((el) => el.scrollWidth > el.clientWidth);
  assert.equal(overflow, false, `header overflow at ${width}`);
  await toggle().click();
  const box = await page.getByRole('menu', { name: 'Chế độ hiển thị' }).boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= width, `menu bounds at ${width}`);
  await page.keyboard.press('Escape');
  if (width === 390) await shot('dashboard-dark-mobile');
}
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(200);
await page.evaluate(() => window.scrollTo(0, 0));
const plot = page.locator('svg').filter({ has: page.locator('text[fill="var(--c-chart-axis)"]') }).first();
const box = await plot.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(200);
assert.ok(await page.getByText('Lượt tiếp cận', { exact: true }).count() > 1, 'chart tooltip shown');
await shot('dashboard-dark-tooltip');
await page.emulateMedia({ media: 'print' });
assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-surface').trim()), '#ffffff');
await page.emulateMedia({ media: 'screen' });
for (const url of ['/', '/pricing', '/terms']) {
  await page.goto(origin + url, { waitUntil: 'networkidle' });
  assert.equal(await dark(), true, url);
}
authed = false;
for (const url of ['/login', '/register']) {
  await page.goto(origin + url, { waitUntil: 'networkidle' });
  assert.equal(await dark(), true, url);
}
assert.deepEqual(errors, []);
console.log('PASS: switching / system OS changes / reload / keyboard / 6 viewport sizes / SVG / print / public + auth routes / page errors');
} finally {
await browser.close();
}

