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
| **YuE / YuE2** (HKUST/M-A-P) | canzone intera da testo, con voce | codice Apache; **pesi YuE2 CC BY-NC 4.0** (MODEL_LICENSE nel repository ufficiale, letto 26/11) | GPU NVIDIA 24 GB | ⛔ escluso |
| **DiffRhythm** | canzone intera da testo, veloce | Apache 2.0 (LICENSE ufficiale) | Mac o GPU 8 GB | pronuncia solo cinese/inglese/francese/tedesco/coreano: **non l'italiano** |
| **SongGeneration / LeVo** (Tencent) | canzone da testo | non chiara | GPU | **Non usare** finché la licenza non è chiara |
| **ACE-Step 1.5** | base e voce che canta il TUO testo | MIT | CPU lento / GPU veloce | Spazio pronto in `space-crea/`. **Misurato**: 30 s in 34-59 s su CPU. Manca solo crearlo su Hugging Face (stasera) |
| **LAION CLAP** | riconoscere strumenti, suoni, emozioni | Apache 2.0 (pesi ufficiali) | browser (transformers.js) | **Integrato** (Orecchio IA). Misurato: 7/9 strumenti, 156 MB, 0,6 s per pezzo; emozione sul mix poco affidabile |
| **ableton-mcp** (ahujasid) | far comandare Ableton a un'IA | MIT | Mac + Ableton (a pagamento) | Solo se un giorno compri Ableton |
| **Signalsmith Stretch** | cambiare tono e velocità con qualità alta (autotune, doppie voci) | MIT (con versione Web/WASM ufficiale) | browser | Candidato per migliorare pitch/formant. **Rubber Band è GPL: no** |
| **sqlite-vec** | memoria «per significato» | MIT o Apache | browser (WASM) | Per ora non serve: i dati sono pochi. Quando serve, dopo |

## 3. Tabella delle funzionalità (aggiornata 26/11 sera)

