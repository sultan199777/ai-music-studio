# Mappa del progetto (generata da tools/mappa.js, non modificare a mano)

Leggi questo file PRIMA di aprire i sorgenti: dice dove sta ogni cosa.

## src/ (moduli)

| File | Righe | Scopo | Esporta |
|---|---|---|---|
| app.body.html | 312 |  |  |
| app.css | 195 |  |  |
| app.js | 1209 | ================= Dati e salvataggio ================= |  |
| app.shell.html | 30 |  |  |
| app.template.html | 1169 |  |  |
| arranger.js | 580 | Arrangiatore: costruisce basi ORIGINALI con una struttura vera (intro, strofa, pre, ritornello, bridge, outro) e direzioni di stile diverse. Tutto è sintetizzato dal programma (nessun campione, nessun brano altrui). | generate: generate, planStructure: planStructure, STYLES: STYLES, SECTIONS: SEC |
| audio-analysis.js | 223 | Analisi audio della voce (Modulo 1, solo parte MISURABILE con calcolo diretto). Misura: livello, picco, clipping, dinamica, altezza delle note (pitch), estensione e scostamento dall'intonazione "temperata" (La = 440 Hz). | analyze: analyze, detectPitch: detectPitch, synthExample: synthExample, freqToMidi: freqToMidi, midiToFreq: midiToFreq, midiToName: midiToName |
| autotune.js | 217 | Autotune (correzione dell'intonazione) con la tecnica PSOLA. 1. Si misura l'altezza della voce nel tempo (AudioAnalysis). 2. Per ogni istante si sceglie la nota "giusta" più vicina nella scala scelta. | correct: correct, scaleMask: scaleMask, quantizeMidi: quantizeMidi, stepUp: stepUp |
| backing.js | 291 | Generatore di basi musicali ORIGINALI (batteria, basso, accordi, pad, melodia). Tutto è sintetizzato dal programma con onde semplici: non usa registrazioni, campioni o brani di altri. Il risultato è una bozza utile per c | generate: generate, mix: mix, withVoice: withVoice, resampleLinear: resampleLinear, GENRES: GENRES, chordName: chordName, NAMES: NAMES |
| base-analysis.js | 119 | Analisi di una base musicale importata (audio con più strumenti insieme): velocità (BPM) e tonalità STIMATE. BPM: si misura quanto spesso l'energia sale di colpo (colpi di batteria, accordi) | analyze: analyze, estimateBpm: estimateBpm |
| clip-fx.js | 41 | Effetti del videoclip a tempo di musica: calcolo puro, senza disegno. Dato il tempo trascorso e i battiti al minuto, dice quanto ingrandire l'immagine, quanto farla vibrare e quale riga del testo mostrare. | beatState: beatState, lyricAt: lyricAt, frame: frame |
| instruments.js | 280 | Strumenti: catalogo spiegato + campionatore (sampler) + chitarre sintetizzate. - I campioni veri vengono da VSCO-2-CE e VCSL (Versilian Studios, licenza CC0):   ogni strumento è un file assets/inst/<id>.json (nel sito: i |  |
| key-detect.js | 73 | Riconoscimento della tonalità dalla voce (stima). Metodo: istogramma delle 12 note (senza ottava) pesato sul tempo, confrontato con i profili di Krumhansl-Kessler per le 12 tonalità maggiori e le 12 minori. | detect: detect, fromHistogram: fromHistogram, NAMES: NAMES |
| lyrics-engine.js | 425 | Motore di analisi dei testi (Modulo 3 e parte del Modulo 4). Tutto qui è calcolato con regole semplici sulla lingua italiana, senza servizi esterni. Sono EURISTICHE: il conteggio delle sillabe può sbagliare | countSyllables: countSyllables, lineSyllables: lineSyllables, rhymeKey: rhymeKey, rhymeRelation: rhymeRelation, tokenize: tokenize, parseStanzas: parseStanzas, analyze: analyze |
| lyrics-to-base.js | 51 | Dal testo a una base consigliata: genere, scala e velocità. È un'IPOTESI costruita sul tono emotivo (dizionario di parole) e sulla lunghezza delle righe. Serve come punto di partenza, non come verità. | suggest: suggest |
| manga-filter.js | 191 | Filtro "fumetto" per immagini: stile cartoon a colori, stile neon (nero, viola, fucsia) e manga a retino. È un filtro grafico che gira sul tuo dispositivo, NON un'intelligenza artificiale: non ridisegna il volto, non cre | apply: apply |
| master.js | 72 | Catena di master: filtro sui bassi, correzione di tono leggera, compressione "colla", saturazione morbida, regolazione del volume medio e limitatore sul picco. Serve a far suonare la base (o il mix con la voce) più piena | process: process, PRESETS: PRESETS, rmsDb: rmsDb, peakDb: peakDb |
| pitch-editor.js | 79 | Editor delle note (stile "piano roll"): divide la voce misurata in note singole e prepara le note da passare all'autotune. Ogni nota ha:   midi    nota cantata (misurata, mediana dei frame, può essere decimale) | segment: segment, snap: snap, resnap: resnap, offsetCents: offsetCents |
| polish.js | 154 | Rifinitura della voce: filtro dei bassi, equalizzatore, compressore, eco e riverbero. Tutto calcolato dal programma con filtri standard (biquad) e un riverbero a linee di ritardo. Non è un plugin da studio professionale, | process: process, denoise: denoise, highpass: highpass, peaking: peaking, highShelf: highShelf, compress: compress, reverb: reverb, echo: echo, PRESETS: PRESETS |
| producer-actions.js | 179 | AI Producer: trasforma un comando scritto in italiano in modifiche REALI alla base. Riconosce un elenco limitato di richieste (vedi HELP). Quello che non riconosce non viene eseguito: l'app lo passa a Claude come consigl | interpret: interpret, HELP: HELP, LEVEL_KEYS: LEVEL_KEYS, cloneState: cloneState |
| promo-plan.js | 125 | Piano di promozione di una canzone (30 giorni), costruito dai dati del brano. Non usa servizi esterni e non pubblica nulla: produce un calendario di contenuti con piattaforma, formato, data, orario suggerito, didascalia  | generate: generate, toCsv: toCsv, TEMPLATE: TEMPLATE |
| samples-data.js | 2 | campioni batteria CC0 codificati | dati |
| style-card.js | 114 | Scheda di stile: misura caratteristiche GENERICHE di una canzone di riferimento (tempo, peso del basso, luminosità, densità ritmica, crescita di energia) e le trasforma in parametri per l'arrangiatore. Si possono mescola | measure: measure, blend: blend, toParams: toParams, normBpm: normBpm |
| video-ideas.js | 87 | Idee per il videoclip, costruite sul brano: concetto visivo, struttura a battute (con i secondi calcolati dal tempo), inquadrature da girare con l'iPhone, montaggio e cose da evitare. | generate: generate, MOODS: MOODS |

## src/app.js: sezioni (riga: titolo)

- 17: Dati e salvataggio
- 85: Audio
- 175: Claude (facoltativo)
- 193: Navigazione
- 219: Atmosfera: i colori seguono l'emozione del testo
- 229: Home
- 261: Canzoni
- 314: Studio: testo
- 370: Guida alla voce: canta / parla / allunga
- 401: Studio: base
- 495: Strumenti veri
- 640: AI Producer
- 699: Vocal Studio
- 732: Registrazione con il microfono vero (solo nella versione app; dentro Claude il microfono è bloccato)
- 1000: Video
- 1090: Marketing e Social
- 1155: Libreria
- 1170: Impostazioni
- 1201: Avvio

## Funzioni principali di app.js (riga: nome)

esc:5, fmt:6, cap:7, tick:8, sleep:9, tag:13, today:14, uid:15, defaultProd:23, newSong:26, cur:29, persist:38, flush:44, sanitize:52, load:58, getCtx:87, makeBuffer:92, stopPlay:97, playBuf:103, getDl:120, saveFile:121, wavBlob:133, saveAudio:141, toMono:158, decode:164, initSample:177, ask:181, songContext:185, route:203, applyMood:222, lyricLines:257, analysisOf:258, topMood:259, songCard:262, inFolder:268, renderAnalysis:316, meter:344, renderGuide:372, followBars:403, fillBase:407, syncKar:419, getBase:439, activeTake:444, buildMix:446, karaokeTick:464, makeAndPlay:474, instName:497, noteNm:498, loadInst:499, ensureInst:504, instOptions:510, instInfo:521, fillInst:526, applyRecipe:533, previewInst:544, renderRefs:607, chatPush:642, renderChat:643, renderHist:647, snapshot:651, producerGo:652, localAdvice:675, setAT:704, addTake:712, micOk:734, tdb:735, dbTake:746, restoreTakes:756, recUi:768, finishRec:789, renderTakes:809, selectTake:823, renderTakeAnalysis:834, cssv:852, drawPitch:853, noteName:909, geom:910, drawNotes:917, renderNotes:944, playTone:954, noteAtX:960, ptr:961, endDrag:972, rescale:985, filterPhoto:1002, soon:1017, wrap:1020, drawClip:1021, clipMix:1044, renderIdeas:1070, copyText:1092, post:1097, findItem:1104, postEvents:1105, genPlan:1113, renderPlan:1123, refreshSocial:1136, applyTheme:1171, renderSettings:1175, start:1202

## tests/

- arranger.test.js: 16 test
- audio-analysis.test.js: 8 test
- autotune-key.test.js: 13 test
- backing-manga.test.js: 13 test
- base-analysis.test.js: 2 test
- instruments.test.js: 6 test
- lyrics-base-clip.test.js: 7 test
- lyrics-engine.test.js: 12 test
- master.test.js: 6 test
- pitch-video.test.js: 7 test
- polish.test.js: 8 test
- producer-promo.test.js: 16 test
- style-card.test.js: 8 test

## Altro

- build.js: esegue i test e crea dist/index.html (artifact) e docs/ (sito GitHub Pages)
- notes/STATO.md: cosa è fatto e cosa no (aggiornare ogni passo)
- notes/ARCHITETTURA.md, notes/LICENZE-SUONI.md
- src/app.body.html / app.css / app.shell.html: interfaccia
