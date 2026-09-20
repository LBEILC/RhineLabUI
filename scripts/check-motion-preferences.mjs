import assert from 'node:assert/strict';
import { createMotionPreferences, fullMotion, reducedMotion, motionPresetFor, motionSettingsMarkup } from '../src/motion-preferences.ts';

for (const system of [false, true]) {
  assert.equal(motionPresetFor(createMotionPreferences(undefined, system)), system ? 'reduced' : 'full');
  for (const legacy of [false, true]) {
    assert.equal(motionPresetFor(createMotionPreferences(undefined, legacy)), legacy ? 'reduced' : 'full');
  }
  assert.equal(motionPresetFor(createMotionPreferences(fullMotion(), system)), 'full');
  assert.equal(motionPresetFor(createMotionPreferences(reducedMotion(), system)), 'reduced');
  assert.equal(motionPresetFor(createMotionPreferences({ ...fullMotion(), boot: false }, system)), 'custom');
}
// Old saved scroll values must not change the preset or discard other choices.
for (const motion of [fullMotion(), reducedMotion(), { ...fullMotion(), modelDecryption: false }]) {
  for (const smoothScroll of [false, true]) {
    const restored = createMotionPreferences({ ...motion, smoothScroll }, undefined);
    assert.deepEqual(restored, motion);
    assert.equal(motionPresetFor(restored), motionPresetFor(motion));
    assert.ok(!motionSettingsMarkup(restored).includes('smoothScroll'));
    assert.equal(Object.keys(restored).length, 14);
  }
}
console.log('Motion preferences: 12 initialization cases and 6 retired-scroll migration cases passed.');
