const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || '0.0.0.0';
const STATIC_DIR = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, code, data) {
  const payload = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

async function handleAircraft(reqUrl, res) {
  try {
    const limit = Math.max(20, Math.min(800, Number(reqUrl.searchParams.get('limit') || 300)));
    const upstream = 'https://opensky-network.org/api/states/all';
    const response = await fetch(upstream, {
      headers: { 'User-Agent': 'earth-sat-live/1.0' },
      cache: 'no-store',
    });
    if (!response.ok) {
      sendJson(res, response.status, { error: `OpenSky failed ${response.status}` });
      return;
    }
    const data = await response.json();
    const trimmed = Array.isArray(data.states) ? data.states.slice(0, limit) : [];
    sendJson(res, 200, {
      time: data.time,
      source: upstream,
      states: trimmed,
    });
  } catch (err) {
    sendJson(res, 502, { error: err.message || 'proxy_error' });
  }
}

function serveStatic(reqPath, res) {
  const safePath = path.normalize(reqPath).replace(/^\.+/, '');
  let filePath = path.join(STATIC_DIR, safePath);
  if (filePath.endsWith(path.sep)) filePath = path.join(filePath, 'index.html');
  if (!path.extname(filePath)) filePath = path.join(filePath, 'index.html');
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (reqUrl.pathname === '/healthz') {
    return sendJson(res, 200, { ok: true });
  }

  if (reqUrl.pathname === '/api/aircraft') {
    return handleAircraft(reqUrl, res);
  }

  const pathname = reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname;
  serveStatic(pathname, res);
});

server.listen(PORT, HOST, () => {
  console.log(`earth-sat-live listening on http://${HOST}:${PORT}`);
});
