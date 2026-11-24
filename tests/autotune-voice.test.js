const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/audio-analysis.js');
const T = require('../src/autotune.js');
const F = require('../src/formant.js');
const { voice, melody, std, midiBetween } = require('./_voice-synth.js');

const SR = 22050;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const finite = (x) => x.every(Number.isFinite);
const tr = (x, sr) => T.track(x, sr || SR);

test('tracciatore fine: altezza di una nota sintetica entro 5 cent e passo di circa 6 ms', () => {
  const x = melody([[57, 1.2, 0]], SR);
  const t = tr(x);
  assert.ok(Math.abs(t.hopSeconds - 0.006) < 0.002, 'hop ' + t.hopSeconds);
  const m = midiBetween(t, 0.2, 1.0);
  assert.ok(m.length > 80, 'frame ' + m.length);
  assert.ok(Math.abs(mean(m) - 57) < 0.05, 'media ' + mean(m));
});

test('intonazione: errore in cent prima/dopo su voce sintetica stonata (Do maggiore)', () => {
  const notes = [[60, 0.7, -35], [64, 0.7, 28], [67, 0.7, -22], [64, 0.7, 40], [62, 0.7, -30], [60, 0.7, 18]];
  const x = melody(notes, SR, { vibCents: 15 });
  const before = T.measure(x, SR, { tonic: 0, mode: 'maggiore' });
  assert.ok(before.centerCents > 20, 'prima ' + before.centerCents);
  for (const retune of [0, 20]) {
    const r = T.correct(x, SR, { tonic: 0, mode: 'maggiore', strength: 1, retuneMs: retune, vibrato: 1 });
    const after = T.measure(r.samples, SR, { tonic: 0, mode: 'maggiore' });
    assert.ok(after.centerCents < 12, 'retune ' + retune + ': dopo ' + after.centerCents.toFixed(1));
    assert.ok(after.centerCents < before.centerCents * 0.5, 'dimezzato');
    assert.ok(finite(r.samples) && r.samples.length === x.length);
  }
});

test('retune speed: 0 ms arriva sulla nota subito, 100 ms ci mette di più', () => {
  // legato: Do esatto, poi Mi calante di 40 cent (salto netto a t = 0.8)
  const x = melody([[60, 0.8, 0], [64, 1.2, -45]], SR);
  const err = (r, t0, t1) => mean(midiBetween(tr(r.samples), t0, t1).map(m => Math.abs(m - 64) * 100));
  const fast = T.correct(x, SR, { retuneMs: 0, strength: 1 });
  const slow = T.correct(x, SR, { retuneMs: 100, strength: 1 });
  const ef = err(fast, 0.81, 0.87), es = err(slow, 0.81, 0.87);
  assert.ok(ef < 15, 'veloce ' + ef);
  assert.ok(es > ef + 15, 'lento ' + es + ' veloce ' + ef);
  assert.ok(err(slow, 1.7, 1.95) < 12, 'a regime anche quello lento');
});

test('humanize: nelle note lunghe lascia passare la deriva lenta, a 0 la appiattisce', () => {
  const x = melody([[57, 3, 0]], SR, { driftCents: 28, driftRate: 0.8 });
  const sd = (h) => std(midiBetween(tr(T.correct(x, SR, { retuneMs: 10, humanize: h, strength: 1 }).samples), 1.2, 2.8).map(m => m * 100));
  const s0 = sd(0), s1 = sd(1), sIn = std(midiBetween(tr(x), 1.2, 2.8).map(m => m * 100));
  assert.ok(sIn > 14, 'ingresso ' + sIn);
  assert.ok(s0 < sIn * 0.35, 'humanize 0: ' + s0 + ' vs ' + sIn);
  assert.ok(s1 > s0 + 6 && s1 > sIn * 0.45, 'humanize 1: ' + s1 + ' vs ' + s0);
});

