import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const PORT=4360;
const server=spawn('npx',['vite','preview','--port',String(PORT),'--strictPort'],{cwd:'/home/ubuntu/spacemath',stdio:'ignore'});
for(let i=0;i<80;i++){try{if((await fetch(`http://localhost:${PORT}/`)).ok)break;}catch{}await sleep(400);}
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await b.newPage({viewport:{width:1400,height:880}});
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto(`http://localhost:${PORT}/`,{waitUntil:'load'});
await page.waitForFunction(()=>window.__sukukan,null,{timeout:60000});

console.log('対応:', await page.evaluate(()=>({
  supported: window.__sukukan.ui.speech.supported,
  voices: window.__sukukan.ui.speech.voices().length,
  button: !!document.getElementById('btn-voice'),
})));

// 発話内容を記録
await page.evaluate(()=>{
  window.__said = [];
  const sp = window.__sukukan.ui.speech;
  const orig = sp.say.bind(sp);
  sp.say = (t) => { window.__said.push(t); return orig(t); };
});

const state = () => page.evaluate(()=>({
  enabled: window.__sukukan.ui.speech.enabled,
  label: document.getElementById('btn-voice').textContent,
  on: document.getElementById('btn-voice').classList.contains('on'),
}));

await page.evaluate(()=>window.__sukukan.openLesson('mc-1-1'));
await sleep(700);
console.log('初期:', JSON.stringify(await state()));

await page.click('#btn-voice'); await sleep(400);
console.log('トグル後:', JSON.stringify(await state()));

await page.evaluate(()=>{ window.__said.length = 0; window.__sukukan.app.sequencer.goTo(3); });
await sleep(800);
console.log('4ステップ目の読み上げ:');
for (const t of await page.evaluate(()=>window.__said)) console.log('   「' + t + '」');

// 一時停止で読み上げが止まるか
await page.evaluate(()=>window.__sukukan.ui.setPlaying(false));
await sleep(300);
console.log('停止で cancel:', await page.evaluate(()=>!window.__sukukan.ui.speech.speaking));

// 星図へ戻ると止まるか
await page.evaluate(()=>window.__sukukan.ui.toggleVoice(false));
await page.evaluate(()=>window.__sukukan.ui.toggleVoice(true));
await page.evaluate(()=>window.__sukukan.openMap());
await sleep(400);
console.log('星図で cancel:', await page.evaluate(()=>!window.__sukukan.ui.speech.speaking));

// 設定が保存されるか
await page.evaluate(()=>window.__sukukan.ui.toggleVoice(true));
console.log('保存値:', await page.evaluate(()=>localStorage.getItem('sukukan.voice')));
await b.close(); server.kill('SIGTERM');
console.log(errs.length?'ERRORS: '+errs.join(' | '):'✓ ページエラーなし');
