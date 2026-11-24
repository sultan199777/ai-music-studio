const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../src/voice-chain.js');
const T = require('../src/autotune.js');
const F = require('../src/formant.js');
const A = require('../src/audio-analysis.js');
const { voice, melody, std, midiBetween } = require('./_voice-synth.js');

const SR = 22050;
const finite = (x) => { for (let i = 0; i < x.length; i++) if (!Number.isFinite(x[i])) return false; return true; };
const peak = (x) => { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); return p; };
const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
// energia (dB) in una banda e in un intervallo di tempo, con FFT a finestre (Welch semplice)
function bandDb(x, sr, f1, f2, t0, t1) {
  const N = 2048, a = Math.floor((t0 || 0) * sr), b = Math.min(x.length, Math.floor((t1 == null ? x.length / sr : t1) * sr));
  let e = 0;
  for (let st = a; st + N <= b; st += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[st + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
    F.fft(re, im, false);
    for (let k = 1; k < N / 2; k++) { const f = k * sr / N; if (f >= f1 && f <= f2) e += re[k] * re[k] + im[k] * im[k]; }
  }
  return 10 * Math.log10(Math.max(e, 1e-20));
}
function noise(n, seed, amp) { let s = seed; const o = new Float32Array(n); for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; o[i] = amp * (s / 4294967296 - 0.5) * 2; } return o; }
function hpNoise(n, sr, seed, amp, fc) { return V.stages.eq2 && (function () { const y = noise(n, seed, amp); return require('../src/polish.js').highpass(require('../src/polish.js').highpass(y, sr, fc), sr, fc); })(); }

test('pulizia: taglia il rombo sotto 90 Hz e riduce il fruscio di fondo senza toccare la voce', () => {
  const sr = SR, n = sr * 3, x = new Float32Array(n);
  const v = melody([[null, 1], [57, 1, 0], [null, 1]], sr, { amp: 0.4 });
  for (let i = 0; i < n; i++) x[i] = v[i] + 0.2 * Math.sin(2 * Math.PI * 40 * i / sr) + 0.01 * (Math.sin(i * 12.9898) * 43758.5453 % 1);
  const y = V.stages.clean(x, sr, { hp: 90, denoiseDb: 0 }, {});
  assert.ok(bandDb(x, sr, 30, 50) - bandDb(y, sr, 30, 50) > 15, 'rombo');
  const z = V.stages.clean(x, sr, { hp: 90, denoiseDb: 18 }, {});
  assert.ok(bandDb(y, sr, 2000, 9000, 0.1, 0.9) - bandDb(z, sr, 2000, 9000, 0.1, 0.9) > 8, 'fruscio nei silenzi');
  assert.ok(Math.abs(bandDb(y, sr, 200, 1000, 1.2, 1.8) - bandDb(z, sr, 200, 1000, 1.2, 1.8)) < 1.5, 'voce intatta');
  assert.ok(finite(z));
});

test('de-esser: abbassa la banda alta sulle "S" e lascia intatta la voce', () => {
  const sr = 44100, dur = 2, n = sr * dur, vow = melody([[52, 2, 0]], sr, { amp: 0.3 }), hn = hpNoise(n, sr, 5, 0.5, 5000), x = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / sr, burst = (t > 0.8 && t < 1.1) ? 1 : 0; x[i] = vow[i] + hn[i] * burst; }
  const rep = {}, y = V.stages.deess(x, sr, { freq: 6500, amount: 0.8 }, rep);
  const hiBefore = bandDb(x, sr, 5500, 12000, 0.85, 1.05), hiAfter = bandDb(y, sr, 5500, 12000, 0.85, 1.05);
  assert.ok(hiBefore - hiAfter > 5, 'banda alta ridotta di ' + (hiBefore - hiAfter).toFixed(1) + ' dB');
  const loBefore = bandDb(x, sr, 100, 1500, 0.1, 0.7), loAfter = bandDb(y, sr, 100, 1500, 0.1, 0.7);
  assert.ok(Math.abs(loBefore - loAfter) < 0.5, 'voce toccata di ' + (loBefore - loAfter));
  assert.ok(rep.deessMaxReductionDb > 4);
  const weak = {}; V.stages.deess(x, sr, { freq: 6500, amount: 0.05 }, weak);
  assert.ok(weak.deessMaxReductionDb < rep.deessMaxReductionDb, 'amount regola la forza');
  assert.ok(finite(y));
});

