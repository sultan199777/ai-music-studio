// Tappa 3 nel browser: tastiera sulla scala, accordi, piano roll, Impara. Uso: NODE_PATH=$(npm root -g) node tests/browser/ui-edit-check.js
const path = require('path');
const { chromium, devices } = require('playwright');
const file = path.join(__dirname, '..', '..', 'dist', 'index.html'); const SHOTS = process.env.SHOTS || '/tmp';
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] }), page = await ctx.newPage(), errs = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|ERR_NAME|ERR_INTERNET/.test(m.text())) errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('file://' + file + '#beatlab'); await page.waitForSelector('#bl-kbd .bl-key');
  const st = () => page.evaluate(() => { const s = window.BeatLabUI.state, p = s.project, T = window.BeatTheory, t = p.tracks.find((x) => x.id === window.BeatLabUI.edit.ED.track); return { key: p.key, notes: t ? t.notes.length : -1, allIn: t ? t.notes.every((n) => T.inScale(p.key, n.n)) : null, tid: t && t.id, tracks: p.tracks.length }; });
  // tastiera
  const keys = await page.evaluate(() => Array.from(document.querySelectorAll('#bl-kbd .bl-key')).map((k) => ({ m: +k.dataset.midi, cls: k.className })));
  const inAll = await page.evaluate(() => Array.from(document.querySelectorAll('#bl-kbd .bl-key')).every((k) => window.BeatTheory.inScale(window.BeatLabUI.state.project.key, +k.dataset.midi)));
  ok(keys.length >= 14 && inAll && keys.every((k) => !/out/.test(k.cls)), 'blocco sulla scala: ' + keys.length + ' tasti, tutti nella scala (' + (await page.locator('.bl-key').first().innerText()).replace('\n', ' ') + ' ...)');
  ok(await page.locator('.bl-key.tonic').count() >= 2, 'la nota di partenza e\' evidenziata');
  await page.locator('#bl-lock').evaluate((e) => e.click()); const free = await page.locator('#bl-kbd .bl-key').count(); ok(free === 25 && await page.locator('.bl-key.out').count() > 5, 'blocco spento: tutte le 25 note, quelle fuori scala scure'); await page.locator('#bl-lock').evaluate((e) => e.click());
  await page.locator('#bl-kbd .bl-key').nth(3).tap(); await page.waitForTimeout(400);
  ok((await st()).tracks >= 8, 'toccando un tasto si crea una traccia strumento se manca (tracce: ' + (await st()).tracks + ')');
  const pk0 = await page.evaluate(async () => { let mx = 0; const k = document.querySelectorAll('#bl-kbd .bl-key'); for (let i = 0; i < 4; i++) { k[i + 2].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); for (let j = 0; j < 8; j++) { mx = Math.max(mx, window.BeatLabUI.state.player.meters().master); await new Promise((r) => setTimeout(r, 25)); } } return mx; });
  ok(pk0 > 0.01, 'toccare i tasti produce suono (picco ' + pk0.toFixed(3) + ')');
  // registrazione
  const n0 = (await st()).notes; await page.locator('#bl-rec').evaluate((e) => e.click()); await page.locator('#bl-play').tap(); await page.waitForTimeout(500);
  for (const i of [0, 2, 4]) { await page.locator('#bl-kbd .bl-key').nth(i + 3).dispatchEvent('pointerdown'); await page.waitForTimeout(260); }
  await page.locator('#bl-play').tap(); const s1 = await st(); ok(s1.notes >= n0 + 3 && s1.allIn, 'registrazione: ' + (s1.notes - n0) + ' note aggiunte, tutte nella scala');
  await page.locator('#bl-rec').evaluate((e) => e.click());
  // accordi
  await page.locator('.chip[data-mood="cupa"]').tap(); ok(/i - VI - VII/.test(await page.locator('#bl-mooddesc').innerText()), 'atmosfera cupa spiegata in una riga: ' + (await page.locator('#bl-mooddesc').innerText()).slice(0, 60));
  const names = await page.locator('#bl-chords .btn').allInnerTexts(); ok(names.length === 4 && /Do min/.test(names[0]), 'accordi: ' + names.map((x) => x.replace(/\n/g, ' ')).join(' | '));
  await page.locator('#bl-writechords').tap(); const s2 = await st(); ok(s2.notes === 6 && s2.allIn, 'progressione scritta: ' + s2.notes + ' note (3 note x 2 battute), tutte nella scala');
  // piano roll: aggiungi, sposta, allunga, cancella
  const box = await page.locator('#bl-roll').boundingBox();
  const click = async (tick, ri) => { await page.locator('#bl-roll').scrollIntoViewIfNeeded(); const b = await page.locator('#bl-roll').boundingBox(); await page.mouse.click(b.x + 54 + tick / 24 * 22 + 3, b.y + 18 + ri * 22 + 11); };
  const before = (await st()).notes; await click(288, 4); const a1 = await st(); ok(a1.notes === before + 1 && a1.allIn, 'piano roll: tocco su spazio vuoto aggiunge una nota (in scala)');
  const note = await page.evaluate(() => { const n = window.BeatLabUI.edit.ED.sel; return n && { t: n.t, d: n.d, n: n.n, v: n.v }; }); ok(note && note.t === 288 && note.t % 24 === 0, 'quantizzata sui sedicesimi: tick ' + (note && note.t));
  const b2 = await page.locator('#bl-roll').boundingBox(); const sx = b2.x + 54 + 288 / 24 * 22 + 8, sy = b2.y + 18 + 4 * 22 + 11;
  await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + 44, sy, { steps: 4 }); await page.mouse.up();
  const mv = await page.evaluate(() => { const n = window.BeatLabUI.edit.ED.sel; return { t: n.t, n: n.n }; }); ok(mv.t === 288 + 48, 'trascinando la nota si sposta di 2 passi (tick ' + mv.t + ')');
  const ex = b2.x + 54 + (mv.t + note.d) / 24 * 22 - 4; await page.mouse.move(ex, sy); await page.mouse.down(); await page.mouse.move(ex + 44, sy, { steps: 4 }); await page.mouse.up();
  const rs = await page.evaluate(() => window.BeatLabUI.edit.ED.sel.d); ok(rs === note.d + 48, 'trascinando il bordo destro si allunga: ' + note.d + ' -> ' + rs);
  await page.locator('#bl-selvel').fill('40'); ok(await page.evaluate(() => window.BeatLabUI.edit.ED.sel.v) === 40, 'forza della nota cambiata a 40');
  await page.locator('#bl-delnote').tap(); ok((await st()).notes === before, 'cancella nota');
  await page.locator('#bl-notedur').selectOption('192'); await click(168, 12); ok(await page.evaluate(() => window.BeatLabUI.edit.ED.sel.d) === 192, 'lunghezza nota scelta: mezza battuta');
  // cambio tonalita'
  await page.locator('#bl-tonic').selectOption('2'); const s3 = await st(); ok(s3.key.root === 2 && s3.allIn, 'cambio tonalita\' a Re: note trasposte e ancora in scala');
  await page.locator('#bl-scale').selectOption('phrygian'); ok((await st()).allIn && /Frigio|scuro/.test(await page.locator('#bl-c-key').innerText()), 'scala frigia: note riportate in scala');
  // Impara
  ok(await page.locator('.bl-learnbox').first().isVisible() === false, 'spiegazioni nascoste di default'); await page.locator('#bl-learnswitch').evaluate((e) => e.click());
  ok(await page.locator('.bl-learnbox:visible').count() >= 12, 'Impara acceso: ' + await page.locator('.bl-learnbox:visible').count() + ' spiegazioni visibili');
  const ex2 = await page.evaluate(async () => { const E = window.BeatEngine, U = window.BeatLabUI.edit, out = {}; for (const k of Object.keys(U.EXAMPLES)) { const segs = U.EXAMPLES[k](); if (!segs) { out[k] = 'strumento'; continue; } let pkm = 0, fin = true, dur = 0; for (const s of segs) { const r = await E.renderOffline(s, { loops: 1, tail: 0.3 }); const a = E.analyzeChannels(r.chans); pkm = Math.max(pkm, a.peak); fin = fin && a.finite; dur += r.buffer.duration; } out[k] = { pk: +pkm.toFixed(2), fin, dur: +dur.toFixed(1) }; } return out; });
  const bad = Object.entries(ex2).filter(([k, v]) => v !== 'strumento' && (!v.fin || v.pk < 0.05)); ok(bad.length === 0, 'tutti gli esempi "Ascolta" producono suono finito: ' + JSON.stringify(ex2));
  await page.locator('[data-example="swing"]').first().tap(); await page.waitForFunction(() => /Suona/.test(document.querySelector('[data-example="swing"]').textContent), null, { timeout: 15000 }); ok(true, 'pulsante "Ascolta esempio" parte');
  ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, 'nessuno scroll orizzontale della pagina');
  await page.locator('#bl-c-roll').scrollIntoViewIfNeeded(); await page.screenshot({ path: SHOTS + '/bl-t3.png' });
  ok(errs.length === 0, 'nessun errore in console' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); console.log(fails ? fails + ' PROVE FALLITE' : 'TUTTO OK'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
