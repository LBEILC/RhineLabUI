import assert from 'node:assert/strict';
import {SpectrumEnvelope} from '../src/archive-play-motion.ts';
const ordinary=new SpectrumEnvelope(),filtered=new SpectrumEnvelope();
const tone=Array(128).fill(.16);
for(let i=0;i<120;i++){const t=i/60;filtered.ignoreLocalSound(t+.4);ordinary.ingest(tone,t);filtered.ingest(tone,t);ordinary.update(1/60,t,true);filtered.update(1/60,t,true)}
assert.ok(ordinary.bands.activity>.99,'System-mixed interaction audio reproduces the false music onset');
assert.equal(filtered.bands.activity,0);assert.equal(filtered.bands.low,0);
for(let i=180;i<360;i++){const t=i/60;filtered.ingest(tone,t);filtered.update(1/60,t,true)}
assert.ok(filtered.bands.activity>.99,'External sustained music still starts');
for(let i=360;i<480;i++){const t=i/60;filtered.ignoreLocalSound(t+.4);filtered.ingest(tone,t);filtered.update(1/60,t,true)}
assert.ok(filtered.bands.activity>.99,'Dragging during established music does not disable music');
for(let i=480;i<1080;i++)filtered.update(1/60,i/60,true);
assert.ok(filtered.bands.activity<.001,'Missing audio returns to silence');
console.log('Reproduced false onset; own sounds ignored from silence, sustained music and release passed.');
