import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { bootMotion } from '../src/boot-motion.ts';
import { brandHeading } from '../src/brand.ts';
import { audioSettingsMarkup } from '../src/audio-settings.ts';
import { loadSite, siteTokens, escapeHtml, engineRoot } from './site-config.mjs';
import { buildContent, parsePage } from './content.mjs';

test('default UI language and identity are preserved; custom identity is escaped and used consistently', async t => {
  const root = await mkdtemp(join(tmpdir(), 'rhine-site-ui-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const defaults = await loadSite(root);
  assert.equal(defaults.lang, 'zh-CN');
  assert.equal(defaults.sessionName, 'JOYCE MOORE');
  assert.equal(defaults.sessionStatus, 'SESSION AUTHORIZED');
  assert.equal(defaults.welcomeName, 'RHINE LAB.LLC.');
  assert.equal(defaults.welcomeMessage, '欢迎访问莱茵生命内部资料档案');
  const source = await readFile(join(engineRoot, 'src/main.ts'), 'utf8');
  const stageTemplate = source.match(/\$\("#stage"\)\.innerHTML = (`[\s\S]*?`);/)[1];
  const settingsTemplate = source.match(/function settingsMarkup\(\) \{\s+return (`[\s\S]*?`);/)[1];
  const context = site => ({ site, escapeHtml, records: [{ title: '莱茵生命', category: '机构档案' }], archiveColumns: ['机构档案'], logo: '', brandHeading, audioSettingsMarkup, qualityMarkup: () => '', prefs: { soundVolume: .55, musicVolume: .5 } });
  const stage = runInNewContext(stageTemplate, context(defaults));
  assert.ok(stage.includes('</i> SESSION AUTHORIZED</span><span>JOYCE MOORE <i>／</i>'));
  for (const text of ['aria-label="ANALYSIS"', '<b>OS</b>', 'INTERNAL DATABASE', 'CONNECTING TO INTERNAL DATABASE', 'aria-label="系统导航"', 'COLUMN <span']) assert.ok(stage.includes(text), text);
  for (const text of ['DEPARTMENT / 科室', 'COLLECTION / 编目范围', 'RELATED / 相关人物', '01 <span>概述</span>', '02 <span>研究记录</span>', '03 <span>访问日志</span>', '输入档案编号、名称或科室']) assert.ok(source.includes(text), text);
  assert.ok(!source.includes('All archives'));
  const custom = { lang: 'en-GB', brand: 'Lab <B> & C', sessionName: 'A <B> & C', sessionStatus: '<AUTHORIZED>', welcomeName: 'Research & Notes', welcomeMessage: 'Welcome, reader.' };
  await writeFile(join(root, 'site.json'), JSON.stringify(custom));
  const configured = await loadSite(root);
  const rendered = runInNewContext(stageTemplate, context(configured));
  const settings = runInNewContext(settingsTemplate, context(configured));
  const heading = { textContent: '' };
  const brandAssignment = source.match(/\$\("\.brand h1"\)\.textContent = site\.brand;/)[0];
  runInNewContext(brandAssignment, { site: configured, $: () => heading });
  assert.equal(heading.textContent, custom.brand);
  for (const html of [rendered, settings]) {
    assert.ok(html.includes('A &lt;B&gt; &amp; C'));
    assert.ok(html.includes('&lt;AUTHORIZED&gt;'));
    assert.ok(!html.includes(custom.sessionName));
    assert.ok(!html.includes('JOYCE MOORE'));
  }
  assert.ok(rendered.includes('Research &amp; Notes'));
  assert.ok(source.includes('new BootSequence($("#stage"), site.sessionName)'));
  assert.ok(source.includes('身份信息确认：${site.sessionName}'));
  assert.ok(source.includes('<span>${escapeHtml(site.sessionName)}</span><b>READ AUTHORIZED'));
  await writeFile(join(root, 'note.md'), '# A note\n\nBody.');
  const output = join(root, '.generated');
  await buildContent(root, output);
  for (const path of ['note/index.html', '404.html']) {
    assert.ok((await readFile(join(output, 'pages', path), 'utf8')).includes('<html lang="en-GB">'), path);
  }
  assert.ok(siteTokens(await readFile(join(engineRoot, 'index.html'), 'utf8'), configured).includes('<html lang="en-GB">'));
  await writeFile(join(root, 'site.json'), '{"sessionName":42}');
  await assert.rejects(loadSite(root), /sessionName must be a string/);
  await writeFile(join(root, 'site.json'), '{"lang":"not_a_tag"}');
  await assert.rejects(loadSite(root), /valid language tag/);
});

test('configurable boot identity retains the animation timings', () => {
  assert.equal(bootMotion(8.56).auth, 'ID CONFIRMED : JOYCE MOORE');
  assert.equal(bootMotion(8.56, 'READER').auth, 'ID CONFIRMED : READER');
  for (let frame = 170; frame <= 675; frame++) {
    const time = frame / 25 - 5;
    assert.deepEqual(bootMotion(time), bootMotion(time, 'JOYCE MOORE'));
    assert.deepEqual({ ...bootMotion(time, 'READER'), auth: '' }, { ...bootMotion(time), auth: '' });
  }
});

test('optional bilingual archive metadata is validated independently of the page URL', () => {
  const page = parsePage('notes/example.md', '---\nen: ENGLISH TITLE\ndepartment: Research\nlead: Reader\nclearance: REFERENCE AREA\nreference: https://example.com/reference\nfindings: [First, Second]\n---\n# 标题');
  assert.equal(page.route, '/notes/example');
  assert.equal(page.archive.en, 'ENGLISH TITLE');
  assert.deepEqual(page.archive.findings, ['First', 'Second']);
  assert.throws(() => parsePage('note.md', '---\nen: 42\n---\n# Note'), /expected a string/);
  assert.throws(() => parsePage('note.md', '---\nfindings: [42]\n---\n# Note'), /expected strings/);
  assert.throws(() => parsePage('note.md', '---\nreference: javascript:alert(1)\n---\n# Note'), /expected HTTP/);
});
