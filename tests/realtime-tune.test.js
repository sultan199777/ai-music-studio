const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/realtime-tune.js');
const T = require('../src/autotune.js');
const A = require('../src/audio-analysis.js');
const { melody, voice, midiBetween } = require('./_voice-synth.js');

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
function stream(core, x, block) {
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i += block) core.process(x.subarray(i, Math.min(x.length, i + block)), out.subarray(i, Math.min(x.length, i + block)));
  return out;
}

test('monitor tempo reale: nota calante di 35 cent riportata vicino alla nota (blocchi da 128 come nel worklet)', () => {
  const sr = 48000, x = melody([[57, 3, -35]], sr, { amp: 0.4 });
  const core = R.createCore(sr, { strength: 1, retuneMs: 20, mode: 'cromatica' });
  const y = stream(core, x, 128);
  assert.ok(y.every(Number.isFinite));
  const before = mean(midiBetween(T.track(x, sr), 1.5, 2.8)), after = mean(midiBetween(T.track(y, sr), 1.5, 2.8));
  assert.ok(Math.abs((before - 57) * 100) > 30, 'ingresso ' + before);
  assert.ok(Math.abs((after - 57) * 100) < 12, 'uscita ' + ((after - 57) * 100).toFixed(1) + ' cent');
  assert.ok(Math.max(...y.subarray(48000).map(Math.abs)) < 0.8, 'nessun picco anomalo');
});

test('monitor tempo reale: spento = voce invariata (solo ritardata); silenzio = silenzio; scala maggiore', () => {
  const sr = 48000, x = melody([[60, 1.5, 20]], sr, { amp: 0.4 });
  const core = R.createCore(sr, { enabled: false });
  const y = stream(core, x, 128), lat = Math.round(core.getLatencySamples());
  let err = 0, n = 0; for (let i = 24000; i < 60000; i++) { const d = y[i + lat] - x[i]; err += d * d; n++; }
  const rms = Math.sqrt(err / n); assert.ok(rms < 0.02, 'differenza dopo compensazione di ' + lat + ' campioni: ' + rms);
  const z = stream(R.createCore(sr, {}), new Float32Array(sr), 128); assert.ok(z.every(v => v === 0));
  // 61,3 in Do maggiore va su Re (62)
  const c2 = R.createCore(sr, { strength: 1, retuneMs: 15, tonic: 0, mode: 'maggiore' }), x2 = melody([[61, 3, 30]], sr, { amp: 0.4 });
  const y2 = stream(c2, x2, 128), m = mean(midiBetween(T.track(y2, sr), 1.6, 2.8));
  assert.ok(Math.abs(m - 62) < 0.15, 'nota ' + m);
});

test('monitor tempo reale: il ritardo proprio è misurato (impulso) e coincide con quello dichiarato', () => {
  const sr = 48000, x = new Float32Array(sr / 2); x[8000] = 1;
  const core = R.createCore(sr, { enabled: false }), y = stream(core, x, 128);
  let bi = 0, bv = 0; for (let i = 0; i < y.length; i++) if (Math.abs(y[i]) > bv) { bv = Math.abs(y[i]); bi = i; }
  const measuredMs = (bi - 8000) / sr * 1000;
  assert.ok(Math.abs(measuredMs - core.getLatencyMs()) < 1, 'misurato ' + measuredMs + ' dichiarato ' + core.getLatencyMs());
  assert.ok(measuredMs > 5 && measuredMs < 40, 'ritardo proprio ' + measuredMs + ' ms');
  console.log('   (ritardo proprio del monitor: ' + measuredMs.toFixed(1) + ' ms + misura altezza ' + core.detectDelayMs.toFixed(1) + ' ms)');
});

test('testo dell\'AudioWorklet: contiene il processore e si compila', () => {
  const src = R.workletSource();
  assert.ok(src.includes('registerProcessor("vl-rt"') && src.includes('createCore'));
  // compila con classi finte
  const fn = new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', src);
  let reg = null; fn(class { constructor() { this.port = {}; } }, (n, c) => { reg = [n, c]; }, 48000);
  assert.equal(reg[0], 'vl-rt');
  const p = new reg[1]({ processorOptions: { strength: 1 } }), o = new Float32Array(128);
  assert.ok(p.process([[new Float32Array(128)]], [[o]]) === true);
});
