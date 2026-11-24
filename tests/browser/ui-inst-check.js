// Strumenti nell'interfaccia: (1) pagina servita via HTTP con i campioni (docs/), (2) file singolo senza campioni (dist/index.html).
// Uso: NODE_PATH=$(npm root -g) node tests/browser/ui-inst-check.js
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium, devices } = require('playwright');
const root = path.join(__dirname, '..', '..'), docs = path.join(root, 'docs');
const SHOTS = process.env.SHOTS || '/tmp';
const MIME = { '.html': 'text/html', '.json': 'application/json', '.mp3': 'audio/mpeg', '.js': 'text/javascript', '.webmanifest': 'application/json', '.png': 'image/png' };
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) fails++; };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(docs, u === '/' ? 'index.html' : u); if (!f.startsWith(docs) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(r); });
async function session(browser, url, label, fn) {
  console.log('--- ' + label);
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' }), page = await ctx.newPage(), errs = [], reqs = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|ERR_NAME|ERR_INTERNET/.test(m.text())) errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(String(e)));
  page.on('request', (r) => { if (/samples\//.test(r.url())) reqs.push(r.url().split('/samples/')[1]); });
  await page.goto(url); await page.waitForSelector('#bl-grid .bl-cell'); await fn(page, reqs);
  ok(errs.length === 0, 'nessun errore in console' + (errs.length ? ': ' + errs.join(' | ') : '')); await ctx.close();
}
const peak = (page, ms) => page.evaluate(async (ms) => { let mx = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { const m = window.BeatLabUI.state.player.meters(); mx = Math.max(mx, m.master); await new Promise((r) => setTimeout(r, 30)); } return mx; }, ms);
(async () => {
  await new Promise((r) => srv.listen(0, r)); const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  await session(browser, 'http://127.0.0.1:' + port + '/#beatlab', 'versione sito (con campioni)', async (page, reqs) => {
    await page.waitForFunction(() => /Suoni veri disponibili/.test(document.getElementById('bl-samplestatus').textContent), null, { timeout: 15000 });
    ok(true, 'stato campioni: ' + (await page.locator('#bl-samplestatus').innerText()));
    ok(reqs.length === 1 && reqs[0] === 'manifest.json', 'all\'apertura si scarica solo il manifest (' + reqs.join(',') + ')');
    ok(await page.locator('.bl-inst').count() >= 28, 'elenco strumenti: ' + await page.locator('.bl-inst').count());
    await page.locator('summary', { hasText: 'Tastiere' }).tap();
    await page.locator('[data-listen="piano"]').tap();
    await page.waitForFunction(() => /pronto/.test(document.querySelector('[data-inst="piano"] [data-inst-state]').textContent), null, { timeout: 15000 });
    const pr = reqs.filter((r) => r.startsWith('piano/')).length; ok(pr === 22 && !reqs.some((r) => r.startsWith('archi/')), 'ascolta pianoforte: scaricati ' + pr + ' campioni del piano e nessun altro strumento');
    ok(await peak(page, 1500) > 0.03, 'il pianoforte suona (picco master misurato)');
    await page.locator('summary', { hasText: 'Archi' }).tap(); await page.locator('[data-add="archi"]').tap(); await page.waitForFunction(() => document.querySelector('[data-track-inst]'), null, { timeout: 5000 });
    ok(await page.locator('.bl-ch select[data-track-inst]').count() >= 2, 'tracce strumento nel mixer (808 + archi)');
    await page.locator('#bl-play').tap(); await page.waitForTimeout(500); await page.waitForFunction(() => /pronto/.test(document.querySelector('.bl-ch [data-inst-state="archi"]')?.textContent || ''), null, { timeout: 15000 });
    const pk = await peak(page, 2500); ok(pk > 0.05 && pk <= 1.001, 'base completa con strumenti suona: picco ' + pk.toFixed(3));
    // 808 campione
    await page.locator('.bl-ch select[data-track-inst]').first().selectOption('sub808s'); await page.waitForFunction(() => /pronto/.test(document.querySelector('.bl-ch [data-inst-state="sub808s"]')?.textContent || ''), null, { timeout: 15000 });
    ok(await peak(page, 1500) > 0.05, '808 da campione suona');
    // kit remoto
    await page.locator('#bl-kit').selectOption('synthkit'); await page.waitForFunction(() => window.BeatLabUI.state.sampler.kitBuffers('synthkit'), null, { timeout: 15000 });
    ok(await peak(page, 1500) > 0.1, 'kit "synthkit" scaricato e suona'); await page.locator('#bl-play').tap(); await page.waitForTimeout(200);
    // export con campioni
    await page.locator('#bl-export').tap(); await page.waitForSelector('#bl-exportinfo', { timeout: 40000 });
    const info = await page.locator('#bl-exportinfo').innerText(); ok(/tutti validi/.test(info), 'WAV con campioni valido: ' + info.replace(/Misurato /, ''));
    const wavpk = await page.evaluate(async () => { const a = document.querySelector('#bl-exportout audio'); const b = new Uint8Array(await (await fetch(a.src)).arrayBuffer()); const h = window.BeatEngine.parseWav(b); const v = new DataView(b.buffer); let mx = 0; for (let i = 44; i < b.length - 1; i += 2) mx = Math.max(mx, Math.abs(v.getInt16(i, true))); return { h, mx: mx / 32768 }; });
    ok(wavpk.h && wavpk.h.frames > 44100 && wavpk.mx > 0.1 && wavpk.mx <= 1, 'file WAV: ' + wavpk.h.frames + ' frame, picco ' + wavpk.mx.toFixed(2));
    ok(await page.evaluate(() => Math.round(performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0)) >= 0, 'memoria JS ' + await page.evaluate(() => Math.round((performance.memory || { usedJSHeapSize: 0 }).usedJSHeapSize / 1048576)) + ' MB');
    await page.screenshot({ path: SHOTS + '/bl-t2.png', fullPage: true });
    ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, 'nessuno scroll orizzontale');
  });
  await session(browser, 'file://' + path.join(root, 'dist', 'index.html') + '#beatlab', 'versione file singolo (senza campioni)', async (page) => {
    await page.waitForFunction(() => /non disponibili/.test(document.getElementById('bl-samplestatus').textContent), null, { timeout: 10000 });
    ok(true, 'avviso onesto: ' + (await page.locator('#bl-samplestatus').innerText()).slice(0, 110) + '…');
    for (const g of ['Tastiere', 'Corde', 'Mallet']) await page.locator('summary', { hasText: g }).tap(); await page.locator('[data-add="piano"]').tap(); await page.locator('[data-add="guitar"]').tap(); await page.locator('[data-add="campane"]').tap();
    ok(await page.locator('details.bl-grp[open]').count() >= 4, 'i gruppi aperti restano aperti dopo aver aggiunto una traccia');
    ok(await page.locator('.bl-ch select[data-track-inst]').count() === 4, 'quattro tracce strumento');
    await page.locator('#bl-play').tap(); ok(await peak(page, 2500) > 0.05, 'suona con i sintetizzatori (ripiego)'); await page.locator('#bl-play').tap();
    await page.locator('#bl-export').tap(); await page.waitForSelector('#bl-exportinfo', { timeout: 30000 }); ok(/tutti validi/.test(await page.locator('#bl-exportinfo').innerText()), 'export WAV con ripiego sintetico valido');
    // rimuovi traccia
    await page.locator('.bl-instrow .btn.danger').first().tap(); ok(await page.locator('.bl-ch select[data-track-inst]').count() === 3, 'rimozione traccia');
  });
  await browser.close(); srv.close(); console.log(fails ? fails + ' PROVE FALLITE' : 'TUTTO OK'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
