/**
 * Serves the production build locally.
 * Usage: npm start  (runs build first if dist/ is missing)
 */
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'dist');
const port = Number(process.env.PORT) || 5174;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function ensureDist() {
  if (existsSync(join(root, 'index.html'))) return;
  console.log('Building production bundle (first run)...');
  await new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'build'], {
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('build failed'))));
  });
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = decoded.replace(/^\/+/, '');
  const resolved = join(root, rel);
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

await ensureDist();

function startServer(tryPort) {
  const srv = createServer(async (req, res) => {
    try {
      let filePath = safePath(req.url || '/');
      if (!filePath) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      let st;
      try {
        st = await stat(filePath);
      } catch {
        st = null;
      }

      if (!st || st.isDirectory()) {
        filePath = join(filePath, 'index.html');
        st = await stat(filePath);
      }

      const body = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    }
  });

  srv.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && tryPort < port + 10) {
      startServer(tryPort + 1);
      return;
    }
    console.error(err.message);
    process.exit(1);
  });

  srv.listen(tryPort, '0.0.0.0', () => {
    console.log(`\n  PDF Toolkit running at:\n`);
    console.log(`  → http://localhost:${tryPort}/\n`);
    console.log('  Press Ctrl+C to stop.\n');
  });
}

startServer(port);