Legenda: ✅ **Funziona** (provato oggi nell'app, numeri misurati) · 🟡 **Nel codice** (test automatici, non riprovato oggi) · 🔴 **Da sviluppare** · ⛔ **Escluso** (licenza o costi)

| Area | Capacità | Stato | Prova / note |
|---|---|---|---|
| **Mani** | comandi a parole → modifiche vere (bpm a numero, 808, swing, sidechain, accordi, melodia, strumenti, riverbero, compressione, riser, esporta) | ✅ | 18/20 comandi del collaudo |
| Mani | **montaggio parti**: duplica, togli, sposta, copia, allunga/accorcia, aggiungi (intro/strofa/pre/ritornello/bridge/outro) con il testo che segue la sua parte | ✅ | «duplica il ritornello» 21→28 s, «togli l'intro» 28→24,5 s; karaoke resta a tempo (test) |
| Mani | **annulla / ripristina** (barra in alto e in chat: «annulla», «ripristina») anche su Crea/Cambia base | ✅ | dopo annulla l'impronta audio è identica a prima |
| Mani | **ascolto A/B** prima/dopo ogni modifica (tasti A·prima, B·dopo o «ascolta prima/dopo») | ✅ | le due versioni suonano esattamente come misurate |
| Mani | automazioni (volume/filtro che cambiano nel tempo), taglio a metà parte | 🔴 | prossimo passo |
| **Creatività** | «più aggressiva / malinconica / potente / commerciale / dolce / energica / cupa»: ricetta da produttore su scala, giro, tempo, batteria, 808, mix, master, struttura, con il **perché** di ogni scelta | ✅ | ogni intenzione cambia ≥3 cose (test); nell'app l'audio cambia |
| **Memoria** | decisioni tenute/annullate (per modifica), usate dalle intenzioni (salta ciò che hai annullato ≥2 volte) | ✅ | «cosa sai di me» le elenca |
| Memoria | frasi «ricorda che…», gusti ♥/✕, profilo di produzione, ascolti dell'orecchio IA, archivio privato su GitHub | 🟡 | |
| Memoria | ricerca «per significato» (database vettoriale) | 🔴 | non serve finché i dati sono pochi |
| **Orecchie** | **Orecchio IA (LAION CLAP)**: strumenti ed emozione per parte, confronto con gli strumenti previsti | ✅ sperimentale | strumenti singoli 7/9 giusti; sul mix completo l'emozione è **poco affidabile** (ha detto «allegra» per una trap scura); 156 MB, 0,6 s per pezzo; ha trovato un pad non udibile |
| Orecchie | BPM/battute (Beat This!), tonalità, accordi, sezioni, livelli/808/fango/distorsione (Orecchio misure) | 🟡 | |
| Orecchie | audio → note (Basic Pitch) | ✅ | 7/7 note (prova di ieri) |
| Orecchie | separazione 4 e 6 tracce, «Precisa» (sul tuo spazio) | ✅ sul server | 6 tracce in 21 s per 20 s di canzone |
| **Voce** | voce IA che canta il TUO testo in italiano (ACE-Step) | ✅ sul server | «Amo tanto gli altri» cantata: `notes/demo-acestep-voce-italiana.mp3`. Sul telefono serve lo spazio Hugging Face (stasera) o il Mac |
| Voce | autotune, formanti, effetti, vocoder, catena voce (chat A) | 🟡 | |
| Voce | doppie voci/armonie di qualità (Signalsmith Stretch, MIT) | 🔴 | da provare con la chat A |
| **Generazione** | basi dal testo (motore nostro, 39 stili, piani d'arrangiamento) | ✅ | 5 basi diverse di fila anche dopo riapertura |
| Generazione | **Mac**: un comando avvia app + ACE-Step locale (`mac/avvia.sh`) | ✅ catena provata su Linux | app da localhost → motore locale: canzone di 10 s in 21 s, nessun errore. Sul Mac vero: da misurare |
| Generazione | DiffRhythm | 🔴 | Apache 2.0, ma **non pronuncia l'italiano**: solo basi strumentali, eventualmente |
| Generazione | YuE2 | ⛔ | pesi CC BY-NC 4.0 (file MODEL_LICENSE ufficiale) |
| **Agenti** | ruoli veri con codice e test: Cervello (produttore), Arrangiatore/beatmaker, Intenzioni creative, Montaggio, Designer suoni, Orecchio misure + Orecchio IA, Controllo qualità, Mix, Master, Voce/Autotune (chat A), Memoria; la chat «IA» smista i comandi | 🟡 | coordinamento = la chat; manca un pannello che mostri «chi ha fatto cosa» |
| Agenti | ogni modifica dice **quale agente** l'ha fatta (🎬 Arrangiatore, 🎛 Produttore, 🥁 Beatmaker, 🎹 Compositore, 🎚 Mix, 🎤 Voce, ✨ Sound designer, 💿 Mastering, 🧠 Cervello) | ✅ | collaudo: 6 comandi, audio misurato su tutte le 8 tracce cambia; «master per spotify» già così → nessun cambio, e lo dice |
| Agenti | pannello grafico del team con la storia di chi ha fatto cosa | 🔴 | |

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

## 6b. Altre tecnologie da tenere d'occhio (non ancora verificate da me)
- **torchcrepe / RMVPE** (intonazione precisa, per un autotune migliore) · **Demucs v4** (già usato) · **audiomentations** (MIT).
- Da **escludere** per licenza: Essentia.js (AGPL), pedalboard di Spotify (GPL-3), Matchering (GPL-3), Rubber Band (GPL), modelli madmom (CC BY-NC-SA), MusicGen (pesi CC BY-NC), Stable Audio Open (soglia di fatturato).

## 7. Piano a fasi (uno alla volta, ognuno provato prima di dire «fatto»)
1. **Stasera**: crei lo spazio Hugging Face → voce che canta davvero le tue parole (ACE-Step) e basi IA senza limiti. Poi lo spazio di separazione.
2. **Orecchie**: provare LAION CLAP nel browser su basi vere (riconosce strumenti/emozione?). Si integra solo se i risultati sono giusti e il peso regge sull'iPhone.
3. **Mani**: duplicare/tagliare/spostare sezioni e automazioni (volume, filtro) con annulla.
4. **Voce**: provare Signalsmith Stretch (MIT) per doppie voci e armonie più naturali (con la chat A).
5. **Mac** (quando lo compri): Ollama (IA che ragiona, gratis), YuE/DiffRhythm se la licenza è confermata, eventualmente Ableton + ableton-mcp.

## Fonti consultate oggi
- Repository: github.com/sb-dev/music-production-skills, /Korben00/ableton-producer-skills, /doseedo/skills, /sirruf/music-gen-skill, /FunwayHQ/sound-design-skill, /ruminoob/sound-skill, /meicale/music_studio
- YuE: huggingface.co/m-a-p/YuE-upsampler · DiffRhythm e LeVo: huggingface.co/tencent/SongGeneration · CLAP: huggingface.co/laion/clap-htsat-fused, huggingface.co/Xenova/clap-htsat-unfused · ableton-mcp: github.com/ahujasid/ableton-mcp · Signalsmith: npmjs.com/package/signalsmith-stretch · sqlite-vec: github.com/asg017/sqlite-vec (mirror consultati)
