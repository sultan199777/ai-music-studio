# Ricerca A: motori audio, suoni liberi, DAW a confronto, librerie JS

Data: 24/11/2026. Dove non ho trovato una conferma scrivo "non verificato". I prezzi cambiano spesso: ricontrollali prima di comprare.

## 1. Motori audio

| Tecnologia | Cosa fa | Licenza / costo | iPhone-Safari / Mac | Limiti |
|---|---|---|---|---|
| Web Audio API (+AudioWorklet, WebAssembly) | Motore audio del browser: oscillatori, filtri, delay, riverbero, mixer a nodi. AudioWorklet esegue il tuo codice DSP in un thread audio dedicato; WASM lo rende più veloce | Standard W3C, gratis | AudioWorklet: Safari Mac dalla 14.1, Safari iOS dalla 14.5 ([caniuse](https://caniuse.com/wf-audio-worklet)). MediaRecorder: iOS dalla 14.5 ([caniuse](https://caniuse.com/mediarecorder)) | Vedi sotto: Web MIDI assente, audio in background, latenza non garantita |
| Tone.js | Libreria sopra Web Audio: Transport (tempo/loop), sintetizzatori (FM, AM...), Sampler, Player, effetti, automazioni ([GitHub](https://github.com/Tonejs/Tone.js)) | MIT, gratis | Usa nodi Web Audio nativi, quindi funziona dove funziona Web Audio | Non è un mixer/DAW completo: costruisci tu il resto |
| AudioKit | Libreria Swift per audio su Apple ([GitHub](https://github.com/AudioKit/AudioKit)) | MIT, gratis | iOS, macOS, tvOS; si installa da Xcode | Solo nativo: serve Xcode (quindi un Mac) |
| Apple AVAudioEngine | Motore nativo Apple: grafo di nodi, effetti, mixer stereo/3D, MIDI e sampler (AVAudioUnitSampler), registrazione, rendering offline, plug-in Audio Unit ([doc Apple](https://developer.apple.com/documentation/avfaudio/audio-engine.md)) | Gratis con Xcode | Solo app native iOS/macOS | Latenza: non verificato (dipende da dispositivo e impostazioni) |
| JUCE | Framework C++ per app e plug-in audio | JUCE 8: Starter gratis fino a 20.000 $ di ricavi, Indie 40 $/mese o 800 $ una tantum fino a 300.000 $, Pro 175 $/mese o 3.500 $ ([forum JUCE](https://forum.juce.com/t/amendments-to-the-juce-end-user-licence-agreement-for-juce-8/61265)). Esiste anche un'opzione AGPLv3 per progetti open source ([forum](https://forum.juce.com/t/juce8-license-and-open-source-projects/60987)); l'uso GPL per app iOS chiuse non è chiarito ufficialmente | Mac: sì. iOS: sì ma, per la parte Apple, serve Xcode. Dettagli non verificati | C++ difficile per un principiante; attenzione ai limiti di ricavo |
| Faust | Linguaggio per scrivere effetti/sintetizzatori; faustwasm compila Faust in WebAssembly e lo usa come nodo Web Audio, anche polifonico ([GitHub](https://github.com/Fr0stbyteR/faustwasm)) | Licenza di faustwasm e di Faust: non verificato | Usa AudioWorklet; Safari vecchi solo ScriptProcessor (deprecato) | Il compilatore richiede https |
| Csound WASM | Motore classico di sintesi, versione browser `@csound/browser` ([README](https://cdn.jsdelivr.net/npm/@csound/browser@7.0.0/README.md)) | Wrapper Apache-2.0; binario WASM LGPL-2.1 | Richiede AudioWorklet (Safari 14.1+); iOS non citato esplicitamente | Dimensione del pacchetto non verificata; curva di apprendimento alta |
| Web Audio Modules (WAM) | Standard di plug-in per il web (DSP + interfaccia), come VST per il browser ([API](https://www.github.com/webaudiomodules/api)) | Licenza del repository: non verificato | Dipende da Web Audio/AudioWorklet | Ecosistema piccolo, maturità non dichiarata |

### Limiti di Safari iOS (verificati)

- **Web MIDI: non supportato** su Safari iOS né su Safari Mac. Su Mac esiste solo un'estensione di terze parti ([caniuse](https://caniuse.com/midi)). Quindi niente tastiere MIDI collegate dal browser su iPhone.
- **Audio in background:** Safari iOS sospende Web Audio quando lo schermo si blocca o l'app va in secondo piano ([forum Apple](https://developer.apple.com/forums/thread/774239)). Esiste un bug aperto: l'AudioContext non sempre riparte al ritorno in primo piano ([WebKit 263627](https://bugs.webkit.org/show_bug.cgi?id=263627)). Soluzione pratica: riprendere il contesto quando la pagina torna visibile; un involucro nativo permette l'audio in background.
- **Latenza:** `AudioContext.latencyHint` e `baseLatency` esistono, ma il browser può ignorare la richiesta ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/baseLatency)). Valori in millisecondi su iPhone: non verificato (da misurare con `outputLatency`).
- **Memoria e archiviazione:** per origine fino al 60% del disco nel browser, 15% per altre app; le app aggiunte alla Home hanno le stesse quote. I dati possono essere cancellati se il sito non viene usato per un po' o in caso di poco spazio. Si può chiedere `StorageManager.persist()` ([WebKit](https://webkit.org/?p=14403)). Limite di RAM di Safari iOS per i campioni: non verificato.
- **Registrazione:** MediaRecorder c'è dalla 14.5; il formato (probabilmente MP4/AAC) non è verificato.

### Cosa serve per l'app nativa
- Xcode: la documentazione Apple parla di installazione e firma da Xcode, quindi serve un Mac.
- Senza pagare: l'account gratuito ("Personal Team") permette di provare l'app sul proprio dispositivo, ma i profili scadono dopo 7 giorni, massimo 3 dispositivi e 3 app. Non include TestFlight né App Store Connect ([Apple](https://developer.apple.com/support/compare-memberships)).
- Per pubblicare sull'App Store: 99 USD all'anno ([Apple](https://developer.apple.com/programs/enroll/?product=WM)).
- Capacitor (MIT) può avvolgere la tua PWA in un'app nativa ([sito](https://capacitorjs.com/)); i requisiti Mac/Xcode non sono nella pagina letta, quindi non verificato.

## 2. Strumenti e suoni liberi

| Risorsa | Licenza | Dimensione | Note per il browser |
|---|---|---|---|
| [sfizz](https://github.com/sfztools/sfizz) | BSD-2-Clause (alcune dipendenze LGPL 2.1) | non verificata | Motore SFZ. Esiste [sfizz-webaudio](https://github.com/sfztools/sfizz-webaudio) (MIT), ma è un prototipo: solo generatori e campioni incorporati, demo per Chrome. Safari non dichiarato |
| FluidSynth / SoundFont | licenza non verificata nelle pagine lette | non verificata | Port WASM: [js-synthesizer](https://npmjs.com/package/js-synthesizer), non verificato in dettaglio |
| [SpessaSynth](https://github.com/spessasus/SpessaSynth) | Apache-2.0 | include GeneralUser GS compresso (peso non indicato) | Sintetizzatore SF2/SF3 e MIDI in JS, Web MIDI, tastiera mobile. Safari non dichiarato |
| [WebAudioFont](https://github.com/surikov/webaudiofont) | Codice GPL-3.0 (contattare l'autore per altre licenze). I suoni derivano da GeneralUserGS e FluidR3, con link alle loro licenze | non verificata | Catalogo General MIDI, 5-10 varianti per strumento. La GPL-3.0 è un problema se vendi un programma chiuso |
| Surge XT | GPL-3.0 ([GitHub](https://github.com/surge-synthesizer/surge)) | non verificata | Solo plug-in desktop (Win, Mac, Linux); nessun WASM né iOS nella pagina |
| Vital | Passato a open source a febbraio 2021 ([forum](https://forum.vital.audio/t/is-vital-actually-open-source/1396?page=2)); licenza esatta e licenza di preset/wavetable: non verificato | non verificata | Solo desktop |
| [VSCO-2 CE](https://www.github.com/sgossner/VSCO-2-CE) | CC0-1.0 | non indicata | Orchestra: archi, fiati, ottoni, tastiere, percussioni |
| [VCSL](https://github.com/sgossner/VCSL) | CC0 | ogni strumento circa 20-75 MB in WAV | Cordofoni, aerofoni, membranofoni, idiofoni, elettrofoni |
| [Stargate sample pack](https://github.com/stargatedaw/stargate-sample-pack) | CC0 / pubblico dominio, senza attribuzione (testo esatto da leggere nel LICENSE) | non indicata | Batterie (kick, snare, hi-hat), loop, violino, synth bass, basso; contributi dalla comunità |
| Altri pacchetti CC0 piano/chitarre/808 | non verificato | non verificata | Il pacchetto Stargate rimanda a VSCO-2 CE e VCSL come altri pacchetti pubblico dominio |

Nota: per iPhone i campioni vanno compressi (la loro conversione in OGG/MP3/AAC) e caricati a richiesta, non tutti insieme.

## 3. Confronto con DAW professionali

| DAW | Funzioni chiave | Prezzo (fonte) |
|---|---|---|
| Ableton Live 13 | Intro: 16 tracce, 8 strumenti; Standard: tracce illimitate; Suite: 20 strumenti, 58 effetti audio | Intro 99 $, Standard 349 $, Suite 749 $ ([Ableton](https://www.ableton.com/shop/live-13)); la pagina indica disponibilità "inizio 2027" |
| FL Studio | Edizioni Fruity, Producer, Signature, All Plugins; 23-39 strumenti, 53-70 effetti; aggiornamenti gratis a vita | Prezzi: non verificato (pagina senza cifre) ([Image-Line](https://www.image-line.com/fl-studio/a56abc-pricing)). Versione iPhone non descritta nella pagina letta |
| Logic Pro | Mac una tantum; iPad solo abbonamento | Mac 199,99 $; Apple Creator Studio 12,99 $/mese o 129 $/anno ([riepilogo](https://shade.inc/blog/apple-logic-pro-pricing), fonte terza, non Apple) |
| Bitwig Studio | Tre edizioni; passaggi di edizione senza costi extra | Essentials 75 € (prezzo normale 99), Producer 149 € (199), Studio 299 € (399), offerta fino al 7/1/2027 ([Bitwig](https://www.bitwig.com/buy)) |
| GarageBand (iOS) | Strumenti touch, Live Loops, Beat Sequencer, Alchemy, fino a 32 tracce, automazione di volume, EQ e compressore, estensioni Audio Unit, iCloud | Prezzo non indicato nella pagina; iOS 16 richiesto ([Apple](https://www.apple.com/ios/garageband/)) |
| BandLab | Gratis: Sampler, separazione stem, 436 strumenti virtuali; Pro 5,80 $/mese in saldo (14,99 $ normale) ([BandLab](https://blog.bandlab.com/bandlab-membership/)) | Gratis o Pro |
| Soundtrap | Piano gratuito; piani a pagamento 9,99 e 14,99 $ (articolo del 2019, **non aggiornato**) ([iMore](https://www.imore.com/spotifys-soundtrap-launches-revamped-free-tier-unlimited-storage)) | Prezzi attuali non verificati |
| Audiotool | Modulare, bus, sidechain, MIDI learn, collaborazione. Gratis. Lo studio richiede un browser desktop (Chrome, Firefox, Edge) ([Audiotool](https://www.audiotool.com/compare/audiotool-vs-bandlab), fonte del produttore) | Gratis |
| openDAW (open source) | In TypeScript con Web Audio: multitraccia, editor tipo piano roll, mixer con mandate, strumenti e FX, esporta stem. **Safari non supporta MIDI**; non supporta plug-in di terzi ([review](https://bedroomproducersblog.com/2026/08/22/opendaw-review/)). Licenza AGPL v3 o commerciale a pagamento ([licenza](https://hn.jakechampion.name/reader/https://github.com/andremichelle/openDAW)) | Gratis (AGPL) |

Funzioni per piano roll, step sequencer, mixer, automazione e sampler: presenti in quasi tutte; "warp" (time-stretch) e controllo preciso per le DAW nominate: non verificato per ciascuna.

## 4. Librerie JS open source utili

| Libreria | Uso | Licenza |
|---|---|---|
| [webaudio-pianoroll](https://www.npmjs.com/package/webaudio-pianoroll) | Piano roll come web component | Apache-2.0 |
| [waveform-playlist](https://app.unpkg.com/waveform-playlist@4.3.3/files/README.md) | Editor multitraccia con forma d'onda, volume, mute/solo, pan, fade, effetti, esportazione WAV | MIT |
| [wavesurfer.js](https://unpkg.com/wavesurfer.js@6.0.0/README.md) | Visualizzazione forme d'onda | BSD-3-Clause |
| [Tone.js](https://github.com/Tonejs/Tone.js) | Transport, sintesi, sampler | MIT |
| [react-piano-roll](https://github.com/MusicAsCode/react-piano-roll) | Piano roll React | non verificato |
| Step sequencer / mixer pronti | non trovati con licenza verificata | non verificato |

## 5. Raccomandazione per l'architettura

| Componente | Ora (iPhone, PWA, 0 €) | Solo con versione nativa Mac |
|---|---|---|
| Motore | Web Audio + Tone.js (MIT) per Transport, synth, effetti | AVAudioEngine/AudioKit (MIT) |
| DSP personalizzato | AudioWorklet (Safari iOS 14.5+); WASM da valutare | C++ con JUCE solo se ricavi bassi (Starter) o progetto aperto |
| Sampler | File compressi caricati a richiesta, da CC0: VSCO-2 CE, VCSL, Stargate | sfizz (BSD-2) |
| Suoni GM | SpessaSynth (Apache-2.0) da provare su Safari | AVAudioUnitSampler |
| Evitare nel prodotto da vendere | WebAudioFont (GPL-3), Surge, openDAW (AGPL) senza licenza commerciale; Vital e FluidSynth fino a verifica | JUCE GPL se la distribuzione è chiusa |
| MIDI | Non disponibile su Safari: tastiera sullo schermo | Core MIDI |
| Registrazione | getUserMedia + MediaRecorder (da testare formato) | AVAudioEngine |
| Archiviazione | IndexedDB + `persist()`; esporta spesso i progetti | File dell'app |
| Background | Non affidabile: riprendere AudioContext al ritorno | Modalità audio in background |
| Pacchettizzazione | PWA nella Home | Capacitor (MIT) + Xcode + 99 $/anno per l'App Store |

Priorità: ottieni prima una PWA stabile su iPhone con Tone.js e campioni CC0, misurando la latenza reale, poi pianifica la versione nativa solo quando avrai un Mac.

## Fonti
- https://caniuse.com/wf-audio-worklet
- https://caniuse.com/midi
- https://caniuse.com/mediarecorder
- https://webkit.org/?p=14403
- https://bugs.webkit.org/show_bug.cgi?id=263627
- https://developer.apple.com/forums/thread/774239
- https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/baseLatency
- https://developer.apple.com/documentation/avfaudio/audio-engine.md
- https://developer.apple.com/support/compare-memberships
- https://developer.apple.com/programs/enroll/?product=WM
- https://forum.juce.com/t/amendments-to-the-juce-end-user-licence-agreement-for-juce-8/61265
- https://forum.juce.com/t/juce8-license-and-open-source-projects/60987
- https://github.com/Tonejs/Tone.js
- https://github.com/AudioKit/AudioKit
- https://github.com/Fr0stbyteR/faustwasm
- https://cdn.jsdelivr.net/npm/@csound/browser@7.0.0/README.md
- https://www.github.com/webaudiomodules/api
- https://capacitorjs.com/
- https://github.com/sfztools/sfizz
- https://github.com/sfztools/sfizz-webaudio
- https://github.com/spessasus/SpessaSynth
- https://github.com/surikov/webaudiofont
- https://github.com/surge-synthesizer/surge
- https://forum.vital.audio/t/is-vital-actually-open-source/1396?page=2
- https://www.github.com/sgossner/VSCO-2-CE
- https://github.com/sgossner/VCSL
- https://github.com/stargatedaw/stargate-sample-pack
- https://www.ableton.com/shop/live-13
- https://www.image-line.com/fl-studio/a56abc-pricing
- https://shade.inc/blog/apple-logic-pro-pricing
- https://www.bitwig.com/buy
- https://www.apple.com/ios/garageband/
- https://blog.bandlab.com/bandlab-membership/
- https://www.imore.com/spotifys-soundtrap-launches-revamped-free-tier-unlimited-storage
- https://www.audiotool.com/compare/audiotool-vs-bandlab
- https://bedroomproducersblog.com/2026/08/22/opendaw-review/
- https://hn.jakechampion.name/reader/https://github.com/andremichelle/openDAW
- https://www.npmjs.com/package/webaudio-pianoroll
- https://app.unpkg.com/waveform-playlist@4.3.3/files/README.md
- https://unpkg.com/wavesurfer.js@6.0.0/README.md
