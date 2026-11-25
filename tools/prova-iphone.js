// Prova veloce su iPhone simulato (per ENTRAMBE le chat): apre docs/ con un server locale, fa eseguire azioni, stampa errori e salva uno screenshot.
// Uso: node tools/prova-iphone.js [screenshot.png] ["js da eseguire nella pagina; await consentito"] [secondi di attesa]
// Esempio: node tools/prova-iphone.js /tmp/a.png "document.getElementById('sb-make').click()" 6
const { chromium, devices } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'docs'), [, , shot = '/tmp/prova.png', code = '', wait = '4'] = process.argv;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.css': 'text/css', '.mp3': 'audio/mpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' }); r.end(d); }); }).listen(0, async () => {
  const b = await chromium.launch(), c = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }), pg = await c.newPage(), errs = [];
  pg.on('pageerror', e => errs.push('ERRORE ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.goto('http://localhost:' + srv.address().port + '/'); await pg.waitForTimeout(2500);
  if (code) { try { const out = await pg.evaluate('(async()=>{' + code + '})()'); if (out !== undefined) console.log('RISULTATO', JSON.stringify(out).slice(0, 2000)); } catch (e) { errs.push('CODICE ' + e.message); } await pg.waitForTimeout(+wait * 1000); }
  await pg.screenshot({ path: shot }); console.log(errs.length ? errs.slice(0, 10).join('\n') : 'nessun errore', '| screenshot:', shot);
  await b.close(); srv.close();
});
