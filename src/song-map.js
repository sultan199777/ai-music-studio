/*
 * Mappa della canzone: il TESTO decide la struttura della base.
 * - I titoli tra parentesi quadre ([Strofa], [Ritornello], [Bridge], [Pre], [Intro], [Outro])
 *   diventano sezioni della base; senza titoli tutto il testo è una strofa.
 * - Ogni riga riceve 1, 2 o 4 battute in base alle sillabe e al modo (canta/parla/allunga).
 * - Ogni sezione è arrotondata a un numero pari di battute (le frasi musicali vanno a coppie):
 *   le battute in più restano strumentali (respiro).
 * - Prima del testo c'è un'intro (2 battute), alla fine un'outro (2 battute).
 * Così ogni riga cade esattamente sulla sua battuta: testo e base vanno insieme.
 * Velocità di riferimento (Analisi, regolabili): parla 4,5 sillabe/s, canta 2,5, allunga 1,5.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SongMap = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RATE = { parla: 4.5, canta: 2.5, allunga: 1.5 };
  var MINB = { parla: 1, canta: 2, allunga: 2 };
  var TAGS = [[/^(rit|ritornello|chorus|hook|coro)/i, 'ritornello'], [/^(pre|pre-?rit|prechorus|pre-chorus)/i, 'pre'], [/^(bridge|ponte)/i, 'bridge'],
    [/^(intro)/i, 'intro'], [/^(outro|finale|chiusura)/i, 'outro'], [/^(strofa|verse|verso|str)/i, 'strofa']];

  function tagOf(line) {
    var m = /^\[(.*)\]$/.exec(line.trim()); if (!m) return null;
    var t = m[1].trim();
    for (var i = 0; i < TAGS.length; i++) if (TAGS[i][0].test(t)) return TAGS[i][1];
    return 'strofa';
  }
  function defSyll(l) { return Math.max(1, Math.round(l.replace(/[^a-zàèéìòù]/gi, '').length / 2.2)); }

  /**
   * @param {string} text testo completo
   * @param {{bpm:number, modes?:Object, syll?:Function, intro?:number, outro?:number, barsPerLine?:number|'auto'}} opt
   */
  function build(text, opt) {
    opt = opt || {};
    var bpm = opt.bpm || 100, barSec = 240 / bpm, modes = opt.modes || {};
    var sy = opt.syll || defSyll, syll = function (l) { var v = sy(l); return typeof v === 'object' && v ? (v.metric || v.raw || 1) : v; };
    var blocks = [], cur = null;
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var l = raw.trim(); if (!l) return;
      var tg = tagOf(l);
      if (tg) { cur = { name: tg, lines: [] }; blocks.push(cur); return; }
      if (!cur) { cur = { name: 'strofa', lines: [] }; blocks.push(cur); }
      cur.lines.push(l);
    });
    blocks = blocks.filter(function (b) { return b.lines.length || b.name === 'intro' || b.name === 'outro'; });
    var intro = opt.intro == null ? 2 : opt.intro, outro = opt.outro == null ? 2 : opt.outro;
    var plan = [], lines = [], bar = 0;
    if (intro > 0 && !(blocks[0] && blocks[0].name === 'intro')) { plan.push(['intro', intro]); bar += intro; }
    blocks.forEach(function (b) {
      var start = bar, used = 0;
      b.lines.forEach(function (text) {
        var mode = modes[text] || 'canta', n = Math.max(1, syll(text)), bars;
        if (opt.barsPerLine && opt.barsPerLine !== 'auto') bars = +opt.barsPerLine;
        else { var need = n / RATE[mode] / barSec; bars = need <= 1.15 ? 1 : (need <= 2.3 ? 2 : 4); bars = Math.max(bars, MINB[mode]); }
        var t0 = (start + used) * barSec, dur = bars * barSec;
        var words = text.split(/\s+/), ws = words.map(function (w) { return Math.max(1, syll(w)); }), tot = ws.reduce(function (a, c) { return a + c; }, 0);
        var sing = Math.min(dur * 0.85, n / RATE[mode] * 1.05), acc = 0;
        lines.push({ text: text, mode: mode, section: b.name, syllables: n, startBar: start + used, bars: bars, start: t0, end: t0 + dur,
          words: words.map(function (w, i) { var a = t0 + sing * acc / tot; acc += ws[i]; return { w: w, start: a, end: t0 + sing * acc / tot }; }) });
        used += bars;
      });
      var secBars = Math.max(2, used + (used % 2));
      plan.push([b.name, secBars]); bar += secBars;
    });
    if (outro > 0 && !(blocks.length && blocks[blocks.length - 1].name === 'outro')) { plan.push(['outro', outro]); bar += outro; }
    return { plan: plan, lines: lines, totalBars: bar, barSec: barSec, firstLine: lines.length ? lines[0].start : 0 };
  }

  /** Riga e parola al tempo t (secondi dall'inizio della base). Nessun giro: prima del testo e dopo la fine restituisce lo stato. */
  function at(map, t) {
    var L = map.lines, i;
    if (!L.length) return { state: 'vuoto' };
    if (t < L[0].start) return { state: 'prima', next: L[0], wait: L[0].start - t, bars: Math.ceil((L[0].start - t) / map.barSec - 1e-9) };
    for (i = 0; i < L.length; i++) if (t < L[i].end) break;
    if (i >= L.length) return { state: 'fine' };
    var line = L[i], w = -1;
    line.words.forEach(function (x, k) { if (t >= x.start) w = k; });
    return { state: 'riga', index: i, line: line, word: w, next: L[i + 1] || null, bar: Math.min(line.bars - 1, Math.floor((t - line.start) / map.barSec)) };
  }

  return { build: build, at: at, tagOf: tagOf, RATE: RATE };
});
