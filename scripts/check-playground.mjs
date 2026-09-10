import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
async function load(file) {const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)}
const {SpectrumEnvelope,RelayRound,musicDisplacement,quietBands}=await load('src/archive-play-motion.ts');
const e=new SpectrumEnvelope(), samples=Array(128).fill(0);samples.fill(1,64,72);e.ingest(samples,0);
let bands=e.update(.1,.1,true);assert.ok(bands.low>.5);assert.equal(bands.mid,0);assert.equal(bands.high,0);
for(let i=1;i<=150;i++) bands=e.update(.05,i*.05,true);
assert.ok(bands.low<.0001&&bands.activity<.001,'Missing callbacks fade to original motion');
e.ingest(Array(128).fill(NaN),8);bands=e.update(.1,8,true);assert.ok(Number.isFinite(bands.low));
assert.equal(musicDisplacement(1,2,3,quietBands(),2),0);
for(let row=-20;row<20;row++) {const n=musicDisplacement(row,3,1,{low:1,mid:1,high:1,activity:1},20);assert.ok(n>=0&&n<=1.8)}
const r=new RelayRound();r.start();r.aim('1:2','normal');r.tick(100,true);assert.equal(r.remaining,6);assert.equal(r.hit('1:2'),true);assert.equal(r.score,1);assert.equal(r.hit('1:2'),false,'Duplicate hit cannot score twice');r.aim('1:3','normal');r.hit('wrong');assert.equal(r.status,'over');r.start();assert.equal(r.score,0);r.aim('1:2','quick');for(let i=0;i<50;i++)r.tick(.1,false);assert.equal(r.status,'over');r.stop();assert.equal(r.target,null);
let callback;const window={dispatchEvent(){},wallpaperRegisterAudioListener:fn=>callback=fn};vm.runInNewContext(readFileSync('wallpaper/host.js','utf8'),{window,Event,CustomEvent,performance:{now:()=>2000}});assert.ok(callback);callback(Array(128).fill(4));assert.equal(window.rhineWallpaperSpectrum.samples[0],1);assert.equal(window.rhineWallpaperSpectrum.time,2);
const {openingShowsDetail,ARRAY_OPENING_END}=await load('src/wallpaper-opening.ts');assert.equal(openingShowsDetail('auto',true),false);assert.equal(openingShowsDetail('auto',false),true);assert.equal(openingShowsDetail('show',true),true);assert.equal(openingShowsDetail('skip',false),false);assert.ok(ARRAY_OPENING_END<26);
console.log('Spectrum stereo/clamping/decay, relay pause/scoring/retry/timeout, host callback and opening policy passed.');
const project=JSON.parse(readFileSync('wallpaper/project.json','utf8')),props=project.general.properties;
assert.equal(project.general.supportsaudioprocessing,true,'WE reads audio support from general');
assert.equal(Object.hasOwn(project,'supportsaudioprocessing'),false,'Root-level flag is not recognized by the host');
assert.equal(Object.values(props).filter(p=>p.type==='group').length,7);
function visible(key,override={}){const context=structuredClone(props);for(const [k,v] of Object.entries(override))context[k].value=v;return !props[key].condition||vm.runInNewContext(props[key].condition,context)}
assert.equal(visible('groupworkbench',{desktopmode:'archive'}),false);
assert.equal(visible('reactiveintensity',{audioreactive:false}),false);
assert.equal(visible('gamepace',{showgame:false}),false);
assert.equal(visible('openingdetail',{boot:false}),false);
for(const key of Object.keys(props))visible(key);
console.log('Seven native groups and all display conditions passed.');

const {RhythmMotion,rhythmDisplacement}=await load('src/archive-play-motion.ts');
const rhythm=new RhythmMotion(); let motion;
const tone={low:0,mid:.5,high:0,activity:1};
for(let i=0;i<300;i++)motion=rhythm.update(tone,i/60,1/60,'wave');
const displacement=(x,b=tone,t=5)=>rhythmDisplacement(10,2,t,b,1,motion,x);
assert.ok(displacement(.5)>.15,'Sustained midrange remains visible after five seconds');
assert.ok(displacement(.5)>displacement(0)*10&&displacement(.5)>displacement(1)*10,'Midrange lives in the screen center');
assert.ok(displacement(0,{...tone,low:.5,mid:0})>.15,'Bass lives on the left');
assert.ok(displacement(1,{...tone,high:.5,mid:0})>.15,'Treble lives on the right');
assert.ok(Math.abs(displacement(.499)-displacement(.501))<.001,'Band boundary is continuous');
assert.equal(displacement(.5,quietBands()),0,'Silence has no new motion');
for(let i=300;i<600;i++)motion=rhythm.update(tone,i/60,1/60,'lift');
for(const key of ['low','mid','high']) {
 const b={...quietBands(),[key]:.5,activity:1};
 const samples=Array.from({length:60},(_,i)=>rhythmDisplacement(10,2,10+i/60,b,1,motion));
 assert.ok(Math.min(...samples)>0,'All sustained bands drive B continuously');
 assert.ok(Math.max(...samples)-Math.min(...samples)>.01,'B keeps travelling during sustained music');
}
assert.equal(rhythmDisplacement(10,2,20,quietBands(),1,motion),0);
for(let i=0;i<200;i++){motion=rhythm.update(tone,i/60,1/60,i%2?'wave':'legacy');assert.ok(Math.abs(Object.values(motion.style).reduce((a,b)=>a+b,0)-1)<1e-10)}
console.log('Continuous spectrum position, sustained notes, smooth bands, travelling layers, silence and interrupted style blend passed.');
