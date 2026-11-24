/*
 * Separazione AI (gratuita, open source, tutto sul telefono/computer): modello HTDemucs v4 di Meta (MIT)
 * eseguito con onnxruntime-web (MIT) dentro un worker (ort/sep-worker.js): la pagina resta usabile.
 * Divide in 4 tracce: voce, batteria, basso, altro.
 * - Il modello (~180 MB) si scarica UNA volta da Hugging Face e resta nel browser (Cache Storage "msa-models-v1").
 * - Usa la scheda grafica (WebGPU) se il browser la offre nel worker, altrimenti il processore (WASM, più lento;
 *   con l'isolamento della pagina usa più processori insieme).
 * - Lavora a 44,1 kHz stereo, a pezzi di ~7,8 s.
 * Limiti onesti: su iPhone può essere lento o fallire per poca memoria; allora l'app usa la separazione veloce.
 * Nessun costo, nessuna chiave, nessun audio inviato a server.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AiSeparator = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var G = typeof self !== 'undefined' ? self : globalThis;
  var MODEL_URL = (G.MSA_MODEL_URL) || 'https://huggingface.co/timcsy/demucs-web-onnx/resolve/main/htdemucs_embedded.onnx';
  var CACHE = 'msa-models-v1', S = { w: null, loading: null, backend: '', job: null };

  async function cached() { try { var c = await caches.open(CACHE); return !!(await c.match(MODEL_URL)); } catch (e) { return false; } }
  async function modelBuffer(onDl) {
    var c = null;
    try { c = await caches.open(CACHE); var hit = await c.match(MODEL_URL); if (hit) { if (onDl) onDl(1, 1, true); return await hit.arrayBuffer(); } } catch (e) { c = null; }
    var r = await fetch(MODEL_URL); if (!r.ok) throw new Error('download ' + r.status);
    var tot = +r.headers.get('Content-Length') || 180534758, rd = r.body.getReader(), parts = [], got = 0;
    for (;;) { var x = await rd.read(); if (x.done) break; parts.push(x.value); got += x.value.length; if (onDl) onDl(got, tot, false); }
    var u = new Uint8Array(got), o = 0; parts.forEach(function (p) { u.set(p, o); o += p.length; }); parts = null;
    if (c) { try { await c.put(MODEL_URL, new Response(u.slice(0).buffer, { headers: { 'Content-Type': 'application/octet-stream' } })); } catch (e) {} }
    return u.buffer;
  }
  function onMsg(e) {
    var m = e.data, j = S.job; if (!j) return;
    if (m.t === 'prog') { if (j.prog) j.prog(m.p); return; }
    S.job = null;
    if (m.t === 'err') j.rej(new Error(m.msg)); else j.res(m);
  }
  function call(msg, transfer, prog) {
    return new Promise(function (res, rej) { S.job = { res: res, rej: rej, prog: prog }; S.w.postMessage(msg, transfer || []); });
  }
  /** Prepara il motore. base = cartella del sito (dove c'è ort/). onDl(scaricati, totale, daMemoria). */
  async function load(base, onDl) {
    if (S.backend) return S.backend;
    if (S.loading) return S.loading;
    S.loading = (async function () {
      var buf = await modelBuffer(onDl), dir = new URL(base + 'ort/', location.href).href;
      if (!S.w) { S.w = new Worker(dir + 'sep-worker.js'); S.w.onmessage = onMsg; S.w.onerror = function (ev) { var j = S.job; S.job = null; if (j) j.rej(new Error(ev.message || 'worker')); }; }
      var threads = G.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
      var m = await call({ t: 'load', buf: buf, paths: dir, threads: threads }, [buf]);
      S.backend = m.backend; return S.backend;
    })();
    try { return await S.loading; } catch (e) { if (S.w) { S.w.terminate(); S.w = null; } throw e; } finally { S.loading = null; }
  }
  /** L, R a 44100 Hz (vengono trasferiti al worker). onProgress(0-1). Ritorna {vocals, drums, bass, other}: {left, right}. */
  async function separate(L, R, onProgress) {
    if (!S.backend) throw new Error('non caricato');
    var l = new Float32Array(L), r = new Float32Array(R || L);
    var m = await call({ t: 'sep', L: l, R: r }, [l.buffer, r.buffer], onProgress);
    return m.r;
  }
  return { MODEL_URL: MODEL_URL, SAMPLE_RATE: 44100, MODEL_MB: 180, load: load, separate: separate, cached: cached, backend: function () { return S.backend; }, ready: function () { return !!S.backend; } };
});