test('compressore: riduce i picchi, non tocca i passaggi piano, rispetta soglia e rapporto', () => {
  const sr = SR, n = sr * 3, x = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / sr, a = t < 1 ? 0.03 : t < 2 ? 0.8 : 0.03; x[i] = a * Math.sin(2 * Math.PI * 220 * i / sr); }
  const r = V.stages.compressor(x, sr, { thresholdDb: -20, ratio: 4, attackMs: 5, releaseMs: 100, kneeDb: 0, makeupDb: 0 });
  const seg = (a, t0, t1) => peak(a.subarray(Math.floor(t0 * sr), Math.floor(t1 * sr)));
  const loud = db(seg(r.y, 1.3, 1.9)) - db(seg(x, 1.3, 1.9)), quiet = db(seg(r.y, 0.3, 0.9)) - db(seg(x, 0.3, 0.9));
  // ingresso a -2 dB, soglia -20: 18 dB sopra, a 4:1 restano 4,5 dB -> riduzione attesa ~13,5 dB
  assert.ok(loud < -11 && loud > -16, 'riduzione sul forte ' + loud.toFixed(1));
  assert.ok(Math.abs(quiet) < 0.3, 'il piano non cambia: ' + quiet.toFixed(2));
  assert.ok(r.maxReductionDb > 11 && r.maxReductionDb < 16);
  assert.ok(peak(r.y) < peak(x));
  // la fase completa riporta il volume medio e riduce la dinamica (picco/RMS)
  const rep = {}, y = V.stages.comp(x, sr, { thresholdDb: -20, ratio: 4, attackMs: 5, releaseMs: 150, peakDb: -8, makeupDb: 0 }, rep);
  assert.ok(rep.compMaxReductionDb > 8 && finite(y));
});

test('saturazione e distorsione: aggiungono armoniche, nessun valore fuori scala', () => {
  const sr = 44100, x = new Float32Array(sr * 2); for (let i = 0; i < x.length; i++) x[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / sr);
  const s = V.stages.sat(x, sr, { drive: 0.8, mix: 1 }, {}), d = V.stages.dist(x, sr, { amount: 0.6, mix: 1, toneHz: 6000 }, {});
  for (const y of [s, d]) {
    assert.ok(finite(y)); assert.ok(peak(y) < 2);
    const h = bandDb(y, sr, 1300, 1340) - bandDb(y, sr, 430, 450), h0 = bandDb(x, sr, 1300, 1340) - bandDb(x, sr, 430, 450);
    assert.ok(h - h0 > 25, 'terza armonica aumentata di ' + (h - h0).toFixed(1) + ' dB');
  }
  const z = V.stages.sat(x, sr, { drive: 0.8, mix: 0 }, {}); assert.ok(z.every((v, i) => Math.abs(v - x[i]) < 1e-6), 'mix 0 = invariato');
});

test('EQ e filtri: la presenza sale, il filtro telefono taglia bassi e alti', () => {
  const sr = 44100, x = noise(sr * 2, 3, 0.2);
  const y = V.stages.eq2(x, sr, { presenceDb: 6, airDb: 0, lowDb: 0, darkHz: 0 });
  const dPres = bandDb(y, sr, 3000, 4000) - bandDb(x, sr, 3000, 4000), dLow = bandDb(y, sr, 200, 800) - bandDb(x, sr, 200, 800);
  assert.ok(dPres > 3.5 && dPres < 8, 'presenza ' + dPres.toFixed(1));
  assert.ok(Math.abs(dLow) < 0.8, 'bassi invariati ' + dLow.toFixed(1));
  const t = V.stages.filter(x, sr, { type: 'telefono', freq: 2500 });
  assert.ok(bandDb(x, sr, 50, 150) - bandDb(t, sr, 50, 150) > 15 && bandDb(x, sr, 6000, 12000) - bandDb(t, sr, 6000, 12000) > 15);
  const k = V.stages.eq2(x, sr, { presenceDb: 0, airDb: 0, lowDb: 0, darkHz: 4000 });
  assert.ok(bandDb(x, sr, 8000, 15000) - bandDb(k, sr, 8000, 15000) > 10);
});

