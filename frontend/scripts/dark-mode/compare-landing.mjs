import fs from 'node:fs';
import { PNG } from 'pngjs';
import assert from 'node:assert/strict';
import { de2000 } from './color-difference.mjs';
const dir = new URL('../../../docs/dark-mode-review/final/landing/', import.meta.url), results = [], cache = new Map();
for (const section of ['cta', 'footer']) for (const width of [1440, 390]) {
  const read = mode => PNG.sync.read(fs.readFileSync(new URL(`${section}-${width}-${mode}-ocean.png`, dir)));
  const baseline = read('baseline'), current = read('light');
  assert.equal(baseline.width, current.width); assert.equal(baseline.height, current.height);
  let above3 = 0, max = 0;
  for (let i = 0; i < baseline.data.length; i += 4) {
    const hex = data => '#' + [...data.subarray(i, i + 3)].map(n => n.toString(16).padStart(2, '0')).join('');
    const a = hex(baseline.data), b = hex(current.data); if (a === b) continue;
    const key = `${a}:${b}`;
    if (!cache.has(key)) cache.set(key, de2000(a, b));
    const difference = cache.get(key); assert.ok(Number.isFinite(difference));
    if (difference > 3) above3++; max = Math.max(max, difference);
  }
  results.push({ section, width, above3, max }); console.log(section, width, above3, max);
}
fs.writeFileSync(new URL('light-comparison.json', dir), JSON.stringify(results, null, 2));
