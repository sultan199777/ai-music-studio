/* Worker della separazione AI: carica onnxruntime-web (MIT) e Demucs Web (MIT) e lavora fuori dalla pagina,
   così l'app resta usabile mentre separa. Messaggi: load {buf, paths, threads} → loaded {backend}; sep {L, R} → prog {p}, done {r}; err {msg}. */
importScripts('ort.webgpu.min.js', 'demucs.js');
var proc = null, backend = '';
self.onmessage = async function (e) {
  var m = e.data;
  try {
    if (m.t === 'load') {
      ort.env.wasm.wasmPaths = m.paths; ort.env.wasm.numThreads = m.threads;
      var tries = self.navigator && self.navigator.gpu ? [['webgpu'], ['wasm']] : [['wasm']], last = null;
      for (var i = 0; i < tries.length && !proc; i++) {
        try { var p = new DemucsWeb.DemucsProcessor({ ort: ort, sessionOptions: { executionProviders: tries[i] } }); await p.loadModel(i === tries.length - 1 ? m.buf : m.buf.slice(0)); proc = p; backend = tries[i][0]; }
        catch (err) { last = err; proc = null; }
      }
      if (!proc) throw last || new Error('modello');
      self.postMessage({ t: 'loaded', backend: backend });
    } else if (m.t === 'sep') {
      proc.onProgress = function (p) { self.postMessage({ t: 'prog', p: p.progress }); };
      var r = await proc.separate(m.L, m.R), out = {}, tr = [];
      ['vocals', 'drums', 'bass', 'other'].forEach(function (k) { out[k] = { left: r[k].left, right: r[k].right }; tr.push(r[k].left.buffer, r[k].right.buffer); });
      self.postMessage({ t: 'done', r: out }, tr);
    }
  } catch (err) { self.postMessage({ t: 'err', msg: String(err && err.message || err) }); }
};
