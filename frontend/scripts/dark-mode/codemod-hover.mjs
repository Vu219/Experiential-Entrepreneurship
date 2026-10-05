// Move pure style mouse-enter/leave handlers into CSS, retaining their enable condition.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../package.json',import.meta.url));
const ts = require('typescript');
const [mode='dry',name='remaining-hover',...args]=process.argv.slice(2);
const root=path.resolve('frontend/src');
const files=args.length?args:JSON.parse(fs.readFileSync(new URL('./remaining-files.json',import.meta.url)));
const colors=fs.readFileSync(path.join(root,'styles/colors.ts'),'utf8');
const vars=new Map([...colors.matchAll(/(\w+): 'var\((--c-[\w-]+)\)'/g)].map(m=>[m[1],m[2]]));
const report=[],manual=[],rules=[];
const kebab=s=>s.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
function cssValue(n) {
 if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return n.text;
 if(ts.isPropertyAccessExpression(n)&&n.expression.getText()==='C'&&vars.has(n.name.text))return `var(${vars.get(n.name.text)})`;
 if(ts.isTemplateExpression(n)){
   let value=n.head.text;
   for(const span of n.templateSpans){const part=cssValue(span.expression);if(part===null)return null;value+=part+span.literal.text;}return value;
 }
 return null;
}
function extract(n,condition=null) {
 if(ts.isBlock(n)){let out=[];for(const s of n.statements){const e=extract(s,condition);if(e===null)return null;out.push(...e);}return out;}
 if(ts.isParenthesizedExpression(n)||ts.isExpressionStatement(n))return extract(n.expression,condition);
 if(ts.isIfStatement(n)&&!n.elseStatement)return extract(n.thenStatement,condition?`(${condition}) && (${n.expression.getText()})`:n.expression.getText());
 if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken){
   const prop=n.left.getText().match(/^\w+\.currentTarget\.style\.(\w+)$/)?.[1];
   if(!prop)return null;const value=cssValue(n.right);
   if(value!==null)return [{prop,value,condition}];
   if(ts.isConditionalExpression(n.right)){
     const yes=cssValue(n.right.whenTrue),no=cssValue(n.right.whenFalse);
     if(yes!==null&&no!==null)return [{prop,yes,no,branch:n.right.condition.getText(),condition}];
   }
 }return null;
}
for(const rel of files.filter(f=>f.endsWith('tsx'))){
 const file=path.join(root,rel),src=fs.readFileSync(file,'utf8'),sf=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
 function visit(n){
   if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
     const attrs=n.attributes.properties;const enter=attrs.find(a=>ts.isJsxAttribute(a)&&a.name.getText()==='onMouseEnter');const leave=attrs.find(a=>ts.isJsxAttribute(a)&&a.name.getText()==='onMouseLeave');
     if(enter&&leave&&enter.getText().includes('currentTarget.style')){
       const fn=enter.initializer?.expression,lf=leave.initializer?.expression;
       const values=fn&&ts.isArrowFunction(fn)?extract(fn.body):null,reset=lf&&ts.isArrowFunction(lf)?extract(lf.body):null;
       const conditions=values&&new Set(values.map(v=>v.condition));const branches=values&&new Set(values.filter(v=>v.branch).map(v=>v.branch));
       if(!values?.length||reset===null||conditions.size>1||branches.size>1){manual.push({file:rel,line:sf.getLineAndCharacterOfPosition(enter.getStart()).line+1,handler:enter.getText()});}
       else {
         const cls='dm-hover-'+crypto.createHash('sha1').update(rel+':'+enter.getStart()).digest('hex').slice(0,7);
         const condition=values[0].condition,branch=[...branches][0];
         const make=(selector,side)=>rules.push(`.${selector}:hover { ${values.map(v=>`${kebab(v.prop)}: ${v.value??v[side]} !important;`).join(' ')} }`);
         let clsExpr=JSON.stringify(cls);
         if(branch){make(cls+'-yes','yes');make(cls+'-no','no');clsExpr=`(${branch} ? '${cls}-yes' : '${cls}-no')`;}
         else make(cls);
         if(condition)clsExpr=`(${condition} ? ${clsExpr} : '')`;
         const cn=attrs.find(a=>ts.isJsxAttribute(a)&&a.name.getText()==='className');
         let attr;
         if(cn){const literal=ts.isStringLiteral(cn.initializer);const old=literal?JSON.stringify(cn.initializer.text):cn.initializer.expression.getText();attr=`className={${literal?old:`(${old} ?? '')`} + ' ' + ${clsExpr}}`;edits.push({start:cn.getStart(),end:cn.getEnd(),text:attr});}
         else edits.push({start:enter.getStart(),end:enter.getStart(),text:`className={${clsExpr}}\n      `});
         edits.push({start:enter.getStart(),end:enter.getEnd(),text:''},{start:leave.getStart(),end:leave.getEnd(),text:''});
         report.push({file:rel,line:sf.getLineAndCharacterOfPosition(enter.getStart()).line+1,cls,condition:condition??null,branch:branch??null,properties:values.map(v=>v.prop)});
       }
     }
   }ts.forEachChild(n,visit);
 }visit(sf);
 if(mode==='apply'&&edits.length){let s=src;for(const e of edits.sort((a,b)=>b.start-a.start||(b.end-b.start)-(a.end-a.start)))s=s.slice(0,e.start)+e.text+s.slice(e.end);fs.writeFileSync(file,s);}
}
fs.writeFileSync(`docs/dark-mode-review/reports/${name}-${mode}.json`,JSON.stringify({converted:report.length,report,manual},null,2));
if(mode==='apply'&&rules.length)fs.appendFileSync(path.join(root,'index.css'),'\n/* Style hover handlers migrated to CSS; conditions remain on className. */\n'+rules.join('\n')+'\n');
console.log(`${mode}: ${report.length} hover pairs moved; ${manual.length} require manual review.`);
