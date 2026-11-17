// Local static server: npm start -- --port 8123
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || 8123);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Invalid port. Use npm start -- --port 8123');
  process.exit(1);
}
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};
const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
  }
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const parts = pathname.split(/[\\/]/);
    if (parts.some(part => part.startsWith('.'))) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    let file = path.resolve(root, '.' + pathname);
    const withinRoot = target => target === root || target.startsWith(root + path.sep);
    if (!withinRoot(file)) { response.writeHead(403); response.end('Forbidden'); return; }
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    file = await fs.realpath(file);
    if (!withinRoot(file)) { response.writeHead(403); response.end('Forbidden'); return; }
    const bytes = await fs.readFile(file);
    response.writeHead(200, {
      'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': bytes.length, 'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch (error) {
    const status = error instanceof URIError ? 400 : ['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500;
    response.writeHead(status); response.end(http.STATUS_CODES[status]);
  }
});
server.on('error', error => { console.error(`Server: ${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  console.log(`Game: http://127.0.0.1:${port}/`);
  console.log('Stop: Ctrl+C');
});
