import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildContent, collectContent, parsePage } from './content.mjs';

test('order is optional and accepts only finite numbers', () => {
  assert.equal(parsePage('note.md', '# Note').order, undefined);
  for (const order of ['0', '-2', '1.5', '100']) {
    assert.equal(parsePage('note.md', `---\norder: ${order}\n---\n# Note`).order, Number(order));
  }
  for (const order of ['"1"', 'true', 'null', '[]', '{}', '.nan', '.inf', '-.inf']) {
    assert.throws(() => parsePage('note.md', `---\norder: ${order}\n---\n# Note`), /Invalid order in note.md: expected a finite number/);
  }
});

test('Markdown order drives archive and directory lists independently of titles', async t => {
  const base = await mkdtemp(join(tmpdir(), 'rhine-order-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = join(base, 'content'), output = join(base, 'output');
  await mkdir(join(root, 'notes'), { recursive: true });
  const entries = [
    ['negative', 'Negative', 'order: -1\ndate: 2020-01-01'],
    ['zero', 'Zero', 'order: 0'],
    ['decimal', 'Decimal', 'order: 0.5'],
    ['tie-new', 'Zebra', 'order: 1\ndate: 2026-09-09'],
    ['tie-a', 'Alpha', 'order: 1\ndate: 2026-09-08'],
    ['tie-b', 'Beta', 'order: 1\ndate: 2026-09-08'],
    ['tie-undated', 'No date', 'order: 1'],
    ['large', 'Large', 'order: 100'],
    ['newest', 'Latest', 'date: 2026-09-09'],
    ['older-a', 'Same title', 'date: 2026-09-08'],
    ['older-b', 'Same title', 'date: 2026-09-08'],
    ['undated', 'Undated', ''],
  ];
  for (const [name, title, metadata] of entries) {
    await writeFile(join(root, `notes/${name}.md`), `---\ntitle: ${title}\n${metadata}\n---\n# ${title}\n\nBody.`);
  }
  let content = await buildContent(root, output);
  const expected = entries.map(([name]) => `/notes/${name}`);
  assert.deepEqual(content.records.map(record => record.source), expected);
  assert.deepEqual(content.pages.find(page => page.route === '/notes').children.map(page => page.route), expected);
  const catalogue = await readFile(join(output, 'catalogue.html'), 'utf8');
  const directory = await readFile(join(output, 'pages/notes/index.html'), 'utf8');
  for (const html of [catalogue, directory]) {
    let previous = -1;
    for (const url of expected) {
      const position = html.indexOf(`href="${url}"`);
      assert.ok(position > previous, `${url} is in order`);
      previous = position;
    }
  }
  // A title edit and file move retain priority; no separate title list is needed.
  await writeFile(join(root, 'notes/zero.md'), '---\norder: 0\npermalink: /notes/zero\n---\n# A renamed title');
  await rename(join(root, 'notes/zero.md'), join(root, 'notes/renamed.md'));
  content = await collectContent(root);
  assert.deepEqual(content.records.map(record => record.source), expected);
  assert.equal(content.records[1].title, 'A renamed title');
  await writeFile(join(root, 'notes/added.md'), '# Added later');
  content = await collectContent(root);
  assert.equal(content.records.length, expected.length + 1);
  assert.deepEqual(content.records.slice(0, 8).map(record => record.source), expected.slice(0, 8));
});

test('directory order controls navigation without propagating to its contents or extracted links', async t => {
  const root = await mkdtemp(join(tmpdir(), 'rhine-directory-order-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [folder, order] of [['alpha', 2], ['beta', 1]]) {
    await mkdir(join(root, folder));
    await writeFile(join(root, `${folder}/index.md`), `---\norder: ${order}\n---\n# ${folder}`);
    await writeFile(join(root, `${folder}/note.md`), '# Note');
  }
  await writeFile(join(root, 'site.json'), JSON.stringify({ projectLinkPrefixes: ['https://example.com/'] }));
  await writeFile(join(root, 'index.md'), '---\norder: -100\n---\n# Home\n\n[Tool](https://example.com/tool)');
  const content = await collectContent(root);
  assert.deepEqual(content.sections.map(page => page.route), ['/beta', '/alpha']);
  assert.equal(content.records.length, 3);
  assert.ok(content.records.every(record => record.order === undefined));
});
