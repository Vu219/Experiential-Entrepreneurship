import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=new URL('../../src/',import.meta.url);
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(tsx?|css)$/.test(p))files.push(p);}}
walk(fileURLToPath(root));
// Use file URLs for cross-platform root resolution.
const css=fs.readFileSync(new URL('styles/tokens.css',root),'utf8');
const defined=new Set([...css.matchAll(/(--c-[\w-]+)\s*:/g)].map(m=>m[1]));
const missing=[];for(const file of files){for(const m of fs.readFileSync(file,'utf8').matchAll(/var\((--c-[\w-]+)/g))if(!defined.has(m[1]))missing.push({file,token:m[1]});}
assert.deepEqual(missing,[]);console.log(`PASS: every --c-* reference resolves (${defined.size} tokens, ${files.length} files scanned).`);
