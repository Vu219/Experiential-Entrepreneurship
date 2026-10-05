import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { lab, de2000 } from './color-difference.mjs';

const out = new URL('../../../docs/dark-mode-review/', import.meta.url);
const baseline = PNG.sync.read(fs.readFileSync(new URL('dashboard-baseline-light.png', out)));
const current = PNG.sync.read(fs.readFileSync(new URL('dashboard-light-no-toggle.png', out)));
assert.equal(current.width, baseline.width);
assert.equal(current.height, baseline.height);
const diff = new PNG({ width: current.width, height: current.height });
const hex = (data, i) => '#' + [...data.slice(i, i + 3)].map((c) => c.toString(16).padStart(2, '0')).join('');
let exact = 0, above76 = 0, above2000 = 0, max2000 = 0;
const regions = {};
const cache = new Map();
for (let i = 0; i < baseline.data.length; i += 4) {
  const a = hex(baseline.data, i), b = hex(current.data, i);
  let de76 = 0, de = 0;
  if (a !== b) {
    exact++;
    const key = a + b;
    if (!cache.has(key)) {
      const la = lab(a), lb = lab(b);
      cache.set(key, [Math.hypot(...la.map((v, j) => v - lb[j])), de2000(a, b)]);
    }
    [de76, de] = cache.get(key);
    max2000 = Math.max(max2000, de);
    if (de76 > 3) above76++;
    if (de > 3) above2000++;
    if (de76 > 3) {
      const y = Math.floor(i / 4 / baseline.width);
      const region = y < 70 ? 'topbar' : y >= 390 && y < 410 ? 'stat comparison labels'
        : y >= 1100 && y < 1140 ? 'activity empty icon' : 'other';
      regions[region] = (regions[region] ?? 0) + 1;
    }
  }
  const grey = Math.round((baseline.data[i] + baseline.data[i + 1] + baseline.data[i + 2]) / 12 + 191);
  const rgb = a === b ? [grey, grey, grey] : de > 3 ? [255, 0, 0] : [255, 236, 150];
  diff.data.set([...rgb, 255], i);
}
const report = { width: baseline.width, height: baseline.height, exact, de76Above3: above76,
  de2000Above3: above2000, maxDe2000: max2000, regions };
fs.writeFileSync(new URL('light-comparison.json', out), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(new URL('dashboard-light-diff.png', out), PNG.sync.write(diff));
console.log(report);
assert.equal(above2000, 0, 'light mode differs beyond the approved CIEDE2000 < 3 merge tolerance');
