# Ricerca tecnologie musicali (documento permanente, chat B)
Aggiornato: 26/11/2026. Ogni voce: cosa fa · problema che risolve · uso per noi · uso commerciale · licenza · hardware · gira sul nostro "server" · integrabile · senza API a pagamento · limiti.
Il nostro "server": nessuno a pagamento. Abbiamo: iPhone (Safari), spazio Hugging Face gratuito dell'utente (CPU 2 vCPU, 16 GB), spazi pubblici con GPU gratuite (ZeroGPU, limite giornaliero).
Legenda stato: ✅ integrato e provato · 🟡 integrato ma non provato fino in fondo · 📋 proposta · ⛔ scartato (licenza/hardware).

## Generazione di canzoni complete
| Progetto | Cosa fa | Licenza / commerciale | Hardware | Dove gira per noi | Stato e limiti |
|---|---|---|---|---|---|
| **ACE-Step 1.5** | testo + stile → canzone completa con voce (50+ lingue, italiano) | codice e pesi **MIT** (scheda HF) → sì | GPU (consumer); CPU troppo lenta | spazio pubblico ufficiale ACE-Step/Ace-Step-v1.5 (ZeroGPU gratis con limite) | 🟡 integrato (tasto «Fallo cantare», Sultan IA «fallo cantare»). Chiamata arriva allo spazio; non sentita da qui (limite gratuito esaurito per l'IP di prova). Voce IA, non dell'utente. |
| YuE / YuE2 | testo → canzone | codice Apache; pesi: fonti discordanti (CC BY-NC per alcune) | GPU 24 GB+ | no | ⛔ licenza non chiara, troppo pesante |
| MusicGen (Meta) | testo → musica strumentale | codice MIT, **pesi CC-BY-NC** → no commerciale | GPU | no | ⛔ licenza |
| Stable Audio Open 1.0 | testo → audio/loop 47 s | Stability Community License: commerciale solo sotto 1 M$ di fatturato | GPU | no | ⛔ soglia di fatturato (regola utente) |

## Separazione voce/base
| Progetto | Licenza | Stato |
|---|---|---|
| SCNet (via unblend, ONNX nel browser) | MIT | ✅ in app (Rapida). SDR voce 12,7–14,4 dB misurati (MUSDB). Telefono: ~1,7 GB di memoria misurati. |
| Mel-Band RoFormer (Kim) | MIT (scheda HF) | ✅ in app «Studio» (computer) e 🟡 nello spazio dell'utente (modo pulitissima, 19 min/4 min su 4 CPU misurati). SDR voce 14,8–17,5 dB. |
| Demucs htdemucs | MIT | 🟡 nello spazio dell'utente (modo veloce): 4 min di audio in 6 min 48 s su 4 CPU (misurato). |
| StemForge | app locale con GPU (separazione, MIDI, generazione) | da verificare la licenza; è un'app intera, non una libreria | 📋 solo come riferimento |
| Steminize, Libretta | non trovati con questi nomi | — | servono nome esatto o link |

## Analisi audio
| Progetto | Cosa fa | Licenza | Stato |
|---|---|---|---|
| **Beat This!** (CPJKU) | battiti e inizio battuta | MIT (codice e pesi) | ✅ in app (small0-v2 ONNX, 10 MB). BPM giusti 14/16 contro 7/16 delle regole (misurato). |
| **Basic Pitch** (Spotify) | audio → note MIDI (anche voce) | Apache 2.0, versione JS/TensorFlow.js | 📋 prossimo: trascrivere la melodia della voce caricata/registrata (per l'omino e per imparare le melodie, solo numeri). |
| Librosa | analisi audio in Python | ISC | 📋 solo nello spazio HF, se servono misure in più |
| Essentia / essentia.js | analisi musicale avanzata | **AGPL-3.0** | ⛔ licenza (renderebbe AGPL l'app) |
| Whisper (transformers.js / faster-whisper) | parole dalla voce | MIT | ✅ telefono (~80 MB) e 🟡 nello spazio (non provato da qui: download del modello bloccato dalla rete di prova) |

## Voce cantata e composizione simbolica
| Progetto | Cosa fa | Licenza | Stato |
|---|---|---|---|
| SoulX-Singer (2026) | partitura/melodia → voce cantata | da verificare; addestrato su cinese/inglese | 📋 da verificare licenza e italiano |
| YingMusic-Singer | voce cantata da melodia + testo | codice e pesi pubblici, licenza da verificare | 📋 |
| DiffSinger | voce cantata | Apache, ma voci quasi solo giapponese/cinese | ⛔ poco utile per l'italiano |
| MIDI-GPT | composizione MIDI multitraccia | CC-BY-NC | ⛔ licenza |
| Modelli linguistici nel browser (Qwen3 0,6B) | chat/testi | Apache | ⛔ per ora: misurato 148 s per una risposta, italiano scarso |

## Proposta concreta (ordine)
1. ✅ Controllo qualità musicale + profilo di produzione (fatto il 26/11, `src/quality-check.js`).
2. 📋 Basic Pitch (Apache, JS) per la melodia vocale: guida dell'omino con note vere e apprendimento melodie (solo numeri).
3. 📋 ACE-Step anche come «riferimento d'arrangiamento»: confronto tra la nostra base e la demo ACE (solo per ascolto).
4. 📋 Nello spazio HF dell'utente: Basic Pitch + Beat This in Python per i video lunghi (niente limiti di memoria del telefono).

Fonti principali: schede Hugging Face ufficiali (ACE-Step/Ace-Step1.5 license: mit; KimberleyJSN/melbandroformer: mit; CPJKU/beat_this LICENSE: MIT), spotify/basic-pitch (Apache-2.0), stability.ai/license, facebookresearch/audiocraft LICENSE_weights, arXiv 2602.00744 (ACE-Step 1.5), 2602.07803 (SoulX-Singer), 2512.04779 (YingMusic-Singer).
