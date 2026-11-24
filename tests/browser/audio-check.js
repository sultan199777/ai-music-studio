// Prova nel browser vero (Chromium): rende ogni stile con OfflineAudioContext e misura picchi, silenzi, valori finiti.
// Uso: NODE_PATH=$(npm root -g) node tests/browser/audio-check.js
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', '..');
const rd = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_INTERNET|ERR_NAME|Failed to load resource/.test(m.text())) errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(String(e)));
  const files = ['samples-data.js', 'beatlab-voices.js', 'beatlab-engine.js', 'beatlab-patterns.js'].concat(process.argv.slice(2));
  await page.setContent('<html><body></body></html>');
  for (const f of files) await page.addScriptTag({ content: rd(f) });
  const res = await page.evaluate(async () => {
    const E = window.BeatEngine, P = window.BeatPatterns, out = [];
    for (const id of P.STYLE_IDS) for (const kit of ['sintetico', 'kitA']) {
      const p = E.newProject(); P.applyStyle(p, id); p.kit = kit;
      const r = await E.exportWav(p, { sampleRate: 44100, loops: 1, tail: 1 });
      const h = E.parseWav(r.wav);
      out.push({ id, kit, peakDb: +r.report.peakDb.toFixed(2), rms: +r.report.rms.toFixed(4), finite: r.report.finite, first: r.report.firstSound, silent: +r.report.silentRatio.toFixed(2), frames: h.frames, bytes: r.wav.length, expectFrames: Math.ceil((p.bars * 4 * 60 / p.bpm + 1) * 44100) });
    }
    // ogni traccia da sola: deve produrre suono (tranne se vuota)
    const p = E.newProject(); P.applyStyle(p, 'trap'); const per = {};
    for (const t of p.tracks) { const q = JSON.parse(JSON.stringify(p)); q.tracks.forEach((x) => { x.solo = x.id === t.id; }); const r = await E.exportWav(q, { loops: 1, tail: 0.5 }); per[t.id] = +r.report.peakDb.toFixed(1); }
    return { out, per };
  });
  console.log(JSON.stringify(res.per));
  let bad = 0;
  for (const r of res.out) {
    const ok = r.finite && r.peakDb > -30 && r.peakDb <= 0.01 && r.first >= 0 && r.silent < 0.95 && Math.abs(r.frames - r.expectFrames) <= 1;
    if (!ok) bad++;
    console.log((ok ? 'OK  ' : 'KO  ') + r.id.padEnd(12) + r.kit.padEnd(9) + 'picco ' + r.peakDb + ' dBFS  rms ' + r.rms + '  silenzio ' + r.silent + '  primo suono ' + r.first + '  frame ' + r.frames + '/' + r.expectFrames);
  }
  console.log('errori in console:', errs.length ? errs : 'nessuno');
  await browser.close(); process.exit(bad || errs.length ? 1 : 0);
})();
