// Prova dell'interfaccia Beat Lab in Chromium con iPhone emulato (touch). Uso: NODE_PATH=$(npm root -g) node tests/browser/ui-check.js [file.html]
const path = require('path'), fs = require('fs');
const { chromium, devices } = require('playwright');
const file = process.argv[2] || path.join(__dirname, '..', '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS || '/tmp';
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_INTERNET|ERR_NAME|Failed to load resource/.test(m.text())) errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('file://' + file + '#beatlab'); await page.waitForSelector('#bl-grid .bl-cell');
  const S = () => page.evaluate(() => { const s = window.BeatLabUI.state; return { bpm: s.project.bpm, playing: s.player.playing, style: s.project.style, kit: s.project.kit }; });
  ok(await page.locator('#bl-grid .bl-row').count() === 6, 'sei righe di batteria');
  ok(await page.locator('#bl-grid .bl-cell').count() === 6 * 16, 'una battuta = 6x16 quadrati');
  ok(await page.locator('#v-beatlab').isVisible(), 'la pagina #beatlab e\' visibile');
  // menu
  await page.goto('file://' + file + '#menu'); ok(await page.locator('#menu-grid a[href="#beatlab"]').count() === 1, 'voce Beat Lab nel menu'); await page.goto('file://' + file + '#beatlab'); await page.waitForSelector('#bl-grid .bl-cell');
  // tocco su un quadrato vuoto = nota; poi di nuovo = tolta
  const cell = page.locator('.bl-row[data-track="d-clap"] .bl-cell[data-i="3"]');
  const was = await cell.evaluate((e) => e.classList.contains('on'));
  await cell.tap(); ok(await cell.evaluate((e) => e.classList.contains('on')) !== was, 'tocco: il colpo si accende/spegne');
  await page.locator('#bl-undo').tap(); ok(await page.locator('.bl-row[data-track="d-clap"] .bl-cell[data-i="3"]').evaluate((e) => e.classList.contains('on')) === was, 'annulla ripristina');
  // play
  await page.locator('#bl-play').tap(); await page.waitForTimeout(1800);
  ok((await S()).playing, 'suona (Player attivo)');
  const m = await page.evaluate(() => window.BeatLabUI.state.player.meters()); const mx = Math.max(...Object.values(m));
  const peakNow = await page.evaluate(async () => { let mx = 0; for (let i = 0; i < 40; i++) { const m = window.BeatLabUI.state.player.meters(); mx = Math.max(mx, m.master); await new Promise((r) => setTimeout(r, 40)); } return mx; });
  ok(peakNow > 0.05 && peakNow <= 1.001, 'misuratore master vede suono: picco ' + peakNow.toFixed(3));
  ok(await page.locator('.bl-cell.now').count() > 0, 'il cursore di riproduzione si muove (' + await page.locator('.bl-cell.now').count() + ' celle)');
  const ctxState = await page.evaluate(() => window.BeatLabUI.state.player.ctx.state); ok(ctxState === 'running', 'AudioContext running');
  // cambio bpm / swing / stile mentre suona
  await page.locator('#bl-bpm').fill('128'); await page.locator('#bl-bpm').dispatchEvent('change'); ok((await S()).bpm === 128, 'BPM cambiato a 128');
  await page.locator('.chip[data-style="drill"]').tap(); ok((await S()).style === 'drill', 'stile drill applicato');
  await page.locator('#bl-rand').tap(); ok((await S()).playing, 'casuale mentre suona: continua');
  await page.waitForTimeout(600);
  // mute kick -> misuratore kick a zero
  await page.locator('.bl-ch[data-ch="d-kick"] .bl-ms').first().tap();
  ok(await page.evaluate(() => window.BeatLabUI.state.project.tracks.find((t) => t.lane === 'kick').mute === true), 'muto sulla cassa');
  await page.locator('#bl-play').tap(); await page.waitForTimeout(200); ok(!(await S()).playing, 'stop');
  // esportazione
  await page.locator('#bl-export').tap(); await page.waitForSelector('#bl-exportinfo', { timeout: 20000 });
  const info = await page.locator('#bl-exportinfo').innerText(); console.log('   ' + info);
  const wav = await page.evaluate(async () => { const a = document.querySelector('#bl-exportout audio'); const b = new Uint8Array(await (await fetch(a.src)).arrayBuffer()); return { h: window.BeatEngine.parseWav(b), an: Array.from(b.slice(0, 4)) }; });
  ok(wav.h && wav.h.ch === 2 && wav.h.sr === 44100 && wav.h.bits === 16 && wav.h.frames > 44100, 'file WAV scaricabile valido: ' + JSON.stringify(wav.h));
  ok(/valori tutti validi/.test(info), 'valori finiti');
  // lunghezza 32 passi
  await page.locator('#bl-len').selectOption('2x32'); ok(await page.locator('#bl-grid .bl-cell').count() === 6 * 32, '32 passi: 6x32 quadrati');
  await page.locator('.bl-modeseg button[data-v="rullata"]').tap(); const c2 = page.locator('.bl-row[data-track="d-hat"] .bl-cell[data-i="1"]'); await c2.tap(); ok(/×2/.test(await page.locator('.bl-row[data-track="d-hat"] .bl-cell[data-i="1"]').innerText()), 'rullata x2 su hi-hat');
  // nessuno scroll orizzontale della pagina
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(sw <= 1, 'nessuno scroll orizzontale della pagina (' + sw + 'px)');
  await page.screenshot({ path: SHOTS + '/bl-t1.png', fullPage: false });
  ok(errs.length === 0, 'nessun errore in console' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); console.log(fails ? fails + ' PROVE FALLITE' : 'TUTTO OK'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
