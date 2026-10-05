// Codemod dark mode: thay mã hex trung tính trong inline style bằng C.<token> theo bảng đã duyệt.
// node codemod.mjs <dry|apply> <reportName> <file...>   (đường dẫn tương đối frontend/src)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('D:/SU26/EXE/frontend/package.json');
const ts = require('typescript');

const SRC = 'D:/SU26/EXE/frontend/src';
const [mode, reportName, ...args] = process.argv.slice(2);
const files = args.length ? args : JSON.parse(fs.readFileSync(new URL('./remaining-files.json', import.meta.url))).filter(f => f !== 'pages/app/Dashboard.tsx');
const M = JSON.parse(fs.readFileSync(new URL('./neutral-map.json', import.meta.url), 'utf8'));
const camel = (t) => t.replace(/-(\w)/g, (_, c) => c.toUpperCase()).replace(/-(\d)/g, '$1');
const MAP = new Map();
for (const r of [...M.exact, ...M.merged]) MAP.set(r.h, camel(r.token));
const norm = (h) => {
  h = h.toLowerCase().slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return '#' + h;
};

const SURFACE_TOKENS = new Set(['surface', 'surfaceSubtle', 'bg', 'surfaceMuted', 'border', 'borderStrong']);
const TEXT_TOKENS = new Set(['ink200', 'ink250', 'textFaint', 'ink350', 'textMuted', 'textSecondary', 'ink550', 'ink600', 'ink650', 'text', 'ink750', 'textStrong', 'ink900']);
const BG_PROPS = new Set(['background', 'backgroundColor']);
const FG_PROPS = new Set(['color', 'stroke', 'fill', 'caretColor', 'textDecorationColor', 'accentColor', 'stopColor']);
const BORDER_PROPS = /^(border|outline)/;
const HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

