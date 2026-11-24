/*
 * Intelligenza artificiale LOCALE e gratuita per gli agenti dello Studio (niente abbonamenti, niente chiavi).
 * Due motori:
 *  - "ollama": Ollama sul Mac (https://ollama.com), modello consigliato qwen2.5:7b (buon italiano).
 *              L'app chiama http://localhost:11434. Va avviato con OLLAMA_ORIGINS impostato al sito (vedi guida nell'app).
 *  - "browser": il modello gira dentro la pagina con transformers.js (Qwen2.5 Instruct, licenza Apache-2.0).
 *              1.5B per il computer (scheda grafica), 0.5B per prove. Pesante per l'iPhone.
 * L'IA NON tocca l'audio da sola: traduce la tua richiesta in COMANDI dello Studio (gli stessi che capisce
 * "Parla con lo Studio"), che l'app esegue davvero e che puoi annullare. Può anche proporre righe di testo.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StudioAI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var G = typeof self !== 'undefined' ? self : globalThis;
  var MODELS = { significato: { 'minilm': { nome: 'Capisce il significato (118 MB, anche iPhone)', mb: 118 } }, browser: { 'qwen-1.5b': { id: 'onnx-community/Qwen2.5-1.5B-Instruct', nome: 'Qwen 2.5 1.5B (computer)', mb: 1220 } },
    ollama: { 'qwen2.5:7b': { nome: 'Qwen 2.5 7B (consigliato sul Mac)' }, 'llama3.1:8b': { nome: 'Llama 3.1 8B' }, 'qwen2.5:3b': { nome: 'Qwen 2.5 3B (Mac con poca memoria)' } } };
  var S = { gen: {}, lib: null };

  var COMANDI = ['808 più lungo', '808 più corto', '808 più distorto', '808 con più colpo', 'voce più riverbero', 'voce più brillante', 'voce più scura', 'voce con autotune robot', 'voce con autotune naturale', 'voce con vocoder', 'voce più eco', 'voce senza eco', 'alza l\'808', 'alza la voce', 'abbassa la voce',
    'alza la melodia', 'abbassa gli accordi', 'melodia un\'ottava sopra', 'arpeggio a destra', 'pad più scuro', 'batteria più compressa', 'riser prima del ritornello', 'impact sul ritornello',
    'più energia', 'più emozionante', 'più cinematografica', 'basso più profondo', 'a 140 bpm', 'in La minore', 'stile trap', 'stile drill', 'stile drill di brooklyn', 'stile melodico', 'stile epico', 'più lenta', 'più veloce',
    'hi-hat più fitti', 'hi-hat più radi', 'senza batteria', 'master per spotify', 'master più forte', 'nuova variante', 'crea la base dal testo'];
  /** Il prompt: chi è l'agente, cosa può fare, in che formato rispondere. */
  function messages(user, ctx) {
    var sys = 'Sei il produttore musicale dentro lo studio "Sultan Sound" (rap, trap, drill italiani). Rispondi SEMPRE in italiano, breve e concreto.\n' +
      'Non hai accesso diretto all\'audio: per cambiare la base scrivi COMANDI scelti da questo elenco (puoi cambiare numeri e nomi di note): ' + COMANDI.join('; ') + '.\n' +
      'Formato OBBLIGATORIO della risposta:\nRISPOSTA: una o due frasi su cosa fai e perché.\nCOMANDI:\n- comando\n- comando\n' +
      'Se la persona chiede righe di testo, aggiungi alla fine:\nTESTO:\nriga\nriga\n' +
      'Non copiare testi di altri artisti. Non promettere successo. Se non serve nessun comando scrivi "COMANDI:" vuoto.';
    var c = 'Progetto: ' + ctx.summary + (ctx.lyrics ? '\nTesto attuale (inizio):\n' + ctx.lyrics.slice(0, 600) : '\nTesto: vuoto') + (ctx.taste ? '\nGusti imparati: ' + ctx.taste : '');
    return [{ role: 'system', content: sys },
      { role: 'user', content: 'Progetto: Trap · 140 BPM · La minore\nTesto: vuoto\n\nRichiesta: voglio una base più cupa e un 808 che si sente di più' },
      { role: 'assistant', content: 'RISPOSTA: Rendo la base più scura e metto l\'808 in primo piano, più lungo e distorto.\nCOMANDI:\n- pad più scuro\n- 808 più lungo\n- 808 più distorto\n- basso più profondo' },
      { role: 'user', content: c + '\n\nRichiesta: ' + user }];
  }
  /** Legge la risposta dell'IA: {reply, commands:[...], lyrics:[...]} (robusto: accetta anche risposte un po' storte). */
  function parse(text) {
    var t = String(text || ''), out = { reply: '', commands: [], lyrics: [] }, mode = '';
    t.split(/\r?\n/).forEach(function (raw) {
      var l = raw.trim(); if (!l) return;
      var m = /^\**\s*(RISPOSTA|COMANDI|TESTO)\s*:?\s*\**\s*:?\s*(.*)$/i.exec(l);
      if (m) { mode = m[1].toUpperCase(); if (mode === 'RISPOSTA' && m[2]) out.reply += m[2] + ' '; else if (m[2] && mode === 'COMANDI') out.commands.push(m[2]); return; }
      if (mode === 'COMANDI') { var c = l.replace(/^(?:[-*•]\s*|\d+[.)]\s*)/, '').replace(/[".]+$/g, '').trim(); if (c && c.length < 80) out.commands.push(c); }
      else if (mode === 'TESTO') out.lyrics.push(l.replace(/^[-*•]\s*/, ''));
      else if (mode === 'RISPOSTA' || !mode) out.reply += l + ' ';
    });
    var seen = {}; out.reply = out.reply.split(/(?<=[.!?])\s+/).filter(function (x) { var k = x.trim().toLowerCase(); if (!k || seen[k]) return false; seen[k] = 1; return true; }).join(' ').trim().slice(0, 320); out.commands = out.commands.slice(0, 8); out.lyrics = out.lyrics.slice(0, 16);
    return out;
  }
  async function askOllama(msgs, o) {
    var r = await fetch((o.url || 'http://localhost:11434') + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: o.model || 'qwen2.5:7b', messages: msgs, stream: false, options: { temperature: 0.4 } }) });
    if (!r.ok) throw new Error('Ollama risponde ' + r.status + (r.status === 404 ? ' (modello non scaricato: ollama pull ' + (o.model || 'qwen2.5:7b') + ')' : ''));
    var j = await r.json(); return j.message && j.message.content || '';
  }
  async function pingOllama(url) { try { var r = await fetch((url || 'http://localhost:11434') + '/api/tags'); if (!r.ok) return null; var j = await r.json(); return (j.models || []).map(function (m) { return m.name; }); } catch (e) { return null; } }
  async function askBrowser(msgs, o) {
    var key = MODELS.browser[o.model] ? o.model : 'qwen-1.5b', M = MODELS.browser[key];
    if (!S.lib) S.lib = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js');
    var T = S.lib;
    if (!S.gen[key]) {
      T.env.allowLocalModels = false; if (o.wasmPaths) T.env.backends.onnx.wasm.wasmPaths = o.wasmPaths;
      T.env.backends.onnx.wasm.numThreads = G.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
      var gpu = false; try { gpu = !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch (e) {}
      var files = {};
      S.gen[key] = await T.pipeline('text-generation', M.id, { device: gpu ? 'webgpu' : 'wasm', dtype: gpu ? 'q4f16' : 'int8',
        progress_callback: function (p) { if (p && p.status === 'progress' && p.file) { files[p.file] = [p.loaded || 0, p.total || 0]; var a = 0, b = 0; for (var k in files) { a += files[k][0]; b += files[k][1]; } if (o.onProgress) o.onProgress(a, b); } } });
    }
    var out = await S.gen[key](msgs, { max_new_tokens: 180, do_sample: false, repetition_penalty: 1.25, no_repeat_ngram_size: 4 });
    var g = out[0].generated_text; return Array.isArray(g) ? g[g.length - 1].content : String(g);
  }
  // ---------- motore "significato" (browser, anche iPhone): embedding multilingue, niente testo generato ----------
  var EXTRA = ['più malinconica', 'più luminosa', 'più triste', 'più cupa e scura', 'più aggressiva', 'più calma', 'più lenta', 'più veloce', 'il ritornello deve esplodere', 'metti l\'eco sulla voce', 'più spazio e atmosfera'];
  async function embedder(o) {
    if (!S.lib) S.lib = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js');
    var T = S.lib;
    if (!S.emb) { T.env.allowLocalModels = false; if (o.wasmPaths) T.env.backends.onnx.wasm.wasmPaths = o.wasmPaths; var files = {};
      S.emb = await T.pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', { dtype: 'q8', progress_callback: function (p) { if (p && p.status === 'progress' && p.file) { files[p.file] = [p.loaded || 0, p.total || 0]; var a = 0, b = 0; for (var k in files) { a += files[k][0]; b += files[k][1]; } if (o.onProgress) o.onProgress(a, b); } } }); }
    return S.emb;
  }
  var SEM_MAP = { 'il ritornello deve esplodere': ['riser prima del ritornello', 'impact sul ritornello', 'più energia'], 'metti l\'eco sulla voce': ['voce più eco'], 'più spazio e atmosfera': ['voce più riverbero', 'pad più scuro'], 'più triste': ['più malinconica', 'pad più scuro'], 'più cupa e scura': ['pad più scuro', 'basso più profondo'], 'più aggressiva': ['808 più distorto', 'batteria più compressa', 'più energia'], 'più calma': ['più lenta', 'hi-hat più radi'] };
  async function semantic(user, o) {
    var emb = await embedder(o), cmds = COMANDI.concat(EXTRA).filter(function (c) { return !/crea la base dal testo/.test(c); });
    if (!S.cmdVec) { var v = await emb(cmds, { pooling: 'mean', normalize: true }); S.cmdVec = v.tolist(); }
    var parts = String(user).toLowerCase().split(/,|;|\.| e poi | poi | e (?=(?:la|il|lo|l'|un|una|più|meno|voce|808|basso|batteria|melodia|accordi|pad|hi)\b)/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 2; });
    if (!parts.length) parts = [String(user)];
    var pv = (await emb(parts, { pooling: 'mean', normalize: true })).tolist(), picked = [];
    pv.forEach(function (q, i) {
      var sc = S.cmdVec.map(function (c, k) { var d = 0; for (var j = 0; j < c.length; j++) d += c[j] * q[j]; return [d, k]; }).sort(function (a, b) { return b[0] - a[0]; });
      if (sc[0][0] < 0.5) return;
      var c = cmds[sc[0][1]]; (SEM_MAP[c] || [c]).forEach(function (x) { if (picked.indexOf(x) < 0) picked.push(x); });
      if (sc[1] && sc[1][0] > 0.8 && sc[0][0] - sc[1][0] < 0.03) { var c2 = cmds[sc[1][1]]; (SEM_MAP[c2] || [c2]).forEach(function (x) { if (picked.indexOf(x) < 0) picked.push(x); }); }
    });
    return { reply: picked.length ? 'Ho capito: ' + picked.join(', ') + '.' : 'Non ho trovato un comando vicino a quello che chiedi.', commands: picked, lyrics: [] };
  }
  /** Chiede all'IA. o = {engine:'ollama'|'browser', model, url, wasmPaths, onProgress}. */
  async function think(user, ctx, o) {
    o = o || {}; if (o.engine === 'significato') return semantic(user, o);
    var msgs = messages(user, ctx), raw = o.engine === 'ollama' ? await askOllama(msgs, o) : await askBrowser(msgs, o);
    var p = parse(raw); p.raw = raw; return p;
  }
  return { semantic: semantic, EXTRA: EXTRA, MODELS: MODELS, COMANDI: COMANDI, messages: messages, parse: parse, think: think, pingOllama: pingOllama };
});
