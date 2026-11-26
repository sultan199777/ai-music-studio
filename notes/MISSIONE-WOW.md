# MISSIONE WOW — ricerca e stato reale (26/11, chat B)

Etichette: **Misurato oggi** = provato nell'app con un test vero oggi · **Nel codice** = esiste e ha test automatici, non riprovato oggi · **Da verificare** = letto in documentazione, non ancora provato da noi.
Regole sempre valide: solo licenze MIT / Apache / BSD / CC0; niente GPL/AGPL, CC BY-NC, CC BY-SA, soglie di fatturato; niente abbonamenti senza tua approvazione; solo la tua voce.

---

## 1. I 7 repository che mi hai indicato (scaricati e letti oggi)

| Repository | Licenza | Ultimo aggiornamento | Cosa è davvero | Serve a noi? |
|---|---|---|---|---|
| sb-dev/music-production-skills | MIT | 29/08/2026 | 4 skill di metodo (compose, evaluate, produce, pack-author) + 22 skill da programmatore. `music-produce` usa **Replicate (a pagamento)** | **Adattare** le idee di `music-evaluate` (confronto bozze, non rompere ciò che hai approvato). Non installare la parte Replicate |
| Korben00/ableton-producer-skills | MIT | 05/06/2026 | 14 skill (batteria, basso, topline, riarmonizza, humanize, quick mix, FX chain…) che **scrivono dentro Ableton Live** | Servono solo con **Ableton (a pagamento)** sul Mac. Le regole musicali (groove, bassline, topline) si possono **adattare** al nostro motore |
| doseedo/skills | MIT (le skill) | 11/11/2026 | Comandi per il servizio **doseedo.com, a pagamento per ogni lavoro** (100+ strumenti IA, stem, sessioni DAW) | **No** senza tua approvazione: costa a ogni uso |
| sirruf/music-gen-skill | MIT | 29/05/2026 | 1 skill + script Python che genera melodie/accordi semplici in WAV | Poco: il nostro arrangiatore fa già di più |
| FunwayHQ/sound-design-skill | MIT | 03/03/2026 | Skill da sound designer: ragiona su fisica e psicoacustica e scrive codice **Web Audio** e SuperCollider | **Adattare**: è codice per il browser, come la nostra app |
| ruminoob/sound-skill | MIT | 29/10/2026 | Skill «fai suoni col codice» (effetti, whoosh, ambienti, loop) | **Adattare** per nuovi effetti di produzione |
| meicale/music_studio (Remiqora) | MIT | 15/10/2026 | Studio per PC con **scheda grafica**: ACE-Step 1.5 + YuE + DAW multitraccia + arrangiatore IA. In sviluppo, instabile | Idea uguale alla nostra; utile come riferimento per il **Mac** |

**Cosa vuol dire «skill»:** sono istruzioni scritte per un'IA come me (Claude), non programmi che girano nella tua app. Rendono me più bravo quando lavoro sul progetto; non danno da sole poteri all'app. Le parti utili le trasformo in codice vero nell'app (come ho fatto oggi con le «mani»).

## 2. Tecnologie nuove verificate oggi (licenza)

| Tecnologia | A cosa serve | Licenza (fonte) | Dove gira | Stato per noi |
|---|---|---|---|---|
| **YuE** (HKUST/M-A-P) | canzone intera da testo, con voce | Apache 2.0 secondo la scheda ufficiale; vecchie copie dicono CC BY-NC → controllare il file LICENSE ufficiale prima | GPU (Mac potente o server) | Da verificare |
| **DiffRhythm** | canzone intera da testo, veloce | Apache 2.0 (codice e pesi) | GPU | Da verificare |
| **SongGeneration / LeVo** (Tencent) | canzone da testo | non chiara | GPU | **Non usare** finché la licenza non è chiara |
| **ACE-Step 1.5** | base e voce che canta il TUO testo | MIT | CPU lento / GPU veloce | Spazio pronto in `space-crea/`. **Misurato**: 30 s in 34-59 s su CPU. Manca solo crearlo su Hugging Face (stasera) |
| **LAION CLAP** | riconoscere strumenti, suoni, emozioni («ascolta e descrivi») | Apache 2.0 (pesi ufficiali) | browser con transformers.js | Da provare: candidato per le «orecchie» |
| **ableton-mcp** (ahujasid) | far comandare Ableton a un'IA | MIT | Mac + Ableton (a pagamento) | Solo se un giorno compri Ableton |
| **Signalsmith Stretch** | cambiare tono e velocità con qualità alta (autotune, doppie voci) | MIT (con versione Web/WASM ufficiale) | browser | Candidato per migliorare pitch/formant. **Rubber Band è GPL: no** |
| **sqlite-vec** | memoria «per significato» | MIT o Apache | browser (WASM) | Per ora non serve: i dati sono pochi. Quando serve, dopo |

## 3. Cosa ha GIÀ l'app (stato onesto)

