// Tappa 4 nel browser: effetti, sidechain, limiter, misura volume, MIDI, salvataggio IndexedDB. Uso: NODE_PATH=$(npm root -g) node tests/browser/ui-mix-check.js
const path = require('path'), fs = require('fs');
const { chromium, devices } = require('playwright');
const file = path.join(__dirname, '..', '..', 'dist', 'index.html'); const SHOTS = process.env.SHOTS || '/tmp';
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true }), page = await ctx.newPage(), errs = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|ERR_NAME|ERR_INTERNET/.test(m.text())) errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('file://' + file + '#beatlab'); await page.waitForSelector('#bl-fx-track');
  ok(await page.locator('#bl-fx-low').count() === 1 && await page.locator('#bl-m-ceil').count() === 1, 'pannello effetti e master presenti');
  // render offline: effetti cambiano davvero il segnale
  const R = await page.evaluate(async () => {
    const E = window.BeatEngine, P = window.BeatPatterns, M = window.BeatMix;
    const mk = () => { const p = E.newProject({ bpm: 140 }); P.applyStyle(p, 'trap'); return p; };
    const rd = async (p) => { const r = await E.renderOffline(p, { sampleRate: 44100, tail: 1 }); return { m: M.loudness(r.chans, r.sr), fin: r.chans.every((c) => { for (let i = 0; i < c.length; i++) if (!isFinite(c[i])) return false; return true; }), c0: r.chans[0] }; };
    const base = await rd(mk());
    const mu = (p) => { p.tracks.forEach((t) => { if (t.id !== 'd-snare') t.mute = true; }); return p; }; const base1 = await rd(mu(mk())); const pe = mu(mk()); pe.tracks.find((t) => t.id === 'd-snare').fx = Object.assign(E.defaultFx(), { rev: 1 }); const rev = await rd(pe);
    let diffRev = 0; for (let i = 0; i < base.c0.length; i++) diffRev += Math.abs(base1.c0[i] - rev.c0[i]);
    // coda: riverbero allunga la coda dopo l'ultimo colpo? confronto energia nell'ultimo secondo
    const tailE = (c) => { let e = 0; for (let i = c.length - 44100; i < c.length; i++) e += c[i] * c[i]; return e; };
    const pq = mk(); const b = E.newInstTrack('sub808'); b.notes = [{ t: 0, d: 384 * 2, n: 36, v: 110, s: 0 }]; pq.tracks.push(b);
    const pq2 = JSON.parse(JSON.stringify(pq)); pq2.tracks.find((t) => t.kind === 'inst').fx = Object.assign(E.defaultFx(), { sc: 1 });
    pq.tracks.forEach((t) => { if (t.kind === 'drum' && t.lane !== 'kick') t.mute = true; }); pq2.tracks.forEach((t) => { if (t.kind === 'drum' && t.lane !== 'kick') t.mute = true; }); pq.tracks.find((t) => t.id === 'd-kick').mute = true; pq2.tracks.find((t) => t.id === 'd-kick').mute = true;
    const A = await rd(pq), B = await rd(pq2);
    const eq = mk(); eq.tracks.forEach((t) => { t.fx = Object.assign(E.defaultFx(), { eq: { low: 12, mid: 0, high: 0 } }); }); const Q = await rd(eq);
    const loud = mk(); loud.master.vol = 1.2; loud.tracks.forEach((t) => { t.vol = 1.5; }); loud.master.ceil = -3; const L = await rd(loud);
    return { base: base.m, rev: rev.m, diffRev, tailBase: tailE(base1.c0), tailRev: tailE(rev.c0), A: A.m, B: B.m, Aenv: A.c0, fin: [base.fin, rev.fin, A.fin, B.fin, Q.fin, L.fin], Q: Q.m, L: L.m };
  });
  ok(R.fin.every(Boolean), 'tutti i render hanno valori finiti');
  ok(R.diffRev > 1, 'il riverbero cambia il segnale (differenza ' + R.diffRev.toFixed(1) + ')');
  ok(R.tailRev > R.tailBase * 1.2, 'il riverbero allunga la coda (energia ultimo secondo ' + R.tailBase.toExponential(2) + ' -> ' + R.tailRev.toExponential(2) + ')');
  ok(R.B.lufs < R.A.lufs - 0.3, 'sidechain: il basso con sidechain e\' piu\' basso (' + R.A.lufs.toFixed(1) + ' -> ' + R.B.lufs.toFixed(1) + ' LUFS)');
  ok(R.Q.lufs > R.base.lufs - 30 && isFinite(R.Q.lufs), 'EQ +12 dB sui bassi: render valido (' + R.Q.lufs.toFixed(1) + ' LUFS)');
  ok(R.L.peakDb <= -2.9 && R.L.truePeakDb <= -2.0, 'limiter con tetto -3 dB: picco ' + R.L.peakDb.toFixed(2) + ' dBFS, picco reale stimato ' + R.L.truePeakDb.toFixed(2));
  ok(R.base.peakDb <= -0.9, 'tetto predefinito -1 dB rispettato: picco ' + R.base.peakDb.toFixed(2) + ' dBFS, volume ' + R.base.lufs.toFixed(1) + ' LUFS');
  // UI: sidechain cambia, preset
  await page.locator('#bl-fx-track').selectOption('d-snare'); await page.locator('#bl-fx-sat').evaluate((e) => { e.value = 0.6; e.dispatchEvent(new Event('input', { bubbles: true })); });
  ok((await page.evaluate(() => window.BeatLabUI.state.project.tracks.find((t) => t.id === 'd-snare').fx.sat)) === 0.6, 'slider saturazione scrive nel progetto');
  await page.locator('#bl-fx-all').tap(); ok(await page.evaluate(() => { const p = window.BeatLabUI.state.project, b = p.tracks.find((t) => t.inst === 'sub808'); return !b || b.fx.sc > 0; }), 'valori di partenza applicati a tutte le tracce');
  // suono dal vivo con effetti: meter finito e > 0
  await page.locator('#bl-play').tap(); await page.waitForTimeout(1500);
  const live = await page.evaluate(() => window.BeatLabUI.state.player.meters()); await page.locator('#bl-play').tap();
  ok(isFinite(live.master) && live.master > 0.005, 'ascolto dal vivo con effetti: picco master ' + live.master.toFixed(3));
  // misura volume
  await page.locator('#bl-measure').tap(); await page.waitForSelector('#bl-loudinfo', { timeout: 30000 }); ok(/LUFS/.test(await page.locator('#bl-loudinfo').innerText()), 'misura volume: ' + (await page.locator('#bl-loudinfo').innerText()).slice(0, 90));
  // MIDI
  await page.locator('#bl-midi').tap(); await page.waitForSelector('#bl-dl-midi');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#bl-dl-midi').evaluate((e) => e.click())]); const fp = await dl.path(); const buf = fs.readFileSync(fp);
  const MI = require(path.join(__dirname, '..', '..', 'src', 'beatlab-midi.js')); let m = null, err = null; try { m = MI.parse(new Uint8Array(buf)); } catch (e) { err = e.message; }
  ok(m && m.format === 1 && m.ppq === 96 && m.tracks.every((t) => t.ended) && m.tracks.some((t) => t.events.some((e) => e.type === 'on')), 'MIDI scaricato valido: ' + buf.length + ' byte, ' + (m ? m.tracks.length + ' tracce' : err));
  // IndexedDB
  await page.locator('#bl-pname').fill('Prova IDB'); await page.locator('#bl-psave').tap(); await page.waitForSelector('[data-pid]');
  const before = await page.evaluate(() => JSON.stringify(window.BeatLabUI.state.project));
  await page.locator('#bl-bpm').fill('99'); await page.locator('#bl-bpm').dispatchEvent('change');
  await page.locator('[data-open]').first().tap(); await page.waitForTimeout(500);
  const after = await page.evaluate(() => JSON.stringify(window.BeatLabUI.state.project));
  ok(JSON.parse(after).bpm === JSON.parse(before).bpm && JSON.parse(after).name === 'Prova IDB', 'salva in IndexedDB e riapri: BPM ' + JSON.parse(after).bpm + ' ripristinato');
  ok(await page.evaluate(() => !!window.indexedDB), 'usato IndexedDB vero');
  await page.reload(); await page.waitForSelector('[data-pid]'); ok(await page.locator('[data-pid]').count() === 1, 'il progetto sopravvive al ricaricamento');
  await page.locator('[data-del]').first().tap(); await page.waitForTimeout(300); ok(await page.locator('[data-pid]').count() === 0, 'cancellazione ok');
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ok(ov <= 1, 'nessuno scroll orizzontale (' + ov + ')');
  await page.locator('#bl-c-fx').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(SHOTS, 'bl-t4.png') });
  ok(errs.length === 0, 'nessun errore in console' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close(); console.log(fails ? 'ERRORI: ' + fails : 'TUTTO OK'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