test('doppie voci (ADT): copie ritardate 13-25 ms, più forti nel ritardo = più energia, nessun NaN', () => {
  const sr = 44100, x = new Float32Array(sr); x[5000] = 1;
  for (const seed of [1, 2, 3, 4, 5]) {
    const y = V.stages.doubles(x, sr, { count: 1, gainDb: -6, delayMs: 19, modMs: 0, seed }, {});
    let best = 0, bi = 0; for (let i = 5100; i < y.length; i++) if (Math.abs(y[i]) > best) { best = Math.abs(y[i]); bi = i; }
    const ms = (bi - 5000) / sr * 1000;
    assert.ok(ms >= 13 && ms <= 25, 'ritardo ' + ms.toFixed(1) + ' ms (seed ' + seed + ')');
    assert.ok(finite(y) && y[5000] > 0.99);
  }
  const v = melody([[57, 1, 0]], sr, { amp: 0.3 }), d = V.stages.doubles(v, sr, { count: 2, gainDb: -8, delayMs: 19, modMs: 0.8, seed: 3 }, {});
  assert.ok(d.length === v.length && finite(d) && Math.abs(V.gatedRmsDb(d, sr) - V.gatedRmsDb(v, sr)) > 0.2 && V.gatedRmsDb(d, sr) < V.gatedRmsDb(v, sr) + 4, 'doppie: livello ' + V.gatedRmsDb(d, sr) + ' vs ' + V.gatedRmsDb(v, sr));
});

test('armonie: copie sulla terza/quinta della scala, ritardo casuale 10-30 ms, tonalità incerta = non applicate', () => {
  const x = melody([[60, 0.7, 0], [64, 0.7, 0], [67, 0.7, 0], [62, 0.7, 0]], SR);
  const trk = T.track(x, SR), rep = { warnings: [] };
  const y = V.stages.harmony(x, SR, { voices: 1, gainDb: 0, seed: 5 }, { scaleKnown: true, tonic: 0, mode: 'maggiore', track: trk }, rep);
  assert.ok(finite(y) && y.length === x.length);
  assert.ok(rep.harmonyDelaysMs.every(d => d >= 10 && d <= 30), JSON.stringify(rep.harmonyDelaysMs));
  const h = new Float32Array(x.length); for (let i = 0; i < x.length; i++) h[i] = y[i] - x[i];
  const ht = T.track(h, SR), want = [[0.15, 0.6, 64], [0.85, 1.3, 67], [1.55, 2.0, 71], [2.25, 2.7, 65]];
  want.forEach(([a, b, m]) => { const md = mean(midiBetween(ht, a + 0.03, b - 0.03)); assert.ok(Math.abs(md - m) < 0.35, 'nota ' + m + ' trovata ' + md.toFixed(2)); });
  const rep2 = { warnings: [] }, y2 = V.stages.harmony(x, SR, { voices: 2, gainDb: -10 }, { scaleKnown: false }, rep2);
  assert.ok(rep2.warnings.length === 1 && y2.every((v, i) => v === x[i]));
});

test('eco e riverbero: ripetizioni al tempo giusto che calano; coda che decade; nessun NaN', () => {
  const sr = 44100, x = new Float32Array(sr); x[2000] = 1;
  const d = V.stages.delay(x, sr, { timeMs: 250, sync: false, feedback: 0.5, mix: 0.5, lowPassHz: 6000 }, {});
  const at = (ms) => { const c = 2000 + Math.round(ms * sr / 1000); let m = 0; for (let i = c - 60; i < c + 60; i++) m = Math.max(m, Math.abs(d[i])); return m; };
  assert.ok(at(250) > 0.05 && at(500) > 0.005 && at(500) < at(250), 'eco ' + at(250) + ' ' + at(500));
  assert.ok(at(125) < at(250) * 0.2, 'niente eco a metà tempo');
  const dy = V.stages.delay(x, sr, { timeMs: 100, sync: true, feedback: 0.3, mix: 0.3 }, { bpm: 120 });
  const c2 = 2000 + Math.round(0.75 * 500 * sr / 1000), w = (() => { let m = 0; for (let i = c2 - 60; i < c2 + 60; i++) m = Math.max(m, Math.abs(dy[i])); return m; })();
  assert.ok(w > 0.03, 'sync a 120 BPM = croma puntata (375 ms)');
  const r = V.stages.reverb(x, sr, { mix: 0.3, decaySec: 1.0, preDelayMs: 10, lowCutHz: 200, highCutHz: 8000 });
  assert.ok(finite(r) && r.length > x.length + sr * 0.8);
  const e = (a, b) => { let s = 0; for (let i = Math.round(a * sr); i < Math.round(b * sr); i++) s += r[i] * r[i]; return 10 * Math.log10(s + 1e-20); };
  const drop = e(0.1, 0.2) - e(0.6, 0.7);
  assert.ok(drop > 10 && drop < 45, 'decadimento ' + drop.toFixed(1) + ' dB in 0,5 s (RT60 = 1 s attesi circa 30)');
  assert.ok(e(0.1, 0.2) > e(0.9, 1.0));
  const rl = V.stages.reverb(x, sr, { mix: 0.3, decaySec: 2.5, preDelayMs: 10, lowCutHz: 200, highCutHz: 8000 });
  const el = (a, b) => { let s = 0; for (let i = Math.round(a * sr); i < Math.round(b * sr); i++) s += rl[i] * rl[i]; return 10 * Math.log10(s + 1e-20); };
  assert.ok(el(0.9, 1.0) > e(0.9, 1.0) + 3, 'decaySec più lungo = coda più lunga');
});