test('flex-tune: dentro la zona non corregge, fuori sì; le scivolate passano', () => {
  const x = melody([[60, 1.5, 22]], SR);
  const med = (r) => mean(midiBetween(tr(r.samples), 0.4, 1.3)) * 100;
  const off = med(T.correct(x, SR, { retuneMs: 0, flexCents: 0 })) - 6000;
  const zone = med(T.correct(x, SR, { retuneMs: 0, flexCents: 35 })) - 6000;
  assert.ok(Math.abs(off) < 8, 'senza flex ' + off);
  assert.ok(Math.abs(zone - 22) < 8, 'dentro la zona resta com\'è: ' + zone);
  const x2 = melody([[60, 1.2, 38]], SR);
  const out = med(T.correct(x2, SR, { retuneMs: 0, flexCents: 20 })) - 6000;
  assert.ok(Math.abs(out) < 12, 'fuori zona corregge: ' + out);
  // scivolata 60 -> 62 in 0.6 s: con flex la correzione media lungo la scivolata è molto minore
  const glide = voice(t => t < 0.6 ? 60 : t < 1.2 ? 60 + 2 * (t - 0.6) / 0.6 : 62, 1.8, SR);
  const dev = (r) => { const a = midiBetween(tr(r.samples), 0.7, 1.1), b = midiBetween(tr(glide), 0.7, 1.1); const n = Math.min(a.length, b.length); let s = 0; for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]); return s / n * 100; };
  const dNo = dev(T.correct(glide, SR, { retuneMs: 0, flexCents: 0 })), dFlex = dev(T.correct(glide, SR, { retuneMs: 0, flexCents: 60 }));
  assert.ok(dNo > 12, 'senza flex la scivolata viene "a gradini": ' + dNo);
  assert.ok(dFlex < dNo * 0.6, 'con flex passa: ' + dFlex + ' vs ' + dNo);
});

test('modalità Classico: passaggio a gradino, meno tempo "tra due note" che con retune lento', () => {
  const x = voice(t => t < 0.6 ? 60 : t < 0.8 ? 60 + 4 * (t - 0.6) / 0.2 : 64, 1.6, SR);
  const between = (r) => { const m = midiBetween(tr(r.samples), 0.55, 0.95); return m.filter(v => Math.abs(v - 60) > 0.3 && Math.abs(v - 64) > 0.3 && Math.abs(v - 62) > 0.3 ? true : false).length; };
  // scala maggiore di Do: tra 60 e 64 ci sono 62 (Re) e si passa per 62: contiamo i frame lontani da QUALSIASI nota di scala
  const off = (r) => { const mask = T.scaleMask(0, 'maggiore'); return midiBetween(tr(r.samples), 0.55, 0.95).filter(v => Math.abs(v - T.quantizeMidi(v, mask)) > 0.35).length; };
  const classic = off(T.correct(x, SR, { tonic: 0, mode: 'maggiore', classic: true }));
  const smooth = off(T.correct(x, SR, { tonic: 0, mode: 'maggiore', retuneMs: 120 }));
  assert.ok(classic < smooth, 'classico ' + classic + ' vs lento ' + smooth);
  assert.ok(classic < smooth * 0.5, 'classico molto più netto: ' + classic + ' vs ' + smooth);
});

test('vibrato: naturale conservato o tolto, artificiale aggiunto, deriva regolabile', () => {
  const vib = melody([[57, 2.5, 0]], SR, { vibCents: 35, vibRate: 5.5 });
  const sdOf = (x) => std(midiBetween(tr(x), 0.9, 2.3).map(m => m * 100));
  const sIn = sdOf(vib);
  assert.ok(sIn > 18 && sIn < 32, 'ingresso ' + sIn);
  const keep = sdOf(T.correct(vib, SR, { retuneMs: 0, vibrato: 1 }).samples);
  const none = sdOf(T.correct(vib, SR, { retuneMs: 0, vibrato: 0 }).samples);
  const half = sdOf(T.correct(vib, SR, { retuneMs: 0, vibrato: 0.5 }).samples);
  assert.ok(keep > sIn * 0.75, 'conservato ' + keep + ' / ' + sIn);
  assert.ok(none < sIn * 0.3, 'tolto ' + none);
  assert.ok(half > none + 3 && half < keep, 'metà ' + half);
  // artificiale su una nota piatta
  const flat = melody([[57, 2.5, 0]], SR);
  const art = T.correct(flat, SR, { retuneMs: 0, vibrato: 0, vibratoDepth: 45, vibratoRate: 6, vibratoDelay: 0.2 }).samples;
  const m = midiBetween(tr(art), 1.0, 2.2).map(v => v * 100), mu = mean(m);
  assert.ok(std(m) > 45 / Math.SQRT2 * 0.6 && std(m) < 45 / Math.SQRT2 * 1.4, 'ampiezza ' + std(m));
  let cross = 0; for (let i = 1; i < m.length; i++) if ((m[i - 1] - mu) * (m[i] - mu) < 0) cross++;
  const hz = cross / 2 / 1.2; // 1.2 s di finestra
  assert.ok(hz > 4.8 && hz < 7.2, 'frequenza ' + hz);
  // deriva
  const dr = melody([[57, 3, 0]], SR, { driftCents: 28, driftRate: 0.8 });
  const sd0 = std(midiBetween(tr(T.correct(dr, SR, { retuneMs: 0, drift: 0 }).samples), 1.2, 2.8).map(v => v * 100));
  const sd1 = std(midiBetween(tr(T.correct(dr, SR, { retuneMs: 0, drift: 1 }).samples), 1.2, 2.8).map(v => v * 100));
  assert.ok(sd1 > sd0 + 8, 'deriva conservata ' + sd1 + ' vs ' + sd0);
});

