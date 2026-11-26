/*
 * IA vera (gratis): un modello di linguaggio grande, aperto, su un servizio con piano GRATUITO senza carta.
 * - Groq: modelli aperti (es. openai/gpt-oss-120b, licenza Apache 2.0), piano Free a limiti di richieste, non addestra sui dati.
 * - OpenRouter: modelli «:free» (router openrouter/free), 50 richieste al giorno sul piano gratuito.
 * La chiave la crea l'utente e la incolla nell'app: resta SOLO sul suo telefono (localStorage), mai nel codice
 * né nel repository pubblico. Senza chiave l'app usa l'IA di base (regole, SultanAI) come prima.
 * Il modello riceve le MISURE vere dell'app (sillabe, rime, emozioni, base) e può chiedere azioni all'app
 * con una riga finale «AZIONI: [...]»: l'app esegue solo azioni di una lista sicura.
 * Moduli puri (testabili senza rete): buildMessages, parseReply, cleanActions; ask usa fetch passato o globale.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CloudAI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PROVIDERS = {
    groq: { label: 'Groq · gratis, velocissimo', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'openai/gpt-oss-120b', keyPage: 'https://console.groq.com/keys', keyHint: 'gsk_' },
    openrouter: { label: 'OpenRouter · modelli gratis (50 al giorno)', url: 'https://openrouter.ai/api/v1/chat/completions', model: 'openrouter/free', keyPage: 'https://openrouter.ai/keys', keyHint: 'sk-or-' }
  };
  var PAGES = ['testo', 'base', 'voce', 'mix', 'libreria'];
  var MAX_LYR = 2600, MAX_HIST = 8;

  function systemPrompt() {
    return [
      'Sei Sultan IA, il produttore e coach dentro l\'app musicale di Sultan (rap, trap e drill italiani, spesso malinconici o scuri).',
      'Rispondi SEMPRE in italiano semplice, frasi corte, come un produttore esperto che parla a un artista giovane. Niente teoria inutile: dai la cosa da fare.',
      'Regole fisse:',
      '- Usa le MISURE che ti passa l\'app (sillabe, rime, emozioni, BPM, tonalità): sono vere. Non inventare numeri che non hai.',
      '- Se proponi righe nuove, scrivile tu, originali, nello stile di Sultan. Non copiare mai testi di altri artisti; puoi citare solo lo stile (flow, temi, atmosfera).',
      '- Non promettere successo, hit o soldi. Sii onesto se una cosa non si può fare nell\'app.',
      '- Solo la voce di Sultan: niente imitazioni o cloni di voci di altri.',
      '- Se Sultan parla di stare male davvero o di farsi del male, metti prima la persona: ascolta, invitalo a parlarne con qualcuno di cui si fida o a chiamare il 112. Niente azioni in quel caso.',
      '',
      'Puoi far fare cose all\'app. Se serve, aggiungi come ULTIMA riga, da sola:',
      'AZIONI: [ ... ]',
      'con un array JSON di azioni scelte SOLO da questa lista:',
      '{"type":"go","ws":"testo|base|voce|mix|libreria"}  apre una pagina',
      '{"type":"variants","n":8,"atm":"<id atmosfera o vuoto>"}  crea da 4 a 24 basi diverse (atmosfere disponibili nel contesto)',
      '{"type":"studio","text":"<comando breve in italiano>"}  modifica la base nello Studio, es. "808 più lungo", "bpm 140", "togli la batteria nell\'intro", "più riverbero sulla voce", "abbassa gli accordi", "annulla"',
      '{"type":"sing"}  fa cantare il testo da una voce IA di prova (ACE-Step)',
      '{"type":"remember","text":"<preferenza di Sultan da ricordare>"}',
      'Non mettere AZIONI se Sultan fa solo una domanda o chiede un parere. Non scrivere mai la parola AZIONI altrove.'
    ].join('\n');
  }

  function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '\n[…testo tagliato…]' : s; }

  /** ctx: {page, lyrics, summary, analysis, memory[], presets[{id,nome}], decisions} ; history: [{who:'me'|'ai', t}] */
  function buildMessages(text, ctx, history) {
    ctx = ctx || {};
    var c = ['CONTESTO DELL\'APP (aggiornato adesso):', 'Pagina aperta: ' + (ctx.page || 'sconosciuta') + '.'];
    if (ctx.summary) c.push('Base attuale: ' + ctx.summary + '.');
    if (ctx.analysis) c.push('Misure del testo (calcolate dall\'app):\n' + ctx.analysis);
    if (ctx.lyrics && String(ctx.lyrics).trim()) c.push('Testo di Sultan:\n"""\n' + clip(ctx.lyrics, MAX_LYR) + '\n"""'); else c.push('Il testo è ancora vuoto.');
    if (ctx.memory && ctx.memory.length) c.push('Cose che Sultan ti ha chiesto di ricordare:\n- ' + ctx.memory.slice(-12).join('\n- '));
    if (ctx.decisions) c.push('Dalle sue scelte nello Studio:\n' + clip(ctx.decisions, 500));
    if (ctx.presets && ctx.presets.length) c.push('Atmosfere per le basi (id: nome): ' + ctx.presets.slice(0, 40).map(function (p) { return p.id + ': ' + p.nome; }).join('; ') + '.');
    var msgs = [{ role: 'system', content: systemPrompt() }, { role: 'system', content: c.join('\n\n') }];
    (history || []).slice(-MAX_HIST).forEach(function (m) { if (m && m.t) msgs.push({ role: m.who === 'me' ? 'user' : 'assistant', content: clip(m.t, 1200) }); });
    msgs.push({ role: 'user', content: String(text || '') });
    return msgs;
  }

  /** Tiene solo azioni della lista sicura, con valori controllati. */
  function cleanActions(arr, presetIds) {
    var out = [];
    (Array.isArray(arr) ? arr : []).slice(0, 12).forEach(function (a) {
      if (!a || typeof a !== 'object') return;
      if (a.type === 'go' && PAGES.indexOf(a.ws) >= 0) out.push({ type: 'go', ws: a.ws });
      else if (a.type === 'variants') { var n = Math.max(4, Math.min(24, parseInt(a.n, 10) || 8)); var atm = (presetIds && presetIds.indexOf(a.atm) >= 0) ? a.atm : null; out.push({ type: 'variants', n: n, atm: atm }); }
      else if (a.type === 'studio' && typeof a.text === 'string' && a.text.trim()) out.push({ type: 'studio', text: a.text.trim().slice(0, 120) });
      else if (a.type === 'sing') out.push({ type: 'sing' });
      else if (a.type === 'remember' && typeof a.text === 'string' && a.text.trim()) out.push({ type: 'remember', text: a.text.trim().slice(0, 200) });
    });
    return out.slice(0, 4);
  }

  /** Separa la risposta dalla riga AZIONI. Toglie eventuali <think>…</think>. */
  function parseReply(raw, presetIds) {
    var t = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim(), actions = [];
    var m = t.match(/(?:^|\n)\s*\**AZIONI\**\s*:\s*(\[[\s\S]*\])\s*`*\s*$/);
    if (m) {
      try { actions = cleanActions(JSON.parse(m[1]), presetIds); } catch (e) { actions = []; }
      t = t.slice(0, m.index).trim();
    }
    t = t.replace(/```\s*$/, '').trim();
    return { reply: t || (actions.length ? 'Ok, lo faccio.' : '…'), actions: actions };
  }

  function errText(status, body) {
    if (status === 401 || status === 403) return 'La chiave non è valida o è scaduta: creane una nuova e incollala nelle impostazioni ⚙.';
    if (status === 429) return 'Limite gratuito raggiunto per ora (troppe richieste). Riprova tra un minuto, o domani se è il limite del giorno.';
    if (status === 402) return 'Il servizio chiede credito: con i modelli gratuiti non dovrebbe succedere. Controlla di aver scelto un modello gratis.';
    if (status >= 500) return 'Il servizio IA è in difficoltà in questo momento (errore ' + status + '). Riprova tra poco.';
    var msg = ''; try { msg = (JSON.parse(body).error || {}).message || ''; } catch (e) {}
    return 'Errore ' + status + (msg ? ': ' + String(msg).slice(0, 160) : '') + '.';
  }

  /** opts: {provider, key, model, fetch, timeoutMs, presetIds, history}. Ritorna {reply, actions, model}. Lancia Error con messaggio in italiano. */
  async function ask(text, ctx, opts) {
    opts = opts || {}; var P = PROVIDERS[opts.provider || 'groq']; if (!P) throw new Error('Servizio IA sconosciuto.');
    if (!opts.key) throw new Error('Manca la chiave: aprila in ⚙ e incollala.');
    var f = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null); if (!f) throw new Error('Questo browser non può collegarsi.');
    var model = opts.model || P.model, body = { model: model, messages: buildMessages(text, ctx, opts.history), temperature: 0.7, max_tokens: 1200 };
    if ((opts.provider || 'groq') === 'groq' && /gpt-oss/.test(model)) body.reasoning_effort = 'low';
    var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + opts.key };
    if (opts.provider === 'openrouter') { headers['X-Title'] = 'Sultan Sound'; if (typeof location !== 'undefined' && location.origin && /^https?:/.test(location.origin)) headers['HTTP-Referer'] = location.origin; }
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, opts.timeoutMs || 60000) : null;
    var res;
    try { res = await f(P.url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined }); }
    catch (e) { throw new Error(e && e.name === 'AbortError' ? 'Il servizio IA non ha risposto in tempo. Riprova.' : 'Non riesco a collegarmi al servizio IA (rete assente o bloccata).'); }
    finally { if (timer) clearTimeout(timer); }
    var raw = await res.text();
    if (!res.ok) { if (res.status === 400 && body.reasoning_effort && /reasoning/i.test(raw)) { delete body.reasoning_effort; return ask2(f, P, headers, body, opts.presetIds, model); } throw new Error(errText(res.status, raw)); }
    return finish(raw, opts.presetIds, model);
  }
  async function ask2(f, P, headers, body, presetIds, model) {
    var res = await f(P.url, { method: 'POST', headers: headers, body: JSON.stringify(body) }), raw = await res.text();
    if (!res.ok) throw new Error(errText(res.status, raw)); return finish(raw, presetIds, model);
  }
  function finish(raw, presetIds, model) {
    var j; try { j = JSON.parse(raw); } catch (e) { throw new Error('Risposta del servizio IA non leggibile.'); }
    var ch = j.choices && j.choices[0], content = ch && ch.message ? ch.message.content : '';
    if (!content || !String(content).trim()) throw new Error('Il modello ha risposto vuoto. Riprova o scegli un altro modello.');
    var r = parseReply(content, presetIds); r.model = j.model || model; return r;
  }

  /* ---------- impostazioni sul telefono (mai nel codice) ---------- */
  function store(s) { return s || (typeof localStorage !== 'undefined' ? localStorage : null); }
  function getCfg(s) {
    s = store(s); var c = { provider: 'groq', model: '', on: false };
    try { var j = JSON.parse((s && s.getItem('msa-cloudai')) || '{}'); if (PROVIDERS[j.provider]) c.provider = j.provider; c.model = j.model || ''; c.on = !!j.on; } catch (e) {}
    c.key = (s && s.getItem('msa-cloudai-key-' + c.provider)) || ''; return c;
  }
  function setCfg(c, s) {
    s = store(s); if (!s) return; var p = PROVIDERS[c.provider] ? c.provider : 'groq';
    s.setItem('msa-cloudai', JSON.stringify({ provider: p, model: c.model || '', on: !!c.on }));
    if (typeof c.key === 'string') { if (c.key.trim()) s.setItem('msa-cloudai-key-' + p, c.key.trim()); else s.removeItem('msa-cloudai-key-' + p); }
  }
  function ready(c) { return !!(c && c.on && c.key && PROVIDERS[c.provider]); }
  function looksLikeKey(provider, key) { var P = PROVIDERS[provider]; key = String(key || '').trim(); return !!P && key.length >= 20 && !/\s/.test(key) && key.indexOf(P.keyHint) === 0; }

  return { PROVIDERS: PROVIDERS, systemPrompt: systemPrompt, buildMessages: buildMessages, parseReply: parseReply, cleanActions: cleanActions, ask: ask, getCfg: getCfg, setCfg: setCfg, ready: ready, looksLikeKey: looksLikeKey, errText: errText };
});
