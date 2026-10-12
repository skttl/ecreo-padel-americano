import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createStaticServer } from '../server.js';

test('local server serves module MIME and HEAD, rejects traversal, private files and other methods', async () => {
  const server = createStaticServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const request = (path, method = 'GET') => new Promise((resolve, reject) => {
    http.request({ hostname: '127.0.0.1', port: server.address().port, path, method }, response => {
      let body = ''; response.on('data', chunk => body += chunk);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    }).on('error', reject).end();
  });
  try {
    const module = await request('/tournament.js');
    assert.equal(module.status, 200);
    assert.equal(module.headers['content-type'], 'text/javascript; charset=utf-8');
    assert.match(module.body, /export function createTournament/);
    assert.equal((await request('/tournament.js', 'HEAD')).body, '');
    for (const path of ['/../package.json', '/%2e%2e/package.json', '/%2e%2e%2fpackage.json', '/.git/config', '/server.js', '/README.md', '/docs/a', '/%zz', '/app.js%00']) {
      assert.notEqual((await request(path)).status, 200, path);
    }
    assert.equal((await request('/app.js', 'POST')).status, 405);
    assert.equal((await request('/')).headers['content-type'], 'text/html; charset=utf-8');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