test('limitatore e livello finale: nessun campione sopra il tetto, volume medio al bersaglio', () => {
  const sr = SR, x = melody([[57, 1, 0], [60, 1, 0]], sr, { amp: 0.9, vibCents: 10 });
  const L = V.stages.limiter(x.map(v => v * 4), sr, 0.8912);
  assert.ok(peak(L.y) <= 0.8913);
  assert.ok(L.maxReductionDb > 6);
  const all = V.render(x, sr, V.buildParams({ ids: ['naturale'] }).params, { bpm: 90 });
  assert.ok(db(peak(all.samples)) <= -0.99, 'picco ' + db(peak(all.samples)));
  assert.ok(Math.abs(all.report.outputRmsDb - -19) < 2, 'livello ' + all.report.outputRmsDb);
});

test('tutti i caratteri: nessun NaN, picco sotto -1 dBFS, risultato ripetibile', () => {
  const x = melody([[57, 0.8, -25], [60, 0.8, 20], [64, 0.8, -15], [62, 0.8, 30], [60, 0.8, 0]], SR, { vibCents: 18, noise: 0.002 });
  assert.equal(V.CHARACTERS.length, 13);
  V.CHARACTERS.forEach(c => {
    const b = V.buildParams({ ids: [c.id] }), r = V.render(x, SR, b.params, { bpm: 95 });
    assert.ok(finite(r.samples), c.id + ' NaN'); assert.ok(db(peak(r.samples)) <= -0.99, c.id + ' picco ' + db(peak(r.samples)));
    assert.equal(r.report.nanFixed || 0, 0, c.id + ' campioni corretti');
    assert.ok(r.samples.length >= x.length);
    const r2 = V.render(x, SR, b.params, { bpm: 95 });
    assert.ok(r.samples.length === r2.samples.length && r.samples.every((v, i) => v === r2.samples[i]), c.id + ' non ripetibile');
  });
  // combinazione di più caratteri
  const mix = V.buildParams({ ids: ['robotico', 'scuro', 'doppie', 'armonie'] }), rm = V.render(x, SR, mix.params, { bpm: 95 });
  assert.ok(finite(rm.samples) && db(peak(rm.samples)) <= -0.99);
  assert.ok(mix.params.doubles.on && mix.params.harmony.on && mix.params.tune.classic);
});

