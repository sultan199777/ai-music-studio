# Mappa del progetto (generata da tools/mappa.js, non modificare a mano)

Leggi questo file PRIMA di aprire i sorgenti: dice dove sta ogni cosa.

## src/ (moduli)

| File | Righe | Scopo | Esporta |
|---|---|---|---|
| ai-separator.js | 83 | Separazione AI v2 (gratuita, open source, tutto sul dispositivo). Motore: unblend (MIT) + onnxruntime-web 1.26 (MIT), file in unblend/ e ort126/ accanto alla pagina. Modelli (scaricati UNA volta da Hugging Face e tenuti  |  |
| app.body.html | 562 |  |  |
| app.css | 321 |  |  |
| app.js | 2668 | ================= Dati e salvataggio ================= |  |
| app.shell.html | 60 |  |  |
| app.template.html | 1169 |  |  |
| arranger.js | 684 | Arrangiatore: costruisce basi ORIGINALI con una struttura vera (intro, strofa, pre, ritornello, bridge, outro) e direzioni di stile diverse. Tutto è sintetizzato dal programma (nessun campione, nessun brano altrui). | generate: generate, planStructure: planStructure, STYLES: STYLES, SECTIONS: SEC, ARP: ARP, ARP_STYLE: ARP_STYLE |
| artist-lab.js | 110 | Cartelle artista: impara lo STILE da testi che carichi tu, con SOLO statistiche. Di ogni testo si misurano numeri (sillabe per riga, rime, ripetizioni, ricchezza delle parole, quali "mondi" ricorrono e quali stanno insie | measure: measure, merge: merge, finalize: finalize, blend: blend, compare: compare, newAcc: newAcc, SCENE_IT: SCENE_IT |
| audio-analysis.js | 223 | Analisi audio della voce (Modulo 1, solo parte MISURABILE con calcolo diretto). Misura: livello, picco, clipping, dinamica, altezza delle note (pitch), estensione e scostamento dall'intonazione "temperata" (La = 440 Hz). | analyze: analyze, detectPitch: detectPitch, synthExample: synthExample, freqToMidi: freqToMidi, midiToFreq: midiToFreq, midiToName: midiToName |
| autotune.js | 421 | Autotune (correzione dell'intonazione) con la tecnica PSOLA. 1. Si misura l'altezza della voce nel tempo (AudioAnalysis). 2. Per ogni istante si sceglie la nota "giusta" più vicina nella scala scelta. | correct: correct, scaleMask: scaleMask, quantizeMidi: quantizeMidi, stepUp: stepUp, track: track, measure: measure, detectKey: detectKey |
| backing.js | 291 | Generatore di basi musicali ORIGINALI (batteria, basso, accordi, pad, melodia). Tutto è sintetizzato dal programma con onde semplici: non usa registrazioni, campioni o brani di altri. Il risultato è una bozza utile per c | generate: generate, mix: mix, withVoice: withVoice, resampleLinear: resampleLinear, GENRES: GENRES, chordName: chordName, NAMES: NAMES |
| base-analysis.js | 119 | Analisi di una base musicale importata (audio con più strumenti insieme): velocità (BPM) e tonalità STIMATE. BPM: si misura quanto spesso l'energia sale di colpo (colpi di batteria, accordi) | analyze: analyze, estimateBpm: estimateBpm |
| beat-learn.js | 357 | Impara da una base: carichi una canzone (es. un pezzo che ti piace), l'app  1) SEPARA voce e base (stima): STFT + maschere morbide.     - voce = suono al CENTRO dello stereo (mid molto più forte del side), ARMONICO (non  | chordsOf: chordsOf, progName: progName, separate: separate, separateAsync: separateAsync, clean: clean, learn: learn, blend: blend, closestStyle: closestStyle, describe: describe, stft: stft, istft: i |
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
| clips.js | 64 | Clip della voce: montaggio non distruttivo come nei DAW (Pro Tools, Logic). Una clip = un pezzo di una prova (take) messo in un punto della canzone:   {take, start (s nella canzone), offset (s dentro la prova), len (s),  | XF: XF, clip: clip, whole: whole, split: split, compByLines: compByLines, render: render, end: end |
| coach.js | 166 | Coach: impara dai tuoi gesti e ti insegna. Gira tutto sul telefono, senza servizi a pagamento. 1. IMPARA (preferenze): ogni gesto è un voto.    mi piace +3 · non mi piace -3 · base salvata +2 · voce registrata sulla base | fresh: fresh, record: record, suggest: suggest, profile: profile, lessons: lessons, learn: learn, progress: progress, features: features, compatible: compatible, SKILLS: SKILLS, WEIGHTS: W |
| ear.js | 191 | Orecchio di Sultan: "ascolto" con strumenti di misura, come fa un fonico con gli analizzatori. Io non ho orecchie, ma posso MISURARE il suono: livello, dinamica, quanta energia c'è in basso (sub, 808), al centro e in alt | lufs: lufs, listenVoice: listenVoice, moodOf: moodOf, MOODS: MOODS, listen: listen, spectrum: spectrum, BANDS: BANDS, REF: REF |
| formant.js | 98 | Formant shift (cambio del TIMBRO senza cambiare la nota) con il metodo del CEPSTRUM. Idea: lo spettro della voce = "inviluppo" (la forma della gola e della bocca: i formanti) x "armoniche" (la nota). Si stima l'inviluppo | shift: shift, fft: fft |
| instruments.js | 293 | Strumenti: catalogo spiegato + campionatore (sampler) + chitarre sintetizzate. - I campioni veri vengono da VSCO-2-CE e VCSL (Versilian Studios, licenza CC0):   ogni strumento è un file assets/inst/<id>.json (nel sito: i |  |
| key-detect.js | 73 | Riconoscimento della tonalità dalla voce (stima). Metodo: istogramma delle 12 note (senza ottava) pesato sul tempo, confrontato con i profili di Krumhansl-Kessler per le 12 tonalità maggiori e le 12 minori. | detect: detect, fromHistogram: fromHistogram, NAMES: NAMES |
| local-ai.js | 62 | Assistente testi con AI locale (opzionale). Usa WebLLM (Apache 2.0) con modelli Qwen2.5 (Apache 2.0): il modello si scarica UNA volta sul telefono e gira lì (WebGPU). Nessun testo parte verso server. Il cervello Sultan ( | MODELS: MODELS, TASKS: TASKS, supported: supported, buildPrompt: buildPrompt, clean: clean, load: load, ask: ask, LIB_URL: LIB_URL |
| lyrics-engine.js | 425 | Motore di analisi dei testi (Modulo 3 e parte del Modulo 4). Tutto qui è calcolato con regole semplici sulla lingua italiana, senza servizi esterni. Sono EURISTICHE: il conteggio delle sillabe può sbagliare | countSyllables: countSyllables, lineSyllables: lineSyllables, rhymeKey: rhymeKey, rhymeRelation: rhymeRelation, tokenize: tokenize, parseStanzas: parseStanzas, analyze: analyze |
| lyrics-to-base.js | 58 | Dal testo a una base consigliata: genere, scala e velocità. È un'IPOTESI costruita sul tono emotivo (dizionario di parole) e sulla lunghezza delle righe. Serve come punto di partenza, non come verità. | suggest: suggest |
| manga-filter.js | 191 | Filtro "fumetto" per immagini: stile cartoon a colori, stile neon (nero, viola, fucsia) e manga a retino. È un filtro grafico che gira sul tuo dispositivo, NON un'intelligenza artificiale: non ridisegna il volto, non cre | apply: apply |
| master-pro.js | 95 | Mastering stereo (calcolo sul file):  1. compressore multibanda a 3 bande (incroci 150 Hz e 3 kHz, filtri Linkwitz-Riley 4° ordine: le bande sommate ridanno il segnale);  2. larghezza stereo (mid/side) con i bassi sotto  | TARGETS: TARGETS, DEF: DEF, BANDS: BANDS, split3: split3, limiter: limiter, correlation: correlation, spectrum: spectrum, compare: compare, mono: mono, process: process |
| master.js | 72 | Catena di master: filtro sui bassi, correzione di tono leggera, compressione "colla", saturazione morbida, regolazione del volume medio e limitatore sul picco. Serve a far suonare la base (o il mix con la voce) più piena | process: process, PRESETS: PRESETS, rmsDb: rmsDb, peakDb: peakDb |
| mixer.js | 143 | Mixer a canali dello Studio (Web Audio). Ogni traccia ha la sua catena:   volume → EQ 3 bande (bassi 120 Hz, medi regolabili, alti 8 kHz) → compressore → saturazione → sidechain (solo dove serve)   → panoramica → uscita; | autoPoints: autoPoints, CH: CH, LIMITS: LIMITS, LABELS: LABELS, PRESETS: PRESETS, channel: channel, preset: preset, satCurve: satCurve, duckCurve: duckCurve, impulse: impulse, build: build |
| pitch-editor.js | 79 | Editor delle note (stile "piano roll"): divide la voce misurata in note singole e prepara le note da passare all'autotune. Ogni nota ha:   midi    nota cantata (misurata, mediana dei frame, può essere decimale) | segment: segment, snap: snap, resnap: resnap, offsetCents: offsetCents |
| polish.js | 154 | Rifinitura della voce: filtro dei bassi, equalizzatore, compressore, eco e riverbero. Tutto calcolato dal programma con filtri standard (biquad) e un riverbero a linee di ritardo. Non è un plugin da studio professionale, | process: process, denoise: denoise, highpass: highpass, peaking: peaking, highShelf: highShelf, compress: compress, reverb: reverb, echo: echo, PRESETS: PRESETS |
| producer-actions.js | 179 | AI Producer: trasforma un comando scritto in italiano in modifiche REALI alla base. Riconosce un elenco limitato di richieste (vedi HELP). Quello che non riconosce non viene eseguito: l'app lo passa a Claude come consigl | interpret: interpret, HELP: HELP, LEVEL_KEYS: LEVEL_KEYS, cloneState: cloneState |
| promo-plan.js | 125 | Piano di promozione di una canzone (30 giorni), costruito dai dati del brano. Non usa servizi esterni e non pubblica nulla: produce un calendario di contenuti con piattaforma, formato, data, orario suggerito, didascalia  | generate: generate, toCsv: toCsv, TEMPLATE: TEMPLATE |
| realtime-tune.js | 120 | Autotune LEGGERO in tempo reale (SPERIMENTALE) per il monitor in cuffia. Funziona così: misura l'altezza della voce con la stessa idea di McLeod (autocorrelazione normalizzata, finestra ~37 ms su audio ridotto a ~12 kHz) | createCore: createCore, workletSource: workletSource |
| samples-data.js | 2 | campioni batteria CC0 codificati | dati |
| sing-guide.js | 70 | Guida al canto: dal testo + base (mappa della canzone) a un foglio di istruzioni riga per riga. Per ogni riga: quando entrare (battuta e secondi), come dirla (rap parlato / cantato / tenuto), quanto tenere l'ultima parol | build: build, check: check, activity: activity, FAST: FAST |
| song-map.js | 85 | Mappa della canzone: il TESTO decide la struttura della base. - I titoli tra parentesi quadre ([Strofa], [Ritornello], [Bridge], [Pre], [Intro], [Outro])   diventano sezioni della base; senza titoli tutto il testo è una  | build: build, at: at, tagOf: tagOf, RATE: RATE |
| sound-lab.js | 181 | Laboratorio suoni: crea strumenti NUOVI partendo dai suoni grezzi. Un suono del laboratorio è una "ricetta":   strati  : 1-3 sorgenti (strumenti veri o sintesi), ognuno con ottava, volume, scordatura | KNOBS: KNOBS, SYNTHS: SYNTHS, ORIGINALS: ORIGINALS, GENRES: GENRES, render: render, install: install, invent: invent, deps: deps, rangeOf: rangeOf |
| studio-agent.js | 89 | Agente dello Studio: capisce frasi in italiano e le trasforma in modifiche VERE al progetto (mixer per traccia, 808 del designer, note della melodia, effetti di passaggio, microfono, master). Funziona con regole (gratis, | interpret: interpret, EXAMPLES: EXAMPLES |
| style-card.js | 114 | Scheda di stile: misura caratteristiche GENERICHE di una canzone di riferimento (tempo, peso del basso, luminosità, densità ritmica, crescita di energia) e le trasforma in parametri per l'arrangiatore. Si possono mescola | measure: measure, blend: blend, toParams: toParams, normBpm: normBpm |
| sultan-brain.js | 156 | Cervello Sultan: legge il TESTO e decide da solo come deve suonare la base. Non è un modello di linguaggio: è un sistema di regole misurabili, tutto sul telefono, tutto spiegabile. 1. SCENE: conta nel testo parole di mon | MOOD: MOOD, parseStyle: parseStyle, plan: plan, styleScores: styleScores, words: words, BASE_BPM: BASE_BPM, hash: hash, NAMES: NAMES, GENRES: GENRES, LEX: LEX |
| synth-design.js | 111 | Designer di suoni (sintesi calcolata qui, nessun campione):  - SYNTH wavetable: 4 forme d'onda (sinusoide → dente di sega → quadra → "vocale") e si scorre tra loro con    "Posizione"; un LFO muove la posizione (movimento | B808_PRESETS: B808_PRESETS, PERC: PERC, percEvents: percEvents, voiceInstrument: voiceInstrument, TABLES: TABLES, SYNTH_DEF: SYNTH_DEF, SYNTH_PRESETS: SYNTH_PRESETS, synthParams: synthParams, synth: s |
| timing.js | 43 | Correzione del tempo: misura di quanto la voce è in anticipo o in ritardo rispetto alla griglia della base (semicrome al BPM del progetto) e sposta la voce. Si assume che la registrazione parta insieme alla base. Misurat | onsets: onsets, measure: measure, shift: shift |
| transcribe.js | 44 | Trascrizione delle parole cantate: Whisper (OpenAI, licenza MIT) eseguito sul dispositivo con transformers.js (Hugging Face, Apache-2.0). Gratis, niente server: il modello si scarica una volta. Serve per STUDIARE il meto |  |
| video-ideas.js | 87 | Idee per il videoclip, costruite sul brano: concetto visivo, struttura a battute (con i secondi calcolati dal tempo), inquadrature da girare con l'iPhone, montaggio e cose da evitare. | generate: generate, MOODS: MOODS |
| voice-chain.js | 619 | Catena vocale modulare (Voice Lab, tappa 2). Codice PURO (nessun DOM, nessun Web Audio): gira in Node e nel browser, quindi si può misurare con test numerici. Lavora su una registrazione già fatta (qualità massima, non t |  |
| voice-fx.js | 88 | Effetti di trasformazione della voce (calcolo sul file, nessun plugin esterno):  - vocoder: la voce "suona" un sintetizzatore che fa gli ACCORDI DELLA BASE (16 bande, come i vocoder classici):             la voce dà le p | FX: FX, apply: apply, chorus: chorus, flanger: flanger, phaser: phaser, gate: gate, exciter: exciter, vocoder: vocoder, metallic: metallic, radio: radio, carrier: carrier |
| voice-lab.css | 21 |  |  |
| voice-lab.js | 437 | Voice Lab: interfaccia semplice per autotune e catena vocale (tappa 3). Solo browser (usa il DOM). Lavora sul FILE registrato (qualità massima) con VoiceChain; in più offre un monitor in cuffia SPERIMENTALE (RtTune). Il  |  |
| word-bank.js | 61 | Dizionario personale per le rime: nessun dizionario di terzi, quindi nessun problema di licenza. Le parole arrivano da tre posti: un piccolo elenco scritto per questo progetto (parole comuni del rap), le parole dei TUOI  | newBank: newBank, learn: learn, rhymes: rhymes, seeded: seeded, SEED: SEED |

## src/app.js: sezioni (riga: titolo)

- 17: Dati e salvataggio
- 91: Audio
- 182: Claude (facoltativo)
- 200: Navigazione
- 229: Atmosfera: i colori seguono l'emozione del testo
- 239: Home
- 271: Canzoni
- 324: Studio: testo
- 380: Guida alla voce: canta / parla / allunga
- 411: Studio: base
- 514: Rime dal dizionario personale
- 519: Assistente testi (AI locale, opzionale)
- 568: Cartelle artista: stile misurato dai testi caricati (solo numeri)
- 612: Cervello Sultan nel Beat Lab
- 623: Orecchio di Sultan: ascolto con strumenti di misura
- 657: Cervello Sultan: dal testo alla base (stile, velocità, tonalità, strumenti)
- 692: Strumenti veri
- 891: Coach
- 977: Studio (DAW): tracce, trasporto, testo, agenti
- 1116: registrazione nello Studio
- 1158: scelta strumento (foglio)
- 1187: agenti
- 1294: comandi
- 1329: Parla con lo Studio: frasi → modifiche vere, con Accetta / Annulla
- 1361: Mastering professionale, riferimento A/B, tracce separate
- 1408: Designer suoni: synth, 808, effetti di transizione
- 1495: Piano roll nello Studio (melodia e basso 808)
- 1571: Voce: prove e montaggio (clip)
- 1635: Mixer a canali (stessa catena per ascolto e file salvato)
- 1739: Microfono nello Studio: pulito o autotune, tutto modificabile
- 1811: Impara da una base
- 2028: AI Producer
- 2087: Vocal Studio
- 2120: Registrazione con il microfono vero (solo nella versione app; dentro Claude il microfono è bloccato)
- 2452: VOICE LAB (cablaggio): il codice sta in src/voice-chain.js, src/voice-lab.js, src/realtime-tune.js
- 2456: fine VOICE LAB
- 2458: Video
- 2548: Marketing e Social
- 2613: Libreria
- 2628: Impostazioni
- 2660: Avvio

## Funzioni principali di app.js (riga: nome)

esc:5, fmt:6, cap:7, tick:8, sleep:9, tag:13, today:14, uid:15, defaultProd:23, newSong:26, cur:29, persist:38, flush:44, sanitize:52, load:64, getCtx:93, makeBuffer:98, stopPlay:103, playBuf:110, getDl:127, saveFile:128, wavBlob:140, saveAudio:148, toMono:165, decode:171, initSample:184, ask:188, songContext:192, route:210, applyMood:232, lyricLines:267, analysisOf:268, topMood:269, songCard:272, inFolder:278, renderAnalysis:326, meter:354, renderGuide:382, followBars:413, fillBase:418, syncKar:430, songMap:451, getBase:456, activeTake:461, buildMix:463, karaokeTick:482, makeAndPlay:496, wbStore:515, wbLearnSongs:516, rhChips:517, arStore:569, arModel:570, arBars:575, arRender:576, arAdd:592, blBrain:613, earMeasure:624, earApply:625, earHtml:632, earMoodNote:640, earRun:646, runBrain:659, brainFirst:681, instName:694, noteNm:695, labRec:696, loadInst:697, ensureInst:704, instOptions:710, refreshInstSelects:723, instInfo:726, fillInst:731, applyRecipe:739, previewInst:750, labOptions:762, labCurrent:767, labSet:773, renderKnobs:779, labPlayRec:785, renderLab:790, sgGuide:866, sgCue:867, sgRender:868, lyricHtml:882, coachState:892, coachCtx:893, coachRec:897, coachName:898, coachCands:906, coachMeasure:928, coachCheck:946, coachFix:961, renderCoach:971, lvl:989, dwFill:990, dwLyInfo:1004, dwSteps:1008, dwBase:1013, voiceTake:1017, dwBuffers:1018, gainFor:1034, dwGains:1040, dwStop:1041, dwPlay:1048, dwPos:1069, dwDraw:1077, dwRefresh:1112, dwChanged:1114, dwRecord:1117, dwRecStop:1134, sheetOpen:1160, sheetRender:1161, agentsRender:1189, agentTecnico:1206, agentAscoltatore:1223, coachSummary:1232, wait:1233, agentsRun:1234, talkRender:1331, talkGo:1338, talkApply:1350, mpSet:1363, mpRender:1364, mpMake:1380, synthRegister:1409, dsSliders:1416, dsRender:1417, voxRegister:1478, voxMake:1483, extraFxBufs:1494, prNotes:1499, prGenerated:1500, inScale:1501, drumDefault:1502, drumDraw:1508, prDraw:1514, prSave:1534, prStepMidi:1535, realTakes:1572, takeById:1573, vclips:1574, vclipKey:1579, vclipBuffer:1580, setClips:1585, fmtS:1586, clipsRender:1588, mixSet:1637, dwGraph:1644, mixRender:1659, mixFmt:1669, autoRender:1684, verRender:1700, dwRender:1711, wavStereo:1720, dwExport:1728, micSet:1740, micRender:1747, takeChords:1768, micApply:1773, learnList:1813, decodeStereo:1814, learnBar:1822, sepMode:1823, sepInfo:1824, stMono:1832, sepAi:1833, sepFast:1848, normOnly:1856, lyricStats:1880, trHtml:1887, profLine:1901, learnRender:1902, learnArtists:1941, learnPlan:1942, learnUse:1943, dwWsName:1957, dwWs:1958, projLine:1965, renderRefs:1995, chatPush:2030, renderChat:2031, renderHist:2035, snapshot:2039, producerGo:2040, localAdvice:2063, setAT:2092, addTake:2100, micOk:2122, tdb:2123, dbTake:2134, restoreTakes:2144, recUi:2156, startRec:2159, finishRec:2205, renderTakes:2246, selectTake:2260, renderTakeAnalysis:2272, cssv:2290, drawPitch:2291, noteName:2361, geom:2362, drawNotes:2369, renderNotes:2396, playTone:2406, noteAtX:2412, ptr:2413, endDrag:2424, rescale:2437, filterPhoto:2460, soon:2475, wrap:2478, drawClip:2479, clipMix:2502, renderIdeas:2528, copyText:2550, post:2555, findItem:2562, postEvents:2563, genPlan:2571, renderPlan:2581, refreshSocial:2594, applyTheme:2629, renderSettings:2634, start:2661

## tests/

- _voice-synth.js: 0 test
- arranger.test.js: 19 test
- artist-lab.test.js: 7 test
- audio-analysis.test.js: 8 test
- autotune-chords.test.js: 1 test
- autotune-key.test.js: 13 test
- autotune-voice.test.js: 11 test
- backing-manga.test.js: 13 test
- base-analysis.test.js: 2 test
- beat-learn.test.js: 7 test
- beatlab-engine.test.js: 12 test
- beatlab-mix.test.js: 10 test
- beatlab-patterns.test.js: 5 test
- beatlab-sampler.test.js: 6 test
- beatlab-theory.test.js: 5 test
- clips.test.js: 4 test
- coach.test.js: 6 test
- ear.test.js: 9 test
- instruments.test.js: 6 test
- local-ai.test.js: 3 test
- lyrics-base-clip.test.js: 8 test
- lyrics-engine.test.js: 12 test
- master-pro.test.js: 4 test
- master.test.js: 6 test
- melody.test.js: 3 test
- mixer.test.js: 5 test
- pitch-video.test.js: 7 test
- polish.test.js: 8 test
- producer-promo.test.js: 16 test
- realtime-tune.test.js: 4 test
- sing-guide.test.js: 3 test
- song-map.test.js: 4 test
- sound-lab.test.js: 6 test
- studio-agent.test.js: 2 test
- style-card.test.js: 8 test
- sultan-brain.test.js: 8 test
- synth-design.test.js: 5 test
- timing.test.js: 3 test
- voice-chain.test.js: 15 test
- voice-fx.test.js: 3 test
- word-bank.test.js: 5 test

## Altro

- build.js: esegue i test e crea dist/index.html (artifact) e docs/ (sito GitHub Pages)
- notes/STATO.md: cosa è fatto e cosa no (aggiornare ogni passo)
- notes/ARCHITETTURA.md, notes/LICENZE-SUONI.md
- src/app.body.html / app.css / app.shell.html: interfaccia