function propOf(node) {
  let n = node.parent;
  while (n) {
    if (ts.isPropertyAssignment(n)) return { kind: 'prop', name: n.name.getText().replace(/['"]/g, '') };
    if (ts.isJsxAttribute(n)) return { kind: 'jsx', name: n.name.getText() };
    if (ts.isConditionalExpression(n) || ts.isParenthesizedExpression(n) || ts.isTemplateSpan(n) || ts.isTemplateExpression(n) ||
        ts.isJsxExpression(n) || (ts.isBinaryExpression(n) && ['||', '??', '&&'].includes(n.operatorToken.getText()))) { n = n.parent; continue; }
    return { kind: 'other', name: ts.SyntaxKind[n.kind] };
  }
  return { kind: 'other', name: '?' };
}

function decide(tok, prop, text) {
  const p = prop.name;
  if (prop.kind === 'other') return 'ngữ cảnh không phải thuộc tính style (' + p + ')';
  if (/gradient\(/.test(text)) return 'nằm trong gradient';
  if (p === 'boxShadow' || p === 'textShadow' || p === 'filter') return 'shadow/filter';
  const isBg = BG_PROPS.has(p), isFg = FG_PROPS.has(p) || (prop.kind === 'jsx' && ['color', 'stroke', 'fill'].includes(p)), isBorder = BORDER_PROPS.test(p);
  if (!isBg && !isFg && !isBorder) return 'thuộc tính lạ: ' + p;
  if (tok === 'surface' && isFg) return 'KEEP'; // chữ/icon trắng trên nền màu
  if (tok === 'surface' && isBorder) return 'viền trắng (ring?)';
  if (TEXT_TOKENS.has(tok) && isBg) return 'màu chữ dùng làm nền';
  if (SURFACE_TOKENS.has(tok) && isFg) return 'màu nền dùng làm chữ';
  return 'OK';
}

const report = [];
const totals = { replaced: 0, flagged: 0, kept: 0, manual: 0 };
for (const rel of files) {
  const file = path.join(SRC, rel);
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const rep = { file: rel, replaced: {}, flagged: [], manual: [], kept: 0 };
  const line = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;

  function handleLiteral(node, rawText, contentStart, isWholeString, quoteKind) {
    const prop = propOf(node);
    const parts = []; let last = 0; let changed = false;
    for (const m of rawText.matchAll(HEX)) {
      const h = norm(m[0]);
      const tok = MAP.get(h);
      if (!tok) { rep.manual.push({ line: line(node.getStart()), hex: h, prop: prop.name }); continue; }
      const d = decide(tok, prop, rawText);
      if (d === 'KEEP') { rep.kept++; continue; }
      if (d !== 'OK') { rep.flagged.push({ line: line(node.getStart()), hex: h, tok, prop: prop.name, why: d, text: rawText.slice(0, 70) }); continue; }
      parts.push(rawText.slice(last, m.index), { tok }); last = m.index + m[0].length; changed = true;
      rep.replaced[tok] = (rep.replaced[tok] || 0) + 1;
    }
    if (!changed) return;
    parts.push(rawText.slice(last));
    const onlyToken = parts.length === 3 && parts[0] === '' && parts[2] === '';
    let out;
    if (quoteKind === 'template') out = parts.map((x) => (typeof x === 'string' ? x : '${C.' + x.tok + '}')).join('');
    else if (onlyToken) out = 'C.' + parts[1].tok;
    else out = '`' + parts.map((x) => (typeof x === 'string' ? x.replace(/`/g, '\\`') : '${C.' + x.tok + '}')).join('') + '`';
    if (quoteKind === 'jsx') out = '{' + out + '}';
    edits.push({ start: contentStart, end: contentStart + (quoteKind === 'template' ? rawText.length : node.getEnd() - node.getStart()), text: out, node });
  }

  (function visit(node) {
    if (ts.isStringLiteral(node) && HEX.test(node.text)) {
      HEX.lastIndex = 0;
      const isJsx = node.parent && ts.isJsxAttribute(node.parent);
      handleLiteral(node, node.text, node.getStart(), true, isJsx ? 'jsx' : 'string');
    } else if (ts.isNoSubstitutionTemplateLiteral(node) && HEX.test(node.text)) {
      HEX.lastIndex = 0;
      handleLiteral(node, node.text, node.getStart(), true, 'string');
    } else if ((ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && HEX.test(node.rawText ?? '')) {
      HEX.lastIndex = 0;
      const start = node.getStart() + 1; // sau ` hoặc }
      handleLiteral(node, node.rawText, start, false, 'template');
    }
    HEX.lastIndex = 0;
    ts.forEachChild(node, visit);
  })(sf);

  const nRep = Object.values(rep.replaced).reduce((a, b) => a + b, 0);
  totals.replaced += nRep; totals.flagged += rep.flagged.length; totals.kept += rep.kept; totals.manual += rep.manual.length;
  report.push(rep);
  if (mode === 'apply' && edits.length) {
    let out = src;
    for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    if (!/import \{[^}]*\bC\b[^}]*\} from '[^']*styles\/colors'/.test(out)) {
      let relImp = path.relative(path.dirname(file), path.join(SRC, 'styles/colors')).replace(/\\/g, '/');
      if (!relImp.startsWith('.')) relImp = './' + relImp;
      const quote = /from "/.test(src) && !/from '/.test(src) ? '"' : "'";
      const imp = `import { C } from ${quote}${relImp}${quote};`;
      const imports = [...out.matchAll(/^import [\s\S]*?from ['"][^'"]+['"];?(?=\r?$)/gm)];
      const lastImp = imports[imports.length - 1];
      const eol = out.includes('\r\n') ? '\r\n' : '\n';
      if (lastImp) { const at = lastImp.index + lastImp[0].length; out = out.slice(0, at) + eol + imp + out.slice(at); }
      else out = imp + eol + out;
    }
    fs.writeFileSync(file, out);
  }
}

// Báo cáo markdown
const L = [`# Codemod dark mode — ${mode === 'apply' ? 'ĐÃ ÁP DỤNG' : 'DRY-RUN'} (${reportName})`, '',
  `Tổng: **${totals.replaced}** chỗ thay · **${totals.flagged}** chỗ không chắc (sửa tay) · ${totals.kept} chỗ giữ trắng (chữ/icon trên nền màu) · ${totals.manual} mã màu ngoài bảng (thương hiệu/trạng thái — xử lý tay/token tone).`, ''];
for (const r of report) {
  const n = Object.values(r.replaced).reduce((a, b) => a + b, 0);
  L.push(`## ${r.file}`, '', `Thay ${n}: ${Object.entries(r.replaced).map(([k, v]) => `C.${k}×${v}`).join(', ') || '—'} · giữ trắng ${r.kept}`);
  if (r.flagged.length) { L.push('', '| Dòng | Màu | Token gợi ý | Thuộc tính | Lý do | Đoạn |', '|---|---|---|---|---|---|'); for (const f of r.flagged) L.push(`| ${f.line} | \`${f.hex}\` | ${f.tok} | ${f.prop} | ${f.why} | \`${f.text.replace(/\|/g, '\\|')}\` |`); }
  if (r.manual.length) L.push('', 'Ngoài bảng: ' + r.manual.map((m) => `L${m.line} \`${m.hex}\`(${m.prop})`).join(', '));
  L.push('');
}
const out = new URL(`../../../docs/dark-mode-review/reports/${reportName}-${mode}.md`, import.meta.url);
fs.mkdirSync(new URL('../../../docs/dark-mode-review/reports/', import.meta.url), { recursive: true });
fs.writeFileSync(out, L.join('\n'));
console.log(L[2]);
console.log('report:', out.pathname);
