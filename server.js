import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const assets = new Map([
  ['index.html', 'text/html'], ['styles.css', 'text/css'], ['app.js', 'text/javascript'],
  ['tournament.js', 'text/javascript'], ['scheduler.js', 'text/javascript'],
  ['scheduler-worker.js', 'text/javascript'], ['storage.js', 'text/javascript'],
  ['statistics.js', 'text/javascript'],
]);

export function createStaticServer() {
  return http.createServer(async (request, response) => {
    const reject = status => { response.writeHead(status); response.end(); };
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD'); return reject(405);
    }
    let pathname;
    try { pathname = decodeURIComponent(request.url.split('?')[0]); }
    catch { return reject(400); }
    const asset = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!pathname.startsWith('/') || !assets.has(asset)) return reject(404);
    try {
      const body = await readFile(path.join(root, asset));
      response.writeHead(200, { 'Content-Type': `${assets.get(asset)}; charset=utf-8`, 'Content-Length': body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { reject(404); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createStaticServer();
  server.on('error', error => { console.error(`Serveren kunne ikke starte: ${error.message}`); process.exitCode = 1; });
  server.listen(4173, '127.0.0.1', () => console.log('Ecreo padel: http://127.0.0.1:4173'));
}