test('i caratteri cambiano davvero il suono (misurato)', () => {
  const x = melody([[57, 1.2, -25], [60, 1.2, 20], [64, 1.2, -15]], SR, { vibCents: 30, noise: 0.001 });
  const run = (ids, extra) => V.render(x, SR, V.buildParams(Object.assign({ ids, keyOverride: { tonic: 9, mode: 'minore' } }, extra || {})).params, { bpm: 95 });
  const vibStd = (r) => std(midiBetween(T.track(r.samples, SR), 0.35, 1.0).map(m => m * 100));
  const nat = run(['naturale']), rob = run(['robotico']);
  assert.ok(vibStd(nat) > vibStd(rob) * 1.5 && vibStd(rob) < 12, 'vibrato naturale ' + vibStd(nat).toFixed(1) + ' robot ' + vibStd(rob).toFixed(1));
  const err = (r) => T.measure(r.samples, SR, { tonic: 0, mode: 'maggiore' }).centerCents;
  const errIn = T.measure(x, SR, { tonic: 0, mode: 'maggiore' }).centerCents;
  assert.ok(err(rob) < errIn * 0.4, 'errore ' + errIn.toFixed(1) + ' -> ' + err(rob).toFixed(1) + ' cent');
  const cen = (r) => bandDb(r.samples, SR, 2500, 10000) - bandDb(r.samples, SR, 100, 800);
  const dark = run(['scuro']), bright = run(['brillante']);
  assert.ok(cen(bright) > cen(dark) + 4, 'luminosità: brillante ' + cen(bright).toFixed(1) + ' scuro ' + cen(dark).toFixed(1));
  const noRev = run(['naturale'], { macros: { space: 0 } }), big = run(['naturale'], { macros: { space: 100 } });
  assert.ok(big.samples.length > noRev.samples.length + SR * 0.5, 'più spazio = coda più lunga');
});

test('cursori semplici e parametri: mappatura, limiti, salvataggio', () => {
  const m = (o) => V.buildParams({ ids: ['naturale'], macros: o }).params;
  assert.equal(m({ robotic: 100 }).tune.retuneMs, 0); assert.equal(m({ robotic: 100 }).tune.classic, true);
  assert.ok(m({ robotic: 0 }).tune.retuneMs >= 60 && m({ robotic: 0 }).tune.classic === false);
  assert.ok(m({ robotic: 50 }).tune.retuneMs > 5 && m({ robotic: 50 }).tune.retuneMs < 40);
  assert.ok(m({ timbre: 100 }).tune.formantSemitones > 3.5 && m({ timbre: 0 }).tune.formantSemitones < -3.5 && m({ timbre: 50 }).tune.formantSemitones === 0);
  assert.equal(m({ space: 0 }).reverb.on, false); assert.ok(m({ space: 100 }).reverb.mix > m({ space: 30 }).reverb.mix);
  assert.ok(m({ intensity: 20 }).tune.strength < m({ intensity: 90 }).tune.strength);
  assert.ok(m({ natural: 100 }).tune.vibrato > m({ natural: 0 }).tune.vibrato);
  // combinazione: timbro = somma degli scostamenti, spazio = massimo
  const c = V.combineMacros(['scuro', 'brillante']); assert.equal(c.timbre, 50 + (20 - 50) + (75 - 50)); assert.equal(c.space, 30);
  assert.deepEqual(V.buildParams({ ids: ['xxx'] }).ids, []);
  // sanitize: fuori limite, NaN, sconosciuti
  const s = V.sanitize({ tune: { retuneMs: 99999, strength: NaN, humanize: -3 }, eq: { airDb: 50 }, filter: { type: 'bah' }, finto: { x: 1 } });
  assert.equal(s.tune.retuneMs, 200); assert.equal(s.tune.strength, V.DEFAULTS.tune.strength); assert.equal(s.tune.humanize, 0); assert.equal(s.eq.airDb, 8); assert.equal(s.filter.type, 'telefono'); assert.equal(s.finto, undefined);
  V.SPEC.forEach(sp => assert.ok(sp[4] && sp[0].indexOf('.') > 0, 'spec ' + sp[0]));
  // salva e ricarica
  const st = { ids: ['scuro', 'doppie'], macros: { space: 77, timbre: 33 }, advanced: { tune: { retuneMs: 12 }, eq: { airDb: 99 } }, name: 'Il mio' };
  const back = V.parseState(V.serializeState(st));
  assert.deepEqual(back.ids, ['scuro', 'doppie']); assert.equal(back.macros.space, 77); assert.equal(back.advanced.tune.retuneMs, 12); assert.equal(back.advanced.eq.airDb, 8); assert.equal(back.name, 'Il mio');
  assert.equal(V.parseState('non json'), null); assert.equal(V.parseState('{"v":2}'), null);
});

