// Prova nel browser (Chromium) dei campioni veri: carica da docs/samples via HTTP, decodifica, suona nota per nota in un
// OfflineAudioContext e MISURA: picco, valori finiti, ritardo iniziale del decoder, intonazione (autocorrelazione) e click nei loop.
// Uso: NODE_PATH=$(npm root -g) node tests/browser/samples-check.js
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', '..'), docs = path.join(root, 'docs');
const rd = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const MIME = { '.html': 'text/html', '.json': 'application/json', '.mp3': 'audio/mpeg', '.js': 'text/javascript' };
const srv = http.createServer((q, r) => { const f = path.join(docs, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(docs) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise((r) => srv.listen(0, r)); const port = srv.address().port;
  const browser = await chromium.launch(); const page = await browser.newPage(); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*(ERR_|404)/.test(m.text())) errs.push(m.text()); }); page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://127.0.0.1:' + port + '/samples/manifest.json');
  for (const f of ['samples-data.js', 'beatlab-voices.js', 'beatlab-engine.js', 'beatlab-patterns.js', 'beatlab-sampler.js']) await page.addScriptTag({ content: rd(f) });
  const only = process.argv[2];
  const res = await page.evaluate(async ({ base, only }) => {
    const E = window.BeatEngine, SM = window.BeatSampler, P = window.BeatPatterns, out = [];
    const sp = new SM.Sampler({ base }); await sp.init();
    const ids = Object.keys(sp.manifest.instruments).filter((i) => !only || i === only);
    function detect(x, sr) { // autocorrelazione: altezza MIDI o null
      const st = Math.floor(0.25 * sr), seg = x.slice(st, st + Math.floor(0.4 * sr)); let m = 0; for (const v of seg) m += v; m /= seg.length; for (let i = 0; i < seg.length; i++) seg[i] -= m;
      const n = seg.length, lmin = Math.floor(sr / 2200), lmax = Math.min(n - 2, Math.floor(sr / 25)); let ac0 = 0; for (let i = 0; i < n; i++) ac0 += seg[i] * seg[i]; if (ac0 < 1e-8) return null;
      const r = new Float64Array(lmax + 1); for (let l = lmin; l <= lmax; l++) { let s = 0; for (let i = 0; i + l < n; i++) s += seg[i] * seg[i + l]; r[l] = s / ac0 * (n / (n - l)); }
      let pm = 0; for (let l = lmin; l <= lmax; l++) if (r[l] > pm) pm = r[l]; if (pm < 0.5) return null;
      let c = -1; for (let l = lmin + 1; l < lmax; l++) if (r[l] >= 0.9 * pm && r[l] >= r[l - 1] && r[l] >= r[l + 1]) { c = l; break; } if (c < 0) return null;
      const a = r[c - 1], b = r[c], d = r[c + 1], den = a - 2 * b + d, off = Math.abs(den) > 1e-12 ? 0.5 * (a - d) / den : 0; return 69 + 12 * Math.log2(sr / (c + off) / 440);
    }
    async function render(id, midi, dur, len) {
      const p = E.newProject({ bars: 1 }); p.tracks = []; const t = E.newInstTrack(id, id); t.notes = [{ t: 0, d: Math.round(dur * 192), n: midi, v: 100 }]; p.bpm = 120; p.tracks.push(t); p.master.vol = 1; t.vol = 1;
      const OAC = window.OfflineAudioContext, ctx = new OAC(2, Math.floor(44100 * len), 44100), G = E.createGraph(ctx, p); G.sampler = sp;
      E.playEvent(G, p, { type: 'note', track: t.id, midi, vel: 100, durTicks: Math.round(dur * 192) }, 0.01, 60 / (120 * 96)); const b = await ctx.startRendering(); return { x: b.getChannelData(0), sr: 44100 };
    }
    for (const id of ids) {
      const en = sp.manifest.instruments[id], t0 = performance.now(); await sp.load(id); const ms = Math.round(performance.now() - t0); const I = sp.inst[id];
      let offMax = 0, bad = 0, loopJump = 0; let bytes = 0;
      for (const s of I.samples) { const d = s.buf.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i++) { if (!isFinite(d[i])) bad++; pk = Math.max(pk, Math.abs(d[i])); } if (pk < 0.05 || pk > 1.0001) bad++; offMax = Math.max(offMax, s.off);
        if (s.ls != null) { const sr = s.buf.sampleRate, a = Math.round((s.ls + s.off) * sr), e = Math.round((s.le + s.off) * sr); const jump = Math.abs(d[e - 1] - d[a]); const rms = Math.sqrt(d.slice(a, e).reduce((q, v) => q + v * v, 0) / (e - a)); loopJump = Math.max(loopJump, jump / (rms + 1e-9)); } }
      // intonazione: note a meta' strada fra due radici (caso peggiore) + sulle radici
      const roots = I.samples.map((s) => s.m); const tests = []; for (let i = 0; i < roots.length - 1; i++) tests.push(Math.round((roots[i] + roots[i + 1]) / 2)); tests.push(roots[Math.floor(roots.length / 2)]);
      const errs = []; let silent = 0, peak = 0, fin = true;
      for (const m of tests.slice(0, 14)) { const r = await render(id, m, 1.2, 1.8); let pk = 0; for (const v of r.x) { if (!isFinite(v)) fin = false; pk = Math.max(pk, Math.abs(v)); } peak = Math.max(peak, pk); if (pk < 0.01) silent++; const d = detect(r.x, r.sr); if (d != null) errs.push(Math.round((d - m) * 100)); }
      // click nel loop: nota lunga (sostenuti)
      let click = null; if (en.sustain) { const m = roots[Math.floor(roots.length / 2)], r = await render(id, m, 6, 7); const x = r.x; let s2 = 0, n = 0, mx = 0; const a = Math.floor(0.5 * r.sr), b = Math.floor(6 * r.sr); for (let i = a + 1; i < b; i++) { const d = x[i] - 2 * x[i - 1] + x[i - 2]; s2 += d * d; n++; if (Math.abs(d) > mx) mx = Math.abs(d); } click = +(mx / Math.sqrt(s2 / n)).toFixed(1); }
      out.push({ id, n: I.samples.length, loadMs: ms, offMax: +offMax.toFixed(4), bad, silent, peak: +peak.toFixed(3), fin, loopJump: +loopJump.toFixed(2), click, centsErr: errs, med: errs.length ? Math.round(errs.map(Math.abs).sort((a, b) => a - b)[Math.floor(errs.length / 2)]) : null, sustain: en.sustain });
    }
    // kit
    const kits = []; for (const k of Object.keys(sp.manifest.kits)) { await sp.loadKit(k); const kb = sp.kitBuffers(k); const o = {}; for (const l in kb) { const d = kb[l].getChannelData(0); let pk = 0, fin2 = true; for (const v of d) { if (!isFinite(v)) fin2 = false; pk = Math.max(pk, Math.abs(v)); } o[l] = { pk: +pk.toFixed(2), dur: +(d.length / kb[l].sampleRate).toFixed(2), fin: fin2 }; } kits.push({ k, o }); }
    return { out, kits };
  }, { base: 'http://127.0.0.1:' + port + '/samples/', only });
  let bad = 0;
  for (const r of res.out) {
    const ok = r.bad === 0 && r.silent === 0 && r.fin && r.offMax < 0.03 && (r.click == null || r.click < 40) && r.peak > 0.02;
    if (!ok) bad++;
    console.log((ok ? 'OK  ' : 'KO  ') + r.id.padEnd(11) + (r.n + ' camp.').padEnd(10) + ('carica ' + r.loadMs + ' ms').padEnd(16) + 'ritardo decoder ' + r.offMax + ' s  picco ' + r.peak + '  salto loop ' + r.loopJump + '  click ' + r.click + '  errore altezza (centesimi, mediana assoluta) ' + r.med + ' [' + r.centsErr.join(',') + ']');
  }
  for (const k of res.kits) console.log('kit ' + k.k + ' ' + Object.keys(k.o).map((l) => l + ':' + k.o[l].pk + '/' + k.o[l].dur + 's').join(' '));
  console.log('errori in console:', errs.length ? errs : 'nessuno'); await browser.close(); srv.close(); process.exit(bad || errs.length ? 1 : 0);
})();
