/*
 * Beat Lab - salvataggio progetti (Tappa 4): IndexedDB (con copia di riserva in localStorage se IndexedDB non c'e').
 * sanitize() ripulisce/ripara un progetto letto da fuori (file vecchi o rovinati) cosi' non puo' rompere il motore.
 */
(function (root, factory) {
  var E = (typeof module === 'object' && module.exports) ? require('./beatlab-engine.js') : root.BeatEngine;
  if (typeof module === 'object' && module.exports) module.exports = factory(E, root);
  else root.BeatStore = factory(E, root);
})(typeof self !== 'undefined' ? self : this, function (E, root) {
  'use strict';
  var DB = 'beatlab', ST = 'projects', LS = 'beatlab.proj.';
  function num(v, d, lo, hi) { v = +v; if (!isFinite(v)) v = d; return Math.max(lo, Math.min(hi, v)); }
  function fxClean(f) { var o = E.defaultFx(); f = f || {}; var e = f.eq || {};
    o.eq = { low: num(e.low, 0, -15, 15), mid: num(e.mid, 0, -15, 15), high: num(e.high, 0, -15, 15) };
    ['sat', 'comp', 'sc', 'rev', 'dly'].forEach(function (k) { o[k] = num(f[k], 0, 0, 1); }); return o; }
  function sanitize(src) {
    if (!src || typeof src !== 'object') throw new Error('Progetto non valido');
    var bars = Math.round(num(src.bars, 2, 1, 16)), res = src.res === 32 ? 32 : 16, len = bars * res;
    var p = E.newProject({ name: String(src.name || 'Il mio beat').slice(0, 60), bpm: num(src.bpm, 140, 40, 240), swing: num(src.swing, 50, 50, 75), bars: bars, res: res, kit: String(src.kit || 'sintetico'), style: String(src.style || 'trap') });
    if (src.key && typeof src.key === 'object') p.key = { root: Math.round(num(src.key.root, 0, 0, 11)), scale: String(src.key.scale || 'minor') };
    p.tracks = [];
    (Array.isArray(src.tracks) ? src.tracks : []).slice(0, 24).forEach(function (t, i) {
      if (!t || typeof t !== 'object') return; var n;
      if (t.kind === 'drum' && E.LANE_IDS.indexOf(t.lane) >= 0) {
        n = E.newDrumTrack(t.lane, len); for (var k = 0; k < len; k++) { n.steps[k] = num(t.steps && t.steps[k], 0, 0, 127); var r = Math.round(num(t.roll && t.roll[k], 0, 0, 4)); n.roll[k] = (r === 2 || r === 3 || r === 4) ? r : 0; }
        n.rollShape = t.rollShape || n.rollShape; n.tune = num(t.tune, 0, -12, 12);
      } else if (t.kind === 'inst') {
        n = E.newInstTrack(E.Voices.INSTRUMENTS[t.inst] ? String(t.inst) : 'sub808', String(t.name || t.inst || 'Strumento').slice(0, 40));
        n.notes = (Array.isArray(t.notes) ? t.notes : []).slice(0, 4000).map(function (x) { return { t: Math.round(num(x && x.t, 0, 0, E.BAR * bars - 1)), d: Math.round(num(x && x.d, 24, 1, E.BAR * bars)), n: Math.round(num(x && x.n, 60, 0, 127)), v: Math.round(num(x && x.v, 100, 1, 127)), s: x && x.s ? 1 : 0 }; });
        n.params = (t.params && typeof t.params === 'object') ? t.params : n.params;
      } else return;
      n.vol = num(t.vol, n.vol, 0, 1.5); n.pan = num(t.pan, 0, -1, 1); n.mute = !!t.mute; n.solo = !!t.solo; n.fx = fxClean(t.fx); if (t.kind === 'inst' && t.id && typeof t.id === 'string') n.id = t.id.slice(0, 40);
      p.tracks.push(n);
    });
    var m = src.master || {}; p.master = { vol: num(m.vol, 0.75, 0, 1.2), ceil: num(m.ceil, -1, -6, 0), revSize: num(m.revSize, 1.8, 0.3, 4), dlyFb: num(m.dlyFb, 0.35, 0, 0.85), dlyDiv: Math.round(num(m.dlyDiv, 0, 0, 2)), glue: num(m.glue, 0, 0, 1) };
    return p;
  }
  function G() { return (typeof globalThis !== 'undefined') ? globalThis : root; }
  function idb() { return G().indexedDB; }
  function open() { return new Promise(function (res, rej) { var r = idb().open(DB, 1); r.onupgradeneeded = function () { r.result.createObjectStore(ST, { keyPath: 'id' }); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function tx(mode, fn) { return open().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction(ST, mode), rq = fn(t.objectStore(ST)); t.oncomplete = function () { db.close(); res(rq && rq.result); }; t.onerror = t.onabort = function () { db.close(); rej(t.error); }; }); }); }
  function lsGet() { var o = []; try { for (var i = 0; i < G().localStorage.length; i++) { var k = G().localStorage.key(i); if (k.indexOf(LS) === 0) o.push(JSON.parse(G().localStorage.getItem(k))); } } catch (e) {} return o; }
  function save(p, id) {
    var rec = { id: id || ('p' + Date.now().toString(36)), name: p.name, saved: Date.now(), project: JSON.parse(JSON.stringify(p)) };
    if (!idb()) { try { G().localStorage.setItem(LS + rec.id, JSON.stringify(rec)); return Promise.resolve(rec.id); } catch (e) { return Promise.reject(e); } }
    return tx('readwrite', function (s) { return s.put(rec); }).then(function () { return rec.id; });
  }
  function list() { if (!idb()) return Promise.resolve(lsGet().map(function (r) { return { id: r.id, name: r.name, saved: r.saved }; })); return tx('readonly', function (s) { return s.getAll(); }).then(function (a) { return (a || []).map(function (r) { return { id: r.id, name: r.name, saved: r.saved }; }).sort(function (x, y) { return y.saved - x.saved; }); }); }
  function load(id) { if (!idb()) { var r = lsGet().filter(function (x) { return x.id === id; })[0]; return r ? Promise.resolve(sanitize(r.project)) : Promise.reject(new Error('Progetto non trovato')); } return tx('readonly', function (s) { return s.get(id); }).then(function (r) { if (!r) throw new Error('Progetto non trovato'); return sanitize(r.project); }); }
  function remove(id) { if (!idb()) { try { G().localStorage.removeItem(LS + id); } catch (e) {} return Promise.resolve(); } return tx('readwrite', function (s) { return s.delete(id); }); }
  return { sanitize: sanitize, save: save, list: list, load: load, remove: remove };
});