| Capacità | Com'è fatta | Stato |
|---|---|---|
| **Orecchie**: BPM, battiti, battute | Beat This! (MIT) | Nel codice |
| Tonalità, accordi, sezioni | key-detect, base-analysis, auto-sections | Nel codice |
| Livelli, sub/808, fango, distorsione, dinamica | Orecchio (`ear.js`) | Nel codice |
| Separare voce/batteria/basso/resto | telefono: SCNet (pesante); tuo spazio: htdemucs, Mel-RoFormer, **Precisa**, **6 tracce** | **Misurato oggi** sul server di prova: 6 tracce in 21 s per 20 s di canzone, «Precisa» in 88 s |
| Audio → note (MIDI) | Basic Pitch di Spotify (Apache) | **Misurato oggi**: 7 note su 7 giuste |
| Parole dalla voce | Whisper (MIT) | Nel codice |
| Confrontare basi / riascoltarsi | QualityCheck (impronta, somiglianza) + nuovo tentativo automatico | Nel codice; misurato ieri |
| **Cervello**: testo → emozione, BPM, tonalità, giro, melodia, batteria, arrangiamento | SultanBrain + Arranger + 39 stili + piani d'arrangiamento | **Misurato oggi**: 5 basi di fila tutte diverse, anche dopo aver riaperto l'app |
| **Mani**: comandi a parole → modifiche vere | StudioAgent + ProducerActions + chat «IA» | **Misurato oggi: 18 comandi su 20 funzionano** (vedi sotto) |
| Annulla | dalla chat e dal pannello | **Misurato oggi** |
| **Voce**: autotune (PSOLA), autotune in cuffia (sperimentale), formanti, effetti, vocoder, catena voce | autotune.js, realtime-tune.js, formant.js, voice-fx.js | Nel codice (chat A) |
| Voce che canta le parole vere | ACE-Step | Bloccato: serve il tuo spazio Hugging Face (stasera) |
| Suoni veri | 48 strumenti + percussioni registrate (CC0) | **Misurato oggi**: 104 suoni su 104 suonano |
| **Memoria** permanente | memoria nel telefono + archivio privato su GitHub + profilo gusti (♥/✕) + memoria «ricorda che…» | Nel codice |
| IA che ragiona in linguaggio libero | WebLLM/Qwen nel browser, Ollama sul Mac (gratis) | Nel codice, facoltativa |

### Collaudo delle «mani» (oggi, nell'app, iPhone simulato)
Prima: 9 comandi su 20 diventavano modifiche vere; «annulla» non funzionava e due risposte dicevano «Fatto» senza cambiare niente.
Dopo la correzione di oggi funzionano: bpm 140 · più 808 · 808 più lungo · togli la batteria nell'intro (solo l'intro) · più veloce · tonalità la minore · riverbero voce · alza melodia · abbassa basso · sidechain · più swing · cambia la melodia · cambia gli accordi · riser prima del ritornello · compressione voce · metti il piano al posto della chitarra · esporta la base · annulla.
Ancora **non sa**: «duplica il ritornello» (lo dice, non finge). Quando non cambia niente risponde «Era già così», non «Fatto».

## 4. Locale gratis · serve hardware · a pagamento

| Gratis, gira nel telefono/browser | Gratis ma serve un computer o un server | A pagamento (non usare senza tuo sì) |
|---|---|---|
| tutto l'arrangiatore e i suoni, Beat This!, Basic Pitch, Whisper piccolo, autotune, mix e master, chat con regole, WebLLM (se l'iPhone regge) | ACE-Step, YuE, DiffRhythm (meglio con GPU), separazione htdemucs/RoFormer (spazio Hugging Face gratuito su CPU), Ollama sul Mac | doseedo, Replicate, Suno/Udio, Ableton Live, plugin Antares/Melodyne |

## 5. Agenti: come funziona il «team»
Non servono 12 programmi diversi. Oggi nell'app ci sono già ruoli veri: Cervello (produttore), Arrangiatore (beatmaker/arrangiamento), Designer suoni, Orecchio (analista audio), Controllo qualità, Mix e Master, Voce (chat A), Memoria e gusti, e la chat «IA» che coordina e smista i comandi. Ogni ruolo è codice con test; la chat decide chi chiamare. Aggiungere un agente = aggiungere regole o misure vere, non un nome nuovo.

## 6. Apprendimento continuo: cosa è vero
- Impara dai tuoi ♥/✕ e dai «cambia base» (profilo di produzione), si può azzerare. **Non è addestramento di un modello**: sono numeri salvati e usati nelle basi successive.
- Impara da canzoni/video caricati (solo misure, mai l'audio).
- «Ricorda che…» salva frasi nella memoria.
- Non dichiara di aver imparato se non ha salvato: il salvataggio è nel telefono e nell'archivio GitHub.

## 7. Piano a fasi (uno alla volta, ognuno provato prima di dire «fatto»)
1. **Stasera**: crei lo spazio Hugging Face → voce che canta davvero le tue parole (ACE-Step) e basi IA senza limiti. Poi lo spazio di separazione.
2. **Orecchie**: provare LAION CLAP nel browser su basi vere (riconosce strumenti/emozione?). Si integra solo se i risultati sono giusti e il peso regge sull'iPhone.
3. **Mani**: duplicare/tagliare/spostare sezioni e automazioni (volume, filtro) con annulla.
4. **Voce**: provare Signalsmith Stretch (MIT) per doppie voci e armonie più naturali (con la chat A).
5. **Mac** (quando lo compri): Ollama (IA che ragiona, gratis), YuE/DiffRhythm se la licenza è confermata, eventualmente Ableton + ableton-mcp.

## Fonti consultate oggi
- Repository: github.com/sb-dev/music-production-skills, /Korben00/ableton-producer-skills, /doseedo/skills, /sirruf/music-gen-skill, /FunwayHQ/sound-design-skill, /ruminoob/sound-skill, /meicale/music_studio
- YuE: huggingface.co/m-a-p/YuE-upsampler · DiffRhythm e LeVo: huggingface.co/tencent/SongGeneration · CLAP: huggingface.co/laion/clap-htsat-fused, huggingface.co/Xenova/clap-htsat-unfused · ableton-mcp: github.com/ahujasid/ableton-mcp · Signalsmith: npmjs.com/package/signalsmith-stretch · sqlite-vec: github.com/asg017/sqlite-vec (mirror consultati)
