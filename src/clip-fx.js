/*
 * Effetti del videoclip a tempo di musica: calcolo puro, senza disegno.
 * Dato il tempo trascorso e i battiti al minuto, dice quanto ingrandire
 * l'immagine, quanto farla vibrare e quale riga del testo mostrare.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ClipFx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function beatState(t, bpm) {
    var beatLen = 60 / bpm, b = Math.max(0, t) / beatLen, beat = Math.floor(b), phase = b - beat;
    return { beat: beat, phase: phase, bar: Math.floor(beat / 4), beatInBar: beat % 4, pulse: Math.exp(-phase * 5) };
  }

  function lyricAt(lines, bar) {
    var l = (lines || []).filter(function (x) { return x && x.trim(); });
    return l.length ? l[((bar % l.length) + l.length) % l.length] : '';
  }

  // Hash semplice per vibrazioni ripetibili
  function noise(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function frame(t, bpm) {
    var s = beatState(t, bpm), down = s.beatInBar === 0;
    var scale = 1 + 0.035 * s.pulse + (down ? 0.035 * s.pulse : 0);
    var glitch = down && s.phase < 0.15 ? (0.15 - s.phase) / 0.15 : 0;
    return {
      beat: s.beat, bar: s.bar, beatInBar: s.beatInBar, phase: s.phase,
      scale: scale,
      shakeX: (noise(s.beat * 3 + 1) - 0.5) * 14 * glitch,
      shakeY: (noise(s.beat * 3 + 2) - 0.5) * 10 * glitch,
      split: 7 * glitch + 1.5 * s.pulse,
      flash: down ? 0.25 * s.pulse : 0.08 * s.pulse
    };
  }

  /**
   * Tempi del testo che scorre (karaoke) basati sulle SILLABE, non su un tempo fisso.
   * lines: righe; opt.bpm; opt.syll(riga) -> sillabe; opt.modes {riga: 'canta'|'parla'|'allunga'};
   * opt.barsPerLine: numero fisso oppure 'auto'.
   * Velocità tipiche (Analisi, da regolare): parlato/rap ~5,5 sillabe al secondo, cantato ~3, note lunghe ~1,8.
   * Ogni riga occupa 1, 2 o 4 battute (le frasi musicali stanno su multipli di battuta).
   * Le parole sono distribuite per sillabe sull'85% della riga (si finisce prima della battuta dopo).
   */
  var RATE = { parla: 5.5, canta: 3, allunga: 1.8 };
  function timeline(lines, opt) {
    opt = opt || {};
    var barSec = 4 * 60 / (opt.bpm || 100), out = [], bar = 0;
    var syll = opt.syll || function (l) { return Math.max(1, Math.round(l.replace(/[^a-zàèéìòù]/gi, '').length / 2.2)); };
    var sy0 = syll; syll = function (l) { var v = sy0(l); return typeof v === 'object' && v ? (v.metric || v.raw || 1) : v; };
    (lines || []).filter(function (x) { return x && x.trim(); }).forEach(function (text) {
      var mode = (opt.modes && opt.modes[text]) || 'canta', n = Math.max(1, syll(text)), bars;
      if (opt.barsPerLine && opt.barsPerLine !== 'auto') bars = +opt.barsPerLine;
      else {
        var need = n / RATE[mode] / barSec;
        bars = need <= 1.25 ? 1 : (need <= 2.6 ? 2 : 4);
      }
      var start = bar * barSec, dur = bars * barSec, words = text.trim().split(/\s+/), ws = words.map(function (w) { return Math.max(1, syll(w)); });
      var tot = ws.reduce(function (a, b) { return a + b; }, 0), sing = Math.min(dur * 0.85, n / RATE[mode] * 1.05), acc = 0;
      out.push({ text: text, mode: mode, syllables: n, startBar: bar, bars: bars, start: start, end: start + dur,
        words: words.map(function (w, i) { var a = start + sing * acc / tot; acc += ws[i]; return { w: w, start: a, end: start + sing * acc / tot }; }) });
      bar += bars;
    });
    return out;
  }
  function lineAt(tl, t) {
    if (!tl.length) return null;
    var total = tl[tl.length - 1].end, tt = t % total, i;
    for (i = 0; i < tl.length; i++) if (tt < tl[i].end) break;
    var L = tl[Math.min(i, tl.length - 1)], w = -1;
    L.words.forEach(function (x, k) { if (tt >= x.start) w = k; });
    return { index: Math.min(i, tl.length - 1), line: L, word: w, next: tl[(Math.min(i, tl.length - 1) + 1) % tl.length], bar: Math.min(L.bars - 1, Math.floor((tt - L.start) / ((L.end - L.start) / L.bars))) };
  }

  return { beatState: beatState, lyricAt: lyricAt, frame: frame, timeline: timeline, lineAt: lineAt };
});
