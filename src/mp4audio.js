/* Estrae SOLO l'audio AAC dei primi secondi da un file MP4/MOV/M4A, senza caricare tutto il file in memoria.
   Serve sull'iPhone: un video di 4 minuti pesa 100-500 MB e Safari finisce la memoria se lo legge intero.
   Legge l'indice (moov) e poi solo i pezzetti audio che servono; li riveste con intestazioni ADTS (decodificabili da decodeAudioData).
   Se qualcosa non torna (non è AAC, file strano) restituisce null e l'app usa il metodo di prima. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Mp4Audio = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  var FREQ = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  function u32(v, o) { return v.getUint32(o); }
  function tag(v, o) { return String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3)); }
  async function rd(file, a, b) { return new DataView(await file.slice(a, b).arrayBuffer()); }
  /* lista dei box in [a,b) di un DataView */
  function boxes(v, a, b) {
    var out = [], o = a;
    while (o + 8 <= b) {
      var sz = u32(v, o), t = tag(v, o + 4), hd = 8;
      if (sz === 1) { sz = u32(v, o + 8) * 4294967296 + u32(v, o + 12); hd = 16; } else if (sz === 0) sz = b - o;
      if (sz < hd || o + sz > b) break;
      out.push({ t: t, s: o + hd, e: o + sz }); o += sz;
    }
    return out;
  }
  function find(v, a, b, t) { var l = boxes(v, a, b); for (var i = 0; i < l.length; i++) if (l[i].t === t) return l[i]; return null; }
  /* cerca il box moov scorrendo l'intestazione dei box di primo livello (poche letture da 16 byte) */
  async function findMoov(file) {
    var o = 0, n = 0;
    while (o + 8 <= file.size && n++ < 64) {
      var v = await rd(file, o, Math.min(file.size, o + 16)), sz = u32(v, 0), t = tag(v, 4), hd = 8;
      if (sz === 1) { sz = u32(v, 8) * 4294967296 + u32(v, 12); hd = 16; } else if (sz === 0) sz = file.size - o;
      if (sz < hd) return null;
      if (t === 'moov') return { s: o + hd, e: o + sz };
      o += sz;
    }
    return null;
  }
  function audioTrack(v, moov) {
    var traks = boxes(v, moov.s, moov.e).filter(function (b) { return b.t === 'trak'; });
    for (var i = 0; i < traks.length; i++) {
      var mdia = find(v, traks[i].s, traks[i].e, 'mdia'); if (!mdia) continue;
      var hdlr = find(v, mdia.s, mdia.e, 'hdlr'); if (!hdlr || tag(v, hdlr.s + 8) !== 'soun') continue;
      var mdhd = find(v, mdia.s, mdia.e, 'mdhd'), minf = find(v, mdia.s, mdia.e, 'minf'); if (!mdhd || !minf) continue;
      var stbl = find(v, minf.s, minf.e, 'stbl'); if (!stbl) continue;
      return { v: v, stbl: stbl, scale: u32(v, mdhd.s + (v.getUint8(mdhd.s) === 1 ? 20 : 12)) };
    }
    return null;
  }
  function config(v, stbl) {
    var stsd = find(v, stbl.s, stbl.e, 'stsd'); if (!stsd) return null;
    var ent = boxes(v, stsd.s + 8, stsd.e)[0]; if (!ent || ent.t !== 'mp4a') return null;
    var ver = v.getUint16(ent.s + 8), q = boxes(v, ent.s + 28 + (ver === 1 ? 16 : ver === 2 ? 36 : 0), ent.e), esds = null, i;
    for (i = 0; i < q.length; i++) if (q[i].t === 'esds') esds = q[i];
    if (!esds) { var w = null; for (i = 0; i < q.length; i++) if (q[i].t === 'wave') w = q[i]; /* QuickTime (.mov): esds sta dentro "wave" */ if (w) { var qq = boxes(v, w.s, w.e); for (i = 0; i < qq.length; i++) if (qq[i].t === 'esds') esds = qq[i]; } }
    if (!esds) return null;
    /* descrittori MPEG-4: cerco il tag 0x05 (DecoderSpecificInfo) */
    var o = esds.s + 4, end = esds.e;
    for (; o < end - 2; o++) {
      if (v.getUint8(o) === 5) {
        var p = o + 1, len = 0, k = 0; do { var c = v.getUint8(p++); len = (len << 7) | (c & 127); k++; } while ((c & 128) && k < 4);
        if (len < 2) return null;
        var b0 = v.getUint8(p), b1 = v.getUint8(p + 1), obj = b0 >> 3, fi = ((b0 & 7) << 1) | (b1 >> 7), ch = (b1 >> 3) & 15;
        if (fi > 12 || obj < 1 || obj > 4 || ch < 1 || ch > 7) return null;
        return { obj: obj, fi: fi, ch: ch, rate: FREQ[fi] };
      }
    }
    return null;
  }
  /* elenco (posizione, grandezza) dei primi campioni audio che coprono "secs" secondi */
  function samples(v, stbl, scale, secs) {
    var stsz = find(v, stbl.s, stbl.e, 'stsz'), stsc = find(v, stbl.s, stbl.e, 'stsc'), stts = find(v, stbl.s, stbl.e, 'stts'),
      co = find(v, stbl.s, stbl.e, 'stco'), c64 = false; if (!co) { co = find(v, stbl.s, stbl.e, 'co64'); c64 = true; }
    if (!stsz || !stsc || !stts || !co) return null;
    var fixed = u32(v, stsz.s + 4), total = u32(v, stsz.s + 8), size = function (i) { return fixed || u32(v, stsz.s + 12 + i * 4); };
    /* quanti campioni servono (da stts) */
    var need = 0, acc = 0, lim = secs * scale, ne = u32(v, stts.s + 4), o = stts.s + 8;
    for (var i = 0; i < ne && acc < lim; i++) { var cnt = u32(v, o), dur = u32(v, o + 4) || 1, take = Math.min(cnt, Math.ceil((lim - acc) / dur)); need += take; acc += take * dur; o += 8; }
    need = Math.min(need, total); if (need < 1) return null;
    var nch = u32(v, co.s + 4), ns = u32(v, stsc.s + 4), runs = [];
    for (i = 0; i < ns; i++) runs.push({ first: u32(v, stsc.s + 8 + i * 12), per: u32(v, stsc.s + 12 + i * 12) });
    var out = [], si = 0, r = 0;
    for (var c = 1; c <= nch && si < need; c++) {
      while (r + 1 < runs.length && runs[r + 1].first <= c) r++;
      var pos = c64 ? u32(v, co.s + 8 + (c - 1) * 8) * 4294967296 + u32(v, co.s + 12 + (c - 1) * 8) : u32(v, co.s + 8 + (c - 1) * 4);
      for (var k = 0; k < runs[r].per && si < need; k++, si++) { var sz = size(si); out.push({ p: pos, n: sz }); pos += sz; }
    }
    return out.length ? out : null;
  }
  function adts(cfg, n) {
    var L = n + 7, h = new Uint8Array(7);
    h[0] = 0xFF; h[1] = 0xF1; h[2] = ((cfg.obj - 1) << 6) | (cfg.fi << 2) | (cfg.ch >> 2); h[3] = ((cfg.ch & 3) << 6) | (L >> 11);
    h[4] = (L >> 3) & 255; h[5] = ((L & 7) << 5) | 31; h[6] = 0xFC; return h;
  }
  /* restituisce { buf: ArrayBuffer ADTS-AAC, rate, ch, secs } oppure null */
  async function extract(file, secs, onFail) {
    try {
      var m = await findMoov(file); if (!m || m.e - m.s > 64 * 1048576) return null;
      var v = await rd(file, m.s, m.e), tr = audioTrack(v, { s: 0, e: v.byteLength }); if (!tr) return null;
      var cfg = config(v, tr.stbl); if (!cfg) return null;
      var sm = samples(v, tr.stbl, tr.scale, secs || 240); if (!sm) return null;
      /* leggo i campioni raggruppando quelli vicini in una sola lettura */
      var parts = [], len = 0, i = 0;
      while (i < sm.length) {
        var j = i, a = sm[i].p, b = a + sm[i].n; while (j + 1 < sm.length && sm[j + 1].p === b && b - a < 4194304) { j++; b += sm[j].n; }
        var data = new Uint8Array(await file.slice(a, b).arrayBuffer()), off = 0;
        for (var q = i; q <= j; q++) { var h = adts(cfg, sm[q].n); parts.push(h, data.subarray(off, off + sm[q].n)); len += 7 + sm[q].n; off += sm[q].n; }
        i = j + 1;
      }
      var out = new Uint8Array(len), p = 0; parts.forEach(function (x) { out.set(x, p); p += x.length; });
      return { buf: out.buffer, rate: cfg.rate, ch: cfg.ch, frames: sm.length };
    } catch (e) { if (onFail) onFail(e); return null; }
  }
  return { extract: extract, boxes: boxes, adts: adts };
});
