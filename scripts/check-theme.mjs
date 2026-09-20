import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('src/theme-motion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {ThemeWave}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const wave=new ThemeWave(),center={lane:2,row:12},far={lane:5,row:20};
wave.set(true,0,center);wave.beginFrame();const a=wave.sample(center,.3),b=wave.sample(far,.3);assert.ok(a>b&&a>0&&a<1,'Origin changes first');
wave.set(false,.3,center);assert.equal(wave.sample(center,.3),a);assert.equal(wave.sample(far,.3),b,'Reversal preserves each current card');
assert.equal(wave.sample(center,2),0);assert.equal(wave.sample(far,2),0);assert.equal(wave.background(2),0);
wave.set(true,3,center,true);assert.equal(wave.sample(far,3),1);assert.equal(wave.background(3),1,'Reduced motion goes directly to target');
wave.set(false,4,center);wave.beginFrame();for(let i=-100;i<100;i++){const n=wave.sample({lane:i,row:i},4.2);assert.ok(n>=0&&n<=1)}
console.log('Theme cascade, reversal continuity, endpoints, reduced motion and bounded values passed.');
