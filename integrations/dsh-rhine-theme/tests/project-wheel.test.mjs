import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
const result=await build({entryPoints:[fileURLToPath(new URL('../src/client/rhine/project-wheel.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'})
const {ProjectWheel,adjacentProject}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))

test('wheel normalizes pixel, line and page devices and emits at most one project per event',()=>{
 for(const [delta,mode,height] of [[100,0,1000],[3,1,1000],[1,2,1000],[10000,0,1000]]){
  const wheel=new ProjectWheel()
  assert.equal(wheel.push(delta,mode,height,0),1)
  assert.equal(wheel.push(-delta,mode,height,300),-1)
 }
})
test('touchpad accumulates small motion, rejects jitter and drops inertia during cooldown',()=>{
 const wheel=new ProjectWheel()
 for(let t=0;t<7;t++)assert.equal(wheel.push(10,0,1000,t*10),0)
 assert.equal(wheel.push(10,0,1000,70),1)
 wheel.reset()
 for(let t=80;t<350;t+=10)assert.equal(wheel.push(100,0,1000,t),0)
 assert.equal(wheel.push(1,0,1000,350),0)
 assert.equal(wheel.push(100,0,1000,400),1)
 wheel.reset()
 assert.equal(wheel.push(40,0,1000,800),0)
 assert.equal(wheel.push(-40,0,1000,820),0)
 assert.equal(wheel.push(-40,0,1000,840),-1)
})
test('stale scroll fragments and invalid input cannot trigger delayed navigation',()=>{
 const wheel=new ProjectWheel()
 for(const value of [NaN,Infinity,0])assert.equal(wheel.push(value,0,1000,0),0)
 assert.equal(wheel.push(40,0,1000,0),0)
 assert.equal(wheel.push(40,0,1000,400),0)
 wheel.reset();assert.equal(wheel.push(40,0,1000,450),0)
})
test('project traversal starts at the first/last project from home, wraps, and supports empty/removed projects',()=>{
 const projects=[{id:'a'},{id:'b'},{id:'c'}]
 assert.equal(adjacentProject(projects,null,1)?.id,'a')
 assert.equal(adjacentProject(projects,null,-1)?.id,'c')
 assert.equal(adjacentProject(projects,'a',1)?.id,'b')
 assert.equal(adjacentProject(projects,'a',-1)?.id,'c')
 assert.equal(adjacentProject(projects,'c',1)?.id,'a')
 assert.equal(adjacentProject(projects,'removed',1)?.id,'a')
 assert.equal(adjacentProject([],null,1),undefined)
 assert.equal(adjacentProject([{id:'only'}],'only',1)?.id,'only')
})
