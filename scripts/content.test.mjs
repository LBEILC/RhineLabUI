import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { collectContent, buildContent, parsePage } from './content.mjs';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';
import { contentRoot } from './site-config.mjs';

test('the selected content root supplies records independently of engine documentation', async () => {
  const { pages, records, categories } = await collectContent(contentRoot);
  assert.ok(pages.length > 0);
  assert.ok(records.length > 0);
  assert.ok(records.every(r => categories.includes(r.category)));
  assert.equal(new Set(records.map(r => r.source)).size, records.length);
  assert.ok(!pages.some(p => /^(?:art|verification|reference|src)\//.test(p.file || '')));
});

test('new folders, posts, relative assets, moves, and deletes need no UI changes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'logger-content-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'blogs/research'), { recursive: true });
  await writeFile(join(root, 'blogs/research/20260908-first.md'), '# A new observation\n\nA real note.\n\n![Diagram](diagram.svg)\n\n## Evidence\n\nMath: $E=mc^2$.\n\n[Next](second.md)\n');
  await writeFile(join(root, 'blogs/research/second.md'), '# Second note\n\nMore evidence.');
  await writeFile(join(root, 'blogs/research/diagram.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await writeFile(join(root, 'blogs/research/draft.md'), '---\ndraft: true\n---\n# Not published');
  let content = await buildContent(root, join(root, '.generated'));
  assert.ok(content.pages.some(p => p.route === '/blogs/research'));
  assert.deepEqual(content.categories, ['Research']);
  assert.ok(!content.pages.some(p => p.route.includes('draft')));
  const html = await readFile(join(root, '.generated/pages/blogs/research/20260908-first/index.html'), 'utf8');
  assert.match(html, /href="\/blogs\/research\/second"/);
  assert.match(html, /src="\/blogs\/research\/diagram.svg"/);
  assert.match(html, /class="katex"/);
  assert.match(html, /id="evidence"/);
  assert.match(html, /2026-09-08/);
  await readFile(join(root, '.generated/pages/blogs/research/diagram.svg'));
  await rename(join(root, 'blogs/research'), join(root, 'blogs/experiments'));
  content = await buildContent(root, join(root, '.generated'));
  assert.deepEqual(content.categories, ['Experiments']);
  assert.ok(content.records.every(r => r.source.startsWith('/blogs/experiments/')));
  await assert.rejects(readFile(join(root, '.generated/pages/blogs/research/index.html')), { code: 'ENOENT' });
  await rm(join(root, 'blogs/experiments/second.md'));
  await buildContent(root, join(root, '.generated'));
  await assert.rejects(readFile(join(root, '.generated/pages/blogs/experiments/second/index.html')), { code: 'ENOENT' });
});

test('front matter is optional, stable permalinks and unpublished entries work', () => {
  const page = parsePage('blogs/moved/example.md', '---\ntitle: "A & B"\npermalink: /blogs/stable\ncategory: Experiments\ndescription: A short summary\ntags: [TLS, notes]\n---\n# Content');
  assert.equal(page.route, '/blogs/stable');
  assert.equal(page.category, 'Experiments');
  assert.equal(page.summary, 'A short summary');
  assert.deepEqual(page.tags, ['TLS', 'notes']);
  assert.equal(parsePage('blogs/hidden.md', '---\npublished: false\n---\nHidden'), null);
  assert.equal(parsePage('blogs/note.md', '# My title').title, 'My title');
  assert.throws(() => parsePage('blogs/bad.md', '---\npermalink: /../../bad\n---\nBad'), /Invalid permalink/);
});

test('duplicate URLs fail the build instead of overwriting a post', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'logger-duplicate-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'a.md'), '---\npermalink: /same\n---\n# A');
  await writeFile(join(root, 'b.md'), '---\npermalink: /same\n---\n# B');
  await assert.rejects(collectContent(root), /Duplicate permalink/);
});

test('archive navigation supports changing category counts and unequal collection sizes', async () => {
  const source = await readFile('src/archive-loop.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const sizes of [[1], [2, 3], [1, 3, 17, 8, 2], [40, 2, 1, 8, 33, 4, 5, 2, 3, 2, 8]]) {
    let index = 0;
    const columns = sizes.map(count => Array.from({ length: count }, () => index++));
    const data = {
      archiveColumns: sizes.map((_, i) => String(i)),
      columnFiles: lane => columns[lane],
      fileLocation: index => {
        const lane = columns.findIndex(files => files.includes(index));
        return { lane, row: 12 + columns[lane].indexOf(index) };
      },
    };
    const exports = {};
    runInNewContext(code, { exports, require: () => data });
    const count = exports.LOOP_COLUMNS * exports.LOOP_ROWS;
    assert.equal(count, 288);
    const initial = Array.from({ length: count }, (_, i) => exports.poolCell(i));
    assert.ok(initial.some(cell => cell.lane === 2 && cell.row === 12));
    for (const center of [{ lane: 2, row: 12 }, { lane: -9, row: -40 }, { lane: 23, row: 75 }, { lane: 2048, row: 2048 }]) {
      const cells = Array.from({ length: count }, (_, i) => exports.visibleCell(i, center));
      assert.equal(new Set(cells.map(exports.cellKey)).size, count);
      assert.ok(cells.some(cell => exports.sameCell(cell, center)));
      assert.equal(new Set(cells.map(cell => cell.lane)).size, exports.LOOP_COLUMNS);
      assert.equal(new Set(cells.map(cell => cell.row)).size, exports.LOOP_ROWS);
      assert.ok(cells.every(cell => Math.abs(cell.lane - center.lane) <= Math.floor(exports.LOOP_COLUMNS / 2) && Math.abs(cell.row - center.row) <= Math.floor(exports.LOOP_ROWS / 2)));
      assert.ok(cells.every(cell => Number.isInteger(exports.fileAtCell(cell))));
    }
    let cell = { lane: 0, row: 12 };
    for (let lane = 0; lane < sizes.length; lane++) {
      const files = columns[lane];
      if (lane) cell = exports.selectionCell(files[0], cell, { axis: 'lane', direction: 1 });
      assert.equal(exports.fileAtCell(cell), files[0]);
      for (let step = 1; step <= files.length * 2; step++) {
        const next = files[step % files.length];
        const previousRow = cell.row;
        cell = exports.selectionCell(next, cell, { axis: 'row', direction: 1 });
        assert.equal(cell.row, previousRow + 1);
        assert.equal(exports.fileAtCell(cell), next);
      }
    }
    cell = exports.selectionCell(columns[0][0], cell, { axis: 'lane', direction: 1 });
    assert.equal(exports.fileAtCell(cell), columns[0][0]);
  }
});
