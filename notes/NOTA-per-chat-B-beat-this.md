# Nota per la chat B — Beat This! (battiti e battute precisi) per "Impara da una base"
Scritta dalla chat A il 25/11/2026. Non è provata: da lì non si scarica il modello (rete bloccata). Va provata nel browser con una base vera.

## Perché
beat-learn.js stima BPM e griglia con regole. Beat This! (rete neurale, ISMIR 2024) trova **battiti e inizio battuta (downbeat)** con molta più precisione, anche con swing e tempi difficili. Più la griglia è precisa, più i numeri imparati (cassa/rullante sui 16 passi, swing, struttura in battute) sono giusti.

## Cosa è
- Modello: Beat This! (CPJKU/beat_this, licenza **MIT**). Conversione ONNX: https://huggingface.co/ashudesai/songbird-models (MIT, versione "small" circa 10 MB, "final" circa 80 MB).
- Esecuzione: onnxruntime-web (MIT), già nel progetto (ort126).
- Verificare nel repo originale (https://github.com/CPJKU/beat_this) i parametri esatti prima di scrivere il codice: sample rate (22050 Hz), mel 128 bande, hop 441 (50 fotogrammi/s), log-mel, uscita = probabilità di beat e downbeat per fotogramma, poi picchi con distanza minima. NON fidarsi della memoria: controllare README e codice del preprocessing.

## Come integrarlo (proposta)
1. Nuovo `src/beat-this.js` (UMD come gli altri): `load(url)`, `track(float32Mono, sr)` → `{beats:[s], downbeats:[s], bpm, barSec}`.
2. In beat-learn.js: se Beat This! è disponibile usa la sua griglia; se no, il metodo a regole che c'è già (fallback invariato).
3. Scaricare il modello a richiesta (una volta, poi in cache del browser), con avviso del peso. Mai all'avvio.
4. Salvare nel profilo SOLO numeri (BPM, posizione dei downbeat, swing, densità): mai audio. Il Cervello (sultan-brain, `opt.profile`) li usa già.
5. Test: sintetizzare in Node un brano di click a 120 BPM con swing noto e controllare che bpm/downbeat tornino entro una tolleranza; poi prova su base vera nel browser (da telefono se possibile).

## Rischi
- iPhone: memoria. Usare la versione "small" e finestre di 30 s con sovrapposizione.
- Se non converge: lasciare il fallback, non mostrare numeri inventati. Etichette Misurato / Ipotesi come sempre.

## Altre idee libere, solo se la licenza è chiara (controllare il file LICENSE)
- @audio/mir (accordi/tonalità in JS): licenza dell'insieme non letta; i pacchetti chordino e nnls-chroma sono GPL → NON usarli.
- regroove (varianti di groove in ONNX): nessuna licenza trovata → NON usare finché non chiarita.
- Da scartare per licenza: pesi MusicGen (CC BY-NC); Stable Audio Open (condizioni sul fatturato); DiffRhythm (pesi poco chiari).
