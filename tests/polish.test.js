const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/polish.js');

const SR = 22050;
function sine(f, sec, amp) { const x = new Float32Array(Math.floor(SR * sec)); for (let i = 0; i < x.length; i++) x[i] = (amp || 0.5) * Math.sin(2 * Math.PI * f * i / SR); return x; }
function rms(x, a, b) { let s = 0; a = Math.round(a || 0); b = Math.min(Math.round(b || x.length), x.length); for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); }
const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));

test('filtro dei bassi: toglie 40 Hz e lascia 1 kHz', () => {
  const lo = P.highpass(sine(40, 1), SR, 100), hi = P.highpass(sine(1000, 1), SR, 100);
  const cut = db(rms(lo, SR / 2)) - db(rms(sine(40, 1), SR / 2));
  const keep = db(rms(hi, SR / 2)) - db(rms(sine(1000, 1), SR / 2));
  assert.ok(cut < -10, 'taglio ' + cut.toFixed(1));
  assert.ok(Math.abs(keep) < 0.5, 'passaggio ' + keep.toFixed(2));
});

test('equalizzatore: +3 dB alla frequenza scelta', () => {
  const y = P.peaking(sine(3200, 1), SR, 3200, 3, 0.9);
  const g = db(rms(y, SR / 2)) - db(rms(sine(3200, 1), SR / 2));
  assert.ok(Math.abs(g - 3) < 0.6, 'guadagno ' + g.toFixed(2));
});

test('compressore: riduce la distanza tra suoni forti e deboli', () => {
  const x = new Float32Array(SR * 2);
  const a = sine(440, 1, 0.8), b = sine(440, 1, 0.05);
  x.set(a, 0); x.set(b, SR);
  const y = P.compress(x, SR, { thresholdDb: -30, ratio: 4, attackMs: 3, releaseMs: 50 });
  const before = db(rms(x, 5000, SR - 100)) - db(rms(x, SR + 5000, 2 * SR - 100));
  const after = db(rms(y, 5000, SR - 100)) - db(rms(y, SR + 5000, 2 * SR - 100));
  assert.ok(after < before - 6, 'prima ' + before.toFixed(1) + ' dopo ' + after.toFixed(1));
});

test('riverbero: coda che decresce e mix 0 = nessun cambiamento', () => {
  const imp = new Float32Array(SR); imp[10] = 1;
  const wet = P.reverb(imp, SR, { mix: 0.5 });
  assert.ok(wet.length > imp.length);
  const early = rms(wet, SR * 0.05, SR * 0.35), late = rms(wet, SR * 0.8, SR * 1.2);
  assert.ok(early > 0 && early > late, 'coda ' + early + ' > ' + late);
  const dry = P.reverb(imp, SR, { mix: 0 });
  assert.equal(dry.length, imp.length);
  assert.deepEqual(Array.from(dry.slice(0, 50)), Array.from(imp.slice(0, 50)));
});

test('eco: ripete il suono dopo il tempo indicato', () => {
  const imp = new Float32Array(SR); imp[0] = 1;
  const y = P.echo(imp, SR, { timeMs: 200, feedback: 0.3, mix: 0.5 });
  const d = Math.round(SR * 0.2);
  assert.ok(Math.abs(y[d] - 0.5) < 1e-6);
});

test('catena completa: valori finiti, picco sotto il massimo, nessuna = copia', () => {
  const x = sine(300, 1, 0.9);
  for (const p of ['pulita', 'pop', 'eco']) {
    const y = P.process(x, SR, p);
    let ok = true, peak = 0; for (const v of y) { if (!Number.isFinite(v)) ok = false; peak = Math.max(peak, Math.abs(v)); }
    assert.ok(ok, p); assert.ok(peak <= 0.951, p + ' picco ' + peak);
  }
  assert.deepEqual(Array.from(P.process(x, SR, 'nessuna').slice(0, 100)), Array.from(x.slice(0, 100)));
});

test('riduzione rumore: abbassa il fruscio tra le frasi e lascia la voce', () => {
  let seed = 99; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  const x = new Float32Array(SR * 3);
  for (let i = 0; i < x.length; i++) x[i] = 0.01 * rnd(); // fruscio di fondo
  for (let i = SR; i < 2 * SR; i++) x[i] += 0.4 * Math.sin(2 * Math.PI * 300 * i / SR); // una frase
  const y = P.denoise(x, SR, {});
  const noiseBefore = db(rms(x, SR * 0.1, SR * 0.8)), noiseAfter = db(rms(y, SR * 0.1, SR * 0.8));
  const voiceBefore = db(rms(x, SR * 1.2, SR * 1.8)), voiceAfter = db(rms(y, SR * 1.2, SR * 1.8));
  assert.ok(noiseBefore - noiseAfter > 10, 'rumore ' + (noiseBefore - noiseAfter).toFixed(1) + ' dB in meno');
  assert.ok(Math.abs(voiceBefore - voiceAfter) < 1.5, 'voce ' + (voiceBefore - voiceAfter).toFixed(2));
  assert.equal(y.length, x.length);
});

test('riduzione rumore: audio troppo corto o silenzioso non genera errori', () => {
  assert.equal(P.denoise(new Float32Array(100), SR, {}).length, 100);
  const y = P.denoise(new Float32Array(SR), SR, {}); assert.ok(y.every(Number.isFinite));
});
