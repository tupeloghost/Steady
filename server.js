'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildEdition } = require('./pipeline');
const { render } = require('./render');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const CACHE = path.join(ROOT, 'cache');
const PORT = Number(process.env.PORT || 5182);

if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });

const config = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'sources.json'), 'utf8'));
const css = () => fs.readFileSync(path.join(PUBLIC, 'style.css'), 'utf8');
const today = () => new Date().toISOString().slice(0, 10);
const editionPath = (d) => path.join(CACHE, 'edition-' + d + '.json');

let building = null;

async function getEdition({ force = false } = {}) {
  const d = today();
  if (!force && fs.existsSync(editionPath(d))) return JSON.parse(fs.readFileSync(editionPath(d), 'utf8'));
  if (building) return building;
  building = (async () => {
    const cfg = config();
    const edition = await buildEdition(cfg);
    fs.writeFileSync(editionPath(d), JSON.stringify(edition, null, 2));
    // A copy that opens with no server running, for reading later or on another machine.
    fs.writeFileSync(path.join(ROOT, 'latest-edition.html'), render(edition, cfg, { standalone: true, css: css() }));
    return edition;
  })().finally(() => { building = null; });
  return building;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  try {
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const edition = await getEdition({ force: url.searchParams.get('refresh') === '1' });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      return res.end(render(edition, config()));
    }
    if (url.pathname === '/api/edition') {
      const edition = await getEdition({ force: url.searchParams.get('refresh') === '1' });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(edition));
    }
    if (url.pathname === '/api/sources') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(config()));
    }
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
    return res.end('<p style="font:16px Georgia,serif;max-width:32rem;margin:6rem auto;color:#555">'
      + 'Today’s edition could not be assembled. Nothing is wrong with the news, only with this reader. '
      + 'Reason recorded: ' + String(e && e.message || e) + '</p>');
  }

  const full = path.join(PUBLIC, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('not found');
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(full)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(full).pipe(res);
});

server.listen(PORT, () => {
  console.log('Steady is reading at http://localhost:' + PORT);
  // Start assembling straight away so the page is waiting when it is opened, rather
  // than the first visit paying for every feed.
  const d = today();
  if (!fs.existsSync(editionPath(d))) {
    console.log('Assembling today\u2019s edition in the background.');
    getEdition().then(
      () => console.log('Today\u2019s edition is ready.'),
      (e) => console.log('Could not assemble the edition: ' + (e && e.message || e))
    );
  }
});
