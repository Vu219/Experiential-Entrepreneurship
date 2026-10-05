// Dry-run first. Only white foregrounds on an existing brand-filled surface change.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const ts = createRequire(new URL('../../package.json', import.meta.url))('typescript');
const root = path.resolve('frontend/src');
const files = [];
function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(p)) files.push(p); } }
walk(root);
const report = [], unresolved = [];
for (const file of files) {
  if (/Aima(Hero|Scene)\.tsx$/.test(file)) continue;
  const source = fs.readFileSync(file, 'utf8'), sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const vars = new Map(), edits = new Map();
  const visit = (n, fn) => { fn(n); ts.forEachChild(n, c => visit(c, fn)); };
  visit(sf, n => { if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) vars.set(n.name.text, n.initializer); });
  const unwrap = n => { while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isJsxExpression(n))) n = n.expression; return n; };
  function resolve(n, depth = 0) {
    n = unwrap(n); if (!n || depth > 6) return n;
    if (ts.isIdentifier(n) && vars.has(n.text)) return resolve(vars.get(n.text), depth + 1);
    if (ts.isArrowFunction(n)) return resolve(n.body, depth + 1);
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && vars.has(n.expression.text)) return resolve(vars.get(n.expression.text), depth + 1);
    return n;
  }
  function bg(n) {
    n = resolve(n); if (!n || !ts.isObjectLiteralExpression(n)) return null;
    for (const p of n.properties) if (ts.isPropertyAssignment(p) && ['background', 'backgroundColor'].includes(p.name.getText(sf))) return p.initializer;
    for (const p of n.properties) if (ts.isSpreadAssignment(p)) { const b = bg(p.expression); if (b) return b; }
    return null;
  }
  const branded = n => !!n && /brandGradient|BRAND_GRADIENT|var\(--brand(?:\)|-gradient\))/.test(n.getText(sf)) && !/padding-box|border-box|#16a34a|#d6336c/.test(n.getText(sf));
  function ancestorBg(n) {
    for (let a = n.parent; a; a = a.parent) {
      if (ts.isObjectLiteralExpression(a)) { const b = bg(a); if (b && b.getText(sf) !== "'transparent'") return b; }
      if (ts.isJsxElement(a) || ts.isJsxSelfClosingElement(a)) {
        const opening = ts.isJsxElement(a) ? a.openingElement : a;
        const style = opening.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(sf) === 'style');
        const b = style?.initializer && bg(style.initializer); if (b && !/^["']transparent["']$/.test(b.getText(sf))) return b;
      }
    }
    return null;
  }
  visit(sf, n => {
    if (!ts.isStringLiteral(n) || !/^(white|#fff|#ffffff)$/i.test(n.text)) return;
    let p = n.parent;
    while (p && !ts.isPropertyAssignment(p) && !ts.isJsxAttribute(p)) p = p.parent;
    if (!p || !['color', 'stroke', 'fill'].includes(p.name.getText(sf))) return;
    const b = ancestorBg(n);
    if (branded(b)) {
      edits.set(n.getStart(sf), { start: n.getStart(sf), end: n.end, text: ts.isJsxAttribute(p) && p.initializer === n ? '{C.onBrand}' : 'C.onBrand' });
      report.push({ file: path.relative(root, file), line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, background: b.getText(sf) });
    } else if (/brandGradient|BRAND_GRADIENT|var\(--brand/.test(source)) unresolved.push({ file: path.relative(root, file), line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, text: source.split(/\r?\n/)[sf.getLineAndCharacterOfPosition(n.getStart(sf)).line].trim() });
  });
  if (edits.size && process.argv.includes('apply')) {
    let out = source; for (const e of [...edits.values()].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    if (!/import\s*\{[^}]*\bC\b[^}]*\}\s*from\s*['"][^'"]*styles\/colors['"]/.test(source)) {
      const rel = path.relative(path.dirname(file), path.join(root, 'styles/colors')).replaceAll('\\', '/');
      out = `import { C } from '${rel.startsWith('.') ? rel : './' + rel}';\n` + out;
    }
    fs.writeFileSync(file, out);
  }
}
fs.writeFileSync(new URL('../../../docs/dark-mode-review/brand-palettes/foreground-migration.json', import.meta.url), JSON.stringify({ report, unresolved }, null, 2));
console.log(`${report.length} foregrounds in ${new Set(report.map(r => r.file)).size} files; ${unresolved.length} preserved candidates to review.`);
