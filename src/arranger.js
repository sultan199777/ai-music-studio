/*
 * Arrangiatore: costruisce basi ORIGINALI con una struttura vera
 * (intro, strofa, pre, ritornello, bridge, outro) e direzioni di stile diverse.
 *
 * Tutto è sintetizzato dal programma (nessun campione, nessun brano altrui).
 * Le "direzioni" non copiano artisti: usano solo caratteristiche generiche
 * di genere (tempo, densità di batteria, ruolo del basso, tipo di suoni).
 * Con lo stesso seme si ottiene sempre la stessa base.
 * Restituisce lo stesso formato di Backing.generate (+ sections), quindi si
 * mixa con Backing.mix.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { var sd = null, ins = null; try { sd = require('./samples-data.js'); } catch (e) {} try { ins = require('./instruments.js'); } catch (e) {} module.exports = factory(sd, ins); }
  else root.Arranger = factory(root.SampleData || null, root.Instruments || null);
})(typeof self !== 'undefined' ? self : this, function (SampleData, Inst) {
  'use strict';

  var NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
  var STEPS = { maggiore: [0, 2, 4, 5, 7, 9, 11], minore: [0, 2, 3, 5, 7, 8, 10] };
  var PROGS = {
    minore: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [5, 6, 0, 0], [0, 0, 5, 5], [0, 5, 3, 4], [0, 3, 0, 3], [0, 0, 3, 6]],
    maggiore: [[0, 4, 5, 3], [5, 3, 0, 4], [0, 3, 4, 3], [3, 4, 0, 5]]
  };

  // Direzioni di stile. kick/snare: posizioni sui 16 passi; kickExtra: candidati variabili.
  var STYLES = {
    trap: {
      label: 'Trap', leadShift: 0, bpm: 140, swing: 0, kick: [0], kickExtra: [3, 6, 7, 10, 11, 13, 14], snare: [8], clap: true,
      hat: 'trap', bass: '808', slide: 0.3, glide: 0.07, drive: 1.8, rolls: 0.7,
      kickPats: [[[0, 10], [0, 7, 11]], [[0, 6, 10], [0, 3, 10, 14]], [[0, 11], [0, 7, 10, 13]]],
      chord: 'pluck', chordPat: [0, 6, 10], arp: false, pad: 'warm', lead: 'bell', duck: 0.35
    },
    drill: {
      label: 'Drill', bpm: 142, swing: 0, kick: [0], kickExtra: [7, 10, 13], snare: [8], clap: false,
      hat: 'drill', bass: '808', slide: 0.7, glide: 0.13, drive: 2.4, rolls: 0.55,
      kickPats: [[[0, 10], [0, 6, 13]], [[0, 7, 10], [0, 13]], [[0, 3, 10], [0, 7]]],
      chord: 'pluck', chordPat: [0, 8], arp: true, pad: 'dark', lead: 'bell', duck: 0.3
    },
    epico: {
      label: 'Epico (cinematico)', bpm: 84, swing: 0, kick: [0, 8], kickExtra: [6, 14], snare: [4, 12], clap: true,
      hat: 'shaker', bass: 'sub', slide: 0, rolls: 0,
      kickPats: [[[0, 8], [0, 6, 8]], [[0, 8], [0, 8, 14]]],
      chord: 'ostinato', chordPat: [0, 2, 4, 6, 8, 10, 12, 14], arp: true, pad: 'choir', lead: 'strings', duck: 0.2, taiko: true
    },
    melodico: {
      label: 'Melodico', bpm: 96, swing: 0.08, kick: [0], kickExtra: [6, 10, 11], snare: [4, 12], clap: true,
      hat: 'soft', bass: 'round', slide: 0.1, rolls: 0.15,
      kickPats: [[[0, 8], [0, 6, 10]], [[0, 7, 10], [0, 8, 11]], [[0, 10], [0, 6, 8]]],
      chord: 'pluck', chordPat: [0, 3, 6, 10, 12], arp: false, pad: 'warm', lead: 'pluck', duck: 0.25
    },
    boombap: {
      label: 'Boom bap pesante', leadShift: 0, bpm: 90, swing: 0.16, kick: [0], kickExtra: [7, 10, 11], snare: [4, 12], clap: false,
      hat: 'soft', bass: 'round', slide: 0.08, rolls: 0.05,
      kickPats: [[[0, 10], [0, 7, 10]], [[0, 7], [0, 7, 11]], [[0, 10, 11], [0, 6, 10]]],
      chord: 'pluck', chordPat: [0, 6, 10], arp: false, pad: 'dark', lead: 'pluck', duck: 0.3
    },
    street: {
      label: 'Street (stile 50 Cent)', leadShift: 0, bpm: 96, swing: 0.06, kick: [0], kickExtra: [6, 10, 14], snare: [4, 12], clap: true,
      hat: 'soft', bass: '808', slide: 0.2, glide: 0.06, drive: 1.7, rolls: 0.1,
      kickPats: [[[0, 10], [0, 6, 10]], [[0, 7, 10], [0, 3, 10, 14]], [[0, 11], [0, 6, 14]]],
      chord: 'pluck', chordPat: [0, 3, 8, 11], arp: false, pad: 'dark', lead: 'bell', duck: 0.35
    },
    trapdark: {
      label: 'Trap scura pesante', leadShift: 0, bpm: 144, swing: 0, kick: [0], kickExtra: [3, 7, 10, 13], snare: [8], clap: true,
      hat: 'drill', bass: '808', slide: 0.6, glide: 0.12, drive: 2.7, rolls: 0.6,
      kickPats: [[[0, 10], [0, 7, 13]], [[0, 6, 11], [0, 3, 10]], [[0, 7, 10], [0, 13]]],
      chord: 'pluck', chordPat: [0, 8], arp: true, pad: 'dark', lead: 'bell', duck: 0.32
    },
    clubtrap: {
      label: 'Club (dembow trap)', leadShift: 0, bpm: 98, swing: 0, kick: [0, 4, 8, 12], kickExtra: [], snare: [3, 6, 11, 14], clap: true,
      hat: 'offbeat', bass: '808', slide: 0.15, glide: 0.05, drive: 1.8, rolls: 0.2,
      kickPats: [[[0, 4, 8, 12], [0, 4, 8, 12]]],
      chord: 'pluck', chordPat: [0, 6, 10], arp: false, pad: 'warm', lead: 'bell', duck: 0.28
    },
    estate: {
      label: 'Estate (ritmo latino)', bpm: 100, swing: 0, kick: [0, 4, 8, 12], kickExtra: [], snare: [3, 6, 11, 14], clap: false,
      hat: 'offbeat', bass: 'round', slide: 0, rolls: 0,
      kickPats: [[[0, 4, 8, 12], [0, 4, 8, 12]]],
      chord: 'pluck', chordPat: [2, 6, 10, 14], arp: false, pad: 'bright', lead: 'marimba', duck: 0.2
    }
  };

  // Arpeggi: schemi (passo, indice nell'accordo esteso [fondamentale, terza, quinta, ottava, terza alta, quinta alta]).
  // Ogni stile ha uno schema per la strofa (più leggero) e uno per il ritornello (più fitto).
  var ARP = {
    ottavi: { per: 8, seq: [0, 1, 2, 3, 2, 1, 2, 3] },
    spezzato: { per: 8, seq: [0, 2, 1, 3, 2, 4, 3, 2] },
    sedicesimi: { per: 16, seq: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 4, 3] },
    terzine: { per: 12, seq: [0, 1, 2, 3, 2, 1, 0, 1, 2, 4, 3, 2] },
    levare: { per: 8, seq: [-1, 2, -1, 3, -1, 2, -1, 4] },
    lento: { per: 4, seq: [0, 2, 3, 4] }
  };
  var ARP_STYLE = { trap: ['lento', 'terzine'], drill: ['ottavi', 'terzine'], epico: ['ottavi', 'sedicesimi'], melodico: ['lento', 'spezzato'], estate: ['levare', 'spezzato'], boombap: ['lento', 'spezzato'], street: ['lento', 'spezzato'], trapdark: ['ottavi', 'terzine'], clubtrap: ['levare', 'ottavi'] };

  // Come suona ogni sezione (livelli 0-1). riserEnd = riser nell'ultima battuta; gap = respiro prima del drop.
  var SEC = {
    intro: { kick: 0, snare: 0, hat: 0.25, bass: 0, chords: 0.7, pad: 0.8, lead: 0.6, arp: 0.5, riserEnd: true },
    strofa: { kick: 1, snare: 1, hat: 0.6, bass: 1, chords: 0.45, pad: 0.4, lead: 0, arp: 0.55, riserEnd: false },
    pre: { kick: 0.7, snare: 0.8, hat: 1, bass: 0.7, chords: 0.6, pad: 0.7, lead: 0, arp: 0.8, riserEnd: true, gap: true, roll: true },
    ritornello: { kick: 1, snare: 1, hat: 1, bass: 1, chords: 1, pad: 1, lead: 1, arp: 1, impact: true },
    bridge: { kick: 0, snare: 0, hat: 0.3, bass: 0.5, chords: 0.8, pad: 1, lead: 0.9, arp: 0.9, riserEnd: true, gap: true },
    outro: { kick: 0, snare: 0, hat: 0.2, bass: 0.3, chords: 0.5, pad: 0.8, lead: 0.4, arp: 0.4 }
  };

  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function scaleNote(tonic, mode, degree, base) {
    var st = STEPS[mode], oct = Math.floor(degree / 7), d = ((degree % 7) + 7) % 7;
    return base + tonic + st[d] + 12 * oct;
  }
  function chordName(tonic, mode, degree) {
    var r = scaleNote(tonic, mode, degree, 0), t = scaleNote(tonic, mode, degree + 2, 0) - r, f = scaleNote(tonic, mode, degree + 4, 0) - r;
    return NAMES[((r % 12) + 12) % 12] + (t === 3 ? (f === 6 ? 'dim' : 'm') : '');
  }

  /** Ripartisce le battute tra le sezioni: sempre somma esatta = bars. */
  function planStructure(bars) {
    var T;
    if (bars < 4) T = [['ritornello', 1]];
    else if (bars < 8) T = [['strofa', 2], ['ritornello', 2]];
    else if (bars < 16) T = [['intro', 1], ['strofa', 3], ['pre', 1], ['ritornello', 3]];
    else if (bars < 28) T = [['intro', 1], ['strofa', 4], ['pre', 1], ['ritornello', 4], ['outro', 1]];
    else T = [['intro', 2], ['strofa', 8], ['pre', 2], ['ritornello', 8], ['bridge', 4], ['ritornello', 8], ['outro', 2]];
    var sum = T.reduce(function (a, t) { return a + t[1]; }, 0), out = T.map(function (t) {
      var x = bars * t[1] / sum; return { name: t[0], bars: Math.max(1, Math.floor(x)), frac: x - Math.floor(x) };
    });
    var tot = out.reduce(function (a, o) { return a + o.bars; }, 0);
    while (tot < bars) { var bi = 0; out.forEach(function (o, i) { if (o.frac > out[bi].frac) bi = i; }); out[bi].bars++; out[bi].frac = -1; tot++; }
    while (tot > bars) { var mi = 0; out.forEach(function (o, i) { if (o.bars > out[mi].bars) mi = i; }); out[mi].bars--; tot--; }
    return out.map(function (o) { return [o.name, o.bars]; });
  }

  function biquad(x, type, f0, Q, sr) {
    var w = 2 * Math.PI * Math.min(f0, sr * 0.45) / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * Q), a0 = 1 + al, b0, b1, b2;
    if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
    var a1 = -2 * cw, a2 = 1 - al, y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    for (var i = 0; i < x.length; i++) {
      var v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }
  function blep(t, dt) {
    if (t < dt) { t /= dt; return t + t - t * t - 1; }
    if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
    return 0;
  }

  /**
   * @param {{sampleRate?:number,bpm?:number,tonic?:number,mode?:string,bars?:number,genre?:string,seed?:number,bassStyle?:string}} p
   */
  function generate(p) {
    p = p || {};
    var style = STYLES[p.genre] || STYLES.trap, genreKey = STYLES[p.genre] ? p.genre : 'trap';
    // Groove imparato da una base caricata (BeatLearn): solo numeri misurati, mai l'audio altrui.
    if (p.groove && typeof p.groove === 'object') {
      var gv = p.groove, st2 = {}, kk; for (kk in style) st2[kk] = style[kk];
      var okPat = function (a) { return Array.isArray(a) && a.length && a.every(function (x) { return x >= 0 && x < 16; }); };
      if (Array.isArray(gv.kickPats) && gv.kickPats.length && gv.kickPats.every(function (pp) { return Array.isArray(pp) && pp.length === 2 && okPat(pp[0]) && okPat(pp[1]); })) st2.kickPats = gv.kickPats;
      if (typeof gv.rolls === 'number') st2.rolls = Math.max(0, Math.min(1, gv.rolls));
      if (typeof gv.swing === 'number') st2.swing = Math.max(0, Math.min(0.3, gv.swing));
      if (okPat(gv.snare)) st2.snare = gv.snare;
      style = st2;
    }
    var tune = p.tune || {}, tHat = tune.hat == null ? 1 : tune.hat, tBass = tune.bass == null ? 1 : tune.bass, tLift = tune.lift == null ? 1 : tune.lift, tKick = tune.kickVar == null ? 1 : tune.kickVar;
    var sr = p.sampleRate || 32000, bpm = p.bpm || style.bpm;
    var tonic = ((p.tonic || 0) % 12 + 12) % 12, mode = p.mode === 'maggiore' ? 'maggiore' : 'minore';
    // Struttura dal testo (SongMap): p.plan = [[sezione, battute], ...]
    var givenPlan = Array.isArray(p.plan) && p.plan.length ? p.plan.filter(function (x) { return SEC[x[0]] && x[1] > 0; }).map(function (x) { return [x[0], Math.round(x[1])]; }) : null;
    var bars = givenPlan ? Math.min(160, givenPlan.reduce(function (a, x) { return a + x[1]; }, 0)) : Math.max(1, Math.min(64, p.bars || 32));
    var rand = rng(p.seed || 1);
    var stepSec = 60 / bpm / 4, stepLen = Math.round(stepSec * sr), N = stepLen * 16 * bars;
    var bassKind = p.bassStyle === '808' ? '808' : (style.bass);
    var T = { arp: new Float32Array(N), kick: new Float32Array(N), snare: new Float32Array(N), hat: new Float32Array(N), bass: new Float32Array(N), chords: new Float32Array(N), pad: new Float32Array(N), lead: new Float32Array(N), fx: new Float32Array(N) };
    var events = { bass: [], chords: [], lead: [], kick: [], hat: [], arp: [] }, kickStarts = [];
    function okNotes(a) { return Array.isArray(a) && a.length ? a.filter(function (n) { return n && n.bar >= 0 && n.step >= 0 && n.step < 16 && n.len > 0 && n.midi > 0; }) : null; }
    var NL = okNotes(p.notes && p.notes.lead), NB = okNotes(p.notes && p.notes.bass);
    // batteria a passi scritta a mano (16 passi, uguale in ogni battuta dove la batteria suona)
    var okS = function (a) { return Array.isArray(a) ? a.filter(function (x) { return x >= 0 && x < 16; }) : null; };
    var DP = p.drumPat && typeof p.drumPat === 'object' ? { kick: okS(p.drumPat.kick), snare: okS(p.drumPat.snare), hat: okS(p.drumPat.hat), rolls: p.drumPat.rolls !== false } : null;
    var LEADS = { trap: ['synth', 'keys', 'bell'], drill: ['dark', 'keys', 'bell'], epico: ['strings', 'synth', 'keys'], melodico: ['keys', 'synth', 'pluck'], boombap: ['keys', 'pluck', 'bell'], street: ['keys', 'bell', 'synth'], trapdark: ['dark', 'bell', 'keys'], clubtrap: ['bell', 'synth', 'marimba'], estate: ['marimba', 'keys', 'synth'] };
    // Strumenti veri scelti per ruolo (p.inst = {melodia, accordi, pad}); se non caricati si usa la sintesi.
    var pin = p.inst || {};
    function pickInst(role) { var id = pin[role]; return id && Inst && Inst.has(id) ? id : null; }
    var LI = pickInst('melodia'), CI = pickInst('accordi'), PI = pickInst('pad'), AI = pickInst('arpeggio');
    function fit(m, id) { var r = (Inst.info(id) || {}).range || [36, 96]; while (m < r[0]) m += 12; while (m > r[1]) m -= 12; return m; }
    var leadKind = p.lead || (p.heavy ? 'dark' : null) || (LEADS[genreKey] ? LEADS[genreKey][((p.seed || 1) % 3 + 3) % 3] : style.lead);

    function at(bar, step) {
      var sw = (Math.abs(step - Math.round(step)) < 1e-6 && Math.round(step) % 2 === 1) ? style.swing * stepLen : 0;
      return Math.round((bar * 16 + step) * stepLen + sw);
    }
    function add(tr, start, buf, gain) {
      if (start < 0) return;
      var a = T[tr];
      for (var i = 0; i < buf.length && start + i < N; i++) a[start + i] += buf[i] * gain;
    }
    var cache = {};
    function memo(k, fn) { return cache[k] || (cache[k] = fn()); }
    function noise() { return rand() * 2 - 1; }

    // ---------- suoni veri (campioni CC0) ----------
    var useSamples = p.sounds === 'campioni' && !!SampleData;
    var sampCache = {};
    function samp(kind, idx) {
      var arr = SampleData.data[kind], k = kind + (idx % arr.length);
      if (sampCache[k]) return sampCache[k];
      var bin = typeof atob === 'function' ? atob(arr[idx % arr.length]) : Buffer.from(arr[idx % arr.length], 'base64').toString('binary');
      var n = bin.length >> 1, src = new Float32Array(n), i;
      for (i = 0; i < n; i++) { var v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; src[i] = v / 32768; }
      var ratio = SampleData.sr / sr, len = Math.floor(n / ratio), out = new Float32Array(len);
      for (i = 0; i < len; i++) { var x = i * ratio, j = Math.floor(x), fr = x - j; out[i] = src[j] * (1 - fr) + (src[j + 1] || 0) * fr; }
      return (sampCache[k] = out);
    }
    var vKick = (p.seed || 1) % 3, vSnare = (p.seed || 1) % 3, vClap = ((p.seed || 1) + 1) % 3;
    function cut(buf, sec, fade) {
      var n = Math.min(buf.length, Math.round(sec * sr)), o = buf.slice(0, n), f = Math.min(n, Math.round(fade * sr));
      for (var i = 0; i < f; i++) o[n - 1 - i] *= i / f;
      return o;
    }

    // ---------- strumenti ----------
    function kickBuf(big) {
      if (useSamples) return memo('sk' + big, function () { return cut(samp('kick', vKick), big ? 0.5 : 0.34, 0.03); });
      return memo('k' + big, function () {
        var len = Math.round((big ? 0.5 : 0.34) * sr), b = new Float32Array(len), ph = 0;
        for (var i = 0; i < len; i++) {
          var t = i / sr, f = 42 + 110 * Math.exp(-t * 45);
          ph += 2 * Math.PI * f / sr;
          b[i] = (Math.sin(ph) * Math.exp(-t * (big ? 7 : 10)) + (i < 300 ? 0.25 * noise() * (1 - i / 300) : 0)) * Math.min(1, i / 30);
        }
        return b;
      });
    }
    function taikoBuf() {
      return memo('taiko', function () {
        var len = Math.round(0.9 * sr), b = new Float32Array(len), ph = 0;
        for (var i = 0; i < len; i++) {
          var t = i / sr, f = 58 + 40 * Math.exp(-t * 18);
          ph += 2 * Math.PI * f / sr;
          b[i] = (Math.sin(ph) * Math.exp(-t * 3.4) + 0.12 * noise() * Math.exp(-t * 30)) * Math.min(1, i / 40);
        }
        return b;
      });
    }
    function snareBuf() {
      if (useSamples) return memo('ss', function () { return cut(samp('snare', vSnare), 0.3, 0.03); });
      var len = Math.round(0.24 * sr), b = new Float32Array(len);
      for (var i = 0; i < len; i++) {
        var t = i / sr;
        b[i] = noise() * Math.exp(-t * 20) * 0.55 + Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 28) * 0.45;
      }
      return b;
    }
    function clapBuf() {
      if (useSamples) return memo('sc', function () { return cut(samp('clap', vClap), 0.3, 0.03); });
      var len = Math.round(0.3 * sr), b = new Float32Array(len), offs = [0, 0.011, 0.022, 0.034];
      for (var i = 0; i < len; i++) {
        var t = i / sr, v = 0;
        for (var k = 0; k < offs.length; k++) if (t >= offs[k]) v += Math.exp(-(t - offs[k]) * (k === 3 ? 18 : 90));
        b[i] = noise() * v * 0.3;
      }
      return biquad(b, 'bp', 1500, 0.8, sr);
    }
    function repitch(buf, ratio) {
      if (Math.abs(ratio - 1) < 1e-3) return buf;
      var len = Math.floor(buf.length / ratio), o = new Float32Array(len);
      for (var i = 0; i < len; i++) { var x = i * ratio, j = Math.floor(x), fr = x - j; o[i] = buf[j] * (1 - fr) + (buf[j + 1] || 0) * fr; }
      return o;
    }
    // pitch: 1 = normale; le rullate salgono o scendono di tono (come nelle produzioni trap).
    function hatBuf(open, vel, pitch) {
      pitch = pitch || 1;
      var pk = Math.round(pitch * 100) / 100;
      if (useSamples) return memo('sh' + open + vel + '_' + pk, function () { var b = repitch(cut(samp('hat', open ? 1 : 0), open ? 0.2 : 0.05, open ? 0.05 : 0.02), pk); for (var i = 0; i < b.length; i++) b[i] *= vel; return b; });
      return memo('h' + open + vel + '_' + pk, function () {
        var len = Math.round((open ? 0.2 : 0.05) * sr), b = new Float32Array(len), prev = 0;
        for (var i = 0; i < len; i++) {
          var t = i / sr, n = noise();
          b[i] = (n - prev) * Math.exp(-t * (open ? 20 : 85)) * 0.5 * vel; prev = n;
        }
        return repitch(b, pk);
      });
    }
    // 808: sinusoide con colpo iniziale, saturazione (armoniche: si sente anche dalle casse del telefono),
    // coda lunga fino alla nota dopo e glide (scivolata) logaritmico dalla nota precedente.
    function bass808(m, prevM, dur, slide) {
      var gl = style.glide || 0.08, drive = style.drive || 1.8;
      if (typeof p.bassRender === 'function') return memo('d8' + m + '_' + prevM + '_' + dur.toFixed(2) + slide, function () { return p.bassRender(m, dur, sr, slide ? prevM : null, gl); });
      return memo('b8' + m + '_' + prevM + '_' + dur.toFixed(2) + slide, function () {
        var len = Math.round(dur * sr), b = new Float32Array(len), ph = 0, f1 = mtof(m), f0 = (slide && prevM != null) ? mtof(prevM) : f1;
        var rel = Math.min(len, Math.round(0.03 * sr));
        for (var i = 0; i < len; i++) {
          var t = i / sr, g = f0 === f1 ? 1 : 1 - Math.exp(-t / (gl / 3));
          var f = f0 * Math.pow(f1 / f0, g) * (1 + (f0 === f1 ? 0.6 : 0.15) * Math.exp(-t * 60));
          ph += 2 * Math.PI * f / sr;
          var env = Math.exp(-t * 0.9) * (0.75 + 0.25 * Math.exp(-t * 8));
          var v = Math.tanh(Math.sin(ph) * drive * (0.6 + 0.4 * env)) / Math.tanh(drive);
          b[i] = (v * 0.9 + 0.1 * Math.sin(2 * ph)) * env * Math.min(1, i / 60) * Math.min(1, (len - i) / rel);
        }
        return b;
      });
    }
    function bassRound(m, dur, sub) {
      return memo('br' + m + '_' + dur.toFixed(2) + sub, function () {
        var len = Math.round(dur * sr), b = new Float32Array(len), ph = 0, f = mtof(m);
        for (var i = 0; i < len; i++) {
          var t = i / sr; ph += 2 * Math.PI * f / sr;
          b[i] = (Math.sin(ph) + (sub ? 0.15 : 0.32) * Math.sin(2 * ph)) * Math.exp(-t * (sub ? 1.4 : 3)) * Math.min(1, i / 200) * Math.min(1, (len - i) / 500);
        }
        return b;
      });
    }
    function pluckBuf(m, dur, bright) {
      return memo('pl' + m + '_' + dur.toFixed(2) + bright, function () {
        var len = Math.round(dur * sr), b = new Float32Array(len), f = mtof(m), amps = [1, 0.55, 0.3, 0.18, 0.1];
        for (var i = 0; i < len; i++) {
          var t = i / sr, v = 0;
          for (var h = 0; h < amps.length; h++) v += amps[h] * (bright ? 1 : 1 - h * 0.12) * Math.sin(2 * Math.PI * f * (h + 1) * t + h * 0.7) * Math.exp(-t * (2.8 + h * 2.4));
          b[i] = v * Math.min(1, i / 80) * Math.min(1, (len - i) / 400);
        }
        return b;
      });
    }
    function bellBuf(m, dur) {
      return memo('bl' + m + '_' + dur.toFixed(2), function () {
        var len = Math.round(dur * sr), b = new Float32Array(len), f = mtof(m);
        for (var i = 0; i < len; i++) {
          var t = i / sr, mod = 1.3 * Math.sin(2 * Math.PI * f * 3.5 * t) * Math.exp(-t * 6);
          b[i] = (Math.sin(2 * Math.PI * f * t + mod) * Math.exp(-t * 2.6) + 0.2 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 5)) * Math.min(1, i / 50) * Math.min(1, (len - i) / 600);
        }
        return b;
      });
    }
    function marimbaBuf(m, dur) {
      return memo('mb' + m + '_' + dur.toFixed(2), function () {
        var len = Math.round(dur * sr), b = new Float32Array(len), f = mtof(m);
        for (var i = 0; i < len; i++) {
          var t = i / sr;
          b[i] = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 6) + 0.4 * Math.sin(2 * Math.PI * f * 4 * t) * Math.exp(-t * 18)) * Math.min(1, i / 40) * Math.min(1, (len - i) / 400);
        }
        return b;
      });
    }
    // Archi / cori: più sega leggermente scordate (polyBLEP) + filtro: niente suono da "flautino".
    function sawStack(midis, dur, dets, lp, atk, rel, formants) {
      return memo('sw' + midis.join(',') + '_' + dur.toFixed(2) + lp + atk + (formants ? 'f' : ''), function () {
        var len = Math.round(dur * sr), b = new Float32Array(len), nOsc = midis.length * dets.length;
        midis.forEach(function (m) {
          dets.forEach(function (c, di) {
            var f = mtof(m) * Math.pow(2, c / 1200), dt = f / sr, ph = (di * 0.31 + m * 0.07) % 1;
            for (var i = 0; i < len; i++) {
              b[i] += (2 * ph - 1 - blep(ph, dt)) / nOsc;
              ph += dt; if (ph >= 1) ph -= 1;
            }
          });
        });
        var y = biquad(b, 'lp', lp, 0.8, sr);
        if (formants) {
          var f1 = biquad(y, 'bp', 700, 4, sr), f2 = biquad(y, 'bp', 1150, 5, sr), f3 = biquad(y, 'bp', 2600, 6, sr);
          for (var k = 0; k < len; k++) y[k] = y[k] * 0.45 + (f1[k] + f2[k] * 0.8 + f3[k] * 0.4) * 1.6;
        }
        var A = Math.max(1, atk * sr), R = Math.max(1, rel * sr);
        for (var j = 0; j < len; j++) y[j] *= Math.min(1, j / A) * Math.min(1, (len - j) / R);
        return y;
      });
    }
    function keysBuf(m, dur) {
      return memo('ky' + m + '_' + dur.toFixed(2), function () {
        var len = Math.round(dur * sr), b = new Float32Array(len), f = mtof(m);
        for (var i = 0; i < len; i++) {
          var t = i / sr, idx = 1.6 * Math.exp(-t * 5) + 0.25;
          var tine = Math.sin(2 * Math.PI * f * t + idx * Math.sin(2 * Math.PI * f * t));
          var body = 0.35 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 7) + 0.18 * Math.sin(2 * Math.PI * f * 0.5 * t) * Math.exp(-t * 3);
          b[i] = (tine * Math.exp(-t * 2.2) + body) * 0.8 * Math.min(1, i / 40) * Math.min(1, (len - i) / 800) * (1 + 0.06 * Math.sin(2 * Math.PI * 5.2 * t));
        }
        return biquad(b, 'lp', 3800, 0.7, sr);
      });
    }
    function synthLeadBuf(m, dur, dark) {
      return memo('sl' + m + '_' + dur.toFixed(2) + dark, function () {
        var lo = sawStack([m], dur, [-14, -5, 5, 14], dark ? 500 : 650, 0.004, 0.06, false), hi = sawStack([m], dur, [-14, -5, 5, 14], dark ? 1800 : 4200, 0.004, 0.06, false);
        var sub = new Float32Array(lo.length), ph = 0, f = mtof(m - 12);
        for (var i = 0; i < lo.length; i++) { var t = i / sr, w = Math.exp(-t * 9); sub[i] = lo[i] + (hi[i] - lo[i]) * w * 1.1 + 0.25 * Math.sin(ph) * Math.min(1, i / 60) * Math.min(1, (lo.length - i) / 600); ph += 2 * Math.PI * f / sr; }
        return sub;
      });
    }
    function leadBuf(kind, m, dur) {
      if (kind === 'keys') return keysBuf(m, dur);
      if (kind === 'synth') return synthLeadBuf(m, dur, false);
      if (kind === 'dark') return synthLeadBuf(m, dur, true);
      if (kind === 'bell') return bellBuf(m, dur);
      if (kind === 'marimba') return marimbaBuf(m, dur);
      if (kind === 'strings') return sawStack([m], dur, [-9, 0, 8], 2400, 0.12, 0.2, false);
      return pluckBuf(m, dur, true);
    }
    function riserBuf(dur) {
      var len = Math.round(dur * sr), b = new Float32Array(len), ph = 0, prev = 0;
      for (var i = 0; i < len; i++) {
        var t = i / len, n = noise(), hp = n - prev; prev = n;
        ph += 2 * Math.PI * (200 + 1800 * t * t) / sr;
        b[i] = (hp * 0.35 + Math.sin(ph) * 0.25) * t * t * Math.min(1, (len - i) / 200);
      }
      return b;
    }
    function impactBuf() {
      var len = Math.round(1.4 * sr), b = new Float32Array(len), ph = 0;
      for (var i = 0; i < len; i++) {
        var t = i / sr; ph += 2 * Math.PI * (48 + 40 * Math.exp(-t * 6)) / sr;
        b[i] = Math.sin(ph) * Math.exp(-t * 2.4) * 0.9 + noise() * Math.exp(-t * 7) * 0.35;
      }
      return b;
    }

    // ---------- piano della canzone ----------
    var plan = givenPlan || planStructure(bars), sections = [], cursor = 0;
    plan.forEach(function (s) { sections.push({ name: s[0], startBar: cursor, bars: s[1], startSec: cursor * stepLen * 16 / sr, endSec: (cursor + s[1]) * stepLen * 16 / sr }); cursor += s[1]; });
    var progs = PROGS[mode], pick = [];
    var pa = Math.floor(rand() * progs.length), pb = (pa + 1 + Math.floor(rand() * (progs.length - 1))) % progs.length, pc = (pb + 1) % progs.length;
    if (pc === pa) pc = (pc + 1) % progs.length;
    if (p.melSeed) { var rq = rng(((p.melSeed * 104729) + (p.seed || 1) * 13 + 5) >>> 0); pa = Math.floor(rq() * progs.length); pb = (pa + 1 + Math.floor(rq() * (progs.length - 1))) % progs.length; pc = (pb + 1) % progs.length; if (pc === pa) pc = (pc + 1) % progs.length; }
    pick = { strofa: progs[pa], intro: progs[pa], pre: progs[pa], ritornello: progs[pb], bridge: progs[pc], outro: progs[pa] };
    // progressione imparata da una base caricata (gradi della scala, 4 accordi): strofa e ritornello la usano, il bridge resta diverso
    if (Array.isArray(p.prog) && p.prog.length === 4 && p.prog.every(function (d) { return d >= 0 && d < 7; })) { pick.strofa = pick.intro = pick.pre = pick.outro = p.prog; pick.ritornello = p.prog; }

    // Ritornello: frase "gancio" generata una volta e ripetuta uguale (i ritornelli devono somigliarsi).
    var scaleM = [];
    for (var d0 = 7; d0 <= 14; d0++) scaleM.push(scaleNote(tonic, mode, d0, 48));
    /* Melodia nuova: un motivo corto (3-5 note) che si ripete con piccole variazioni e chiude sulla tonica.
       Note scelte nella pentatonica (con la seconda minore come nota "scura" nei generi duri), contorno spesso discendente,
       ritmi radi con pause: suona trap/drill/hip hop, non una passeggiata a caso sulla scala. Seme proprio: p.melSeed. */
    var rm = rng(((p.melSeed || 0) * 7919 + (p.seed || 1) * 31 + 17) >>> 0), HARD = { trap: 1, drill: 1, trapdark: 1, street: 1, boombap: 1, clubtrap: 1, epico: 1 }[genreKey] === 1;
    var PENT = mode === 'minore' ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
    var CONT = [[0, -1, -2, -1], [2, 1, 0, 0], [0, 0, -1, -3], [1, 0, -1, 0, -2], [3, 2, 2, 0], [0, 1, 0, -2], [2, 0, 1, -1, -2], [0, -2, -1, -3]];
    var RHY = [[0, 3, 6, 10], [0, 4, 7, 10, 12], [0, 6, 8, 14], [0, 2, 3, 8, 11], [0, 3, 8, 10], [0, 5, 8, 12], [0, 3, 6, 8, 12], [0, 4, 10]];
    function pitch(deg, oct) { var n = PENT.length, o = Math.floor(deg / n), d = ((deg % n) + n) % n; var m = 60 + tonic + PENT[d] + 12 * (o + (oct || 0)) + (p.heavy ? -12 : (style.leadShift == null ? 12 : style.leadShift)); while (m > 79 + (style.leadShift == null ? 12 : 0) - (p.heavy ? 12 : 0)) m -= 12; while (m < 45) m += 12; return m; }
    function makePhrase(progression) {
      var cont = CONT[Math.floor(rm() * CONT.length)], rhy = RHY[Math.floor(rm() * RHY.length)], start = 2 + Math.floor(rm() * 4), phrase = [], bi, k;
      var dark = (HARD || p.heavy) && rm() < (p.heavy ? 0.85 : 0.45) && mode === 'minore';
      for (bi = 0; bi < 4; bi++) {
        var evs = [], rr = rhy.slice(), shiftDeg = bi === 2 ? Math.floor(rm() * 3) - 1 : 0;
        if (bi % 2 === 1 && rr.length > 3 && rm() < 0.6) rr.splice(1 + Math.floor(rm() * (rr.length - 2)), 1); // variazione: una nota in meno
        for (k = 0; k < rr.length; k++) {
          var step = rr[k], nxt = k + 1 < rr.length ? rr[k + 1] : 16, len = Math.max(1, Math.min(nxt - step, 16 - step));
          if (rm() < (p.heavy ? 0.3 : 0.18) && k > 0 && bi !== 3) continue; // pausa
          var deg = start + cont[k % cont.length] + shiftDeg, midi = pitch(deg);
          if (bi === 3 && k === rr.length - 1) { midi = pitch(0, 0); len = Math.max(len, 4); step = Math.min(step, 12); }
          else if (dark && k === 1 && bi % 2 === 0) midi = 60 + tonic + 1 + (p.heavy ? -12 : (style.leadShift == null ? 12 : style.leadShift)); // seconda minore: nota scura
          if (bi === 0 && k === 0 && rm() < 0.4) len = Math.min(16 - step, len + 2);
          evs.push({ step: step, len: len, midi: midi });
        }
        phrase.push(evs);
      }
      if (HARD) phrase[2] = phrase[0].map(function (e) { return { step: e.step, len: e.len, midi: e.midi }; }); // gancio: frase di 2 battute ripetuta (A B A B')
      return phrase;
    }
    var patA = Math.floor(rand() * style.kickPats.length), patB = (patA + 1) % style.kickPats.length;
    var hook = makePhrase(pick.ritornello), bridgeLine = makePhrase(pick.bridge), introTease = hook;
    var prevBassMidi = null, arpCount = 0;

    // Rullate di hi-hat: [colpi per passo, durata in passi]. 1/32 = 2 per passo, terzina = 3 in 2 passi, 1/48 = 3, 1/64 = 4.
    var ROLLS = [[2, 2], [1.5, 2], [3, 1], [2, 4], [4, 1], [1.5, 4]];
    function addHats(bar, lvl, kind, lastBar, secName) {
      var hits = [], i, rollAmt = (style.rolls || 0) * Math.max(0.5, tHat);
      if (kind === 'trap') {
        var dense = lvl >= 0.9;
        for (i = 0; i < 16; i += dense ? 1 : 2) hits.push([i, i % 4 === 0 ? 0.85 : (i % 2 ? 0.4 : 0.55)]);
      } else if (kind === 'drill') {
        for (i = 0; i < 12; i++) if (i % 6 !== 5 || rand() < 0.5) hits.push([i * 16 / 12, i % 3 === 0 ? 0.85 : 0.45]);
      } else if (kind === 'shaker') {
        for (i = 0; i < 16; i += 2) hits.push([i, 0.3 + (i % 4 === 0 ? 0.15 : 0)]);
      } else if (kind === 'soft') {
        for (i = 0; i < 16; i++) hits.push([i, i % 4 === 2 ? 0.7 : (i % 2 ? 0.28 : 0.45)]);
      } else { for (i = 2; i < 16; i += 4) hits.push([i, 0.8]); for (i = 0; i < 16; i += 4) hits.push([i, 0.3]); }
      if (DP && DP.hat) hits = DP.hat.map(function (st) { return [st, st % 4 === 0 ? 0.85 : (st % 2 ? 0.45 : 0.6)]; });
      var rolls = [];
      if (rollAmt > 0 && lvl >= 0.55) {
        var nR = rand() < rollAmt * lvl ? 1 : 0;
        if (nR && lvl >= 0.9 && rand() < rollAmt * 0.6) nR = 2;
        var spots = [6, 14, 10, 2];
        for (var r = 0; r < nR; r++) {
          var type = ROLLS[Math.floor(rand() * ROLLS.length)], st = spots[Math.floor(rand() * 2) + (r ? 2 : 0)];
          if (st + type[1] > 16) st = 16 - type[1];
          rolls.push({ st: st, per: type[0], len: type[1], up: rand() < 0.6 });
        }
        if (lastBar && lvl >= 0.9) rolls.push({ st: 12, per: 2, len: 4, up: true, big: true }); // rullata di fine frase
      }
      if (DP && !DP.rolls) rolls = [];
      var thr = (1 - lvl) * 0.8;
      hits.forEach(function (h) {
        if (h[1] < thr) return;
        if (rolls.some(function (ro) { return h[0] >= ro.st - 1e-6 && h[0] < ro.st + ro.len - 1e-6; })) return;
        var open = (kind === 'offbeat' && h[0] % 4 === 2) || (kind === 'trap' && h[0] === 14 && rand() < 0.3);
        add('hat', at(bar, h[0]), hatBuf(open, 1), 0.5 * h[1] * (0.9 + 0.2 * rand()));
        events.hat.push({ bar: bar, step: h[0], vel: h[1], roll: false });
      });
      rolls.forEach(function (ro) {
        var n = Math.round(ro.per * ro.len);
        for (var j = 0; j < n; j++) {
          var pos = ro.st + j / ro.per, k = j / Math.max(1, n - 1), vel = ro.big ? 0.3 + 0.6 * k : 0.35 + 0.35 * (ro.up ? k : 1 - k);
          var pitch = ro.big || ro.up ? 1 + 0.25 * k : 1 - 0.15 * k;
          add('hat', at(bar, pos), hatBuf(false, 1, pitch), 0.5 * vel);
          events.hat.push({ bar: bar, step: pos, vel: vel, roll: true });
        }
      });
    }

    // ---------- costruzione battuta per battuta ----------
    sections.forEach(function (sec) {
      var cfg = Object.assign({}, SEC[sec.name]), prog = pick[sec.name];
      if (sec.name === 'strofa') { cfg.chords /= tLift; cfg.pad /= tLift; cfg.bass = Math.min(1.3, cfg.bass * tBass); }
      else if (sec.name === 'ritornello') { cfg.chords = Math.min(1.4, cfg.chords * tLift); cfg.pad = Math.min(1.4, cfg.pad * tLift); cfg.lead = Math.min(1.3, cfg.lead * tLift); cfg.bass = Math.min(1.3, cfg.bass * tBass); }
      cfg.hat = Math.min(1, cfg.hat * tHat);
      for (var k = 0; k < sec.bars; k++) {
        var bar = sec.startBar + k, deg = prog[k % 4], barLen = stepLen * 16;
        if (p.chordBars && p.chordBars[bar] != null && p.chordBars[bar] >= 0 && p.chordBars[bar] < 7) deg = +p.chordBars[bar]; // accordo scelto a mano per questa battuta
        var lastBar = k === sec.bars - 1, firstBar = k === 0;
        var ch = [0, 2, 4].map(function (o) { return scaleNote(tonic, mode, deg + o, 48); });
        events.chords.push({ bar: bar, name: chordName(tonic, mode, deg), midis: ch, section: sec.name });
        var rootM = scaleNote(tonic, mode, deg, 36), fifthM = scaleNote(tonic, mode, deg + 4, 36);
        var kickSteps = [];

        // batteria
        if (cfg.kick) {
          // pattern dello stile (2 battute) ripetuto; ogni 4a battuta una variazione.
          var pats = style.kickPats, pat = pats[(sec.name === 'ritornello' ? patB : patA) % pats.length];
          kickSteps = pat[k % 2].slice();
          if (k % 4 === 3 && style.kickExtra.length) {
            var tries = 0, want = 1 + Math.floor(rand() * 2);
            while (want > 0 && tries++ < 10) { var c = style.kickExtra[Math.floor(rand() * style.kickExtra.length)]; if (kickSteps.indexOf(c) < 0) { kickSteps.push(c); want--; } }
            if (kickSteps.length > 3 && rand() < 0.5) kickSteps.splice(1, 1);
          } else if (!style.kickExtra.length && k % 4 === 3) kickSteps.push(14);
          if (tKick > 1) { for (var q = 0; q < Math.round((tKick - 1) * 2); q++) { var c2 = style.kickExtra[Math.floor(rand() * style.kickExtra.length)]; if (c2 != null && kickSteps.indexOf(c2) < 0) kickSteps.push(c2); } }
          else if (tKick < 1) kickSteps = kickSteps.filter(function (s) { return s === 0 || rand() < tKick; });
          if (DP && DP.kick) kickSteps = DP.kick.slice();
          if (cfg.gap && lastBar) kickSteps = kickSteps.filter(function (s) { return s < 12; });
          kickSteps.sort(function (a, b) { return a - b; });
          kickSteps.forEach(function (s) {
            var big = s === 0 && cfg.kick >= 1 && sec.name === 'ritornello';
            add('kick', at(bar, s), kickBuf(big || style.taiko), 0.9 * cfg.kick); kickStarts.push(at(bar, s)); events.kick.push({ bar: bar, step: s });
          });
          if (style.taiko && (sec.name === 'ritornello' || sec.name === 'pre')) {
            add('kick', at(bar, 0), taikoBuf(), 0.55); if (k % 2 === 1) add('kick', at(bar, 10), taikoBuf(), 0.4);
          }
        }
        if (cfg.snare && !(cfg.gap && lastBar && !cfg.roll)) {
          ((DP && DP.snare) || style.snare).forEach(function (s) {
            if (cfg.roll && lastBar) return;
            add('snare', at(bar, s), snareBuf(), 0.55 * cfg.snare);
            if (style.clap) add('snare', at(bar, s), clapBuf(), 0.7 * cfg.snare);
          });
          /* ghost snare: colpi piano tra i principali (tendenza trap), con seme proprio per non cambiare il resto */
          if (HARD && !lastBar && cfg.snare >= 0.7) { var gs = [5, 7, 13, 15][Math.floor(rm() * 4)]; if (rm() < 0.55) add('snare', at(bar, gs), snareBuf(), 0.13 * cfg.snare); }
        }
        if (cfg.roll && lastBar) { // rullo di rullante crescente
          for (var r = 0; r < 12; r++) add('snare', at(bar, 8 + r * 8 / 12), snareBuf(), 0.15 + 0.5 * r / 12);
        } else if (cfg.kick && lastBar && sec.bars >= 4 && sec.name !== 'pre' && rand() < 0.7) { // piccolo fill a fine frase
          for (var f = 0; f < 4; f++) add('snare', at(bar, 12 + f), snareBuf(), 0.18 + 0.12 * f);
        }
        if (cfg.hat) addHats(bar, cfg.hat, style.hat, lastBar, sec.name);

        // basso
        if (cfg.bass) {
          var bs = cfg.kick ? kickSteps.slice() : [0, 8];
          if (!bs.length || bs[0] !== 0) bs.unshift(0);
          bs = bs.filter(function (s, i2, a) { return a.indexOf(s) === i2; });
          bs.forEach(function (s, bi2) {
            var next = bi2 + 1 < bs.length ? bs[bi2 + 1] : 16, dur = Math.min((next - s) * stepSec * 1.0, bassKind === '808' ? 2.2 : 1.6);
            var midi = rootM, r2 = rand();
            var octP = bassKind === '808' ? (genreKey === 'drill' ? 0.4 : 0.22) : 0.12;
            if (s !== 0) midi = r2 < 0.18 ? fifthM : (r2 < 0.18 + octP ? rootM + 12 : rootM);
            var buf, sl = false;
            if (bassKind === '808') {
              sl = style.slide > 0 && prevBassMidi != null && prevBassMidi !== midi && rand() < style.slide;
              buf = bass808(midi, sl ? prevBassMidi : null, dur, sl);
            } else buf = bassRound(midi, dur, bassKind === 'sub');
            if (!NB) add('bass', at(bar, s), buf, 0.75 * cfg.bass);
            if (!NB) events.bass.push({ start: at(bar, s) / sr, midi: midi, dur: dur, bar: bar, step: s, len: next - s, slide: !!sl, slideFrom: (bassKind === '808' && sl) ? prevBassMidi : null }); prevBassMidi = midi;
          });
        }

        // accordi a colpi / arpeggi
        if (cfg.chords && style.chordPat.length) {
          style.chordPat.forEach(function (s, pi) {
            if (sec.name === 'strofa' && pi % 2 === 1 && style.chord === 'pluck' && genreKey !== 'melodico') return;
            var notes = style.arp ? [ch[arpCount++ % 3] + (pi % 4 === 3 ? 12 : 0)] : ch.map(function (m) { return m + 12; });
            var dur = style.chord === 'ostinato' ? stepSec * 1.6 : 1.2;
            if (CI) {
              var tipoC = (Inst.info(CI) || {}).tipo, strum = /guitar|nylon/.test(CI) ? 0.022 : 0.01;
              notes.forEach(function (m, ni) { var mm = fit(m, CI); add('chords', at(bar, s) + ni * Math.round(strum * sr), Inst.render(CI, mm, tipoC === 'sostenuto' ? stepSec * 2 : 1.0, sr, { vel: pi === 0 ? 1 : 0.8 }), notes.length > 1 ? 0.2 : 0.3); });
              return;
            }
            notes.forEach(function (m, ni) { add('chords', at(bar, s) + ni * Math.round(0.012 * sr), style.chord === 'ostinato' ? sawStack([m], dur, [-6, 6], 1800, 0.004, 0.05, false) : pluckBuf(m, dur, genreKey === 'estate'), (style.arp ? 0.3 : 0.2) * cfg.chords); });
          });
        }

        // arpeggio: le note dell'accordo una dopo l'altra (schema diverso tra strofa e ritornello)
        if (cfg.arp && p.arp !== false) {
          var apn = ARP[(ARP_STYLE[genreKey] || ARP_STYLE.trap)[sec.name === 'ritornello' || sec.name === 'bridge' ? 1 : 0]];
          if (p.arpPattern && ARP[p.arpPattern]) apn = ARP[p.arpPattern];
          var ext = [0, 2, 4, 7, 9, 11].map(function (o) { return scaleNote(tonic, mode, deg + o, 60); });
          var stepA = 16 / apn.per, durA = Math.min(0.9, stepSec * stepA * 1.6);
          for (var ai = 0; ai < apn.per; ai++) {
            var ix = apn.seq[ai % apn.seq.length]; if (ix < 0) continue;
            if (cfg.gap && lastBar && ai * stepA >= 14) break;
            var am = ext[ix], vel = ai % (apn.per / 4) === 0 ? 1 : 0.7;
            var abuf = AI ? Inst.render(AI, fit(am, AI), durA, sr, { vel: vel }) : pluckBuf(am, durA, true);
            add('arp', at(bar, ai * stepA), abuf, (AI ? 0.2 : 0.16) * cfg.arp * vel);
            events.arp.push({ start: at(bar, ai * stepA) / sr, midi: am });
          }
        }

        // pad / archi / coro: una nota lunga per battuta, legata alla battuta dopo
        if (cfg.pad && PI) {
          var tipoP = (Inst.info(PI) || {}).tipo, durP = barLen / sr * 1.04;
          ch.concat([ch[0] + 12]).forEach(function (m) { add('pad', bar * barLen, Inst.render(PI, fit(m + 12, PI), durP, sr, { hold: true, attack: tipoP === 'sostenuto' ? 0.25 : 0 }), 0.12 * cfg.pad); });
        } else if (cfg.pad) {
          var kindPad = style.pad, pm = ch.concat([ch[0] + 12]), dur2 = barLen / sr * 1.06;
          var buf2 = kindPad === 'choir' ? sawStack(pm, dur2, [-10, 0, 9], 2200, 0.25, 0.3, true)
            : sawStack(pm, dur2, [-8, 0, 7], kindPad === 'dark' ? 900 : (kindPad === 'bright' ? 2600 : 1500), 0.3, 0.35, false);
          add('pad', bar * barLen, buf2, (kindPad === 'choir' ? 0.5 : 0.42) * cfg.pad);
        }

        // melodia
        if (cfg.lead && !NL) {
          var src = sec.name === 'bridge' ? bridgeLine : hook;
          src[k % 4].forEach(function (n) {
            var d3 = n.len * stepSec * 0.95, m3 = n.midi;
            if (LI) add('lead', at(bar, n.step), Inst.render(LI, fit(m3, LI), d3, sr, { vel: n.step % 4 === 0 ? 1 : 0.85 }), 0.3 * cfg.lead);
            else add('lead', at(bar, n.step), leadBuf(leadKind, m3, d3), (leadKind === 'strings' ? 0.32 : 0.36) * cfg.lead);
            events.lead.push({ start: at(bar, n.step) / sr, midi: m3, dur: d3, bar: bar, step: n.step, len: n.len });
          });
        }

        // effetti
        if (cfg.riserEnd && lastBar) add('fx', bar * barLen, riserBuf(barLen / sr), 0.7);
        if (cfg.impact && firstBar) add('fx', bar * barLen, impactBuf(), 0.8);
        if (cfg.gap && lastBar) { // respiro: ultimi 2 passi muti (tranne fx)
          var g0 = at(bar, 14), g1 = at(bar + 1, 0);
          ['kick', 'snare', 'hat', 'bass', 'chords', 'pad', 'lead'].forEach(function (tr) {
            for (var z = g0; z < g1 && z < N; z++) T[tr][z] *= Math.max(0, 1 - (z - g0) / 200);
          });
        }
      }
    });

    // note scritte a mano nel piano roll (sostituiscono quelle generate; il resto della base resta identico)
    if (NL) NL.forEach(function (n) {
      if (n.bar >= bars) return; var d3 = n.len * stepSec * 0.95, vel = n.vel == null ? 0.9 : n.vel;
      if (LI) add('lead', at(n.bar, n.step), Inst.render(LI, fit(n.midi, LI), d3, sr, { vel: vel }), 0.3);
      else add('lead', at(n.bar, n.step), leadBuf(leadKind, n.midi, d3), 0.36 * vel);
      events.lead.push({ start: at(n.bar, n.step) / sr, midi: n.midi, dur: d3, bar: n.bar, step: n.step, len: n.len, edited: true });
    });
    if (NB) { var pm2 = null; NB.slice().sort(function (a, b) { return a.bar * 16 + a.step - b.bar * 16 - b.step; }).forEach(function (n) {
      if (n.bar >= bars) return; var dur = Math.min(n.len * stepSec, 2.2), sl = !!n.slide && pm2 != null && pm2 !== n.midi;
      add('bass', at(n.bar, n.step), bassKind === '808' ? bass808(n.midi, sl ? pm2 : null, dur, sl) : bassRound(n.midi, dur, bassKind === 'sub'), 0.75);
      events.bass.push({ start: at(n.bar, n.step) / sr, midi: n.midi, dur: dur, bar: n.bar, step: n.step, len: n.len, slide: sl, edited: true }); pm2 = n.midi;
    }); }

    // percussioni del mondo: la funzione riceve le sezioni vere e restituisce colpi {bar, step, buf, track, gain}
    var percEv = typeof p.percEvents === 'function' ? p.percEvents(sections, sr) : null;
    if (percEv) percEv.forEach(function (f) { if (f.bar < bars) add(T[f.track] ? f.track : 'hat', f.bar * stepLen * 16 + Math.round((f.step || 0) * stepLen), f.buf, f.gain == null ? 0.4 : f.gain); });
    // effetti di transizione messi a mano (riser, impact, reverse…): {bar, buf, end}
    if (Array.isArray(p.extraFx)) p.extraFx.forEach(function (f) {
      if (!f || !f.buf || f.bar == null || f.bar > bars) return;
      var at0 = f.end ? f.bar * stepLen * 16 - f.buf.length : f.bar * stepLen * 16 + Math.round((f.step || 0) * stepLen); add(f.track && T[f.track] ? f.track : 'fx', Math.max(0, at0), f.buf, f.gain == null ? 0.7 : f.gain);
    });

    // "pompaggio": accordi e pad si abbassano a ogni cassa, come in produzione moderna
    function duck(tr, depth) {
      var a = T[tr], rel = Math.round(0.16 * sr), span = Math.round(0.35 * sr);
      kickStarts.forEach(function (s0) {
        for (var i = 0; i < span && s0 + i < N; i++) a[s0 + i] *= 1 - depth * Math.exp(-i / rel);
      });
    }
    duck('pad', style.duck); duck('chords', style.duck * 0.6); duck('arp', style.duck * 0.5);

    return { sampleRate: sr, bpm: bpm, tonic: tonic, mode: mode, bars: bars, genre: genreKey, length: N, duration: N / sr, tracks: T, events: events,
      inst: { melodia: LI, accordi: CI, pad: PI, arpeggio: AI }, sections: sections, progression: events.chords.slice(0, 4).map(function (c) { return c.name; }), arranger: true };
  }

  return { generate: generate, planStructure: planStructure, STYLES: STYLES, SECTIONS: SEC, ARP: ARP, ARP_STYLE: ARP_STYLE };
});
