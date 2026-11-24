# Mappa del progetto (generata da tools/mappa.js, non modificare a mano)

Leggi questo file PRIMA di aprire i sorgenti: dice dove sta ogni cosa.

## src/ (moduli)

| File | Righe | Scopo | Esporta |
|---|---|---|---|
| ai-separator.js | 63 | Separazione AI (gratuita, open source, tutto sul telefono/computer): modello HTDemucs v4 di Meta (MIT) eseguito con onnxruntime-web (MIT) dentro un worker (ort/sep-worker.js): la pagina resta usabile. Divide in 4 tracce: |  |
| app.body.html | 484 |  |  |
| app.css | 307 |  |  |
| app.js | 2101 | ================= Dati e salvataggio ================= |  |
| app.shell.html | 49 |  |  |
| app.template.html | 1169 |  |  |
| arranger.js | 644 | Arrangiatore: costruisce basi ORIGINALI con una struttura vera (intro, strofa, pre, ritornello, bridge, outro) e direzioni di stile diverse. Tutto è sintetizzato dal programma (nessun campione, nessun brano altrui). | generate: generate, planStructure: planStructure, STYLES: STYLES, SECTIONS: SEC, ARP: ARP, ARP_STYLE: ARP_STYLE |
| artist-lab.js | 110 | Cartelle artista: impara lo STILE da testi che carichi tu, con SOLO statistiche. Di ogni testo si misurano numeri (sillabe per riga, rime, ripetizioni, ricchezza delle parole, quali "mondi" ricorrono e quali stanno insie | measure: measure, merge: merge, finalize: finalize, blend: blend, compare: compare, newAcc: newAcc, SCENE_IT: SCENE_IT |
| audio-analysis.js | 223 | Analisi audio della voce (Modulo 1, solo parte MISURABILE con calcolo diretto). Misura: livello, picco, clipping, dinamica, altezza delle note (pitch), estensione e scostamento dall'intonazione "temperata" (La = 440 Hz). | analyze: analyze, detectPitch: detectPitch, synthExample: synthExample, freqToMidi: freqToMidi, midiToFreq: midiToFreq, midiToName: midiToName |
| autotune.js | 408 | Autotune (correzione dell'intonazione) con la tecnica PSOLA. 1. Si misura l'altezza della voce nel tempo (AudioAnalysis). 2. Per ogni istante si sceglie la nota "giusta" più vicina nella scala scelta. | correct: correct, scaleMask: scaleMask, quantizeMidi: quantizeMidi, stepUp: stepUp, track: track, measure: measure, detectKey: detectKey |
| backing.js | 291 | Generatore di basi musicali ORIGINALI (batteria, basso, accordi, pad, melodia). Tutto è sintetizzato dal programma con onde semplici: non usa registrazioni, campioni o brani di altri. Il risultato è una bozza utile per c | generate: generate, mix: mix, withVoice: withVoice, resampleLinear: resampleLinear, GENRES: GENRES, chordName: chordName, NAMES: NAMES |
| base-analysis.js | 119 | Analisi di una base musicale importata (audio con più strumenti insieme): velocità (BPM) e tonalità STIMATE. BPM: si misura quanto spesso l'energia sale di colpo (colpi di batteria, accordi) | analyze: analyze, estimateBpm: estimateBpm |
| beat-learn.js | 314 | Impara da una base: carichi una canzone (es. un pezzo che ti piace), l'app  1) SEPARA voce e base (stima): STFT + maschere morbide.     - voce = suono al CENTRO dello stereo (mid molto più forte del side), ARMONICO (non  | separate: separate, separateAsync: separateAsync, clean: clean, learn: learn, blend: blend, closestStyle: closestStyle, describe: describe, stft: stft, istft: istft |
| beatlab-boot.js | 7 | Beat Lab - avvio: collega i moduli opzionali (campioni, teoria, mixer...) all'interfaccia quando sono presenti. |  |
| beatlab-engine.js | 451 | Beat Lab - motore (Tappa 1). SCELTA: Web Audio puro, senza Tone.js. Motivi: (1) non serve scaricare nulla (la pagina resta un file solo e funziona offline come PWA); (2) lo stesso identico codice suona in tempo reale e v | PPQ: PPQ, BAR: BAR, LANES: LANES, LANE_IDS: LANE_IDS, ROLLS: ROLLS, KITS: KITS, Voices: Voices, clamp: clamp, newProject: newProject, newDrumTrack: newDrumTrack, newInstTrack: newInstTrack, resize: re |
| beatlab-midi.js | 78 | Beat Lab - esportazione MIDI (Tappa 4): file standard tipo 1, 96 ticks per quarto (come il motore). Batteria sul canale 10 con la mappa General MIDI; ogni traccia strumento su un canale suo con il programma GM piu' vicin | toMidi: toMidi, parse: parse, DRUM_MAP: DRUM_MAP, progFor: progFor |
| beatlab-mix.js | 78 | Beat Lab - mix (Tappa 4): valori di partenza degli effetti per stile/strumento ("punto di partenza", dalla ricerca C), misura del volume (LUFS, BS.1770 con pesatura K e gate) e stima del picco reale (true peak, interpola | presetFor: presetFor, applyPresets: applyPresets, resetFx: resetFx, lufs: lufs, peaks: peaks, loudness: loudness, advice: advice, kWeight: kWeight |
| beatlab-patterns.js | 212 | Beat Lab - pattern di partenza per stile, ORIGINALI (scritti qui, non copiati da brani). Le regole vengono dalle schede di ricerca C (notes/RICERCA-C-produzione.md): half-time, rullante sul 3 (drill: sul 3 poi sul 4), hi | scaleNote: scaleNote, demoNotes: demoNotes, HELD: HELD, BASSY: BASSY, STYLES: STYLES, STYLE_IDS: STYLE_IDS, SCALES: SCALES, applyStyle: applyStyle, randomize: randomize, mulberry: mulberry, velOf: vel |
| beatlab-sampler.js | 163 | Beat Lab - sampler intonato a piu' campioni (Tappa 2). - Catalogo degli strumenti (sempre presente, anche senza file): nome, gruppo, spiegazione e SINTETIZZATORE DI RIPIEGO. - I campioni (MP3 mono) stanno in samples/ acc | CATALOG: CATALOG, ORDER: ORDER, instrumentList: instrumentList, groupOf: groupOf, Sampler: Sampler, pickSample: pickSample, rateFor: rateFor, firstAbove: firstAbove |
| beatlab-store.js | 53 | Beat Lab - salvataggio progetti (Tappa 4): IndexedDB (con copia di riserva in localStorage se IndexedDB non c'e'). sanitize() ripulisce/ripara un progetto letto da fuori (file vecchi o rovinati) cosi' non puo' rompere il | sanitize: sanitize, save: save, list: list, load: load, remove: remove |
| beatlab-theory.js | 101 | Beat Lab - teoria musicale semplice (Tappa 3): nomi delle note (Do Re Mi + lettera), note della scala, blocco sulla scala, accordi e progressioni per atmosfera, quantizzazione, aggiunta/spostamento note. Le progressioni  | IT: IT, EN: EN, noteName: noteName, noteShort: noteShort, noteFull: noteFull, SCALE_NAMES: SCALE_NAMES, SCALE_HELP: SCALE_HELP, inScale: inScale, scaleDegreeOf: scaleDegreeOf, snapToScale: snapToScale |
| beatlab-ui-edit.js | 229 | Beat Lab - aiuto per chi non e' esperto (Tappa 3): tonalita' e blocco sulla scala, tastiera touch, accordi per atmosfera, piano roll semplice e livello "Impara" con esempi da ascoltare. |  |
| beatlab-ui-inst.js | 137 | Beat Lab - interfaccia degli strumenti (Tappa 2): elenco per gruppi, "Ascolta", "Aggiungi traccia", scelta dello strumento di una traccia, caricamento dei campioni a richiesta con stato visibile. |  |
| beatlab-ui-mix.js | 89 | Beat Lab - interfaccia mix e progetti (Tappa 4): effetti per traccia, master, misura del volume, salvataggio dei progetti (IndexedDB), esportazione MIDI. |  |
| beatlab-ui.js | 270 | Beat Lab - interfaccia (touch, italiano). Costruita senza librerie. Si apre da #beatlab. mount(elemento) disegna tutto; unmount() ferma il suono. Le sezioni sono funzioni separate (render*) e ognuna ridisegna solo la sua |  |
| beatlab-voices.js | 247 | Beat Lab - suoni. Batteria e strumenti costruiti con Web Audio puro (oscillatori, rumore, filtri). Funzionano sia in tempo reale (AudioContext) sia nell'esportazione (OfflineAudioContext), perche' usano solo l'interfacci | mtof: mtof, velGain: velGain, DRUMS: DRUMS, SYNTHS: SYNTHS, INSTRUMENTS: INSTRUMENTS, noiseBuf: noiseBuf, sat: sat, env: env, adsr: adsr, done: done |
| beatlab.css | 73 |  |  |
| clip-fx.js | 79 | Effetti del videoclip a tempo di musica: calcolo puro, senza disegno. Dato il tempo trascorso e i battiti al minuto, dice quanto ingrandire l'immagine, quanto farla vibrare e quale riga del testo mostrare. | beatState: beatState, lyricAt: lyricAt, frame: frame, timeline: timeline, lineAt: lineAt |
| coach.js | 166 | Coach: impara dai tuoi gesti e ti insegna. Gira tutto sul telefono, senza servizi a pagamento. 1. IMPARA (preferenze): ogni gesto è un voto.    mi piace +3 · non mi piace -3 · base salvata +2 · voce registrata sulla base | fresh: fresh, record: record, suggest: suggest, profile: profile, lessons: lessons, learn: learn, progress: progress, features: features, compatible: compatible, SKILLS: SKILLS, WEIGHTS: W |
| ear.js | 135 | Orecchio di Sultan: "ascolto" con strumenti di misura, come fa un fonico con gli analizzatori. Io non ho orecchie, ma posso MISURARE il suono: livello, dinamica, quanta energia c'è in basso (sub, 808), al centro e in alt | listen: listen, spectrum: spectrum, BANDS: BANDS, REF: REF |
| formant.js | 98 | Formant shift (cambio del TIMBRO senza cambiare la nota) con il metodo del CEPSTRUM. Idea: lo spettro della voce = "inviluppo" (la forma della gola e della bocca: i formanti) x "armoniche" (la nota). Si stima l'inviluppo | shift: shift, fft: fft |
| instruments.js | 293 | Strumenti: catalogo spiegato + campionatore (sampler) + chitarre sintetizzate. - I campioni veri vengono da VSCO-2-CE e VCSL (Versilian Studios, licenza CC0):   ogni strumento è un file assets/inst/<id>.json (nel sito: i |  |
| key-detect.js | 73 | Riconoscimento della tonalità dalla voce (stima). Metodo: istogramma delle 12 note (senza ottava) pesato sul tempo, confrontato con i profili di Krumhansl-Kessler per le 12 tonalità maggiori e le 12 minori. | detect: detect, fromHistogram: fromHistogram, NAMES: NAMES |
| lyrics-engine.js | 425 | Motore di analisi dei testi (Modulo 3 e parte del Modulo 4). Tutto qui è calcolato con regole semplici sulla lingua italiana, senza servizi esterni. Sono EURISTICHE: il conteggio delle sillabe può sbagliare | countSyllables: countSyllables, lineSyllables: lineSyllables, rhymeKey: rhymeKey, rhymeRelation: rhymeRelation, tokenize: tokenize, parseStanzas: parseStanzas, analyze: analyze |
| lyrics-to-base.js | 58 | Dal testo a una base consigliata: genere, scala e velocità. È un'IPOTESI costruita sul tono emotivo (dizionario di parole) e sulla lunghezza delle righe. Serve come punto di partenza, non come verità. | suggest: suggest |
| manga-filter.js | 191 | Filtro "fumetto" per immagini: stile cartoon a colori, stile neon (nero, viola, fucsia) e manga a retino. È un filtro grafico che gira sul tuo dispositivo, NON un'intelligenza artificiale: non ridisegna il volto, non cre | apply: apply |
| master.js | 72 | Catena di master: filtro sui bassi, correzione di tono leggera, compressione "colla", saturazione morbida, regolazione del volume medio e limitatore sul picco. Serve a far suonare la base (o il mix con la voce) più piena | process: process, PRESETS: PRESETS, rmsDb: rmsDb, peakDb: peakDb |
| pitch-editor.js | 79 | Editor delle note (stile "piano roll"): divide la voce misurata in note singole e prepara le note da passare all'autotune. Ogni nota ha:   midi    nota cantata (misurata, mediana dei frame, può essere decimale) | segment: segment, snap: snap, resnap: resnap, offsetCents: offsetCents |
| polish.js | 154 | Rifinitura della voce: filtro dei bassi, equalizzatore, compressore, eco e riverbero. Tutto calcolato dal programma con filtri standard (biquad) e un riverbero a linee di ritardo. Non è un plugin da studio professionale, | process: process, denoise: denoise, highpass: highpass, peaking: peaking, highShelf: highShelf, compress: compress, reverb: reverb, echo: echo, PRESETS: PRESETS |
| producer-actions.js | 179 | AI Producer: trasforma un comando scritto in italiano in modifiche REALI alla base. Riconosce un elenco limitato di richieste (vedi HELP). Quello che non riconosce non viene eseguito: l'app lo passa a Claude come consigl | interpret: interpret, HELP: HELP, LEVEL_KEYS: LEVEL_KEYS, cloneState: cloneState |
| promo-plan.js | 125 | Piano di promozione di una canzone (30 giorni), costruito dai dati del brano. Non usa servizi esterni e non pubblica nulla: produce un calendario di contenuti con piattaforma, formato, data, orario suggerito, didascalia  | generate: generate, toCsv: toCsv, TEMPLATE: TEMPLATE |
| realtime-tune.js | 120 | Autotune LEGGERO in tempo reale (SPERIMENTALE) per il monitor in cuffia. Funziona così: misura l'altezza della voce con la stessa idea di McLeod (autocorrelazione normalizzata, finestra ~37 ms su audio ridotto a ~12 kHz) | createCore: createCore, workletSource: workletSource |
| samples-data.js | 2 | campioni batteria CC0 codificati | dati |
| song-map.js | 85 | Mappa della canzone: il TESTO decide la struttura della base. - I titoli tra parentesi quadre ([Strofa], [Ritornello], [Bridge], [Pre], [Intro], [Outro])   diventano sezioni della base; senza titoli tutto il testo è una  | build: build, at: at, tagOf: tagOf, RATE: RATE |
| sound-lab.js | 181 | Laboratorio suoni: crea strumenti NUOVI partendo dai suoni grezzi. Un suono del laboratorio è una "ricetta":   strati  : 1-3 sorgenti (strumenti veri o sintesi), ognuno con ottava, volume, scordatura | KNOBS: KNOBS, SYNTHS: SYNTHS, ORIGINALS: ORIGINALS, GENRES: GENRES, render: render, install: install, invent: invent, deps: deps, rangeOf: rangeOf |
| style-card.js | 114 | Scheda di stile: misura caratteristiche GENERICHE di una canzone di riferimento (tempo, peso del basso, luminosità, densità ritmica, crescita di energia) e le trasforma in parametri per l'arrangiatore. Si possono mescola | measure: measure, blend: blend, toParams: toParams, normBpm: normBpm |
| sultan-brain.js | 119 | Cervello Sultan: legge il TESTO e decide da solo come deve suonare la base. Non è un modello di linguaggio: è un sistema di regole misurabili, tutto sul telefono, tutto spiegabile. 1. SCENE: conta nel testo parole di mon | plan: plan, styleScores: styleScores, words: words, BASE_BPM: BASE_BPM, hash: hash, NAMES: NAMES, GENRES: GENRES, LEX: LEX |
| vendor-demucs.js | 618 | Demucs Web (timcsy/demucs-web 1.0.2, licenza MIT): logica copiata senza modifiche, tolti solo import/export. Modello: HTDemucs di Meta (MIT). MIT License |  |
| video-ideas.js | 87 | Idee per il videoclip, costruite sul brano: concetto visivo, struttura a battute (con i secondi calcolati dal tempo), inquadrature da girare con l'iPhone, montaggio e cose da evitare. | generate: generate, MOODS: MOODS |
| voice-chain.js | 618 | Catena vocale modulare (Voice Lab, tappa 2). Codice PURO (nessun DOM, nessun Web Audio): gira in Node e nel browser, quindi si può misurare con test numerici. Lavora su una registrazione già fatta (qualità massima, non t |  |
| voice-lab.css | 21 |  |  |
| voice-lab.js | 400 | Voice Lab: interfaccia semplice per autotune e catena vocale (tappa 3). Solo browser (usa il DOM). Lavora sul FILE registrato (qualità massima) con VoiceChain; in più offre un monitor in cuffia SPERIMENTALE (RtTune). Il  |  |

## src/app.js: sezioni (riga: titolo)

- 17: Dati e salvataggio
- 91: Audio
- 182: Claude (facoltativo)
- 200: Navigazione
- 230: Atmosfera: i colori seguono l'emozione del testo
- 240: Home
- 272: Canzoni
- 325: Studio: testo
- 381: Guida alla voce: canta / parla / allunga
- 412: Studio: base
- 515: Cartelle artista: stile misurato dai testi caricati (solo numeri)
- 559: Cervello Sultan nel Beat Lab
- 570: Orecchio di Sultan: ascolto con strumenti di misura
- 598: Cervello Sultan: dal testo alla base (stile, velocità, tonalità, strumenti)
- 621: Strumenti veri
- 803: Coach
- 889: Studio (DAW): tracce, trasporto, testo, agenti
- 1035: registrazione nello Studio
- 1076: scelta strumento (foglio)
- 1105: agenti
- 1212: comandi
- 1259: Microfono nello Studio: pulito o autotune, tutto modificabile
- 1309: Impara da una base
- 1475: AI Producer
- 1534: Vocal Studio
- 1567: Registrazione con il microfono vero (solo nella versione app; dentro Claude il microfono è bloccato)
- 1885: VOICE LAB (cablaggio): il codice sta in src/voice-chain.js, src/voice-lab.js, src/realtime-tune.js
- 1889: fine VOICE LAB
- 1891: Video
- 1981: Marketing e Social
- 2046: Libreria
- 2061: Impostazioni
- 2093: Avvio

## Funzioni principali di app.js (riga: nome)

esc:5, fmt:6, cap:7, tick:8, sleep:9, tag:13, today:14, uid:15, defaultProd:23, newSong:26, cur:29, persist:38, flush:44, sanitize:52, load:64, getCtx:93, makeBuffer:98, stopPlay:103, playBuf:110, getDl:127, saveFile:128, wavBlob:140, saveAudio:148, toMono:165, decode:171, initSample:184, ask:188, songContext:192, route:210, applyMood:233, lyricLines:268, analysisOf:269, topMood:270, songCard:273, inFolder:279, renderAnalysis:327, meter:355, renderGuide:383, followBars:414, fillBase:419, syncKar:431, songMap:452, getBase:457, activeTake:462, buildMix:464, karaokeTick:483, makeAndPlay:497, arStore:516, arModel:517, arBars:522, arRender:523, arAdd:539, blBrain:560, earMeasure:571, earApply:572, earHtml:579, earRun:587, runBrain:600, instName:623, noteNm:624, labRec:625, loadInst:626, ensureInst:633, instOptions:639, refreshInstSelects:652, instInfo:655, fillInst:660, applyRecipe:668, previewInst:679, labOptions:691, labCurrent:696, labSet:702, renderKnobs:708, labPlayRec:714, renderLab:719, lyricHtml:794, coachState:804, coachCtx:805, coachRec:809, coachName:810, coachCands:818, coachMeasure:840, coachCheck:858, coachFix:873, renderCoach:883, lvl:901, dwFill:902, dwLyInfo:916, dwSteps:920, dwBase:925, voiceTake:929, dwBuffers:930, gainFor:946, dwGains:952, dwStop:953, dwPlay:960, dwPos:988, dwDraw:996, dwRefresh:1031, dwChanged:1033, dwRecord:1036, dwRecStop:1053, sheetOpen:1078, sheetRender:1079, agentsRender:1107, agentTecnico:1124, agentAscoltatore:1141, coachSummary:1150, wait:1151, agentsRun:1152, dwExport:1247, micSet:1260, micRender:1267, micApply:1281, learnList:1311, decodeStereo:1312, learnBar:1320, sepMode:1321, sepInfo:1322, stMono:1332, sepAi:1333, sepFast:1345, profLine:1377, learnRender:1378, learnPlan:1404, learnUse:1405, renderRefs:1442, chatPush:1477, renderChat:1478, renderHist:1482, snapshot:1486, producerGo:1487, localAdvice:1510, setAT:1539, addTake:1547, micOk:1569, tdb:1570, dbTake:1581, restoreTakes:1591, recUi:1603, startRec:1606, finishRec:1652, renderTakes:1693, selectTake:1707, renderTakeAnalysis:1719, cssv:1737, drawPitch:1738, noteName:1794, geom:1795, drawNotes:1802, renderNotes:1829, playTone:1839, noteAtX:1845, ptr:1846, endDrag:1857, rescale:1870, filterPhoto:1893, soon:1908, wrap:1911, drawClip:1912, clipMix:1935, renderIdeas:1961, copyText:1983, post:1988, findItem:1995, postEvents:1996, genPlan:2004, renderPlan:2014, refreshSocial:2027, applyTheme:2062, renderSettings:2067, start:2094

## tests/

- _voice-synth.js: 0 test
- arranger.test.js: 17 test
- artist-lab.test.js: 7 test
- audio-analysis.test.js: 8 test
- autotune-key.test.js: 13 test
- autotune-voice.test.js: 11 test
- backing-manga.test.js: 13 test
- base-analysis.test.js: 2 test
- beat-learn.test.js: 6 test
- beatlab-engine.test.js: 12 test
- beatlab-mix.test.js: 10 test
- beatlab-patterns.test.js: 5 test
- beatlab-sampler.test.js: 6 test
- beatlab-theory.test.js: 5 test
- coach.test.js: 6 test
- ear.test.js: 6 test
- instruments.test.js: 6 test
- lyrics-base-clip.test.js: 8 test
- lyrics-engine.test.js: 12 test
- master.test.js: 6 test
- pitch-video.test.js: 7 test
- polish.test.js: 8 test
- producer-promo.test.js: 16 test
- realtime-tune.test.js: 4 test
- song-map.test.js: 4 test
- sound-lab.test.js: 6 test
- style-card.test.js: 8 test
- sultan-brain.test.js: 6 test
- voice-chain.test.js: 15 test

## Altro

- build.js: esegue i test e crea dist/index.html (artifact) e docs/ (sito GitHub Pages)
- notes/STATO.md: cosa è fatto e cosa no (aggiornare ogni passo)
- notes/ARCHITETTURA.md, notes/LICENZE-SUONI.md
- src/app.body.html / app.css / app.shell.html: interfaccia
