#!/usr/bin/env node
import http from 'node:http';
import { execFile } from 'node:child_process';

const PORT = Number(process.env.MAC_OPENER_PORT || 17888);
const HOST = '127.0.0.1';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  if (url.pathname === '/health') {
    res.writeHead(200);
    res.end('ok');
    return;
  }
  if (url.pathname !== '/open') {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const filePath = url.searchParams.get('path');
  if (!filePath) {
    res.writeHead(400);
    res.end('missing path');
    return;
  }
  execFile('/usr/bin/open', [filePath], (err) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(err.message);
      return;
    }
    res.writeHead(200);
    res.end('ok');
  });
}).listen(PORT, HOST, () => {
  console.log(`Mac file opener: http://${HOST}:${PORT}/open?path=...`);
});
