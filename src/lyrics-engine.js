/*
 * Motore di analisi dei testi (Modulo 3 e parte del Modulo 4).
 *
 * Tutto qui è calcolato con regole semplici sulla lingua italiana, senza
 * servizi esterni. Sono EURISTICHE: il conteggio delle sillabe può sbagliare
 * di una unità su parole particolari, e l'analisi delle emozioni usa un
 * piccolo dizionario di parole, non capisce ironia o negazioni.
 * Ogni risultato dichiara se è "analisi" (calcolo diretto sul testo) o
 * "ipotesi" (interpretazione che va verificata da una persona).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LyricsEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VOWELS = 'aeiouàáèéìíòóùú';
  var STRONG = 'aeoàáèéòó';
  var ACCENTED_WEAK = 'ìíùú';

  // Parole molto comuni in cui la regola generale sbaglia.
  var EXCEPTIONS = {
    mio: 2, mia: 2, mie: 2, dio: 2, via: 2, zio: 2, zia: 2,
    tua: 2, sua: 2, tue: 2, sue: 2, paura: 3
  };

  var ACCENT_MAP = { 'à': 'a', 'á': 'a', 'è': 'e', 'é': 'e', 'ì': 'i', 'í': 'i', 'ò': 'o', 'ó': 'o', 'ù': 'u', 'ú': 'u' };

  function stripAccents(s) {
    return s.replace(/[àáèéìíòóùú]/g, function (c) { return ACCENT_MAP[c]; });
  }

  function normalizeWord(word) {
    return String(word || '').toLowerCase().replace(/[^a-zàáèéìíòóùú]/g, '');
  }

  function isVowel(c) { return VOWELS.indexOf(c) !== -1; }
  function isStrong(c) { return STRONG.indexOf(c) !== -1; }
  function isAccentedWeak(c) { return ACCENTED_WEAK.indexOf(c) !== -1; }

  // Due vocali vicine stanno nella stessa sillaba (dittongo) o in due (iato)?
  function joins(a, b) {
    if (isStrong(a) && isStrong(b)) return false;
    if (isAccentedWeak(a) && isStrong(b)) return false;
    if (isStrong(a) && isAccentedWeak(b)) return false;
    return true;
  }

  // Vocali che in realtà non formano una sillaba: la u di "qu", "gu" davanti a vocale e la i di "ci", "gi" davanti a vocale.
  function silentVowelAt(w, i) {
    var c = w[i], prev = w[i - 1], next = w[i + 1];
    if (!next || !isVowel(next)) return false;
    if (c === 'u' && (prev === 'q' || prev === 'g')) return true;
    if (c === 'i' && (prev === 'c' || prev === 'g')) return true;
    return false;
  }

  // Posizioni (indici) del punto di appoggio di ogni sillaba.
  function nuclei(w) {
    var out = [];
    var inGroup = false, prevVowel = null, groupStart = -1;
    function closeGroup(end) {
      if (groupStart === -1) return;
      var start = groupStart;
      for (var k = groupStart; k < end; k++) {
        if (isStrong(w[k])) { start = k; break; }
      }
      out.push(start);
    }
    for (var i = 0; i < w.length; i++) {
      var c = w[i];
      if (isVowel(c) && !silentVowelAt(w, i)) {
        if (!inGroup) {
          inGroup = true; groupStart = i;
        } else if (!joins(prevVowel, c)) {
          closeGroup(i);
          groupStart = i;
        }
        prevVowel = c;
      } else {
        if (inGroup) closeGroup(i);
        inGroup = false; groupStart = -1; prevVowel = null;
      }
    }
    if (inGroup) closeGroup(w.length);
    return out;
  }

  function countSyllables(word) {
    var w = normalizeWord(word);
    if (!w) return 0;
    if (Object.prototype.hasOwnProperty.call(EXCEPTIONS, w)) return EXCEPTIONS[w];
    return nuclei(w).length;
  }

  function tokenize(line) {
    var m = String(line || '').toLowerCase().match(/[a-zàáèéìíòóùú]+(?:'[a-zàáèéìíòóùú]+)*/g);
    if (!m) return [];
    var words = [];
    m.forEach(function (tok) {
      // L'amore -> "l" + "amore": l'apostrofo unisce, non aggiunge sillabe.
      tok.split("'").forEach(function (part) { if (part) words.push(part); });
    });
    return words;
  }

  // Sillabe di una riga: 'grezze' (somma delle parole) e 'metriche' (con sinalefe:
  // vocale finale + vocale iniziale si fondono quando si canta).
  function lineSyllables(line) {
    var words = tokenize(line);
    var raw = 0, merges = 0;
    for (var i = 0; i < words.length; i++) {
      raw += countSyllables(words[i]);
      if (i > 0) {
        var prev = words[i - 1], cur = words[i];
        var last = prev[prev.length - 1], first = cur[0];
        if (isVowel(last) && !isAccentedWeak(last) && 'àáèéòó'.indexOf(last) === -1 && isVowel(first)) merges++;
      }
    }
    return { raw: raw, metric: Math.max(0, raw - merges), words: words.length };
  }

  // Chiave di rima: dalla vocale accentata (di norma la penultima sillaba) fino alla fine.
  function rhymeKey(word) {
    var w = normalizeWord(word);
    if (!w) return '';
    var n = nuclei(w);
    if (!n.length) return '';
    var last = w[w.length - 1];
    var start;
    if (!isVowel(last) || isAccentedWeak(last) || 'àáèéòó'.indexOf(last) !== -1) {
      start = n[n.length - 1]; // parola tronca o che finisce in consonante
    } else {
      start = n.length >= 2 ? n[n.length - 2] : n[0];
    }
    return stripAccents(w.slice(start));
  }

  function vowelsOnly(s) { return s.replace(/[^aeiou]/g, ''); }

  function rhymeRelation(a, b) {
    var ka = rhymeKey(a), kb = rhymeKey(b);
    if (!ka || !kb) return 'none';
    if (normalizeWord(a) === normalizeWord(b)) return 'same';
    if (ka === kb) return 'perfect';
    if (vowelsOnly(ka) === vowelsOnly(kb) && vowelsOnly(ka).length >= 2) return 'assonance';
    return 'none';
  }

  function normalizeLine(line) {
    return tokenize(line).join(' ');
  }

  function parseStanzas(text) {
    var stanzas = [];
    var current = null;
    var pendingLabel = null;
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      var label = line.match(/^\[(.+)\]$/);
      if (label) {
        if (current && current.lines.length) stanzas.push(current);
        current = null;
        pendingLabel = label[1].trim();
        return;
      }
      if (!line) {
        if (current && current.lines.length) stanzas.push(current);
        current = null;
        return;
      }
      if (!current) { current = { label: pendingLabel, lines: [] }; pendingLabel = null; }
      current.lines.push(line);
    });
    if (current && current.lines.length) stanzas.push(current);
    stanzas.forEach(function (s, i) { if (!s.label) s.label = 'Strofa ' + (i + 1); });
    return stanzas;
  }

  // Piccolo dizionario di radici di parole per grandi famiglie emotive.
  var LEXICON = {
    amore: ['amor', 'amare', 'amo', 'cuor', 'bacio', 'baci', 'abbracci', 'tenere', 'tenero', 'dolce', 'desider', 'passion', 'insieme', 'carezz'],
    gioia: ['gioi', 'felic', 'rider', 'risat', 'sorrid', 'sorris', 'danz', 'fest', 'luce', 'sole', 'cantar', 'canta', 'brill'],
    tristezza: ['pian', 'lacrim', 'sola', 'solo', 'solitud', 'dolor', 'addio', 'perdut', 'perdere', 'vuot', 'buio', 'manca', 'mancar', 'trist', 'ferit'],
    rabbia: ['rabbi', 'odio', 'urla', 'grid', 'guerra', 'fuoco', 'rompe', 'maledett', 'basta', 'violen', 'furi'],
    speranza: ['speran', 'sogn', 'doman', 'alba', 'volar', 'libert', 'coraggi', 'nuov', 'ancora', 'creder', 'rinasc'],
    nostalgia: ['ricord', 'ieri', 'passat', 'vecchi', 'tornar', 'torn', 'lontan', 'infanzi', 'una volta']
  };
  var VALENCE = { amore: 1, gioia: 1, speranza: 1, tristezza: -1, rabbia: -1, nostalgia: 0 };

  function matchEmotion(word) {
    var found = [];
    Object.keys(LEXICON).forEach(function (emo) {
      var hit = LEXICON[emo].some(function (stem) {
        return stem.length <= 3 ? word === stem : word.indexOf(stem) === 0;
      });
      if (hit) found.push(emo);
    });
    return found;
  }

  function stdev(values) {
    if (values.length < 2) return 0;
    var m = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
    var v = values.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / values.length;
    return Math.sqrt(v);
  }

  function mean(values) {
    return values.length ? values.reduce(function (a, b) { return a + b; }, 0) / values.length : 0;
  }

  // Schema di rime di una strofa: lettere uguali = rima perfetta.
  function stanzaRhymes(lines) {
    var lasts = lines.map(function (l) { var w = tokenize(l); return w[w.length - 1] || ''; });
    var letters = [], reps = [], next = 0;
    var assonances = 0;
    lasts.forEach(function (w, i) {
      var assigned = null;
      for (var j = 0; j < reps.length; j++) {
        var rel = rhymeRelation(reps[j].word, w);
        if (rel === 'perfect' || rel === 'same') { assigned = reps[j].letter; break; }
      }
      if (assigned === null) {
        for (var k = 0; k < reps.length; k++) {
          if (rhymeRelation(reps[k].word, w) === 'assonance') { assonances++; break; }
        }
        assigned = String.fromCharCode(65 + next++);
        reps.push({ word: w, letter: assigned });
      }
      letters.push(assigned);
    });
    var counts = {};
    letters.forEach(function (l) { counts[l] = (counts[l] || 0) + 1; });
    var rhymed = letters.filter(function (l) { return counts[l] > 1; }).length;
    return { letters: letters, scheme: letters.join(''), rhymedLines: rhymed, assonances: assonances, lasts: lasts };
  }

  function analyze(text) {
    var stanzas = parseStanzas(text);
    var allLines = [];
    var lineIndex = 0;
    var stanzaResults = stanzas.map(function (s) {
      var rh = stanzaRhymes(s.lines);
      var lines = s.lines.map(function (l, i) {
        var syl = lineSyllables(l);
        var item = { text: l, syllables: syl.raw, metric: syl.metric, words: syl.words, rhyme: rh.letters[i], lastWord: rh.lasts[i], index: lineIndex++ };
        allLines.push(item);
        return item;
      });
      var metrics = lines.map(function (x) { return x.metric; });
      return {
        label: s.label,
        lines: lines,
        scheme: rh.scheme,
        rhymedLines: rh.rhymedLines,
        rhymeDensity: lines.length ? rh.rhymedLines / lines.length : 0,
        assonances: rh.assonances,
        avgMetric: mean(metrics),
        spread: stdev(metrics),
        min: metrics.length ? Math.min.apply(null, metrics) : 0,
        max: metrics.length ? Math.max.apply(null, metrics) : 0,
        key: s.lines.map(normalizeLine).join('|')
      };
    });

    // Ripetizioni di righe
    var lineCounts = {};
    allLines.forEach(function (l) {
      var k = normalizeLine(l.text);
      if (k) lineCounts[k] = (lineCounts[k] || 0) + 1;
    });
    var repeatedLines = Object.keys(lineCounts).filter(function (k) { return lineCounts[k] > 1; })
      .map(function (k) { return { text: k, count: lineCounts[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
    var repeatedLineTotal = allLines.filter(function (l) { return lineCounts[normalizeLine(l.text)] > 1; }).length;

    // Ritornello: strofa etichettata o strofa che si ripete uguale
    var chorus = null;
    var labeledIdx = -1;
    stanzaResults.forEach(function (s, i) { if (labeledIdx === -1 && /ritornell|chorus|refrain|special/i.test(s.label)) labeledIdx = i; });
    var keyCount = {};
    stanzaResults.forEach(function (s) { keyCount[s.key] = (keyCount[s.key] || 0) + 1; });
    var repIdx = -1;
    stanzaResults.forEach(function (s, i) { if (repIdx === -1 && keyCount[s.key] > 1) repIdx = i; });
    var chosen = labeledIdx !== -1 ? labeledIdx : repIdx;
    if (chosen !== -1) {
      var cs = stanzaResults[chosen];
      var appearances = keyCount[cs.key];
      var components = [];
      var score = 0;
      function add(points, name, ok, detail) {
        components.push({ name: name, points: ok ? points : 0, max: points, detail: detail });
        if (ok) score += points;
      }
      add(35, 'Si ripete uguale', appearances > 1, appearances > 1 ? 'compare ' + appearances + ' volte' : 'compare una sola volta');
      add(20, 'Righe brevi e cantabili', cs.avgMetric > 0 && cs.avgMetric <= 9, 'media ' + cs.avgMetric.toFixed(1) + ' sillabe (soglia 9)');
      add(15, 'Metro regolare', cs.spread <= 1.5, 'scarto ' + cs.spread.toFixed(1) + ' sillabe (soglia 1,5)');
      add(15, 'Rime presenti', cs.rhymeDensity >= 0.5, Math.round(cs.rhymeDensity * 100) + '% righe in rima (soglia 50%)');
      var firstWords = cs.lines.map(function (l) { return tokenize(l.text)[0]; });
      var anaphora = firstWords.length > 1 && firstWords.some(function (w, i) { return w && firstWords.indexOf(w) !== i; });
      add(15, 'Parola di apertura che torna', anaphora, anaphora ? 'più righe iniziano con la stessa parola' : 'nessuna ripetizione in apertura');
      chorus = { stanzaIndex: chosen, label: cs.label, appearances: appearances, labeled: labeledIdx !== -1, score: score, components: components };
    }

    // Emozioni (ipotesi)
    var counts = {};
    Object.keys(LEXICON).forEach(function (e) { counts[e] = 0; });
    var totalWords = 0, matchedWords = 0;
    allLines.forEach(function (l) {
      tokenize(l.text).forEach(function (w) {
        totalWords++;
        var m = matchEmotion(w);
        if (m.length) { matchedWords++; m.forEach(function (e) { counts[e]++; }); }
      });
    });
    var emoTotal = Object.keys(counts).reduce(function (a, e) { return a + counts[e]; }, 0);
    var emotions = Object.keys(counts).map(function (e) {
      return { name: e, count: counts[e], share: emoTotal ? counts[e] / emoTotal : 0 };
    }).sort(function (a, b) { return b.count - a.count; });
    var valenceSum = 0;
    emotions.forEach(function (e) { valenceSum += VALENCE[e.name] * e.count; });
    var sufficient = matchedWords >= 3;

    // Musicalità
    var endings = allLines.map(function (l) { return l.lastWord; }).filter(Boolean);
    var openEndings = endings.filter(function (w) { var c = w[w.length - 1]; return isVowel(c); }).length;
    var alliterations = 0;
    allLines.forEach(function (l) {
      var ws = tokenize(l.text);
      for (var i = 1; i < ws.length; i++) {
        if (ws[i].length > 2 && ws[i - 1].length > 2 && ws[i][0] === ws[i - 1][0] && !isVowel(ws[i][0])) alliterations++;
      }
    });

    var metricAll = allLines.map(function (l) { return l.metric; });
    var result = {
      counts: { stanzas: stanzaResults.length, lines: allLines.length, words: totalWords },
      stanzas: stanzaResults,
      syllables: { average: mean(metricAll), spread: stdev(metricAll), min: metricAll.length ? Math.min.apply(null, metricAll) : 0, max: metricAll.length ? Math.max.apply(null, metricAll) : 0 },
      repeatedLines: repeatedLines,
      repetitionShare: allLines.length ? repeatedLineTotal / allLines.length : 0,
      chorus: chorus,
      emotions: { items: emotions, matchedWords: matchedWords, totalWords: totalWords, sufficient: sufficient, valence: sufficient ? (valenceSum > 0 ? 'positivo' : valenceSum < 0 ? 'negativo' : 'misto') : null },
      singability: { openEndingShare: endings.length ? openEndings / endings.length : 0, alliterations: alliterations }
    };
    result.suggestions = buildSuggestions(result);
    return result;
  }

  function buildSuggestions(r) {
    var out = [];
    if (!r.counts.lines) return out;

    r.stanzas.forEach(function (s) {
      if (s.lines.length >= 3 && s.spread > 2) {
        out.push({
          kind: 'analisi',
          text: '"' + s.label + '": le righe vanno da ' + s.min + ' a ' + s.max + ' sillabe. Avvicinale a ' + Math.round(s.avgMetric) + ' per una melodia più regolare.',
          reason: 'Scarto di ' + s.spread.toFixed(1) + ' sillabe tra le righe; sopra 2 la linea melodica deve forzare il ritmo.'
        });
      }
    });

    if (!r.chorus) {
      out.push({
        kind: 'ipotesi',
        text: 'Non trovo un ritornello. Prova a scegliere una frase breve e farla tornare identica almeno due volte.',
        reason: 'Nessuna strofa si ripete e nessuna è etichettata come ritornello. La ripetizione aiuta la memorizzazione.'
      });
    } else if (r.chorus.score < 60) {
      var weak = r.chorus.components.filter(function (c) { return !c.points; }).map(function (c) { return c.name.toLowerCase(); });
      out.push({
        kind: 'ipotesi',
        text: 'Il ritornello ("' + r.chorus.label + '") ha margine di miglioramento su: ' + weak.join(', ') + '.',
        reason: 'Punteggio euristico ' + r.chorus.score + '/100 sui criteri elencati nel dettaglio.'
      });
    }

    var avgDensity = r.stanzas.reduce(function (a, s) { return a + s.rhymeDensity; }, 0) / r.stanzas.length;
    if (r.counts.lines >= 4 && avgDensity < 0.3) {
      out.push({
        kind: 'analisi',
        text: 'Poche rime perfette (' + Math.round(avgDensity * 100) + '% delle righe). Se vuoi un suono più orecchiabile, prova a far rimare le ultime parole di righe alternate.',
        reason: 'Le rime (anche solo assonanze) danno punti di appoggio all\'ascolto; qui sono rare.'
      });
    }

    if (r.repetitionShare > 0.6) {
      out.push({
        kind: 'ipotesi',
        text: 'Più del 60% delle righe è ripetuto. Inserisci una variazione nelle strofe per non appesantire l\'ascolto.',
        reason: 'Tanta ripetizione rende il brano familiare ma, oltre una certa soglia, può risultare monotono.'
      });
    }

    if (r.counts.lines >= 4 && r.singability.openEndingShare < 0.5) {
      out.push({
        kind: 'analisi',
        text: 'Meno della metà delle righe finisce con una vocale. Le note lunghe sono più facili da tenere su parole che finiscono in vocale.',
        reason: r.singability.openEndingShare === 0 ? 'Nessuna riga finisce con una vocale.' : Math.round(r.singability.openEndingShare * 100) + '% delle righe finisce con una vocale.'
      });
    }

    if (!r.emotions.sufficient) {
      out.push({
        kind: 'ipotesi',
        text: 'Il testo contiene poche parole riconoscibili nel mio dizionario emotivo, quindi non esprimo un giudizio sul tono.',
        reason: 'Parole riconosciute: ' + r.emotions.matchedWords + ' (ne servono almeno 3).'
      });
    }
    return out;
  }

  return {
    countSyllables: countSyllables,
    lineSyllables: lineSyllables,
    rhymeKey: rhymeKey,
    rhymeRelation: rhymeRelation,
    tokenize: tokenize,
    parseStanzas: parseStanzas,
    analyze: analyze
  };
});
