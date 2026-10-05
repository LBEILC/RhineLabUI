import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
const source=(await readFile(new URL('../desktop/rhine-window-policy.mjs',import.meta.url),'utf8')).replace("import { app, BrowserWindow, ipcMain, screen } from 'electron'",'')
test('native window actions validate caller and whitelist, then use normal Electron lifecycle',()=>{
 const handlers=new Map(),calls=[]
 const frame={url:'dsh-app://app/'},sender={mainFrame:frame}
 const window={isFullScreen:()=>true,setFullScreen:v=>calls.push(['fullscreen',v]),minimize:()=>calls.push(['minimize']),close:()=>calls.push(['close'])}
 runInNewContext(source,{setTimeout:fn=>{fn();return 0},clearTimeout:()=>{},app:{whenReady:()=>({then:()=>{}})},screen:{},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},BrowserWindow:{fromWebContents:s=>s===sender?window:undefined}})
 const action=handlers.get('rhine-desktop:window'),event={sender,senderFrame:frame}
 assert.throws(()=>action({...event,senderFrame:{url:'https://example.com'}},'close'),/Invalid/)
 assert.throws(()=>action(event,'destroy'),/Unknown/)
 assert.equal(calls.length,0)
 action(event,'fullscreen');action(event,'minimize');action(event,'close')
 assert.deepEqual(calls,[['fullscreen',false],['minimize'],['close']])
})

test('F11 uses the native focused window, works after windowing, and cleans up with the theme', () => {
 const handlers=new Map(),windowEvents=new Map(),inputEvents=new Map(),toggles=[]
 const frame={url:'dsh-app://app/'},sender={mainFrame:frame}
 let fullscreen=false,minimum=[400,300],origin=frame.url,prevented=0,title='DSH'
 const contents={on:(n,f)=>inputEvents.set(n,f),removeListener:(n,f)=>{if(inputEvents.get(n)===f)inputEvents.delete(n)},isDestroyed:()=>false,getURL:()=>origin,send:()=>{}}
 const window={getTitle:()=>title,setTitle:v=>title=v,webContents:contents,isDestroyed:()=>false,isFullScreen:()=>fullscreen,isMaximized:()=>false,
  getMinimumSize:()=>minimum,setMinimumSize:(...v)=>minimum=v,getBounds:()=>({x:0,y:0,width:1920,height:1080}),setBounds:()=>{},setSize:()=>{},
  setFullScreen:v=>{fullscreen=v;toggles.push(v)},on:(n,f)=>windowEvents.set(n,f),once:()=>{},removeListener:n=>windowEvents.delete(n)}
 runInNewContext(source,{setTimeout:fn=>{fn();return 0},clearTimeout:()=>{},app:{whenReady:()=>({then:()=>{}})},screen:{getAllDisplays:()=>[],getDisplayMatching:()=>({id:1,workArea:{x:0,y:0,width:1920,height:1080},workAreaSize:{width:1920,height:1080}})},ipcMain:{handle:(n,f)=>handlers.set(n,f)},BrowserWindow:{fromWebContents:()=>window}})
 const policy=handlers.get('rhine-desktop:scene-policy'),action=handlers.get('rhine-desktop:window'),event={sender,senderFrame:frame}
 policy(event,true); assert.equal(fullscreen,true); assert.equal(inputEvents.size,1)
 const key=inputEvents.get('before-input-event'),press=(extra={})=>key({preventDefault:()=>prevented++},{key:'F11',type:'keyDown',...extra})
 policy(event,true); assert.equal(inputEvents.get('before-input-event'),key)
 action(event,'fullscreen'); assert.equal(fullscreen,false)
 press(); assert.equal(fullscreen,true)
 press({isAutoRepeat:true}); press({type:'keyUp'}); assert.equal(fullscreen,true)
 press(); assert.equal(fullscreen,false)
 for(const extra of [{alt:true},{control:true},{meta:true},{shift:true},{key:'F10'}])press(extra)
 assert.equal(fullscreen,false); assert.equal(prevented,4)
 origin='https://example.com';press();assert.equal(fullscreen,false);origin=frame.url
 press(); assert.equal(fullscreen,true)
 policy(event,false);assert.equal(fullscreen,false);assert.equal(inputEvents.size,0);assert.equal(windowEvents.size,0);assert.deepEqual(minimum,[400,300])
 policy(event,true);assert.equal(inputEvents.size,1);policy(event,false)
})


