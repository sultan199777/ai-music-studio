const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../src/backing.js');
const M = require('../src/manga-filter.js');
const A = require('../src/audio-analysis.js');

const SR = 22050;
const STEPS = { maggiore: [0, 2, 4, 5, 7, 9, 11], minore: [0, 2, 3, 5, 7, 8, 10] };
const inScale = (midi, tonic, mode) => STEPS[mode].includes((((midi - tonic) % 12) + 12) % 12);
const energy = (x, a, b) => { let s = 0; for (let i = a; i < Math.min(b, x.length); i++) s += x[i] * x[i]; return s; };

test('base: durata esatta, valori finiti, ogni strumento suona', () => {
  const b = B.generate({ sampleRate: SR, bpm: 120, bars: 4, genre: 'pop', tonic: 0, mode: 'maggiore', seed: 7 });
  assert.equal(b.length, Math.round(60 / 120 / 4 * SR) * 16 * 4);
  for (const [nome, t] of Object.entries(b.tracks)) {
    assert.equal(t.length, b.length, nome);
    let fin = true, e = 0;
    for (const v of t) { if (!Number.isFinite(v)) fin = false; e += v * v; }
    assert.ok(fin, nome + ' non finito');
    assert.ok(e > 0, nome + ' silenzioso');
  }
});

test('base: stesso seme = stessa base, seme diverso = melodia diversa', () => {
  const a = B.generate({ sampleRate: SR, bars: 4, seed: 3 });
  const b = B.generate({ sampleRate: SR, bars: 4, seed: 3 });
  const c = B.generate({ sampleRate: SR, bars: 4, seed: 4 });
  assert.deepEqual(Array.from(a.tracks.lead.slice(0, 5000)), Array.from(b.tracks.lead.slice(0, 5000)));
  assert.notDeepEqual(a.events.lead.map((e) => e.midi), c.events.lead.map((e) => e.midi));
});

test('base: melodia, basso e accordi usano solo note della tonalità scelta', () => {
  for (const [tonic, mode] of [[0, 'maggiore'], [9, 'minore'], [7, 'maggiore'], [2, 'minore']]) {
    for (const genre of Object.keys(B.GENRES)) {
      const b = B.generate({ sampleRate: SR, bars: 8, genre, tonic, mode, seed: 11 });
      b.events.lead.forEach((e) => assert.ok(inScale(e.midi, tonic, mode), `${genre} ${tonic} ${mode} melodia ${e.midi}`));
      b.events.bass.forEach((e) => assert.ok(inScale(e.midi, tonic, mode), `basso ${e.midi}`));
      b.events.chords.forEach((c) => c.midis.forEach((m) => assert.ok(inScale(m, tonic, mode), `accordo ${m}`)));
    }
  }
});

test('base: progressione e nomi degli accordi', () => {
  assert.deepEqual(B.generate({ sampleRate: SR, bars: 4, tonic: 0, mode: 'maggiore' }).progression, ['Do', 'Sol', 'Lam', 'Fa']);
  assert.deepEqual(B.generate({ sampleRate: SR, bars: 4, tonic: 9, mode: 'minore' }).progression, ['Lam', 'Fa', 'Do', 'Sol']);
});

test('base: la cassa batte al primo tempo e il basso suona la nota giusta', () => {
  const b = B.generate({ sampleRate: SR, bpm: 120, bars: 4, genre: 'pop', tonic: 9, mode: 'minore', seed: 2 });
  assert.ok(energy(b.tracks.kick, 0, 2000) > 1, 'cassa assente sul primo tempo');
  const bass = A.analyze(b.tracks.bass, SR, { fmin: 30, fmax: 400 });
  assert.ok(bass.pitch, 'basso non riconosciuto');
  const radici = new Set(b.events.bass.map((e) => A.midiToName(e.midi)));
  assert.ok(radici.has(bass.pitch.medianNote), 'basso ' + bass.pitch.medianNote + ' non è tra ' + [...radici].join(', '));
});

test('base: mix con volumi, picco sotto il massimo, strumenti spenti', () => {
  const b = B.generate({ sampleRate: SR, bars: 4, seed: 5 });
  const full = B.mix(b);
  let peak = 0; for (const v of full) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak <= 0.81 && peak > 0.5, 'picco ' + peak);
  const onlyDrums = B.mix(b, { basso: 0, accordi: 0, pad: 0, melodia: 0 });
  const nodrums = B.mix(b, { batteria: 0 });
  assert.ok(energy(onlyDrums, 0, onlyDrums.length) > 0);
  assert.ok(energy(nodrums, 0, nodrums.length) > 0);
  const silent = B.mix(b, { batteria: 0, basso: 0, accordi: 0, pad: 0, melodia: 0 });
  assert.equal(energy(silent, 0, silent.length), 0);
});

