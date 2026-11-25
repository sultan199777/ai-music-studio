# Mappa del progetto (generata da tools/mappa.js, non modificare a mano)

Leggi questo file PRIMA di aprire i sorgenti: dice dove sta ogni cosa.

## src/ (moduli)

| File | Righe | Scopo | Esporta |
|---|---|---|---|
| ai-separator.js | 120 | Separazione AI v2 (gratuita, open source, tutto sul dispositivo). Motore: unblend (MIT) + onnxruntime-web 1.26 (MIT), file in unblend/ e ort126/ accanto alla pagina. Modelli (scaricati UNA volta da Hugging Face e tenuti  |  |
| app.body.html | 667 |  |  |
| app.css | 367 |  |  |
| app.js | 3400 | ================= Dati e salvataggio ================= |  |
| app.shell.html | 71 |  |  |
| app.template.html | 1169 |  |  |
| arranger.js | 741 | Arrangiatore: costruisce basi ORIGINALI con una struttura vera (intro, strofa, pre, ritornello, bridge, outro) e direzioni di stile diverse. Tutto è sintetizzato dal programma (nessun campione, nessun brano altrui). | generate: generate, planStructure: planStructure, STYLES: STYLES, SECTIONS: SEC, ARP: ARP, ARP_STYLE: ARP_STYLE |
| artist-lab.js | 110 | Cartelle artista: impara lo STILE da testi che carichi tu, con SOLO statistiche. Di ogni testo si misurano numeri (sillabe per riga, rime, ripetizioni, ricchezza delle parole, quali "mondi" ricorrono e quali stanno insie | measure: measure, merge: merge, finalize: finalize, blend: blend, compare: compare, newAcc: newAcc, SCENE_IT: SCENE_IT |
| audio-analysis.js | 223 | Analisi audio della voce (Modulo 1, solo parte MISURABILE con calcolo diretto). Misura: livello, picco, clipping, dinamica, altezza delle note (pitch), estensione e scostamento dall'intonazione "temperata" (La = 440 Hz). | analyze: analyze, detectPitch: detectPitch, synthExample: synthExample, freqToMidi: freqToMidi, midiToFreq: midiToFreq, midiToName: midiToName |
| auto-sections.js | 94 | Sezioni automatiche: se nel testo NON ci sono i titoli tra parentesi, l'app li mette da sola.  - Titolo: la prima riga se è corta, da sola (riga vuota dopo) o è una data/numero ("25 maggio"). Non resta nel testo cantato. | label: label, summary: summary, hasTags: hasTags, takeTitle: takeTitle |
| autotune.js | 421 | Autotune (correzione dell'intonazione) con la tecnica PSOLA. 1. Si misura l'altezza della voce nel tempo (AudioAnalysis). 2. Per ogni istante si sceglie la nota "giusta" più vicina nella scala scelta. | correct: correct, scaleMask: scaleMask, quantizeMidi: quantizeMidi, stepUp: stepUp, track: track, measure: measure, detectKey: detectKey |
| backing.js | 291 | Generatore di basi musicali ORIGINALI (batteria, basso, accordi, pad, melodia). Tutto è sintetizzato dal programma con onde semplici: non usa registrazioni, campioni o brani di altri. Il risultato è una bozza utile per c | generate: generate, mix: mix, withVoice: withVoice, resampleLinear: resampleLinear, GENRES: GENRES, chordName: chordName, NAMES: NAMES |
| base-analysis.js | 119 | Analisi di una base musicale importata (audio con più strumenti insieme): velocità (BPM) e tonalità STIMATE. BPM: si misura quanto spesso l'energia sale di colpo (colpi di batteria, accordi) | analyze: analyze, estimateBpm: estimateBpm |
| beat-learn.js | 360 | Impara da una base: carichi una canzone (es. un pezzo che ti piace), l'app  1) SEPARA voce e base (stima): STFT + maschere morbide.     - voce = suono al CENTRO dello stereo (mid molto più forte del side), ARMONICO (non  | chordsOf: chordsOf, progName: progName, separate: separate, separateAsync: separateAsync, clean: clean, learn: learn, blend: blend, closestStyle: closestStyle, describe: describe, stft: stft, istft: i |
| beat-this.js | 143 | Beat This! (CPJKU, ISMIR 2024, licenza MIT) nel browser: battiti e inizio battuta (downbeat) con una rete neurale. Modello ONNX "small" (2,1 M parametri, circa 10 MB, MIT): huggingface.co/ashudesai/songbird-models (small |  |
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
| dna.js | 167 | MUSICAL DNA ENGINE: ogni stile è un elenco di NUMERI (velocità, swing, densità cassa, rullante, hi-hat, 808, giro armonico…).  - PROFILES: 24 profili di artisti e famiglie. Sono caratteristiche GENERALI di genere (ipotes | FIELDS: FIELDS, ORDER: ORDER, LIST: LIST, byId: byId, neutral: neutral, sanitize: sanitize, fuse: fuse, emotion: emotion, applyEmotion: applyEmotion, toProd: toProd, describe: describe, EMOS: EMOS |
| ear.js | 191 | Orecchio di Sultan: "ascolto" con strumenti di misura, come fa un fonico con gli analizzatori. Io non ho orecchie, ma posso MISURARE il suono: livello, dinamica, quanta energia c'è in basso (sub, 808), al centro e in alt | lufs: lufs, listenVoice: listenVoice, moodOf: moodOf, MOODS: MOODS, listen: listen, spectrum: spectrum, BANDS: BANDS, REF: REF |
| formant.js | 98 | Formant shift (cambio del TIMBRO senza cambiare la nota) con il metodo del CEPSTRUM. Idea: lo spettro della voce = "inviluppo" (la forma della gola e della bocca: i formanti) x "armoniche" (la nota). Si stima l'inviluppo | shift: shift, fft: fft |
| guide-voice.js | 126 | Voce guida: una voce maschile SINTETICA che canta/rappa il tuo testo sulla base, a tempo con le parole e intonata sulla scala della base (effetto autotune duro). Serve per sentire come potrebbe suonare il testo e capire  | syllabify: syllabify, render: render, measureF0: measureF0, hzToMidi: hzToMidi, midiToHz: midiToHz |
| instruments.js | 342 | Strumenti: catalogo spiegato + campionatore (sampler) + chitarre sintetizzate. - I campioni veri vengono da VSCO-2-CE e VCSL (Versilian Studios, licenza CC0):   ogni strumento è un file assets/inst/<id>.json (nel sito: i |  |
| key-detect.js | 73 | Riconoscimento della tonalità dalla voce (stima). Metodo: istogramma delle 12 note (senza ottava) pesato sul tempo, confrontato con i profili di Krumhansl-Kessler per le 12 tonalità maggiori e le 12 minori. | detect: detect, fromHistogram: fromHistogram, NAMES: NAMES |
| local-ai.js | 96 | Assistente testi con AI locale (opzionale). Usa WebLLM (Apache 2.0) con modelli Qwen2.5 (Apache 2.0): il modello si scarica UNA volta sul telefono e gira lì (WebGPU). Nessun testo parte verso server. Il cervello Sultan ( | recommend: recommend, pingOllama: pingOllama, useOllama: useOllama, MODELS: MODELS, TASKS: TASKS, supported: supported, buildPrompt: buildPrompt, clean: clean, load: load, ask: ask, LIB_URL: LIB_URL |
| lyrics-engine.js | 425 | Motore di analisi dei testi (Modulo 3 e parte del Modulo 4). Tutto qui è calcolato con regole semplici sulla lingua italiana, senza servizi esterni. Sono EURISTICHE: il conteggio delle sillabe può sbagliare | countSyllables: countSyllables, lineSyllables: lineSyllables, rhymeKey: rhymeKey, rhymeRelation: rhymeRelation, tokenize: tokenize, parseStanzas: parseStanzas, analyze: analyze |
| lyrics-to-base.js | 58 | Dal testo a una base consigliata: genere, scala e velocità. È un'IPOTESI costruita sul tono emotivo (dizionario di parole) e sulla lunghezza delle righe. Serve come punto di partenza, non come verità. | suggest: suggest |
| manga-filter.js | 191 | Filtro "fumetto" per immagini: stile cartoon a colori, stile neon (nero, viola, fucsia) e manga a retino. È un filtro grafico che gira sul tuo dispositivo, NON un'intelligenza artificiale: non ridisegna il volto, non cre | apply: apply |
| master-pro.js | 95 | Mastering stereo (calcolo sul file):  1. compressore multibanda a 3 bande (incroci 150 Hz e 3 kHz, filtri Linkwitz-Riley 4° ordine: le bande sommate ridanno il segnale);  2. larghezza stereo (mid/side) con i bassi sotto  | TARGETS: TARGETS, DEF: DEF, BANDS: BANDS, split3: split3, limiter: limiter, correlation: correlation, spectrum: spectrum, compare: compare, mono: mono, process: process |
| master.js | 72 | Catena di master: filtro sui bassi, correzione di tono leggera, compressione "colla", saturazione morbida, regolazione del volume medio e limitatore sul picco. Serve a far suonare la base (o il mix con la voce) più piena | process: process, PRESETS: PRESETS, rmsDb: rmsDb, peakDb: peakDb |
| mixer.js | 147 | Mixer a canali dello Studio (Web Audio). Ogni traccia ha la sua catena:   volume → EQ 3 bande (bassi 120 Hz, medi regolabili, alti 8 kHz) → compressore → saturazione → sidechain (solo dove serve)   → panoramica → uscita; | autoPoints: autoPoints, CH: CH, LIMITS: LIMITS, LABELS: LABELS, PRESETS: PRESETS, channel: channel, preset: preset, satCurve: satCurve, duckCurve: duckCurve, impulse: impulse, build: build |
| omino.js | 73 | L'omino che canta: mostra COME e QUANDO cantare sulla base, a tempo con lo Studio. Dalla mappa della canzone (righe e parole con inizio/fine in secondi) calcola in ogni istante:  bocca (aperta sulle parole, più aperta su | state: state, draw: draw |
| pitch-editor.js | 79 | Editor delle note (stile "piano roll"): divide la voce misurata in note singole e prepara le note da passare all'autotune. Ogni nota ha:   midi    nota cantata (misurata, mediana dei frame, può essere decimale) | segment: segment, snap: snap, resnap: resnap, offsetCents: offsetCents |
| polish.js | 154 | Rifinitura della voce: filtro dei bassi, equalizzatore, compressore, eco e riverbero. Tutto calcolato dal programma con filtri standard (biquad) e un riverbero a linee di ritardo. Non è un plugin da studio professionale, | process: process, denoise: denoise, highpass: highpass, peaking: peaking, highShelf: highShelf, compress: compress, reverb: reverb, echo: echo, PRESETS: PRESETS |
| prod-fx.js | 448 | Produzione: effetti cinematografici/ambientali + interventi vocali (eco, risposte, cori, voce scura, reverse, ad-lib) scelti DAL TESTO e messi a tempo sulla base. Tutto sintetizzato da zero (nessun campione, nessun dirit | SOUNDS: SOUNDS, VOX: VOX, LEX: LEX, readLine: readLine, plan: plan, renderSfx: renderSfx, renderVox: renderVox, lastWord: lastWord, pitch: pitch, sound: sound, names: names, rng: rng |
| producer-actions.js | 179 | AI Producer: trasforma un comando scritto in italiano in modifiche REALI alla base. Riconosce un elenco limitato di richieste (vedi HELP). Quello che non riconosce non viene eseguito: l'app lo passa a Claude come consigl | interpret: interpret, HELP: HELP, LEVEL_KEYS: LEVEL_KEYS, cloneState: cloneState |
| promo-plan.js | 125 | Piano di promozione di una canzone (30 giorni), costruito dai dati del brano. Non usa servizi esterni e non pubblica nulla: produce un calendario di contenuti con piattaforma, formato, data, orario suggerito, didascalia  | generate: generate, toCsv: toCsv, TEMPLATE: TEMPLATE |
| realtime-tune.js | 120 | Autotune LEGGERO in tempo reale (SPERIMENTALE) per il monitor in cuffia. Funziona così: misura l'altezza della voce con la stessa idea di McLeod (autocorrelazione normalizzata, finestra ~37 ms su audio ridotto a ~12 kHz) | createCore: createCore, workletSource: workletSource |
| remix.js | 57 | Remix: stravolge davvero la base. Da un seme (testo + numero di versione) costruisce ritmo di cassa, rullante, hi-hat, giro di accordi, mix e seme melodico. Ogni versione è un'altra, ma resta nello stile. make(seed, opt) | make: make, distance: distance, progName: progName, KICKS: KICKS, PROG_MIN: PROG_MIN, PROG_MAJ: PROG_MAJ |
| samples-data.js | 2 | campioni batteria CC0 codificati | dati |
| sig-fx.js | 73 | Effetti "firma" delle basi trap/drill moderne, tutti SINTETIZZATI da zero (nessun campione, nessun diritto di terzi):  sirena (ambulanza/polizia), sparo, mitraglia (raffica), coro lirico (intro stile opera), filtro "focu | SIG: SIG, siren: siren, gunshot: gunshot, machinegun: machinegun, choir: choir, focus: focus, pick: pick, rng: rng |
| sing-guide.js | 70 | Guida al canto: dal testo + base (mappa della canzone) a un foglio di istruzioni riga per riga. Per ogni riga: quando entrare (battuta e secondi), come dirla (rap parlato / cantato / tenuto), quanto tenere l'ultima parol | build: build, check: check, activity: activity, FAST: FAST |
| song-map.js | 85 | Mappa della canzone: il TESTO decide la struttura della base. - I titoli tra parentesi quadre ([Strofa], [Ritornello], [Bridge], [Pre], [Intro], [Outro])   diventano sezioni della base; senza titoli tutto il testo è una  | build: build, at: at, tagOf: tagOf, RATE: RATE |
| sound-lab.js | 181 | Laboratorio suoni: crea strumenti NUOVI partendo dai suoni grezzi. Un suono del laboratorio è una "ricetta":   strati  : 1-3 sorgenti (strumenti veri o sintesi), ognuno con ottava, volume, scordatura | KNOBS: KNOBS, SYNTHS: SYNTHS, ORIGINALS: ORIGINALS, GENRES: GENRES, render: render, install: install, invent: invent, deps: deps, rangeOf: rangeOf |
| studio-agent.js | 91 | Agente dello Studio: capisce frasi in italiano e le trasforma in modifiche VERE al progetto (mixer per traccia, 808 del designer, note della melodia, effetti di passaggio, microfono, master). Funziona con regole (gratis, | interpret: interpret, EXAMPLES: EXAMPLES |
| studio-ai.js | 105 | Intelligenza artificiale LOCALE e gratuita per gli agenti dello Studio (niente abbonamenti, niente chiavi). Due motori:  - "ollama": Ollama sul Mac (https://ollama.com), modello consigliato qwen2.5:7b (buon italiano). | semantic: semantic, EXTRA: EXTRA, MODELS: MODELS, COMANDI: COMANDI, messages: messages, parse: parse, think: think, pingOllama: pingOllama |
| style-card.js | 114 | Scheda di stile: misura caratteristiche GENERICHE di una canzone di riferimento (tempo, peso del basso, luminosità, densità ritmica, crescita di energia) e le trasforma in parametri per l'arrangiatore. Si possono mescola | measure: measure, blend: blend, toParams: toParams, normBpm: normBpm |
| style-presets.js | 88 | Atmosfere "tipo …": caratteristiche di GENERE associate ad artisti e scene (velocità, strumenti, batteria, accordi, umore). Non copiano nessuna base o melodia: sono punti di partenza per basi nuove e originali. Ogni atmo | LIST: LIST, PROGS: PROGS, byId: byId, variant: variant, pickMany: pickMany, progName: progName |
| sultan-brain.js | 167 | Cervello Sultan: legge il TESTO e decide da solo come deve suonare la base. Non è un modello di linguaggio: è un sistema di regole misurabili, tutto sul telefono, tutto spiegabile. 1. SCENE: conta nel testo parole di mon | MOOD: MOOD, parseStyle: parseStyle, plan: plan, styleScores: styleScores, words: words, BASE_BPM: BASE_BPM, hash: hash, NAMES: NAMES, GENRES: GENRES, LEX: LEX |
| synth-design.js | 205 | Designer di suoni (sintesi calcolata qui, nessun campione):  - SYNTH wavetable: 4 forme d'onda (sinusoide → dente di sega → quadra → "vocale") e si scorre tra loro con    "Posizione"; un LFO muove la posizione (movimento | fm: fm, PRO: PRO, KITS: KITS, kitRender: kitRender, B808_PRESETS: B808_PRESETS, PERC: PERC, percEvents: percEvents, voiceInstrument: voiceInstrument, TABLES: TABLES, SYNTH_DEF: SYNTH_DEF, SYNTH_PRESET |
| taste.js | 56 | Gusto: impara dai ♥ e ✕ che metti alle basi generate. Salva SOLO numeri (stile, tonalità, pesantezza, BPM), mai audio né testi. newMem() → memoria vuota; vote(mem, plan, +1/-1) → nuova memoria; profile(mem) → profilo per | newMem: newMem, vote: vote, weights: weights, profile: profile, avoidList: avoidList, bpmRange: bpmRange, summary: summary, reset: reset |
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
- 516: Rime dal dizionario personale
- 521: Assistente testi (AI locale, opzionale)
- 590: Cartelle artista: stile misurato dai testi caricati (solo numeri)
- 650: Cervello Sultan nel Beat Lab
- 661: Orecchio di Sultan: ascolto con strumenti di misura
- 699: Cervello Sultan: dal testo alla base (stile, velocità, tonalità, strumenti)
- 709: Voce guida: voce maschile sintetica sulla base (impara solo l'altezza della tua voce)
- 738: Controllo del telefono: gira SUL tuo iPhone e dice cosa funziona (Misurato)
- 791: MUSICAL DNA ENGINE: mescola stili (numeri), emozioni del testo → base vera
- 940: Strumenti veri
- 1139: Coach
- 1225: Studio (DAW): tracce, trasporto, testo, agenti
- 1393: registrazione nello Studio
- 1435: scelta strumento (foglio)
- 1465: agenti
- 1572: comandi
- 1611: Parla con lo Studio: frasi → modifiche vere, con Accetta / Annulla
- 1685: Mastering professionale, riferimento A/B, tracce separate
- 1732: Designer suoni: synth, 808, effetti di transizione
- 1819: Piano roll nello Studio (melodia e basso 808)
- 1916: Voce: prove e montaggio (clip)
- 1980: Mixer a canali (stessa catena per ascolto e file salvato)
- 2084: Microfono nello Studio: pulito o autotune, tutto modificabile
- 2156: Impara da una base
- 2424: Studio a passi: porto qui i comandi del Cervello (stessi id, stessi ascolti)
- 2436: Varianti: 8 basi diverse alla volta, da ascoltare e scegliere (senza limite: premi ancora)
- 2578: Ispettore della traccia: un tocco sulla traccia → Suono · Note · Canale
- 2624: Produzione: effetti da film e interventi vocali scelti dal testo (ProdFx), modificabili a mano
- 2759: AI Producer
- 2818: Vocal Studio
- 2851: Registrazione con il microfono vero (solo nella versione app; dentro Claude il microfono è bloccato)
- 3184: VOICE LAB (cablaggio): il codice sta in src/voice-chain.js, src/voice-lab.js, src/realtime-tune.js
- 3188: fine VOICE LAB
- 3190: Video
- 3280: Marketing e Social
- 3345: Libreria
- 3360: Impostazioni
- 3392: Avvio

## Funzioni principali di app.js (riga: nome)

esc:5, fmt:6, cap:7, tick:8, sleep:9, tag:13, today:14, uid:15, defaultProd:23, newSong:26, cur:29, persist:38, flush:44, sanitize:52, load:64, getCtx:93, makeBuffer:98, stopPlay:103, playBuf:110, getDl:127, saveFile:128, wavBlob:140, saveAudio:148, toMono:165, decode:171, initSample:184, ask:188, songContext:192, route:210, applyMood:232, lyricLines:267, analysisOf:268, topMood:269, songCard:272, inFolder:278, renderAnalysis:326, meter:354, renderGuide:382, followBars:413, fillBase:418, syncKar:430, songMap:451, getBase:456, activeTake:461, buildMix:463, karaokeTick:482, makeAndPlay:496, wbStore:517, wbLearnSongs:518, rhChips:519, arStore:591, tasteMem:592, arModel:593, arModel0:598, beatProfile:606, arBars:613, arRender:614, arAdd:630, blBrain:651, earMeasure:662, earApply:663, earHtml:670, earMoodNote:678, earRun:684, applyMoodBg:696, moodNow:698, autoSecs:702, gvS:710, gvAdd:711, rxFor:766, runBrain:767, dnaSaved:793, dnaOpts:794, dnaParts:800, dnaBuild:804, dnaSliders:811, dnaCreate:814, atmQuick:842, sbAuto:856, sbMore:860, sbChips:887, sbPreset:899, brainFirst:917, instName:942, noteNm:943, labRec:944, loadInst:945, ensureInst:952, instOptions:958, refreshInstSelects:971, instInfo:974, fillInst:979, applyRecipe:987, previewInst:998, labOptions:1010, labCurrent:1015, labSet:1021, renderKnobs:1027, labPlayRec:1033, renderLab:1038, sgGuide:1114, sgCue:1115, sgRender:1116, lyricHtml:1130, coachState:1140, coachCtx:1141, coachRec:1145, coachName:1146, coachCands:1154, coachMeasure:1176, coachCheck:1194, coachFix:1209, renderCoach:1219, lvl:1239, dwFill:1240, dwLyInfo:1254, dwSteps:1258, dwBase:1270, voiceTake:1274, dwBuffers:1275, gainFor:1299, dwGains:1306, dwStop:1307, dwPlay:1315, ominoTick:1339, dwPos:1345, dwDraw:1354, dwRefresh:1389, dwChanged:1391, dwRecord:1394, dwRecStop:1411, sheetOpen:1437, sheetRender:1438, agentsRender:1467, agentTecnico:1484, agentAscoltatore:1501, coachSummary:1510, wait:1511, agentsRun:1512, talkRender:1613, aiSet:1620, aiRender:1621, runCommands:1635, talkState:1647, talkGo:1651, talkApply:1673, mpSet:1687, mpRender:1688, mpMake:1704, synthRegister:1733, dsSliders:1740, dsRender:1741, voxRegister:1802, voxMake:1807, extraFxBufs:1818, prNotes:1823, prGenerated:1824, inScale:1825, chordsDraw:1827, drumDefault:1846, drumDraw:1852, prDraw:1858, prSave:1879, prStepMidi:1880, realTakes:1917, takeById:1918, vclips:1919, vclipKey:1924, vclipBuffer:1925, setClips:1930, fmtS:1931, clipsRender:1933, mixSet:1982, dwGraph:1989, mixRender:2004, mixFmt:2014, autoRender:2029, verRender:2045, dwRender:2056, wavStereo:2065, dwExport:2073, micSet:2085, micRender:2092, takeChords:2113, micApply:2118, learnList:2158, decodeStereo:2159, learnBar:2167, sepMode:2168, sepInfo:2170, stMono:2178, withTimeout:2179, stallGuard:2181, sepAi:2182, learnSecs:2203, sepDb:2206, sepIdb:2207, wakeOn:2208, sepServer:2211, sepFast:2244, normOnly:2253, btGrid:2266, learnOne:2277, lyricStats:2308, trHtml:2315, learnLyrics:2323, lyricsDone:2332, profLine:2342, learnRender:2343, varCount:2386, folderProf:2388, learnArtists:2398, learnPlan:2399, learnUse:2400, dwWsName:2414, dwWs:2415, rnd:2438, varSpec:2439, varMake:2445, varName:2463, atmRender:2466, varRender:2467, varHtml:2470, varClick:2475, refSet:2501, refApply:2506, varStyleRender:2523, textWeights:2531, pfImageWeights:2537, learnSpecs2:2546, learnSpecs:2570, inspSuono:2585, inspTab:2593, inspOpen:2599, projLine:2617, pfSig:2627, pfHash:2628, pfPlan:2629, pfKey:2639, pfCount:2640, pfGo:2641, pfName:2642, pfWhere:2643, pfChanged:2648, pfRender:2649, pfAdRender:2664, renderRefs:2726, chatPush:2761, renderChat:2762, renderHist:2766, snapshot:2770, producerGo:2771, localAdvice:2794, setAT:2823, addTake:2831, micOk:2853, tdb:2854, dbTake:2865, restoreTakes:2875, recUi:2888, startRec:2891, finishRec:2937, renderTakes:2978, selectTake:2992, renderTakeAnalysis:3004, cssv:3022, drawPitch:3023, noteName:3093, geom:3094, drawNotes:3101, renderNotes:3128, playTone:3138, noteAtX:3144, ptr:3145, endDrag:3156, rescale:3169, filterPhoto:3192, soon:3207, wrap:3210, drawClip:3211, clipMix:3234, renderIdeas:3260, copyText:3282, post:3287, findItem:3294, postEvents:3295, genPlan:3303, renderPlan:3313, refreshSocial:3326, applyTheme:3361, renderSettings:3366, start:3393

## tests/

- _voice-synth.js: 0 test
- arranger.test.js: 21 test
- artist-lab.test.js: 7 test
- audio-analysis.test.js: 8 test
- auto-sections.test.js: 9 test
- autotune-chords.test.js: 1 test
- autotune-key.test.js: 13 test
- autotune-voice.test.js: 11 test
- backing-manga.test.js: 13 test
- base-analysis.test.js: 2 test
- beat-learn.test.js: 7 test
- beat-this.test.js: 6 test
- beatlab-engine.test.js: 12 test
- beatlab-mix.test.js: 10 test
- beatlab-patterns.test.js: 5 test
- beatlab-sampler.test.js: 6 test
- beatlab-theory.test.js: 5 test
- brain-force.test.js: 4 test
- clips.test.js: 4 test
- coach.test.js: 6 test
- dna.test.js: 8 test
- ear.test.js: 9 test
- guide-voice.test.js: 7 test
- instruments.test.js: 6 test
- local-ai.test.js: 9 test
- lyrics-base-clip.test.js: 8 test
- lyrics-engine.test.js: 12 test
- master-pro.test.js: 4 test
- master.test.js: 6 test
- melody.test.js: 3 test
- mixer.test.js: 5 test
- omino.test.js: 1 test
- pitch-video.test.js: 7 test
- polish.test.js: 8 test
- prod-fx.test.js: 7 test
- producer-promo.test.js: 16 test
- realtime-tune.test.js: 4 test
- remix.test.js: 4 test
- sig-fx.test.js: 6 test
- sing-guide.test.js: 3 test
- song-map.test.js: 4 test
- sound-lab.test.js: 6 test
- studio-agent.test.js: 3 test
- studio-ai.test.js: 3 test
- style-card.test.js: 8 test
- style-presets.test.js: 3 test
- sultan-brain.test.js: 8 test
- synth-design.test.js: 6 test
- taste.test.js: 6 test
- timing.test.js: 3 test
- voice-chain.test.js: 15 test
- voice-fx.test.js: 3 test
- word-bank.test.js: 5 test

## Altro

- build.js: esegue i test e crea dist/index.html (artifact) e docs/ (sito GitHub Pages)
- notes/STATO.md: cosa è fatto e cosa no (aggiornare ogni passo)
- notes/ARCHITETTURA.md, notes/LICENZE-SUONI.md
- src/app.body.html / app.css / app.shell.html: interfaccia
