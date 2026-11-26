# PIANO: potenziare l'intelligenza dello studio (26 nov 2026, chat A)

Richiesta di Sultan: un'AI che ascolta, capisce, crea, modifica, impara, con memoria e agenti, senza API obbligatorie.
Etichette: Misurato = provato da me; Fonte = letto in una pagina; Mia conoscenza = non verificata oggi (va controllata prima di usare).

## 1. I 7 progetti indicati (ricerca)
- Pagine aperte con successo: solo `funwayhq/sound-design-skill` (via skills.sh): una sola skill, traduce descrizioni di suono in codice SuperCollider/Web Audio; controllo sicurezza SAFE (Fonte: skills.sh, 23 ott 2026); licenza NON indicata nella pagina.
- Non raggiunti (sito non nell'elenco consentito o non trovati dalla ricerca): sb-dev/music-production-skills, Korben00/ableton-producer-skills, doseedo/skills, sirruf/music-gen-skill, ruminoob/sound-skill, meicale/music_studio. NIENTE è stato installato o copiato. Per leggerli servono i link diretti ai file README/LICENSE, oppure Sultan li apre da Safari.
- Punto chiave: queste "skill" sono istruzioni di testo per assistenti come Claude Code. Non girano dentro l'app sul telefono. Possono migliorare COME lavoro io (consigli di mestiere), non danno nuove funzioni all'app. Per le funzioni dell'app servono modelli e librerie (punto 3).
- Regola licenze: solo MIT/Apache/BSD/ISC/CC0. Niente GPL/AGPL/CC BY-NC/CC BY-SA/licenza non chiara.

## 2. Cosa abbiamo già (da `src/`) e cosa manca
| Richiesta | Già nell'app | Manca |
|---|---|---|
| Ascoltare con misure | `ear.js` (livelli, LUFS, basso/medi/alti, clipping, fango, per genere), `base-analysis.js`, `audio-analysis.js`, `quality-check.js` | confronto A/B automatico prima/dopo con verdetto |
| BPM, battiti | `beat-learn.js`, `beat-this.js` (MIT), misurato 144 BPM su prova | strutture (strofa/ritornello) da audio vero |
| Tonalità, accordi | `key-detect.js`, accordi in `beat-learn.js` | accordi più affidabili su basi dense |
| Separare voce/batteria/basso | `ai-separator.js` (modelli locali), spazio Hugging Face (chat B) | su iPhone lento: veloce = solo misura |
| Audio in MIDI | `beatlab-midi.js` (MIDI ↔ pattern) | trascrizione da audio (melodia/basso) |
| Generare base | `arranger.js`, `remix.js`, `dna.js`, ACE-Step 1.5 (chat B) | modifica di UNA sezione sull'audio generato (chat B ha iniziato) |
| Memoria | `taste.js`, `archive.js` (numeri su GitHub), IndexedDB | memoria di decisioni ed errori consultabile dagli agenti |
| Agenti | `studio-agent.js`, `producer-actions.js`, squadra in «Crea base» (regole, non modelli di linguaggio) | agenti con ruoli e contesto condiviso; ora sono regole |
| Annulla modifiche | parziale nello Studio | storico unico con annulla per ogni agente |
| Modelli di linguaggio locali | `local-ai.js` (WebLLM/Qwen nel Testo), non verificato su iPhone | Ollama funziona solo su computer |

## 3. Candidati per le capacità mancanti (licenze: MIA CONOSCENZA, da verificare prima)
- Audio → MIDI: Basic Pitch (Spotify, Apache-2.0, gira nel browser). Nel frattempo si può fare melodia/basso monofonici con il tracciatore di intonazione che c'è già (zero dipendenze).
- Separazione: Demucs (MIT) / modelli già in `ai-separator.js`.
- Descrittori audio: Meyda (MIT). Essentia(.js) è AGPL: ESCLUSA.
- Modelli di linguaggio: WebLLM (Apache-2.0) già presente; Ollama (MIT) solo su computer.
- Generazione: ACE-Step 1.5 (MIT) già collegato da chat B.
- Memoria semantica: non serve un database vettoriale pesante: indice a parole/numeri in IndexedDB + file JSON nell'archivio GitHub già fatto.

## 4. Ordine di lavoro proposto (un pezzo alla volta, ognuno con test)
1. **Verifica A/B** (nessuna dipendenza): dopo ogni modifica, `ear.js` misura prima e dopo, confronta e dice «migliorato / peggiorato / uguale» con i numeri. Aggancio a «Annulla».
2. **Melodia e basso da audio a MIDI** (pura JS, con tracciatore esistente), modificabili nello Studio.
3. **Registro decisioni** (cosa hai approvato/scartato, errori e soluzioni) in memoria + archivio online, richiamato dalla squadra.
4. **Agenti con ruoli**: stessa squadra, ma ogni ruolo con il suo contesto e il suo storico (regole + misure, onesto).
5. Poi, con tua autorizzazione: Basic Pitch (polifonico), accordi migliori.

## 5. Richiede autorizzazione o hardware
- Nuove librerie/modelli scaricati: chiedere prima (dimensione, licenza, costo).
- Qualsiasi servizio a pagamento: NO senza approvazione.
- Computer/GPU: modalità Studio della separazione, Ollama.
- Limite onesto: gli «agenti» sono regole e misure, non persone né un modello di linguaggio; il giudizio sul suono resta all'orecchio dell'utente.
