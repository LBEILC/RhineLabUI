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
assert.equal(Object.values(props).filter(p=>p.type==='group').length,6);
function visible(key,override={}){const context=structuredClone(props);for(const [k,v] of Object.entries(override))context[k].value=v;return !props[key].condition||vm.runInNewContext(props[key].condition,context)}
assert.equal(visible('groupworkbench',{desktopmode:'archive'}),false);
assert.equal(visible('reactiveintensity',{audioreactive:false}),false);
assert.equal(visible('gamepace',{showgame:false}),false);
assert.equal(visible('openingdetail',{boot:false}),false);
for(const key of Object.keys(props))visible(key);
console.log('Six native groups and all display conditions passed.');

const {RhythmMotion,rhythmDisplacement}=await load('src/archive-play-motion.ts');
const rhythm=new RhythmMotion(); let motion;
for(let i=0;i<180;i++){const t=i/60;const bass=i%30<5?.5:.015;motion=rhythm.update({low:bass,mid:.08,high:.3,activity:1},t,1/60,'wave');assert.ok(motion.pulses.length<=3);for(let j=1;j<motion.pulses.length;j++)assert.ok(motion.pulses[j].time-motion.pulses[j-1].time>=.22);}
assert.ok(motion.pulses.length>0,'Bass onsets create coherent waves');
for(let i=180;i<480;i++)motion=rhythm.update({low:.2,mid:.08,high:.3,activity:1},i/60,1/60,'wave');
assert.equal(motion.pulses.length,0,'Sustained tone must not repeatedly trigger beats');
for(let i=480;i<600;i++)motion=rhythm.update({low:.2,mid:.08,high:.3,activity:1},i/60,1/60,'lift');
const liftA=rhythmDisplacement(0,0,10,quietBands(),1,motion),liftB=rhythmDisplacement(30,5,10,quietBands(),1,motion);assert.ok(Math.abs(liftA-liftB)<.001,'Lift mode moves the array together');
for(let i=600;i<960;i++)motion=rhythm.update(quietBands(),i/60,1/60,'lift');assert.ok(motion.lift<.0001,'Silence settles to rest');
console.log('Rhythm onset, cooldown, bounded overlap, steady-tone rejection, coherent lift and silence passed.');
