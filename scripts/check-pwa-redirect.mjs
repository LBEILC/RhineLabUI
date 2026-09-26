import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const template = await readFile(new URL('./pwa-worker.js', import.meta.url), 'utf8');

test('Pages redirects remain compatible with cached homepage navigation', async () => {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push(req.url);
    if (req.url === '/app/index.html') {
      res.writeHead(308, { Location: '/app/' }).end();
    } else if (req.url === '/app/') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'X-Release': 'fixture' }).end('<h1>Release</h1>');
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const scope = `http://127.0.0.1:${server.address().port}/app/`;
    const index = `${scope}index.html`;
    const entries = new Map();
    const listeners = {};
    const cache = {
      put: async (key, response) => entries.set(key, response.clone()),
      match: async key => entries.get(key)?.clone(),
      add: async request => { throw new Error(`Unexpected cache.add: ${request.url}`); },
    };
    let offline = false;
    runInNewContext(template.replace('__CACHE_VERSION__', '"fixture"').replace('__PRECACHE_FILES__', '["index.html"]'), {
      URL, Request, Response, Set,
      fetch: request => { if (offline) throw new Error('offline'); return fetch(request); },
      caches: { open: async () => cache, delete: async () => {} },
      self: { registration: { scope }, location: { origin: new URL(scope).origin }, addEventListener: (name, handler) => { listeners[name] = handler; } },
    });
    let installed;
    listeners.install({ waitUntil: promise => { installed = promise; } });
    await installed;
    assert.deepEqual(requests, ['/app/'], 'Precache must fetch the canonical directory URL, including subpath hosting');
    assert.equal(entries.get(index).redirected, false);

    async function navigate(url) {
      let response;
      listeners.fetch({ request: { method: 'GET', mode: 'navigate', redirect: 'manual', url }, respondWith: promise => { response = promise; } });
      return response;
    }
    offline = true;
    for (const url of [scope, index, `${scope}?scene=archive`]) {
      const response = await navigate(url);
      assert.equal(response.redirected, false);
      assert.equal(await response.text(), '<h1>Release</h1>');
    }

    // Use a real followed HTTP redirect so the Response's hidden URL list is real.
    const legacy = await fetch(index);
    assert.equal(legacy.redirected, true);
    await cache.put(index, legacy);
    const recovered = await navigate(scope);
    assert.equal(recovered.redirected, false, 'Manual navigation must not receive a followed redirect');
    assert.equal(recovered.status, 200);
    assert.equal(recovered.headers.get('X-Release'), 'fixture');
    assert.equal(await recovered.text(), '<h1>Release</h1>');
    assert.equal(entries.get(index).bodyUsed, false, 'Serving a page must not consume the stored release');
    assert.equal(await navigate(`${scope}update.html`), undefined, 'Recovery entry remains network-only');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