test('Auto: analizza la registrazione e adatta le regolazioni', () => {
  const clean = melody([[null, 0.6], [57, 1, 0], [60, 1, 5], [64, 1, -5], [null, 0.6]], SR, { amp: 0.4, noise: 0.0002 });
  const noisy = melody([[null, 0.6], [57, 1, 0], [60, 1, 5], [64, 1, -5], [null, 0.6]], SR, { amp: 0.15, noise: 0.03 });
  const ic = V.analyzeVoice(clean, SR), inz = V.analyzeVoice(noisy, SR);
  assert.ok(ic.snrDb > inz.snrDb + 15, 'snr ' + ic.snrDb + ' ' + inz.snrDb);
  const ac = V.autoSettings(ic), an = V.autoSettings(inz);
  assert.ok(!(ac.advanced.clean && ac.advanced.clean.denoiseDb > 0), 'pulita: niente riduzione');
  assert.ok(an.advanced.clean.denoiseDb >= 6, 'rumorosa: riduzione ' + JSON.stringify(an.advanced.clean));
  assert.ok(an.notes.some(t => /fruscio/.test(t)));
  assert.ok(ic.medianHz > 200 && ic.medianHz < 340);
  assert.ok(ac.intensityScale < 1 || ic.chromaticErrCents >= 10);
  // sibilanti
  const sib = new Float32Array(SR * 2), hn = hpNoise(SR * 2, SR, 9, 0.5, 5000), vv = melody([[52, 2, 0]], SR, { amp: 0.2 });
  for (let i = 0; i < sib.length; i++) sib[i] = vv[i] + hn[i] * ((i / SR) % 0.5 < 0.2 ? 1 : 0);
  const as = V.autoSettings(V.analyzeVoice(sib, SR));
  assert.ok(as.advanced.deess && as.advanced.deess.amount >= 0.7, 'sibilanti: ' + JSON.stringify(as.advanced.deess) + ' ' + V.analyzeVoice(sib, SR).sibilanceDb);
  // clipping
  const clip = clean.map(v => Math.max(-1, Math.min(1, v * 6)));
  assert.ok(V.autoSettings(V.analyzeVoice(clip, SR)).notes.some(t => /satura/.test(t)));
  // le regolazioni automatiche entrano davvero nei parametri
  const b = V.buildParams({ ids: ['naturale'], auto: an }); assert.ok(b.params.clean.denoiseDb >= 6);
});

test('ascolto Prima/Dopo: volumi pareggiati senza superare il picco', () => {
  const a = melody([[57, 1.5, 0]], SR, { amp: 0.1 }), b = melody([[57, 1.5, 0]], SR, { amp: 0.7 });
  const g = V.matchGains(a, b, SR), ga = a.map(v => v * g.a), gb = b.map(v => v * g.b);
  assert.ok(Math.abs(V.gatedRmsDb(ga, SR) - V.gatedRmsDb(gb, SR)) < 0.3, 'pareggio');
  assert.ok(peak(ga) <= 0.98 && peak(gb) <= 0.98);
  const loud = b.map(v => v * 1.4), g2 = V.matchGains(a, loud, SR);
  assert.ok(peak(loud.map(v => v * g2.b)) <= 0.981);
});

test('render asincrono = render sincrono, con avanzamento; durata su 20 s a 44,1 kHz', async () => {
  const x = melody([[57, 1, -20], [60, 1, 15]], SR, { vibCents: 15 }), b = V.buildParams({ ids: ['melodico'] }).params;
  const seen = [], ra = await V.renderAsync(x, SR, b, { bpm: 90 }, (l, f) => seen.push(l)), rs = V.render(x, SR, b, { bpm: 90 });
  assert.ok(ra.samples.every((v, i) => v === rs.samples[i]) && ra.samples.length === rs.samples.length);
  assert.ok(seen.length >= 6 && seen[seen.length - 1] === 'Fatto');
  const sr = 44100, long = melody(Array.from({ length: 20 }, (_, i) => [[57, 60, 64, 62, 67][i % 5], 1, [-20, 15, -10, 25, 5][i % 5]]), sr, { vibCents: 20, noise: 0.002 });
  const t0 = Date.now(), r = V.render(long, sr, V.buildParams({ ids: ['melodico', 'armonie', 'doppie'], keyOverride: { tonic: 0, mode: 'maggiore' } }).params, { bpm: 90 });
  const ms = Date.now() - t0;
  assert.ok(finite(r.samples) && db(peak(r.samples)) <= -0.99);
  console.log('   (20 s a 44,1 kHz, melodico+armonie+doppie: ' + ms + ' ms; fasi: ' + JSON.stringify(r.report.stageMs) + ')');
});