test('native caption shows the F11 hint only while windowed, tracks page titles and restores on deactivation', () => {
 const handlers=new Map(),listeners=new Map()
 const frame={url:'dsh-app://app/'}, sender={mainFrame:frame}
 let fullscreen=false,maximized=false,title='ARCHIVE — RHINE LAB / DSH',minimum=[400,300]
 const contents={on:()=>{},removeListener:()=>{},isDestroyed:()=>false,getURL:()=>frame.url,send:()=>{}}
 const window={webContents:contents,isDestroyed:()=>false,isFullScreen:()=>fullscreen,isMaximized:()=>maximized,
  getTitle:()=>title,setTitle:v=>{title=v},getMinimumSize:()=>minimum,setMinimumSize:(...v)=>minimum=v,
  getBounds:()=>({x:0,y:0,width:1920,height:1080}),setBounds:()=>{},setSize:()=>{},setFullScreen:v=>{fullscreen=v;listeners.get(v?'enter-full-screen':'leave-full-screen')?.()},
  on:(n,f)=>listeners.set(n,f),once:()=>{},removeListener:n=>listeners.delete(n)}
 runInNewContext(source,{setTimeout:fn=>{fn();return 0},clearTimeout:()=>{},app:{whenReady:()=>({then:()=>{}})},screen:{getAllDisplays:()=>[],getDisplayMatching:()=>({id:1,workArea:{x:0,y:0,width:1920,height:1080},workAreaSize:{width:1920,height:1080}})},ipcMain:{handle:(n,f)=>handlers.set(n,f)},BrowserWindow:{fromWebContents:()=>window}})
 const policy=handlers.get('rhine-desktop:scene-policy'),action=handlers.get('rhine-desktop:window'),event={sender,senderFrame:frame}
 policy(event,true);assert.equal(title,'ARCHIVE — RHINE LAB / DSH')
 action(event,'fullscreen');assert.equal(title,'ARCHIVE — RHINE LAB / DSH — 按 F11 全屏')
 maximized=true;listeners.get('resize')();assert.equal(title,'ARCHIVE — RHINE LAB / DSH — 按 F11 全屏')
 let prevented=false
 listeners.get('page-title-updated')({preventDefault:()=>prevented=true},'会话二 — RHINE LAB / DSH')
 assert.ok(prevented);assert.equal(title,'会话二 — RHINE LAB / DSH — 按 F11 全屏')
 for(let i=0;i<3;i++){listeners.get('move')();listeners.get('resize')();policy(event,true)}
 assert.equal(title,'会话二 — RHINE LAB / DSH — 按 F11 全屏')
 action(event,'fullscreen');assert.equal(title,'会话二 — RHINE LAB / DSH')
 listeners.get('page-title-updated')({preventDefault:()=>{}},'会话三 — RHINE LAB / DSH')
 action(event,'fullscreen');assert.equal(title,'会话三 — RHINE LAB / DSH — 按 F11 全屏')
 policy(event,false);assert.equal(title,'会话三 — RHINE LAB / DSH');assert.equal(listeners.size,0)
})


test('leaving fullscreen centers once in the display work area including negative origins and taskbars', () => {
 for (const area of [{x:0,y:0,width:1920,height:1040},{x:-2560,y:40,width:2560,height:1400},{x:1920,y:-1080,width:1600,height:860}]) {
  const handlers=new Map(),listeners=new Map(),input=new Map(),moves=[],timers=new Map();let timerId=0
  const flush=()=>{for(const [id,fn] of timers){timers.delete(id);fn()}}
  const display={id:7,workArea:area,workAreaSize:{width:area.width,height:area.height}}
  let fullscreen=false,minimum=[400,300],title='DSH',bounds={x:area.x+600,y:area.y+600,width:Math.ceil(area.width*.5),height:Math.ceil(area.height*.5)}
  const frame={url:'dsh-app://app/'}, sender={mainFrame:frame}
  const contents={on:(n,f)=>input.set(n,f),removeListener:n=>input.delete(n),isDestroyed:()=>false,getURL:()=>frame.url,send:()=>{}}
  const window={webContents:contents,isDestroyed:()=>false,isFullScreen:()=>fullscreen,isMaximized:()=>false,
   getTitle:()=>title,setTitle:v=>title=v,getMinimumSize:()=>minimum,setMinimumSize:(...v)=>minimum=v,
   getBounds:()=>bounds,setSize:()=>{}, // Simulate Windows reporting pre-minimum restore bounds.
   setBounds:v=>{bounds={...v};moves.push(bounds);listeners.get('move')?.()},
   setFullScreen:v=>{if(!v)listeners.get('leave-full-screen')?.();fullscreen=v;if(v)listeners.get('enter-full-screen')?.()},
   on:(n,f)=>listeners.set(n,f),once:()=>{},removeListener:n=>listeners.delete(n)}
  runInNewContext(source,{setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id),app:{whenReady:()=>({then:()=>{}})},screen:{getAllDisplays:()=>[display],getDisplayMatching:()=>display},ipcMain:{handle:(n,f)=>handlers.set(n,f)},BrowserWindow:{fromWebContents:()=>window}})
  const event={sender,senderFrame:frame},policy=handlers.get('rhine-desktop:scene-policy'),action=handlers.get('rhine-desktop:window')
  policy(event,true);action(event,'fullscreen')
  assert.equal(moves.length,0,'Windows leave event still reports fullscreen: defer until restored')
  flush();assert.equal(moves.length,1)
  assert.ok(Math.abs(bounds.x+bounds.width/2-(area.x+area.width/2))<=.5)
  assert.ok(Math.abs(bounds.y+bounds.height/2-(area.y+area.height/2))<=.5)
  assert.ok(bounds.x>=area.x && bounds.y>=area.y)
  listeners.get('move')();listeners.get('resize')();assert.equal(moves.length,1,'ordinary drag/resize must not recenter')
  const key=input.get('before-input-event'),press=()=>key({preventDefault(){}},{key:'F11',type:'keyDown'})
  press();press();flush();assert.equal(moves.length,2,'native F11 uses the same restore handler')
  press();press();policy(event,false);flush();assert.equal(moves.length,2,'deactivation cancels a pending center')
  assert.equal(listeners.size,0);assert.equal(input.size,0)
 }
})
