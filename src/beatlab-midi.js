/*
 * Beat Lab - esportazione MIDI (Tappa 4): file standard tipo 1, 96 ticks per quarto (come il motore).
 * Batteria sul canale 10 con la mappa General MIDI; ogni traccia strumento su un canale suo con il programma GM piu' vicino.
 * Lo swing e' incluso nelle posizioni (cosi' il file suona come il beat).
 */
(function (root, factory) {
  var E = (typeof module === 'object' && module.exports) ? require('./beatlab-engine.js') : root.BeatEngine;
  if (typeof module === 'object' && module.exports) module.exports = factory(E);
  else root.BeatMIDI = factory(E);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  var DRUM_MAP = { kick: 36, snare: 38, clap: 39, hat: 42, ohat: 46, perc: 45 };
  var PROG = { piano: 0, epiano: 4, clavi: 7, organo: 19, arpa: 46, guitar: 25, chitarra: 25, bass: 33, sub808: 38, sub: 39, strings: 48, archi: 48, brass: 61, choir: 52, pad: 89, lead: 81, pluck: 45, fm: 5 };
  function progFor(inst) { inst = String(inst); if (PROG[inst] != null) return PROG[inst]; for (var k in PROG) if (inst.toLowerCase().indexOf(k) >= 0) return PROG[k]; return 0; }
  function vlq(n) { var b = [n & 127]; n >>= 7; while (n > 0) { b.unshift((n & 127) | 128); n >>= 7; } return b; }
  function str(s) { var o = []; for (var i = 0; i < s.length; i++) o.push(s.charCodeAt(i) & 127); return o; }
  function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
  function chunk(id, data) { return str(id).concat(u32(data.length), data); }
  function meta(delta, type, data) { return vlq(delta).concat([0xFF, type], vlq(data.length), data); }
  function trackBytes(name, evs, extra) {
    // evs: {t, order, bytes}; ordina per tempo (note-off prima di note-on a pari tempo)
    evs.sort(function (a, b) { return a.t - b.t || a.order - b.order; });
    var out = meta(0, 3, str(name)).concat(extra || []), last = 0;
    evs.forEach(function (e) { out = out.concat(vlq(e.t - last), e.bytes); last = e.t; });
    out = out.concat(meta(0, 0x2F, []));
    return chunk('MTrk', out);
  }
  function clampB(v, lo, hi) { return Math.max(lo, Math.min(hi, v | 0)); }
  function toMidi(p) {
    var tracks = [], sw = function (t) { return Math.round(t + E.swingDelay(t, p.swing)); };
    var tempo = Math.round(60000000 / p.bpm);
    tracks.push(chunk('MTrk', meta(0, 3, str(p.name || 'Beat Lab')).concat(meta(0, 0x51, [(tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255]), meta(0, 0x58, [4, 2, 24, 8]), meta(0, 0x2F, []))));
    var ev = E.eventsInRange(p, 0, E.BAR * p.bars), drumEv = [], chIdx = 0, hasDrums = false;
    p.tracks.forEach(function (t) {
      if (t.kind !== 'drum') return;
      hasDrums = true;
    });
    ev.forEach(function (e) {
      if (e.type !== 'drum') return;
      var n = DRUM_MAP[e.lane] || 45, tk = Math.round(e.tick + e.delay), v = clampB(e.vel, 1, 127);
      drumEv.push({ t: tk, order: 1, bytes: [0x99, n, v] }); drumEv.push({ t: tk + 12, order: 0, bytes: [0x89, n, 0] });
    });
    if (hasDrums) tracks.push(trackBytes('Batteria', drumEv));
    p.tracks.forEach(function (t) {
      if (t.kind !== 'inst') return;
      var ch = chIdx++; if (ch >= 9) ch++; ch = Math.min(ch, 15);
      var evs = [];
      t.notes.forEach(function (nt) {
        var a = sw(nt.t), b = Math.max(a + 1, Math.round(nt.t + nt.d)), n = clampB(nt.n, 0, 127);
        evs.push({ t: a, order: 1, bytes: [0x90 | ch, n, clampB(nt.v || 100, 1, 127)] }); evs.push({ t: b, order: 0, bytes: [0x80 | ch, n, 0] });
      });
      tracks.push(trackBytes(t.name || t.inst, evs, [0, 0xC0 | ch, progFor(t.inst)]));
    });
    var head = chunk('MThd', [0, 1, (tracks.length >> 8) & 255, tracks.length & 255, 0, E.PPQ]);
    var all = head.slice(); tracks.forEach(function (t) { all = all.concat(t); });
    return new Uint8Array(all);
  }
  // lettore minimo usato dai test: restituisce {format, ntrks, ppq, tracks:[{name, events:[{t,type,ch,note,vel,prog}]}], tempo}
  function parse(u8) {
    var pos = 0, rd32 = function () { var v = ((u8[pos] << 24) | (u8[pos + 1] << 16) | (u8[pos + 2] << 8) | u8[pos + 3]) >>> 0; pos += 4; return v; }, rd16 = function () { var v = (u8[pos] << 8) | u8[pos + 1]; pos += 2; return v; };
    var id = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]); pos = 4; if (id !== 'MThd') throw new Error('non e\' un file MIDI');
    var hl = rd32(), format = rd16(), n = rd16(), ppq = rd16(); pos = 8 + hl; var out = { format: format, ntrks: n, ppq: ppq, tracks: [], tempo: null };
    for (var k = 0; k < n; k++) {
      var cid = String.fromCharCode(u8[pos], u8[pos + 1], u8[pos + 2], u8[pos + 3]); pos += 4; var len = rd32(), end = pos + len; if (cid !== 'MTrk') throw new Error('traccia non valida');
      var t = 0, run = 0, tr = { name: '', events: [], ended: false };
      while (pos < end) {
        var d = 0, b; do { b = u8[pos++]; d = (d << 7) | (b & 127); } while (b & 128); t += d;
        var st = u8[pos]; if (st & 128) { pos++; run = st; } else st = run;
        if (st === 0xFF) { var ty = u8[pos++], l = u8[pos++], data = u8.slice(pos, pos + l); pos += l; if (ty === 3) tr.name = String.fromCharCode.apply(null, data); if (ty === 0x51) out.tempo = (data[0] << 16) | (data[1] << 8) | data[2]; if (ty === 0x2F) tr.ended = true; }
        else { var hi = st & 0xF0, ch = st & 15; if (hi === 0xC0 || hi === 0xD0) { tr.events.push({ t: t, type: hi === 0xC0 ? 'prog' : 'press', ch: ch, prog: u8[pos] }); pos += 1; } else { var a = u8[pos], v = u8[pos + 1]; pos += 2; tr.events.push({ t: t, type: hi === 0x90 && v > 0 ? 'on' : hi === 0x80 || hi === 0x90 ? 'off' : 'cc', ch: ch, note: a, vel: v }); } }
      }
      if (pos !== end) throw new Error('lunghezza traccia errata'); out.tracks.push(tr);
    }
    return out;
  }
  return { toMidi: toMidi, parse: parse, DRUM_MAP: DRUM_MAP, progFor: progFor };
});
