/*
 * Mixer a canali dello Studio (Web Audio). Ogni traccia ha la sua catena:
 *   volume → EQ 3 bande (bassi 120 Hz, medi regolabili, alti 8 kHz) → compressore → saturazione → sidechain (solo dove serve)
 *   → panoramica → uscita; più due mandate: riverbero (stanza generata qui) ed eco a tempo (1/8 puntato, con ritorni filtrati).
 * La stessa funzione build() costruisce il mixer per l'ascolto (AudioContext) e per il file (OfflineAudioContext):
 * quello che senti è quello che salvi.
 * Sidechain: Web Audio non ha un compressore con ingresso esterno, quindi l'inviluppo della cassa (calcolato dal file
 * della cassa) diventa una curva di volume sul canale: identico nel risultato a un compressore in sidechain.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Mixer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // valori di un canale (tutti in unità comprensibili)
  var CH = { low: 0, mid: 0, midHz: 1200, high: 0, comp: 0, sat: 0, pan: 0, rev: 0, dly: 0, duck: 0 };
  var LIMITS = { low: [-12, 12], mid: [-12, 12], midHz: [200, 5000], high: [-12, 12], comp: [0, 1], sat: [0, 1], pan: [-1, 1], rev: [0, 1], dly: [0, 1], duck: [0, 1] };
  var LABELS = {
    low: ['Bassi', 'dB', 'Sotto 120 Hz: peso e corpo.'], mid: ['Medi', 'dB', 'Presenza; togli per fare spazio alla voce.'], midHz: ['Frequenza dei medi', 'Hz', 'Dove agisce la manopola Medi.'],
    high: ['Alti', 'dB', 'Sopra 8 kHz: aria e brillantezza.'], comp: ['Compressione', '%', 'Volume più costante e più davanti.'], sat: ['Calore / distorsione', '%', 'Armoniche in più: suona più grosso e sporco.'],
    pan: ['Panoramica', '', 'Sinistra o destra.'], rev: ['Riverbero', '%', 'Spazio attorno al suono.'], dly: ['Eco', '%', 'Ripetizioni a tempo (1/8 puntato).'], duck: ['Sidechain dalla cassa', '%', 'Si abbassa quando batte la cassa: 808 e cassa non si pestano.']
  };

  // punti di partenza per stile (Analisi: regole di mix comuni, da regolare a orecchio)
  var PRESETS = {
    base: {
      drums: { comp: 0.3, sat: 0.15, high: 1 }, bass: { sat: 0.35, duck: 0.45, low: 2 }, chords: { low: -4, rev: 0.25, pan: -0.15 },
      arp: { low: -6, rev: 0.2, dly: 0.25, pan: 0.25 }, lead: { low: -5, rev: 0.25, dly: 0.2 }, pad: { low: -6, rev: 0.5, high: -2 },
      voice: { low: -3, mid: -1.5, midHz: 400, high: 3, comp: 0.55, rev: 0.18, dly: 0.12 }
    },
    trap: { bass: { sat: 0.55, duck: 0.5 }, drums: { comp: 0.35, sat: 0.2 }, lead: { dly: 0.3 } },
    brooklyn: { bass: { sat: 0.7, duck: 0.45, low: 3 }, drums: { comp: 0.4, sat: 0.2 }, pad: { rev: 0.55, low: -6 }, lead: { rev: 0.35 }, voice: { comp: 0.65, rev: 0.12, dly: 0.08, high: 3 } },
    drill: { bass: { sat: 0.6, duck: 0.4 }, pad: { rev: 0.6 }, lead: { rev: 0.35 } },
    melodico: { bass: { sat: 0.15, duck: 0.3 }, chords: { rev: 0.35 }, voice: { rev: 0.28, dly: 0.18 } },
    epico: { pad: { rev: 0.7 }, chords: { rev: 0.45 }, drums: { comp: 0.45 } },
    estate: { drums: { comp: 0.25, high: 2 }, bass: { duck: 0.2, sat: 0.1 } }
  };

  function clamp(v, k) { var l = LIMITS[k]; v = +v; if (!isFinite(v)) v = CH[k]; return Math.max(l[0], Math.min(l[1], v)); }
  function channel(o) { var c = {}; for (var k in CH) c[k] = o && o[k] != null ? clamp(o[k], k) : CH[k]; return c; }
  /** Impostazioni di partenza per uno stile: base + differenze dello stile. */
  function preset(style, laneIds) {
    var out = {}, b = PRESETS.base, s = PRESETS[style] || {};
    laneIds.forEach(function (id) { out[id] = channel(Object.assign({}, b[id] || {}, s[id] || {})); });
    return out;
  }
  /** Curva di saturazione morbida (tanh), normalizzata: amt 0 = lineare. */
  function satCurve(amt, n) {
    n = n || 2048; var c = new Float32Array(n), k = 1 + amt * 9, norm = Math.tanh(k);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = amt <= 0 ? x : Math.tanh(k * x) / norm; }
    return c;
  }
  /** Inviluppo della cassa → curva di volume (fps punti al secondo). amt 0-1 = quanto si abbassa (fino a -14 dB). */
  function duckCurve(kick, sr, amt, fps) {
    fps = fps || 200; var hop = Math.max(1, Math.round(sr / fps)), n = Math.ceil(kick.length / hop), env = new Float32Array(n), pk = 0, i, j;
    for (i = 0; i < n; i++) { var m = 0; for (j = i * hop; j < Math.min(kick.length, (i + 1) * hop); j++) { var v = kick[j] < 0 ? -kick[j] : kick[j]; if (v > m) m = v; } env[i] = m; if (m > pk) pk = m; }
    var out = new Float32Array(n), rel = Math.exp(-1 / (fps * 0.12)), e = 0, depth = 1 - Math.pow(10, -14 * amt / 20);
    for (i = 0; i < n; i++) { var x = pk > 0 ? env[i] / pk : 0; e = x > e ? x : e * rel; out[i] = 1 - depth * Math.min(1, e * 1.4); }
    return out;
  }
  /** Risposta all'impulso di una stanza (rumore che si spegne), stereo decorrelato. */
  function impulse(sr, sec, seed) {
    var n = Math.round(sr * sec), L = new Float32Array(n), R = new Float32Array(n), s = seed || 7;
    var rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647 * 2 - 1; };
    for (var i = 0; i < n; i++) { var d = Math.pow(1 - i / n, 3) * Math.exp(-i / (sr * sec * 0.35)); L[i] = rnd() * d; R[i] = rnd() * d; }
    return [L, R];
  }

  /**
   * Costruisce il mixer. ctx: AudioContext o OfflineAudioContext; dest: nodo di uscita.
   * opt: {lanes:[id], settings:{id:channel}, bpm, kick:{x,sr} (per il sidechain), t0 (inizio in tempo del contesto), from (secondi saltati)}
   * Ritorna {input(id) → nodo dove collegare la sorgente, fader(id) → GainNode del volume, set(id, chiave, valore), stop()}.
   */
  function build(ctx, dest, opt) {
    var M = { ch: {}, settings: {} }, bpm = opt.bpm || 100;
    // mandate condivise
    var revIn = ctx.createGain(), conv = ctx.createConvolver(), ir = impulse(ctx.sampleRate, 2.2, 11), irb = ctx.createBuffer(2, ir[0].length, ctx.sampleRate);
    irb.getChannelData(0).set(ir[0]); irb.getChannelData(1).set(ir[1]); conv.buffer = irb; conv.normalize = true;
    var revOut = ctx.createGain(); revOut.gain.value = 0.9; revIn.connect(conv); conv.connect(revOut); revOut.connect(dest);
    var dlyIn = ctx.createGain(), dl = ctx.createDelay(2), fb = ctx.createGain(), dlf = ctx.createBiquadFilter(), dlOut = ctx.createGain();
    dl.delayTime.value = Math.min(1.9, 60 / bpm * 0.75); fb.gain.value = 0.35; dlf.type = 'lowpass'; dlf.frequency.value = 3500; dlOut.gain.value = 0.8;
    dlyIn.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(dlOut); dlOut.connect(dest);
    (opt.lanes || []).forEach(function (id) {
      var c = {};
      c.fader = ctx.createGain();
      c.low = ctx.createBiquadFilter(); c.low.type = 'lowshelf'; c.low.frequency.value = 120;
      c.mid = ctx.createBiquadFilter(); c.mid.type = 'peaking'; c.mid.Q.value = 0.9;
      c.high = ctx.createBiquadFilter(); c.high.type = 'highshelf'; c.high.frequency.value = 8000;
      c.comp = ctx.createDynamicsCompressor(); c.comp.attack.value = 0.008; c.comp.release.value = 0.18; c.comp.knee.value = 6;
      c.makeup = ctx.createGain();
      c.sat = ctx.createWaveShaper(); c.sat.oversample = '2x';
      c.duck = ctx.createGain();
      c.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      c.out = ctx.createGain(); c.rev = ctx.createGain(); c.dly = ctx.createGain();
      c.autoF = ctx.createBiquadFilter(); c.autoF.type = 'lowpass'; c.autoF.frequency.value = 20000; c.autoF.Q.value = 0.8; c.autoG = ctx.createGain();
      c.fader.connect(c.autoF); c.autoF.connect(c.autoG); c.autoG.connect(c.low); c.low.connect(c.mid); c.mid.connect(c.high); c.high.connect(c.comp); c.comp.connect(c.makeup); c.makeup.connect(c.sat); c.sat.connect(c.duck);
      if (c.pan) { c.duck.connect(c.pan); c.pan.connect(c.out); } else c.duck.connect(c.out);
      c.out.connect(dest); c.out.connect(c.rev); c.out.connect(c.dly); c.rev.connect(revIn); c.dly.connect(dlyIn);
      M.ch[id] = c;
      var st = channel((opt.settings || {})[id]); M.settings[id] = st;
      for (var k in st) apply(id, k, st[k], true);
      // automazione: punti {t (s nella canzone), vol (0-1.5), cut (0-1, 1 = filtro aperto)} con rampe morbide
      var pts = opt.auto && opt.auto[id]; if (pts && pts.length) schedAuto(c, pts);
    });
    function cutHz(v) { return 200 * Math.pow(100, Math.max(0, Math.min(1, v))); }
    function schedAuto(c, pts) {
      var from = opt.from || 0, t0 = opt.t0 || 0, ramp = 0.35, cur = pts[0];
      for (var i = 0; i < pts.length; i++) if (pts[i].t <= from) cur = pts[i];
      c.autoG.gain.setValueAtTime(cur.vol, t0); c.autoF.frequency.setValueAtTime(cutHz(cur.cut), t0);
      pts.forEach(function (q) { if (q.t <= from) return; var at = t0 + q.t - from;
        c.autoG.gain.setValueAtTime(c.autoG.gain.value, Math.max(t0, at - ramp)); c.autoG.gain.linearRampToValueAtTime(q.vol, at);
        if (q.sweep) c.autoF.frequency.exponentialRampToValueAtTime(cutHz(q.cut), at + q.sweep); else { c.autoF.frequency.setValueAtTime(c.autoF.frequency.value, Math.max(t0, at - ramp)); c.autoF.frequency.exponentialRampToValueAtTime(cutHz(q.cut), at); } });
    }
    function apply(id, k, v, now) {
      var c = M.ch[id]; if (!c) return; v = clamp(v, k); M.settings[id][k] = v;
      var t = ctx.currentTime, set = function (param, val) { if (now) param.value = val; else param.setTargetAtTime(val, t, 0.03); };
      if (k === 'low') set(c.low.gain, v); else if (k === 'mid') set(c.mid.gain, v); else if (k === 'midHz') set(c.mid.frequency, v); else if (k === 'high') set(c.high.gain, v);
      else if (k === 'comp') { set(c.comp.threshold, -2 - 30 * v); set(c.comp.ratio, 1 + 7 * v); set(c.makeup.gain, Math.pow(10, (8 * v) / 20)); }
      else if (k === 'sat') { c.sat.curve = satCurve(v); set(c.out.gain, 1 / (1 + v * 0.6)); }
      else if (k === 'pan') { if (c.pan) set(c.pan.pan, v); }
      else if (k === 'rev') set(c.rev.gain, v * 0.6); else if (k === 'dly') set(c.dly.gain, v * 0.5);
      else if (k === 'duck') scheduleDuck(id, v);
    }
    function scheduleDuck(id, amt) {
      var c = M.ch[id], kick = opt.kick; c.duck.gain.cancelScheduledValues(0); c.duck.gain.value = 1;
      if (!kick || amt <= 0) return;
      var fps = 200, cur = duckCurve(kick.x, kick.sr, amt, fps), from = Math.max(0, opt.from || 0), i0 = Math.floor(from * fps);
      var seg = cur.subarray(Math.min(i0, cur.length - 2)), t0 = Math.max(ctx.currentTime, opt.t0 || 0);
      if (seg.length > 2) c.duck.gain.setValueCurveAtTime(seg, t0, seg.length / fps);
    }
    return {
      input: function (id) { return M.ch[id] ? M.ch[id].fader : dest; },
      fader: function (id) { return M.ch[id] ? M.ch[id].fader : null; },
      set: function (id, k, v) { apply(id, k, v, false); },
      settings: M.settings
    };
  }

  /** Punti di automazione dalle sezioni: auto = {sezione: {vol, cut}}; sections = [{name, startSec}]. */
  function autoPoints(auto, sections) { if (!auto) return null; var pts = []; sections.forEach(function (s) { var a = auto[s.name] || {}; pts.push({ t: s.startSec, vol: a.vol == null ? 1 : a.vol, cut: a.cut == null ? 1 : a.cut }); }); return pts.length ? pts : null; }
  return { autoPoints: autoPoints, CH: CH, LIMITS: LIMITS, LABELS: LABELS, PRESETS: PRESETS, channel: channel, preset: preset, satCurve: satCurve, duckCurve: duckCurve, impulse: impulse, build: build };
});
