import fs from 'node:fs';
import {PNG} from 'pngjs';
import assert from 'node:assert/strict';
import {de2000} from './color-difference.mjs';
const dir=new URL('../../../docs/dark-mode-review/final/',import.meta.url);
const files=fs.readdirSync(dir).filter(f=>f.endsWith('-1440-baseline.png')).sort();
const report=[],cache=new Map();
const rgb=(data,i)=>(data[i]<<16)+(data[i+1]<<8)+data[i+2],hex=n=>'#'+n.toString(16).padStart(6,'0');
for(const file of files){
 const b=PNG.sync.read(fs.readFileSync(new URL(file,dir))),c=PNG.sync.read(fs.readFileSync(new URL(file.replace('-baseline','-light'),dir)));
 if(b.width!==c.width||b.height!==c.height){report.push({file,baseline:[b.width,b.height],current:[c.width,c.height],geometryMismatch:true});continue;}
 let changed=0,above=0,max=0;const regions={},pairs=new Map(),bounds=[b.width,b.height,0,0];
 for(let i=0;i<b.data.length;i+=4){const a=rgb(b.data,i),z=rgb(c.data,i);if(a===z)continue;changed++;
  const k=a*16777216+z;let d=cache.get(k);if(d===undefined){d=de2000(hex(a),hex(z));assert.ok(Number.isFinite(d));cache.set(k,d);}
  max=Math.max(max,d);if(d>3){above++;const y=Math.floor(i/4/b.width),x=(i/4)%b.width;bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);const reg=y<80?'header':x<290?'sidebar':'content';regions[reg]=(regions[reg]??0)+1;pairs.set(k,(pairs.get(k)??0)+1);}
 }
 const result={file,width:b.width,height:b.height,changed,above3:above,max,regions,bounds,largestPairs:[...pairs].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,count])=>({before:hex(Math.floor(k/16777216)),after:hex(k%16777216),count}))};report.push(result);console.log(file,above,max.toFixed(4));
}
fs.writeFileSync(new URL('light-comparison.json',dir),JSON.stringify(report,null,2));
