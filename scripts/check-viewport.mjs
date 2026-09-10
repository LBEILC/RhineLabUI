import assert from "node:assert/strict";
import { viewportLayout, archiveFraming } from "../src/viewport-layout.ts";
import { renderDimensions, qualityPresets } from "../src/render-quality.ts";

for (const [w,h,touch] of [[1920,1080,false],[2560,1080,false],[1280,1024,false],[844,390,true],[390,844,true],[320,568,true]]) {
  const layout=viewportLayout(w,h,touch);
  assert.ok(Math.abs(layout.width*layout.scale-w)<1e-8);
  assert.ok(Math.abs(layout.height*layout.scale-h)<1e-8);
  const film=viewportLayout(w,h,touch,true);
  assert.equal(film.width/film.height,16/9);
  assert.ok(film.width*film.scale<=w+.001&&film.height*film.scale<=h+.001);
  const shot=archiveFraming(layout.width,layout.height,7.33,1,layout.kind==='compact');
  assert.ok(shot.span>=5.9&&shot.detailX>0&&shot.detailX<1&&shot.detailY>0&&shot.detailY<1);
  if(layout.kind==='portrait') {
    const coverHeight=3.7*h/shot.span;
    assert.ok(shot.detailY*h-coverHeight/2>=110, 'Cover clears the return control on short phones');
    assert.ok(shot.detailY*h+coverHeight/2<=h*.54-40, 'Cover clears the document header');
  }
  const render=renderDimensions(qualityPresets.original,layout.width,layout.height,layout.scale,3,16384);
  assert.ok(render.width>=w, 'CSS-sized phones must not retain the old 1920px scale factor');
  assert.ok(render.width*render.height<=8294400+5000);
}
assert.deepEqual(viewportLayout(1920,1080,false),{width:1920,height:1080,scale:1,kind:'desktop'});
assert.equal(archiveFraming(1920,1080,7.33,1,false).span,5.9);
assert.equal(archiveFraming(1920,1080,7.33,1,false).detailX,550/1920);
console.log('Viewport, reference framing and render resolution checks passed.');
