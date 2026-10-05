// Exact light aliases for legacy colors outside the approved neutral merge table.
// Run dry first; apply writes only the planned UI color literals and utility classes.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../package.json', import.meta.url));
const ts = require('typescript');
const palette = require('tailwindcss/colors');
const root = path.resolve('frontend/src');
const [mode = 'dry', reportName = 'remaining-colors', ...args] = process.argv.slice(2);
const files = args.length ? args : JSON.parse(fs.readFileSync(new URL('./remaining-files.json', import.meta.url))).filter(f => f !== 'pages/app/Dashboard.tsx');
let css = fs.readFileSync(path.join(root,'styles/tokens.css'),'utf8');
let colors = fs.readFileSync(path.join(root,'styles/colors.ts'),'utf8');
const light = css.split('@media screen')[0];
const fields = new Map([...colors.matchAll(/(\w+): 'var\((--c-[\w-]+)\)'/g)].map(m=>[m[2],m[1]]));
const canon = s => s.toLowerCase().replace(/\s/g,'').replace(/#([\da-f])([\da-f])([\da-f])\b/g,'#$1$1$2$2$3$3');
const existing = new Map([...light.matchAll(/(--c-[\w-]+):\s*([^;]+);/g)].filter(m=>fields.has(m[1])).map(m=>[canon(m[2]),{key:m[1],field:fields.get(m[1])}]));
const added = new Map(), report = [], preserved = new Map();
const colorRx = /#[\da-f]{8}\b|#[\da-f]{6}\b|#[\da-f]{3}\b|rgba?\([^()]+\)/gi;
function rgb(color) {
 const s=canon(color);
 if(s[0]==='#') return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255);
 const nums=s.match(/[\d.]+/g)?.map(Number);
 return nums?.length>=3 ? nums.slice(0,3).map(n=>n/255) : null;
}
function tone(color) {
 const a=rgb(color); if(!a)return null;
 const max=Math.max(...a),min=Math.min(...a),d=max-min,l=(max+min)/2;
 let h=d===0?0:max===a[0]?((a[1]-a[2])/d+6)%6:max===a[1]?(a[2]-a[0])/d+2:(a[0]-a[1])/d+4;
 h*=60;const s=d===0?0:d/(1-Math.abs(2*l-1));
 // Blue-purple gray in the incumbent palette remains neutral.
 const neutral=s<0.18 || (h>230 && h<290 && (s<0.38 || (l>0.85 && d<0.1)));
 const fg=neutral?'#a3abc4':h<15||h>=350?'#f87171':h<48?'#fb923c':h<70?'#fbbf24':h<165?'#4ade80':h<200?'#5eead4':h<255?'#93c5fd':h<290?'#c4b5fd':'#f9a8d4';
 return {a,h,s,l,neutral,fg};
}
function token(value,role) {
 const t=tone(value);if(!t)return null;
 const norm=canon(value);
 if(role==='bg' && t.l<0.75 && !/^rgba?\(/i.test(value)) return null; // solid fills/brand/platform colors stay fixed
 if(role==='text' && /^(#ffffff|rgba?\(255,255,255[,)]|rgba?\(0,0,0[,)]|#000000)/.test(norm)) {
   if(norm.startsWith('#ffffff')||norm.includes('255,255,255'))return null; // white on a solid fill
 }
 if(existing.has(norm))return existing.get(norm);
 const id=norm.replace(/[^\w]/g,'_').replace(/^_+/,'');
 const key=`--c-legacy-${role}-${id}`,field=`legacy${role[0].toUpperCase()+role.slice(1)}${id.replace(/_(\w)/g,(_,c)=>c.toUpperCase())}`;
 let dark;
 if(role==='text')dark=t.neutral?(t.l<0.3?'#f1f3fb':t.l<0.6?'#c3c9db':'#a3abc4'):t.fg;
 else if(role==='border')dark=t.neutral?'#2e3752':`color-mix(in srgb, ${t.fg} 30%, transparent)`;
 else if(role==='shadow')dark=value.replace(/rgba?\([^()]+\)/gi,'rgba(0, 0, 0, 0.5)');
 else if(/^rgba?\(/i.test(value)) {
   const alpha=value.match(/[\d.]+/g)?.[3]??'1';
   dark=t.neutral?`rgba(18, 24, 41, ${alpha})`:value;
 } else dark=t.neutral?'#182036':`color-mix(in srgb, ${t.fg} 14%, #121829)`;
 const entry={key,field,light:value,dark,role};added.set(key,entry);return entry;
}
const fg=new Set(['color','fill','stroke','fg','textColor','iconColor','accent','primary','titleColor','text','badgeColor']);
const bg=new Set(['background','backgroundColor','bg','tint','iconBg','badgeBg','iconTint','panelBg']);
function context(node) {
 let n=node;
 while(n.parent){const p=n.parent;
   if(ts.isPropertyAssignment(p)||ts.isJsxAttribute(p)){const name=p.name.getText().replace(/['"]/g,'');return {name,role:/^(border|outline|ring)/.test(name)?'border':/shadow/i.test(name)?'shadow':fg.has(name)?'text':bg.has(name)?'bg':null};}
   if(ts.isBinaryExpression(p)&&p.operatorToken.kind===ts.SyntaxKind.EqualsToken){const name=p.left.getText().match(/\.style\.(\w+)$/)?.[1];if(name)return {name,role:/^(border|outline)/.test(name)?'border':/shadow/i.test(name)?'shadow':fg.has(name)?'text':bg.has(name)?'bg':null};}
   if(ts.isConditionalExpression(p)||ts.isParenthesizedExpression(p)||ts.isJsxExpression(p)||ts.isTemplateSpan(p)||ts.isTemplateExpression(p)||ts.isBinaryExpression(p)){n=p;continue;}break;
 }return {name:'other',role:null};
}
function utilityClasses(s) {
 return s.replace(/(?<![\w-])((?:(?:[\w-]+|\[[^\]]+\]):)*)(bg|text|border|ring|divide|placeholder|from|to|via)-(white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})(?![\w-/])/g,(all,mods,prop,color)=>{
   if(color==='white'&&prop==='text')return all;
   const [name,shade]=color.split('-');const hex=name==='white'?'#ffffff':name==='black'?'#000000':palette[name]?.[shade];if(!hex)return all;
   const role=['text','placeholder'].includes(prop)?'text':['border','ring','divide'].includes(prop)?'border':'bg';
   const entry=token(hex,role);return entry?`${mods}${prop}-[var(${entry.key})]`:all;
 });
}
let replacements=0;
for(const rel of files){
 const file=path.join(root,rel),src=fs.readFileSync(file,'utf8'),sf=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,rel.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const edits=[];let changed=0;
 function visit(n){
   const literal=ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n),part=ts.isTemplateHead(n)||ts.isTemplateMiddle(n)||ts.isTemplateTail(n);
   if(literal||part){
     const value=part?n.rawText:n.text;const ctx=context(n);let output=value;
     const utility=literal&&/(?:bg|text|border|ring|divide|placeholder|from|to|via)-(?:white|black|[a-z]+-\d)/.test(value)&&!value.includes('{');
     if(utility)output=utilityClasses(value);
     if(output!==value){edits.push({start:n.getStart(),end:n.getEnd(),text:JSON.stringify(output)});changed++;}
     else if(ctx.role&&colorRx.test(value)){
       colorRx.lastIndex=0;
       const matches=[...value.matchAll(colorRx)];
       const gradient=/gradient\(/.test(value);
       const softGradient=gradient&&matches.every(m=>{const t=tone(m[0]);return t&&t.l>0.85});
       if(gradient&&!softGradient){preserved.set('brand gradients',(preserved.get('brand gradients')||0)+1);}
       else {
         let count=0;
         const pieces=value.replace(colorRx,(v)=>{const e=token(v,ctx.role);if(!e){preserved.set(v,(preserved.get(v)||0)+1);return v;}count++;return `\u0001${e.field}\u0001`;});
         if(count){
           let text;
           if(part)text=pieces.replace(/\u0001(\w+)\u0001/g,'${C.$1}');
           else if(/^\u0001\w+\u0001$/.test(pieces))text='C.'+pieces.slice(1,-1);
           else text='`'+pieces.replace(/`/g,'\\`').replace(/\u0001(\w+)\u0001/g,'${C.$1}')+'`';
           const jsx=ts.isJsxAttribute(n.parent);if(jsx)text='{'+text+'}';
           edits.push({start:n.getStart()+(part?1:0),end:part?n.getStart()+1+value.length:n.getEnd(),text});changed+=count;
         }
       }
     }
   }
   colorRx.lastIndex=0;ts.forEachChild(n,visit);
 }visit(sf);
 if(changed){report.push({file:rel,replacements:changed});replacements+=changed;}
 if(mode==='apply'&&edits.length){
   let next=src;for(const e of edits.sort((a,b)=>b.start-a.start))next=next.slice(0,e.start)+e.text+next.slice(e.end);
   if(/\bC\./.test(next)&&!new RegExp("import \\{[^}]*\\bC\\b[^}]*\\} from ['\"][^'\"]*styles/colors").test(next)){
     let imp=path.relative(path.dirname(file),path.join(root,'styles/colors')).replaceAll('\\','/');if(!imp.startsWith('.'))imp='./'+imp;
     const existingImport=next.match(/import \{([^}]+)\} from (['"])([^'"]*styles\/colors)\2;/);
     next=existingImport?next.replace(existingImport[0],existingImport[0].replace('{','{ C,')):`import { C } from '${imp}';\n`+next;
   }
   fs.writeFileSync(file,next);
 }
}
const newEntries=[...added.values()].filter(e=>!css.includes(e.key+':'));
const reportFile=`docs/dark-mode-review/reports/${reportName}-${mode}.json`;fs.mkdirSync(path.dirname(reportFile),{recursive:true});fs.writeFileSync(reportFile,JSON.stringify({replacements,files:report,tokens:newEntries,preserved:[...preserved]},null,2));
if(mode==='apply'&&newEntries.length){
 css+='\n/* Exact light aliases for legacy app/page colors outside the neutral merge table. */\n:root {\n'+newEntries.map(e=>`  ${e.key}: ${e.light};`).join('\n')+'\n}\n@media screen {\n  :root.dark {\n'+newEntries.map(e=>`    ${e.key}: ${e.dark};`).join('\n')+'\n  }\n}\n';
 colors=colors.replace('} as const;',newEntries.map(e=>`  ${e.field}: 'var(${e.key})',`).join('\n')+'\n} as const;');
 fs.writeFileSync(path.join(root,'styles/tokens.css'),css);fs.writeFileSync(path.join(root,'styles/colors.ts'),colors);
}
console.log(`${mode}: ${replacements} replacements in ${report.length} files; ${newEntries.length} exact aliases. ${reportFile}`);
