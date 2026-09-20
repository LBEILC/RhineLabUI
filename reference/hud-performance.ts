import '../src/style.css';
import '../src/responsive.css';
import '../src/wallpaper-effects.css';
import '../src/theme-ui';
import {logo,brandHeading} from '../src/brand';
import {BootSequence} from '../src/boot';
import {loadBootWebfonts} from '../src/boot-lettering';
import {HudProjection} from '../src/hud-projection';
import {HudProjection as Baseline} from '../.tools/performance/hud-baseline';
import source from '../src/main.ts?raw';
const stage = document.querySelector<HTMLElement>('#stage')!;
const markup = source.match(/innerHTML = `([\s\S]*?)`;/)![1];
stage.innerHTML = markup.replaceAll('${logo}',logo).replaceAll('${brandHeading}',brandHeading);
stage.querySelector('#loading')?.remove();
stage.querySelector('#boot-background')!.insertAdjacentHTML('beforeend','<div class="boot-white"></div>');
stage.style.width='100vw'; stage.style.height='100vh'; stage.style.transform='none';
const boot = new BootSequence(stage);
await loadBootWebfonts(); await document.fonts.ready;
const projection: any = new (location.search.includes('baseline')?Baseline:HudProjection)(stage);
let measures=0;
const measure = projection.measure.bind(projection);
projection.measure = () => {measures++;measure();};
Object.assign(window,{hudBench:{
  frame(t:number,depth=0.6,x=0.7,y=-0.4){
    const start=performance.now();boot.update(t);projection.update(depth,{x,y});
    return {cpu:performance.now()-start,measures,panels:[...stage.querySelectorAll<HTMLElement>('.hud-surface')].map(n=>({name:n.className,projection:n.style.getPropertyValue('--hud-projection')}))};
  },
  invalidate(){projection.invalidate();},
}});
