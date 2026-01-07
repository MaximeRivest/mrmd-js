/**
 * Simple development server for testing mrmd-js
 *
 * Usage: node test-app/server.js
 * Then open http://localhost:3000
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = dirname(__dirname); // mrmd-js root

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
};

const server = createServer(async (req, res) => {
  let path = req.url.split('?')[0];

  // Default to index.html
  if (path === '/') {
    path = '/test-app/index.html';
  }

  // Resolve path relative to package root
  const filePath = join(ROOT, path);
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
    console.log(`200 ${path}`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      console.log(`404 ${path}`);
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
      console.error(`500 ${path}:`, err.message);
    }
  }
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   mrmd-js Test Server                            ║
║                                                  ║
║   → http://localhost:${PORT}                        ║
║                                                  ║
║   Press Ctrl+C to stop                           ║
║                                                  ║
╚══════════════════════════════════════════════════╝
`);
});
