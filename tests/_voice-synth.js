// Voci SINTETICHE per i test (non sono voci vere): armoniche con inviluppo "vocale" (formanti) e curva di altezza a piacere.
// Non è un file di test (il nome inizia con _): serve ai test di autotune e catena vocale.
const A = require('../src/audio-analysis.js');

function res(sig, sr, f, bw) {
  const r = Math.exp(-Math.PI * bw / sr), a1 = -2 * r * Math.cos(2 * Math.PI * f / sr), a2 = r * r;
  const y = new Float32Array(sig.length); let y1 = 0, y2 = 0;
  for (let i = 0; i < sig.length; i++) { const v = sig[i] - a1 * y1 - a2 * y2; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
/**
 * @param {(t:number)=>number} midiAt  altezza (MIDI, anche decimale) al tempo t, o NaN/null per silenzio
 * @param {number} dur secondi
 * @param {{amp?:number, formants?:boolean, noise?:number, seed?:number}} [o]
 */
function voice(midiAt, dur, sr, o) {
  o = o || {};
  const n = Math.floor(dur * sr), src = new Float32Array(n); let ph = 0, prevOn = false;
  for (let i = 0; i < n; i++) {
    const t = i / sr, m = midiAt(t), on = m != null && Number.isFinite(m);
    if (on) {
      const f = A.midiToFreq(m); ph += 2 * Math.PI * f / sr;
      let v = 0; const H = Math.min(30, Math.floor(sr * 0.45 / f));
      for (let h = 1; h <= H; h++) v += Math.sin(h * ph) / Math.pow(h, 1.15);
      const edge = 0.008, a = Math.min(1, (i - (prevOn ? 0 : i)) + 1);
      src[i] = v;
    }
    prevOn = on;
  }
  // inviluppo di ampiezza: sale/scende ai bordi dei tratti con nota
  const env = new Float32Array(n); let run = 0;
  for (let i = 0; i < n; i++) { const m = midiAt(i / sr); env[i] = m != null && Number.isFinite(m) ? 1 : 0; }
  const fade = Math.round(sr * 0.012), e2 = new Float32Array(n);
  for (let i = 0; i < n; i++) { if (env[i]) { run++; } else run = 0; e2[i] = Math.min(1, run / fade); }
  let tail = 0; for (let i = n - 1; i >= 0; i--) { if (env[i]) tail++; else tail = 0; e2[i] = Math.min(e2[i], tail / fade); }
  let y = src;
  if (o.formants !== false) y = res(res(res(src, sr, 600, 90), sr, 1400, 120), sr, 2600, 180);
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(y[i]));
  const out = new Float32Array(n); let seed = o.seed || 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5; };
  for (let i = 0; i < n; i++) out[i] = (o.amp || 0.5) * e2[i] * y[i] / (pk || 1) + (o.noise || 0) * rnd();
  return out;
}
/** Melodia a note: lista [midi, secondi]; legato, con vibrato e deriva opzionali; cents = scostamento per nota. */
function melody(notes, sr, o) {
  o = o || {}; const total = notes.reduce((s, n) => s + n[1], 0);
  const starts = []; let acc = 0; notes.forEach(n => { starts.push(acc); acc += n[1]; });
  const midiAt = (t) => {
    let k = notes.length - 1; for (let i = 0; i < notes.length; i++) if (t < starts[i] + notes[i][1]) { k = i; break; }
    const [m, d, cents, gap] = notes[k], lt = t - starts[k];
    if (m == null) return null;
    let v = m + (cents || 0) / 100;
    if (o.vibCents) v += o.vibCents / 100 * Math.sin(2 * Math.PI * (o.vibRate || 5.5) * lt) * Math.min(1, lt * 3);
    if (o.driftCents) v += o.driftCents / 100 * Math.sin(2 * Math.PI * (o.driftRate || 0.7) * t);
    return v;
  };
  return voice(midiAt, total, sr, o);
}
const cents = (a, b) => 1200 * Math.log2(a / b);
const std = (a) => { const m = a.reduce((s, v) => s + v, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length); };
/** Altezze (MIDI) misurate con il tracciatore fine tra t0 e t1. */
function midiBetween(trk, t0, t1) {
  const out = []; trk.frames.forEach(f => { const t = f.t + trk.frameSeconds / 2; if (f.voiced && t >= t0 && t <= t1) out.push(A.freqToMidi(f.f0)); });
  return out;
}
module.exports = { voice, melody, cents, std, midiBetween, res };
