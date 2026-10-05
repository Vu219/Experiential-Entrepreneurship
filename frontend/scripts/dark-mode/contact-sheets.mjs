import fs from 'node:fs';
import { PNG } from 'pngjs';
const interaction=process.argv.includes('--interactions');
const dir=new URL('../../../docs/dark-mode-review/final/'+(interaction?'interactions/':''),import.meta.url);
for(const width of [1440,390]){
 const files=fs.readdirSync(dir).filter(f=>f.endsWith(interaction?`-${width}.png`:`-${width}-dark.png`)).sort();
 for(let start=0;start<files.length;start+=12){
  const batch=files.slice(start,start+12),tw=width===1440?360:195,th=width===1440?250:500;
  const sheet=new PNG({width:tw*4,height:th*Math.ceil(batch.length/4)});sheet.data.fill(255);
  for(let n=0;n<batch.length;n++){
   const p=PNG.sync.read(fs.readFileSync(new URL(batch[n],dir)));
   for(let y=0;y<th;y++)for(let x=0;x<tw;x++){
    const sx=Math.floor(x*p.width/tw),sy=Math.floor(y*1000/th);if(sy>=p.height)continue;
    sheet.data.set(p.data.subarray((sy*p.width+sx)*4,(sy*p.width+sx)*4+4),(((Math.floor(n/4)*th+y)*sheet.width)+(n%4)*tw+x)*4);
   }
  }
  fs.writeFileSync(new URL(`sheet-${width}-${start}.png`,dir),PNG.sync.write(sheet));
  console.log(`sheet-${width}-${start}.png: ${batch.join(', ')}`);
 }
}
