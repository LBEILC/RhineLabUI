import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildContent } from './content.mjs';
import { engineRoot } from './site-config.mjs';

test('the bundled archives build as a standalone forty-document example site', async t => {
  const root = join(engineRoot, 'examples/rhine-lab');
  const output = await mkdtemp(join(tmpdir(), 'rhine-example-test-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const before = (await readdir(root, { recursive: true })).sort();
  const result = await buildContent(root, output);
  assert.equal(result.records.length, 40);
  assert.equal(result.categories.length, 5);
  for (const category of result.categories) {
    assert.equal(result.records.filter(record => record.category === category).length, 8);
  }
  const originals = await readdir(join(root, 'archives'));
  assert.equal(originals.length, 40);
  for (const [index, record] of result.records.entries()) {
    assert.equal(record.id, `X-${String(index + 1).padStart(3, '0')}`);
    assert.equal(record.order, index + 1);
    const name = `RHINE-LAB-${record.id}.txt`;
    const original = await readFile(join(root, 'archives', name));
    assert.equal(original.toString('utf8').charCodeAt(0), 0xFEFF);
    assert.ok(original.toString('utf8').includes(`FILE ${record.id} / ${record.title}\n`));
    assert.ok(original.toString('utf8').includes(record.abstract));
    const text = original.toString('utf8');
    assert.equal(record.en, text.split('\n')[2]);
    assert.equal(record.department, text.match(/^科室：(.*)$/m)[1]);
    assert.equal(record.lead, text.match(/^相关人物：(.*)$/m)[1]);
    assert.equal(record.clearance, text.match(/^访问范围：(.*)$/m)[1]);
    assert.equal(record.reference, text.match(/^设定参考：(.*)$/m)[1]);
    assert.deepEqual(record.findings, [...text.matchAll(/^\d+\. (.*)$/gm)].map(match => match[1]));
    assert.deepEqual(await readFile(join(output, 'pages/archives', name)), original);
    const html = await readFile(join(output, 'pages', record.source, 'index.html'), 'utf8');
    assert.ok(html.includes(`href="/archives/${name}"`));
    assert.ok(html.includes('本文为基于公开设定的档案式改写，非游戏原文。'));
    assert.ok(html.includes('设定参考'));
    assert.ok(html.includes('相关人物'));
  }
  assert.deepEqual((await readdir(root, { recursive: true })).sort(), before);
});
