const tier = document.querySelector<HTMLSelectElement>('#tier')!;
const scenario = document.querySelector<HTMLSelectElement>('#scenario')!;
const dark = document.querySelector<HTMLInputElement>('#dark')!;
const view = document.querySelector<HTMLIFrameElement>('#view')!;
const note = document.querySelector('#note')!;
const pause = document.querySelector<HTMLButtonElement>('#pause')!;
const params = new URLSearchParams(location.search);
if (['high','medium','low'].includes(params.get('precision')!)) tier.value = params.get('precision')!;
if ([...scenario.options].some(o => o.value === params.get('scenario'))) scenario.value = params.get('scenario')!;
let generation = 0, paused = false;
async function load() {
  const token = ++generation;
  note.textContent = '正在准备…';
  history.replaceState(null,'',`?precision=${tier.value}&scenario=${scenario.value}`);
  view.src = `./performance.html?precision=${tier.value}`;
  await new Promise<void>(resolve => view.onload = () => resolve());
  const win = view.contentWindow as any;
  const deadline = performance.now() + 30000;
  while (!win.bench && token === generation) {
    if (performance.now() > deadline) throw new Error('载入失败，请刷新后重试。');
    await new Promise(r => setTimeout(r,50));
  }
  if (token !== generation) return;
  const b = win.bench;
  await b.prepare(scenario.value, {dark:dark.checked});
  const geometry = (await b.sample(scenario.value, 1)).geometry;
  note.textContent = `每张背景 ${geometry.arrayTriangles.toLocaleString()} 面 · 近景 ${geometry.selectedTriangles.toLocaleString()} 面；全部使用原始画质`;
  let frame = 0, last = 0;
  function tick(now: number) {
    if (token !== generation) return;
    if (!paused && now - last >= 1000/60 - .5) {
      last = now; frame++;
      if (scenario.value === 'navigate' && frame%60 === 0) b.scene.select((frame/60)%8);
      if (scenario.value === 'inspect') b.scene.targetRotation = .65*Math.sin(frame*.012);
      if (scenario.value === 'music') b.scene.setPlayfield(true,{low:.5+.3*Math.sin(frame*.05),mid:.4+.2*Math.sin(frame*.07),high:.3+.2*Math.cos(frame*.09),activity:1},1,1,null,true);
      b.draw();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
const start = () => void load().catch(error => { note.textContent = String(error.message || error); });
for (const control of [tier,scenario,dark]) control.addEventListener('change',start);
pause.addEventListener('click',() => {paused=!paused;pause.textContent=paused?'继续':'暂停';});
start();