test('formant shift: cambia il timbro ma non l\'altezza', () => {
  const x = melody([[54, 2, 0]], SR);
  const centroid = (s) => { const N = 4096; let a = 0, b = 0; for (let st = SR; st + N < s.length; st += N) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = s[st + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); F.fft(re, im, false); for (let k = 1; k < N / 2; k++) { const m = re[k] * re[k] + im[k] * im[k]; a += m * k * SR / N; b += m; } } return a / b; };
  const p0 = mean(midiBetween(tr(x), 0.3, 1.7)), c0 = centroid(x);
  for (const st of [-4, 3]) {
    const y = F.shift(x, SR, st);
    assert.ok(finite(y) && y.length === x.length);
    assert.ok(Math.abs(mean(midiBetween(tr(y), 0.3, 1.7)) - p0) * 100 < 8, 'altezza cambiata con ' + st);
    const c = centroid(y);
    assert.ok(st > 0 ? c > c0 * 1.08 : c < c0 * 0.92, 'timbro ' + st + ': ' + c0.toFixed(0) + ' -> ' + c.toFixed(0));
  }
  // anche passando da correct()
  const z = T.correct(x, SR, { strength: 0, formantSemitones: 3 }).samples;
  assert.ok(centroid(z) > c0 * 1.08);
  assert.ok(Math.abs(mean(midiBetween(tr(z), 0.3, 1.7)) - p0) * 100 < 8);
});

test('tonalità automatica e blocco sulla scala', () => {
  // Sol maggiore (Sol=7): note della scala, leggermente stonate
  const ns = [67, 71, 74, 71, 69, 67, 74, 72, 71, 69, 67, 71, 67, 66, 67, 69, 71, 74, 67];
  const notes = ns.map((m, i) => [m, 0.45, [12, -18, 22, -10][i % 4]]);
  const x = melody(notes, SR);
  const r = T.correct(x, SR, { key: 'auto', retuneMs: 5, strength: 1 });
  assert.ok(r.stats.key && r.stats.key.certain, JSON.stringify(r.stats.key));
  assert.equal(r.stats.key.name, 'Sol maggiore');
  const mask = T.scaleMask(7, 'maggiore');
  const after = T.measure(r.samples, SR, { mask });
  assert.ok(after.centerCents < 12, 'dopo ' + after.centerCents);
  // tonalità incerta: tutte e 12 le note -> usa "tutte le note" e lo dice
  const chrom = melody(Array.from({ length: 24 }, (_, i) => [55 + (i * 5) % 12, 0.3, 0]), SR);
  const r2 = T.correct(chrom, SR, { key: 'auto', retuneMs: 5 });
  assert.equal(r2.stats.key.certain, false);
  assert.equal(r2.stats.mode, 'cromatica');
  assert.equal(T.detectKey(x, SR).name, 'Sol maggiore');
});

test('autotune fine: nessun NaN, picco sotto 1, durata uguale, a 44,1 kHz e tempi ragionevoli', () => {
  const sr = 44100;
  const x = melody([[57, 1.5, -30], [60, 1.5, 25], [64, 1.5, -20], [60, 1.5, 15]], sr, { vibCents: 20 });
  const t0 = Date.now();
  const r = T.correct(x, sr, { tonic: 0, mode: 'maggiore', retuneMs: 15, humanize: 0.5, flexCents: 15, vibrato: 0.7, vibratoDepth: 20, formantSemitones: -2 });
  const ms = Date.now() - t0;
  assert.ok(finite(r.samples) && r.samples.length === x.length);
  let pk = 0; for (const v of r.samples) pk = Math.max(pk, Math.abs(v));
  assert.ok(pk <= 0.991, 'picco ' + pk);
  assert.ok(ms < 20000, 'tempo ' + ms + ' ms per 6 s di voce');
  console.log('   (6 s di voce a 44,1 kHz elaborati in ' + ms + ' ms)');
});

test('accordatura della base (refCents): una nota a +30 cent resta lì se la base è a +30, altrimenti va a 0', () => {
  const x = melody([[57, 1.2, 30]], SR);
  const run = (ref) => { const r = T.correct(x, SR, { tonic: 9, mode: 'cromatica', strength: 1, retuneMs: 0, refCents: ref }); return mean(midiBetween(tr(r.samples), 0.3, 0.9)); };
  const noRef = run(0), withRef = run(30);
  assert.ok(Math.abs(noRef - 57) < 0.08, 'senza ref ' + noRef);
  assert.ok(Math.abs(withRef - 57.3) < 0.08, 'con ref ' + withRef);
});