test('voce sopra la base: durata, ricampionamento e niente distorsione', () => {
  const base = new Float32Array(44100).fill(0.5);
  const voice = new Float32Array(48000 * 2).fill(0.9);
  const out = B.withVoice(base, 44100, voice, 48000, 1);
  assert.equal(out.length, 88200);
  let peak = 0; for (const v of out) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak <= 0.951);
  assert.equal(B.resampleLinear(new Float32Array(48000), 48000, 24000).length, 24000);
});

function imageFrom(fn, w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = fn(x, y);
    const p = (y * w + x) * 4; data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255;
  }
  return { data, width: w, height: h };
}

test('manga bianco e nero: solo nero e bianco, linee sul bordo di una figura', () => {
  const img = imageFrom((x, y) => (x > 40 && x < 90 && y > 40 && y < 90 ? [30, 30, 30] : [235, 235, 235]), 128, 128);
  M.apply(img, { mode: 'bn', detail: 0.6 });
  let black = 0, other = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i];
    if (v === 0) black++; else if (v !== 255) other++;
    assert.equal(img.data[i + 3], 255);
  }
  assert.equal(other, 0);
  assert.ok(black > 50 * 50 * 0.5, 'interno scuro poco inchiostrato: ' + black);
  const px = (x, y) => img.data[(y * 128 + x) * 4];
  assert.equal(px(5, 5), 255, 'lo sfondo chiaro deve restare bianco');
});

test('cartoon: pochi colori, contorni scuri sui bordi, nessun errore', () => {
  const W = 120, H = 100;
  const img = imageFrom((x, y) => (x > 40 && x < 80 && y > 30 && y < 70 ? [220, 60, 60] : [60, 120 + (x % 5), 200]), W, H);
  M.apply(img, { mode: 'cartoon', detail: 0.8 });
  const colors = new Set(); let dark = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    colors.add(img.data[i] * 65536 + img.data[i + 1] * 256 + img.data[i + 2]);
    if (img.data[i] < 30 && img.data[i + 1] < 20 && img.data[i + 2] < 40) dark++;
    assert.equal(img.data[i + 3], 255);
  }
  assert.ok(colors.size <= 80, 'colori ' + colors.size);
  assert.ok(dark > 100, 'contorni ' + dark);
  const px = (x, y) => (y * W + x) * 4;
  assert.ok(img.data[px(60, 50)] > 120, 'il centro rosso deve restare rosso');
});

test('cartoon: una foto con migliaia di colori viene ridotta a poche decine', () => {
  const img = imageFrom((x, y) => [x * 2, y * 2, (x + y) % 256], 100, 100);
  const before = new Set(); for (let i = 0; i < img.data.length; i += 4) before.add(img.data[i] * 65536 + img.data[i + 1] * 256 + img.data[i + 2]);
  M.apply(img, { mode: 'cartoon', detail: 0.3 });
  const after = new Set(); for (let i = 0; i < img.data.length; i += 4) after.add(img.data[i] * 65536 + img.data[i + 1] * 256 + img.data[i + 2]);
  assert.ok(before.size > 5000, 'prima ' + before.size);
  assert.ok(after.size < 250, 'dopo ' + after.size);
});

test('neon: le zone scure restano quasi nere e le chiare diventano fucsia/rosa', () => {
  const W = 100, H = 80;
  const img = imageFrom((x) => (x < 50 ? [10, 10, 12] : [250, 245, 250]), W, H);
  M.apply(img, { mode: 'neon', detail: 0.2 });
  const px = (x, y) => (y * W + x) * 4;
  assert.ok(img.data[px(15, 40)] < 40, 'scuro ' + img.data[px(15, 40)]);
  assert.ok(img.data[px(85, 40)] > 200 && img.data[px(85, 40) + 1] > 150, 'chiaro');
});

test('manga: immagine piccolissima non genera errori', () => {
  const img = imageFrom(() => [10, 20, 30], 2, 2);
  assert.doesNotThrow(() => M.apply(img, {}));
});

test('voce sulla base: spostamento in avanti e indietro, e basso 808 forzato', () => {
  const base = new Float32Array(44100), voice = new Float32Array(44100).fill(0.5);
  const later = B.withVoice(base, 44100, voice, 44100, 1, 0.5);
  assert.equal(later.length, 44100 + 22050);
  assert.equal(later[1000], 0); assert.ok(Math.abs(later[30000] - 0.5) < 1e-6);
  const earlier = B.withVoice(base, 44100, voice, 44100, 1, -0.5);
  assert.equal(earlier.length, 44100);
  const b = B.generate({ sampleRate: SR, bars: 2, genre: 'pop', bassStyle: '808', seed: 1 });
  assert.ok(b.tracks.bass.some((v) => v !== 0));
});
