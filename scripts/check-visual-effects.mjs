import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const moduleFrom = async source => import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const {projectHudPoint,hudQuadMatrix}=await moduleFrom(readFileSync('src/hud-projection.ts','utf8'));
const zero={x:0,y:0};const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
for(const [width,height] of [[1920,1080],[3440,1440],[390,844]]) {
  for(const point of [{x:0,y:0},{x:width,y:height},{x:width*.12,y:height*.3}]) {
    const original=projectHudPoint(point,width,height,0,zero);close(original.x,point.x);close(original.y,point.y);
    const a=projectHudPoint(point,width,height,.7,zero),b=projectHudPoint({x:width-point.x,y:point.y},width,height,.7,zero);
    close(a.x+b.x,width);close(a.y,b.y);
  }
}
const tl=projectHudPoint({x:60,y:114},1920,1080,.7,zero),tr=projectHudPoint({x:330,y:114},1920,1080,.7,zero);
assert.ok(tr.y>tl.y,'Top-left line slopes inward/down');
const rtl=projectHudPoint({x:1590,y:114},1920,1080,.7,zero),rtr=projectHudPoint({x:1860,y:114},1920,1080,.7,zero);
assert.ok(rtr.y<rtl.y,'Top-right line slopes oppositely');
const quad=[{x:12,y:20},{x:380,y:40},{x:340,y:220},{x:5,y:240}],matrix=hudQuadMatrix(400,200,quad);
for(const [i,p] of [[0,[0,0]],[1,[400,0]],[2,[400,200]],[3,[0,200]]]) {
  const d=matrix[3]*p[0]+matrix[7]*p[1]+1;
  close((matrix[0]*p[0]+matrix[4]*p[1]+matrix[12])/d,quad[i].x);
  close((matrix[1]*p[0]+matrix[5]*p[1]+matrix[13])/d,quad[i].y);
}
const events={};globalThis.window={addEventListener:(key,fn)=>events[key]=fn};globalThis.document={addEventListener(){}};
globalThis.effectProbe={};
const mocks=`const wallpaperHost=()=>undefined;class HudProjection{constructor(stage){this.stage=stage}invalidate(){}update(depth,pointer){globalThis.effectProbe.depth=depth;globalThis.effectProbe.pointer={...pointer};this.stage.dataset.hudDepth=String(depth>.00001)}}class ScreenFinish{update(...args){globalThis.effectProbe.screen=args}}`;
const input=readFileSync('src/wallpaper-effects.ts','utf8').replace(/^import .*;\r?\n/gm,'');
const {WallpaperEffects,effectOptions,wallpaperInsets}=await moduleFrom(mocks+input);
assert.deepEqual(wallpaperInsets({}),{top:0,right:0,bottom:0,left:0});
assert.deepEqual(wallpaperInsets({uimargintop:{value:-40},uimarginright:{value:25},uimarginbottom:{value:60},uimarginleft:{value:-10}}),{top:-40,right:25,bottom:60,left:-10});
assert.deepEqual(wallpaperInsets({uimargintop:{value:-999},uimarginright:{value:Infinity},uimarginbottom:{value:999},uimarginleft:{value:'20'}}),{top:-300,right:0,bottom:300,left:0});
assert.equal(effectOptions({}).parallax,false);assert.equal(effectOptions({}).tracking,true);
assert.equal(effectOptions({huddepth:{value:Infinity}}).depth,.2);assert.equal(effectOptions({huddepth:{value:999}}).depth,1);assert.equal(effectOptions({uifroststrength:{value:-3}}).frostStrength,0);
const pointer={},css={};let modal=0;
const stage={dataset:{mode:'archive'},style:{setProperty:(k,v)=>css[k]=v},addEventListener:(k,fn)=>pointer[k]=fn,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:800}),querySelectorAll:()=>[],querySelector:()=>({childElementCount:modal})};
const scene={setSelectedIndexAccent(){}};const fx=new WallpaperEffects(stage,()=>scene),probe=globalThis.effectProbe;
const props=p=>events['rhine-wallpaper-properties']({detail:Object.fromEntries(Object.entries(p).map(([k,value])=>[k,{value}]))});
props({hudparallax:true,uifrost:true,screenfinish:true});pointer.pointermove({pointerType:'mouse',clientX:1000,clientY:0});
for(let i=1;i<120;i++)fx.update(i/60,false);
assert.equal(scene.uiOnlyParallax,true);assert.equal(stage.dataset.uiFrost,'true');assert.equal(probe.screen[0],true);assert.ok(probe.pointer.x>.99);
props({hudtracking:false});for(let i=120;i<240;i++)fx.update(i/60,false);
assert.ok(probe.depth>.19,'Tracking off retains static curved HUD');assert.ok(Math.abs(probe.pointer.x)<.001,'Tracking off returns to centered lens');
props({hudtracking:true});modal=1;for(let i=240;i<360;i++)fx.update(i/60,false);assert.ok(Math.abs(probe.pointer.x)<.001);
modal=0;fx.update(6,true);assert.equal(probe.pointer.x,0);assert.ok(probe.depth>.19,'Reduced motion keeps stationary projection');
stage.dataset.mode='boot';fx.update(6.1,false);assert.ok(probe.depth>.19,'Opening shares the enabled HUD depth');assert.equal(stage.dataset.uiFrost,'false');assert.equal(probe.screen[0],true,'Global finish also covers opening');
props({hudparallax:false,screenfinish:false});fx.update(6.2,false);assert.equal(scene.uiOnlyParallax,true,'Wallpaper camera never follows passive cursor input');assert.equal(probe.screen[0],false);
props({uimarginbottom:60,uimarginleft:-20});fx.update(6.3,false);
assert.equal(stage.dataset.uiInsets,'true');assert.equal(css['--ui-bottom'],'calc(60px / var(--stage-scale, 1))');assert.equal(css['--ui-left'],'calc(-20px / var(--stage-scale, 1))');
props({uimargintop:30});fx.update(6.4,false);assert.equal(css['--ui-bottom'],'calc(60px / var(--stage-scale, 1))','Partial side change retains the other sides');
props({uimargintop:0,uimarginbottom:0,uimarginleft:0});fx.update(6.5,false);assert.equal(stage.dataset.uiInsets,'false','All zero restores baseline layout');
console.log('HUD radial symmetry, opposite slopes, projective corners, tracking independence, modal/reduced motion and global screen scope passed.');
