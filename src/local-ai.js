/*
 * Assistente testi con AI locale (opzionale). Usa WebLLM (Apache 2.0) con modelli Qwen2.5 (Apache 2.0):
 * il modello si scarica UNA volta sul telefono e gira lì (WebGPU). Nessun testo parte verso server.
 * Il cervello Sultan (regole + misure) resta il maestro: l'AI scrive solo bozze di righe, guidate da genere, umore,
 * rime del dizionario personale e modello artisti (solo numeri). Mai testi di altri: si chiede sempre parole nuove.
 * Qui c'è la parte testabile (prompt e pulizia). Il caricamento vero richiede WebGPU: non verificabile fuori dal telefono.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LocalAI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var LIB_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.79';
  var MODELS = [
    { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Leggero (circa 300 MB)', note: 'Veloce, italiano così così' },
    { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Più forte (circa 1 GB)', note: 'Italiano migliore, pesa e scalda di più' }
  ];
  var TASKS = {
    versioni: 'Riscrivi la riga in 3 versioni diverse, con lo stesso numero di sillabe (circa {syll}) e lo stesso significato, parole nuove.',
    punchline: 'Scrivi 3 punchline (frase a effetto, doppio senso o immagine forte) che possano chiudere questa riga o seguirla. Massimo {syll} sillabe ciascuna.',
    continua: 'Scrivi 3 possibili righe successive (circa {syll} sillabe) che portino avanti la storia e finiscano con una di queste rime: {rime}.'
  };
  function supported() { return typeof navigator !== 'undefined' && !!navigator.gpu; }

  function buildPrompt(task, c) {
    c = c || {};
    var t = (TASKS[task] || TASKS.versioni).replace('{syll}', c.syll || 10).replace('{rime}', (c.rhymes && c.rhymes.length ? c.rhymes.slice(0, 8).join(', ') : 'quelle che vuoi'));
    var sys = 'Sei Sultan, un autore di testi rap e trap italiani. Scrivi in italiano, in gergo di strada credibile, senza copiare canzoni esistenti. ' +
      'Genere: ' + (c.genre || 'trap') + '. Umore: ' + (c.mood || 'dark') + '. ' + (c.artistNote ? 'Stile misurato: ' + c.artistNote + '. ' : '') +
      'Rispondi SOLO con 3 righe, una per riga, senza numeri, senza spiegazioni, senza virgolette.';
    var user = (c.context ? 'Testo finora:\n' + c.context + '\n\n' : '') + 'Riga: «' + (c.line || '') + '»\n' + t;
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }
  /* Toglie numeri, elenchi, virgolette, righe vuote o in altre lingue evidenti; tiene al massimo 3 righe. */
  function clean(text, line) {
    var out = [], seen = {};
    String(text || '').split(/\r?\n/).forEach(function (l) {
      l = l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["«»“”']+|["«»“”']+$/g, '').trim();
      if (l.length < 6 || l.length > 140) return;
      if (/^(ecco|certo|sure|here|riga|versione)/i.test(l)) return;
      if (/[一-鿿぀-ヿЀ-ӿ]/.test(l)) return; // cinese/giapponese/cirillico: i modelli piccoli ogni tanto escono di lingua
      var k = l.toLowerCase(); if (seen[k] || (line && k === String(line).toLowerCase().trim())) return;
      seen[k] = 1; out.push(l);
    });
    return out.slice(0, 3);
  }
  var engine = null, loadedId = null;
  async function load(modelId, onProgress) {
    if (!supported()) throw new Error('Questo telefono/browser non ha WebGPU: l\'assistente AI non può partire. Il cervello Sultan resta attivo.');
    if (engine && loadedId === modelId) return engine;
    var mod = await import(LIB_URL);
    engine = await mod.CreateMLCEngine(modelId, { initProgressCallback: function (p) { if (onProgress) onProgress(p); } });
    loadedId = modelId; return engine;
  }
  async function ask(task, ctx) {
    if (!engine) throw new Error('Assistente non attivo');
    var r = await engine.chat.completions.create({ messages: buildPrompt(task, ctx), temperature: 0.9, top_p: 0.92, max_tokens: 160 });
    return clean(r.choices[0].message.content, ctx && ctx.line);
  }
  return { MODELS: MODELS, TASKS: TASKS, supported: supported, buildPrompt: buildPrompt, clean: clean, load: load, ask: ask, LIB_URL: LIB_URL };
});
