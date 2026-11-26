# Stato del Produttore AI (documento permanente di verifica)
Aggiornato: 26/11/2026 (chat B). Stati: ✅ funziona (provato con test automatico o nel browser simulato) · 🟡 c'è ma non provato fino in fondo (iPhone vero, ascolto, servizio esterno) · ❌ manca · ⚠️ problema noto.
Regola: un tasto che esiste NON vuol dire ✅. Ogni ✅ ha il suo test.

| # | Funzione richiesta | Stato | Come è verificato | Note |
|---|---|---|---|---|
| 1 | Ricerca tecnologie (documento permanente) | ✅ | notes/RICERCA-TECNOLOGIE-MUSICALI.md | da aggiornare a ogni scoperta |
| 2 | Motore che ragiona (armonia, melodia, ritmo, struttura) | 🟡 | Arranger + StylePresets + DNA (A); test arranger/style-presets | spiega le scelte nel Cervello e nel controllo qualità; melodia = modulo della chat A |
| 3 | CREA dà basi diverse dall'inizio alla fine | ✅ (misurato) | quality-check.test.js; prova browser: 3 «Crea base» di fila → somiglianza 3%, 3%, 14% | se una base somiglia ≥60% a una delle ultime 5, si rifà da sola (max 2 volte) |
| 3b | Kit di batteria e strumenti diversi a ogni base | ✅ | prova browser 5 creazioni (kit e strumenti cambiano) | varietyGuard: evita kit delle ultime 2 e strumenti delle ultime 5 |
| 3c | Melodia poco ripetitiva | ⚠️ | misurato: 75% di battute di melodia identiche in una trap | il controllo lo segnala e «Migliora» la rigenera; il motore melodico è della chat A |
| 4 | Linguaggi per genere (trap, drill, melodic, dark, hip hop, R&B, pop, cinematic) | 🟡 | 21+ stili nell'Arranger, 39 atmosfere | ascolto dell'utente necessario |
| 5 | Testo come origine (emozione, sillabe, sezioni, energia del ritornello) | 🟡 | Cervello (A), SongMap, ProdFx, controllo «parti del testo rispettate» | accenti/respiri: guida al canto (A) |
| 6 | Autocontrollo della qualità | ✅ | quality-check.test.js (copia, audio, controlli misurati/da ascoltare) | pannello «Il produttore controlla» + «Migliora i punti deboli» |
| 7 | Apprendimento dalle preferenze (mi piace, troppo semplice, più piano…) | ✅ | prova browser: «Più pianoforte» → accordi Kawai; «Batteria più potente» → livello 1,12 | profilo in LIB.settings.prodProf (conteggi + registro legato alla base); azzerabile; NON è addestramento di un modello |
| 7b | Confronto tra risultati vecchi e nuovi | 🟡 | storico impronte (fpHist) e registro feedback | manca una vista «prima/dopo» da ascoltare |
| 8 | Impara da video lunghi | 🟡 | telefono: 40 s centrali (84 s su computer); canzone intera a pezzi con ripresa (provato); spazio HF: 4 min interi (provato con server di prova) | iPhone vero non provato; pulsante IMPARA separato: ❌ (oggi impara da solo dopo il caricamento) |
| 9 | Guida vocale (omino) | 🟡 | omino a tempo (omino.test.js), voce guida nello Studio (provato: traccia avviata), ACE-Step per la demo cantata | note mostrate: ❌; alternative di melodia: ❌ |
| 10 | Agenti collegati (Producer, Composer, Beatmaker, Arranger, Vocal, Analyst, Learning, Mix) | 🟡 | moduli esistenti: Cervello/DNA (composer, A), Arranger, QualityCheck (analyst), prodProf (learning), Mixer/MasterPro, ProdFx | manca un «regista» che mostri il dialogo tra agenti |
| 11 | Guida per principianti + assistente che interviene davvero | ✅ | sultan-ai.test.js; prova browser: «808 più lungo» eseguito, «crea 8 basi» con memoria Shiva | frasi libere complesse («più profondo») → collegare a prodApply |
| 12 | Documento di verifica + test automatici | ✅ | questo file; `node --test tests/*.test.js` | |
| 13 | Miglioramento continuo / agente di ricerca | ❌ | — | proposta: attività programmata che aggiorna il documento di ricerca e chiede approvazione prima di integrare |

## Problemi noti
- Audio su iPhone: sblocco a ogni tocco + file muto (A). Non verificato sul telefono dell'utente.
- Memoria iPhone: base intera ~0,8 GB, separazione nel telefono ~1,7 GB (misurato su computer). Per i video lunghi: spazio HF.
- ACE-Step: limite gratuito giornaliero per indirizzo IP.

## 26/11 — Basi IA senza limiti (ACE-Step sul NOSTRO spazio)
| Funzione | Stato | Verifica |
|---|---|---|
| ACE-Step 1.5 su CPU (mezza precisione) | ✅ misurato | 30 s di base in 34-59 s, picco 8,8 GB (4 CPU); 3 demo create e consegnate all'utente |
| Spazio «sultan-crea» (space-crea/) | ✅ provato in locale | stesso codice dello spazio, chiamato dall'app: 90 s in 156 s |
| App → tuo spazio → base nello Studio per registrare | ✅ nel simulatore | crea-t: «Fatto in 156 s», «Usala per registrare» carica la base nello Studio |
| Spazio vero su Hugging Face (2 CPU gratuite) | 🟡 da creare dall'utente | tempi stimati ~2× |
| Idea 2 · il tuo stile nelle istruzioni dell'IA (cartella imparata o atmosfera → strumenti, groove, tonalità, BPM; tasti «più piano» ecc.) | ✅ nel simulatore | con «Shiva» la richiesta conteneva piano, bell melody, pizzicato strings |
| Idea 1 · base IA divisa in tracce (batteria, basso, resto) nello Studio | ✅ nel simulatore con i due spazi in locale | «Dividila in tracce»: 186 s, poi Studio «Base IA divisa · 36 battute» |
| Idea 3 · rifai solo un pezzo (inizio, centro, finale) | ✅ misurato | 0-10 s rifatti: differenza 114% nel pezzo, 22% nel resto (ricodifica); dall'app: 235 s su 4 CPU per una base di 90 s |

## Aggiunte (26/11)
- **Suoni veri registrati (CC0, VCSL/VSCO-2-CE):** rullanti, battiti di mani, hi-hat, shaker, tamburello, conga, bongo, cajón, campanaccio, claves, tom, grancassa, piatti, mare. Kit «Batteria vera»; gli effetti mare/impatto/salita/piatto al contrario usano registrazioni vere. Misurato nel browser: caricato e scelto da «Cambia base».
- **Agente Melodia (Basic Pitch di Spotify, Apache 2.0):** canticchi 10 secondi → note → la base suona la tua melodia (traccia Melodia, modificabile nel piano roll). Misurato nel browser con una melodia di prova: 7 note su 7 giuste. Non ancora provato su iPhone vero.
- **Separazione sul tuo spazio, 2 modi nuovi (Demucs, MIT):** «Precisa» (htdemucs_ft) e «6 tracce» (voce, batteria, basso, chitarra, piano, resto). Misurato sul server di prova: 20 s di canzone → 6 tracce in 21 s, precisa in 88 s. Serve lo spazio Hugging Face creato (stasera).
