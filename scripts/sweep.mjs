#!/usr/bin/env node
/**
 * Walks every lesson and every step, failing on any page error. Catches the
 * class of bug where one parameter combination throws mid-animation.
 *
 *   node scripts/sweep.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT = Number(process.env.PORT ?? 4283);
const server = spawn('npx',['vite','preview','--port',String(PORT),'--strictPort'],{cwd:'/home/ubuntu/spacemath',stdio:'ignore'});
for(let i=0;i<80;i++){try{if((await fetch(`http://localhost:${PORT}/`)).ok)break;}catch{}await sleep(400);}
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await b.newPage({viewport:{width:1280,height:800}});
let cur=''; const errs=[];
page.on('pageerror',e=>errs.push(`${cur}: ${e.message}\n${(e.stack||'').split('\n').slice(0,4).join('\n')}`));
await page.goto(`http://localhost:${PORT}/`,{waitUntil:'load'});
await page.waitForFunction(()=>window.__sukukan,null,{timeout:60000});
const ids=await page.evaluate(()=>window.__sukukan.lessonIds());
let bad=0;
for(const id of ids){
  cur=id; errs.length=0;
  await page.evaluate(u=>window.__sukukan.openLesson(u), id);
  await sleep(140);
  const n=await page.evaluate(()=>window.__sukukan.app.sequencer.count);
  for(let i=0;i<n;i++){
    await page.evaluate(k=>{const s=window.__sukukan.app.sequencer; s.goTo(k);}, i);
    await sleep(130);
    if(errs.length){ console.log(errs[0]); bad++; break; }
  }
  if(errs.length) { await page.evaluate(()=>window.__sukukan.openMap()); await sleep(120); }
}
await b.close(); server.kill('SIGTERM');
console.log(bad? `\n✖ ${bad} 単元でエラー` : `\n✓ 全${ids.length}単元・全ステップでエラーなし`);
process.exitCode = bad?1:0;
