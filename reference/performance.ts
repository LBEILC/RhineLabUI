import { ArchiveScene } from '../src/scene';
import { qualityPresets } from '../src/render-quality';
import { quietBands } from '../src/archive-play-motion';

// Fixed random kernel makes before/after SSAO comparisons reproducible.
let seed = 431;
Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const scene = new ArchiveScene(document.querySelector('#scene')!);
await scene.load();
const precision = new URLSearchParams(location.search).get('precision') || (window as any).__precisionTier;
const geometry = precision && ['high', 'medium', 'low'].includes(precision)
  ? await (await import('./model-precision')).applyPrecision(scene, precision as any) : null;
scene.setQuality(qualityPresets.original);
scene.setMode('archive');
scene.select(0);
scene.revealImmediately();
scene.uiOnlyParallax = true;
let time = 100;
const gl = scene.renderer.getContext() as WebGL2RenderingContext;
const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
const internal = scene as any;
let uploads = 0, uploadBytes = 0;
const bufferSubData = gl.bufferSubData.bind(gl);
gl.bufferSubData = ((...args: any[]) => {
  uploads++;
  uploadBytes += args[4] ? args[4] * (args[2].BYTES_PER_ELEMENT || 1) : args[2].byteLength;
  return (bufferSubData as any)(...args);
}) as any;
const step = (cinema?: any) => { time += 1 / 60; scene.update(time, cinema); };
Object.assign(window, { bench: {
  scene,
  async prepare(name: string, options: any = {}) {
    scene.setTheme(!!options.dark, true);
    scene.setQuality({ ...qualityPresets.original, ...options.quality });
    scene.setReduced(name === 'static');
    scene.setPlayfield(true, quietBands(), 1, name === 'static' ? 1 : 0, null, name !== 'static');
    scene.setRhythmStyle(options.rhythm || 'legacy');
    scene.setMode(name === 'detail' || name === 'inspect' ? 'detail' : 'archive');
    // Advance springs without expensive draws, then render real warm-up frames.
    const render = internal.composer.render;
    internal.composer.render = () => {};
    for (let i = 0; i < 1200; i++) step();
    internal.composer.render = render;
    // If the optimized renderer has a cache, resize invalidates the skipped draw.
    scene.resize();
    for (let i = 0; i < 8; i++) step();
    gl.finish();
  },
  async sample(name: string, count = 48) {
    const samples: any[] = [];
    for (let i = 0; i < count; i++) {
      if (name === 'navigate' && i % 12 === 0) scene.select((i / 12 + 1) % 8);
      if (name === 'inspect') internal.targetRotation = .45 * Math.sin(i * .055);
      if (name === 'music') scene.setPlayfield(true, {low:.5+.3*Math.sin(i*.27),mid:.4+.2*Math.sin(i*.19),high:.3+.2*Math.cos(i*.31),activity:1},1,1,null,true);
      const query = ext ? gl.createQuery() : null;
      uploads = uploadBytes = 0;
      if (query) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      const start = performance.now();
      step(name === 'opening' ? {time:22 + i/60,reveal:1,lift:0,zoom:0} : undefined);
      const cpu = performance.now() - start;
      if (query) gl.endQuery(ext.TIME_ELAPSED_EXT);
      gl.finish();
      const total = performance.now() - start;
      await new Promise(r => setTimeout(r, 0));
      let gpu: number | null = null;
      if (query) {
        for (let attempts = 0; attempts < 100 && !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE); attempts++) await new Promise(r => setTimeout(r, 1));
        if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu = gl.getQueryParameter(query, gl.QUERY_RESULT)/1e6;
        gl.deleteQuery(query);
      }
      samples.push({cpu,total,gpu,uploads,uploadBytes,calls:scene.renderer.info.render.calls,triangles:scene.renderer.info.render.triangles});
    }
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {samples, geometry, stats:scene.getStats(), quality:document.querySelector('#scene')!.getAttribute('data-render-quality'),renderer:debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),gpuTimer:!!ext};
  },
  draw() { step(); gl.finish(); },
} });
