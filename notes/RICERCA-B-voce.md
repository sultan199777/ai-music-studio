# Ricerca B: Voice Studio professionale in PWA (iPhone)

Legenda: [V] = verificato su una fonte aperta in questa ricerca. "non verificato" = non trovato in fonte ufficiale; le cose scritte così sono solo ipotesi di lavoro, da provare con l'orecchio.

## 1. Come funzionano i controlli di Auto-Tune e Melodyne

### Auto-Tune (Antares)
- **Retune Speed**: quanto in fretta ogni nota viene tirata sulla nota giusta, in millisecondi. 0-5 ms = effetto "robot" duro; più lento = più naturale. 20-30 ms è un punto di partenza comune; il manuale dice 10-50 per un suono naturale [V: help.antarestech.com, manuale Realtime Advanced]. Valori alti lasciano passare più vibrato.
  *Come farlo con algoritmi aperti*: ogni 5-10 ms misuri l'altezza (pitch), calcoli la nota bersaglio e muovi il "pitch corrente" verso il bersaglio con un filtro a un polo (costante di tempo = Retune Speed). Poi cambi l'altezza con PSOLA. È la parte che hai già.
- **Humanize**: rende più lento il ritocco solo nella parte "tenuta" delle note lunghe, così non suonano statiche; le note corte restano precise. Si parte da 0 e si alza se le note lunghe sembrano robotiche [V]. *Realizzazione*: se la nota dura più di ~300 ms, dopo l'attacco aumenti la costante di tempo (idea tecnica nostra, non verificata sul funzionamento interno Antares).
- **Flex-Tune**: lascia passare scivolate e curve volute e corregge solo se si sta troppo lontani dalla nota. A 0 ogni nota va sul bersaglio; valori più alti restringono la zona corretta attorno alla nota. Solo in Modern mode; Classic lo disattiva [V]. *Realizzazione*: zona morta attorno alla nota: se la differenza è maggiore della soglia (in cent) correggi, altrimenti no.
- **Formant (Advanced)**: rende la voce più chiara o più scura senza cambiare nota [V]. Il manuale Realtime Advanced non descrive il controllo in dettaglio (non verificato i dettagli). *Realizzazione*: vedi punto 2 (formant shifting).
- **Throat Modeling / Throat Length**: è una funzione di Auto-Tune Pro 11 per la correzione dei formanti; le fonti trovate la citano solo per nome, quindi come funziona esattamente è **non verificato**.
- **Classic mode**: emula il suono di Auto-Tune 5: più brillante, attacco più marcato e passaggio di nota più "a gradino" [V]. Si realizza con un cambio di nota molto netto (poco smoothing) e un po' di brillantezza.
- **Auto-Key**: rileva tonalità maggiore o minore di un brano e la manda alle istanze di Auto-Tune [V]. *Realizzazione*: istogramma delle 12 note (chroma) pesato per durata, confronto con i profili maggiore/minore di Krumhansl (profili non verificati in questa ricerca).
- **Natural Vibrato / Create Vibrato**: aumenta/riduce il vibrato esistente o ne crea uno nuovo (con "Formant Amount" per variare anche i formanti) [V: manuale Realtime Advanced].

### Melodyne (Celemony)
- Modifica nota per nota: ogni nota è una "bolla" spostabile in altezza e tempo.
- **Pitch Modulation tool**: cambia il vibrato/le oscillazioni rapide (100% = originale, 0% = linea piatta, -100% = invertito). **Pitch Drift tool**: cambia le derive lente di altezza [V: helpcenter.celemony.com]. *Realizzazione*: separi la curva pitch in "centro nota" + oscillazione veloce + deriva lenta (filtri passa-basso/alto sulla curva) e ricombini con pesi diversi.
- **Timing tool**: sposta/allunga le note; doppio clic le porta alla posizione "intesa" rilevata; esiste "Add Random Deviations" per far sembrare due tracce due cantanti [V]. *Realizzazione*: time-stretch locale per nota (punto 4).
- **DNA (Direct Note Access)** e **tool Formant**: in questa ricerca non ho trovato una descrizione leggibile nelle fonti aperte: **non verificato**. (DNA lavora su accordi polifonici, non utile per una voce sola.)

## 2. Algoritmi e librerie aperte

| Algoritmo | Licenza | Su Safari iOS (WASM/JS) | Qualità / limiti | Costo su iPhone |
|---|---|---|---|---|
| YIN | libero (articolo de Cheveigné 2002; implementazioni varie, es. TarsosDSP) | JS puro facile | Buono su voce singola; sbaglia ottave in rumore | Basso |
| pYIN | implementazione di riferimento GPL-2.0 [V: github.com/c4dm/pyin]; richiesta di citare Queen Mary | Porting JS: non verificato; riscrivibile da zero dall'articolo | Più stabile di YIN, meno errori d'ottava; con "viterbi" serve guardare avanti | Medio, ok offline |
| McLeod (Pitchy) | 0BSD, nessuna restrizione [V: github.com/ianprime0509/pitchy] | JS puro, funziona ovunque | Ottimo per tempo reale monofonico; restituisce anche "clarity" 0-1 | Basso |
| CREPE | MIT [V: github.com/marl/crepe] | Esiste versione TF.js/ml5 (non verificato in dettaglio); modello grande | Molto accurato, passo 10 ms; 5 taglie (tiny...full) [V] | Alto: meglio offline o taglia tiny |
| WORLD (DIO/Harvest, CheapTrick, D4C) | BSD modificata, senza brevetti [V: github.com/mmorise/World] | WASM: non verificato | Analisi/risintesi di alta qualità, permette formanti e pitch separati; "metallico" se l'analisi sbaglia | Analisi pesante, solo offline |
| PSOLA / TD-PSOLA | algoritmo pubblico (licenza dipende dal codice) | JS puro (già nel progetto) | Ottimo per piccoli spostamenti su voce; artefatti se pitch errato o spostamenti >~ 5-7 semitoni (non verificato la soglia) | Basso-medio |
| Phase vocoder | libero | JS puro (AudioWorklet) | Voce "phasey"/riverberata; ok per effetti | Medio |
| Rubber Band | GPL, oppure licenza commerciale a pagamento [V: breakfastquay.com] | WASM esiste: rubberband-wasm, GPL-2.0 [V: github Daninet]; Safari iOS non verificato | Qualità alta, ha modo tempo reale e formant preservation (non verificato) | Il fornitore dice che gira in tempo reale da iPhone 4S in poi [V, parola del venditore]; un'altra pagina lo giudica troppo pesante per mobile [V: superpowered.com, fonte di un concorrente, data incerta]: da misurare |
| SoundTouch / SoundTouchJS | LGPL-2.1 [V: @soundtouchjs/core] | JS/AudioWorklet esistente [V] | Leggero, ma lavora nel tempo; gestisce male i transienti [V: pagina Superpowered]; voce parlata ok, canto più sporco | Basso |
| Formant shifting (LPC / cepstrum) | tecniche libere (articoli); codice da scrivere | JS puro fattibile | Cambia timbro "più grande/piccolo"; sopra ±4 semitoni suona artificiale (non verificato) | Medio |
| Armonizzatore | = pitch shift su più copie | JS | Meglio con PSOLA + formanti mantenuti | Basso per copia |
| Doubler/ADT | tecnica libera | Web Audio nativo (DelayNode + LFO) | Ottimo | Molto basso |
| De-esser, compressore, saturazione | tecniche libere; Web Audio ha DynamicsCompressorNode e WaveShaperNode | Nativi | De-esser = compressore su banda alta; saturazione con curva tanh | Molto basso |

AudioWorklet è supportato su iOS Safari dalla 14.5 [V: caniuse]. Attenzione: esiste un bug WebKit aperto (n. 244203, ultimo aggiornamento 2023) con campioni mancanti quando si registra tramite AudioWorklet e `postMessage` [V]; meglio registrare con MediaRecorder e fare l'elaborazione su file.

## 3. Catena vocale professionale

**Ordine**
- iZotope: pitch correction prima di tutto (su voce asciutta) → EQ → compressore → de-esser → delay/riverbero [V: izotope.com].
- Sound On Sound: pulizia (gate), EQ, compressione, saturazione, e pitch correction **dopo** dinamica ed EQ [V: soundonsound.com/techniques/vocal-processing].
- Le due fonti NON concordano sul posto dell'autotune. Raccomandazione per l'app: pulizia rumore → (correzione intonazione sulla voce pulita) → EQ sottrattivo → de-esser → compressore → saturazione → EQ di colore → doppie/armonie → delay → riverbero.

**Valori di partenza con fonte [V: Sound On Sound]**
- Compressore: 4:1 morbido, soglia circa -20 dB, circa 6 dB di riduzione massima, attacco veloce, rilascio ~250 ms; secondo stadio 8:1 solo sui picchi. iZotope: 3-7 dB di riduzione.
- De-esser: ~6 kHz voce maschile, ~7 kHz femminile; iZotope: sibilanti sopra 3 kHz.
- EQ: taglio sotto ~100 Hz; taglio di pochi dB tra 200 Hz e 1,5 kHz contro suono "scatolato"; +2-7 kHz presenza; ripiano da ~10 kHz per "aria".
- Saturazione: usarla con moderazione.
- ADT/doppia voce: delay 13-25 ms per delay (copia anticipata del doppio), 20-35 ms slapback, feedback 0, LFO 0,01-1 Hz con poca profondità [V: craiganderton.org, synchroarts.com].
- Delay stereo di allargamento: canali L/R sfalsati di 1/64, feedback 0, con filtri passa-alto e passa-basso sul delay; riverbero poco, con tagli di bassi e alti [V: izotope.com].

**Caratteri vocali (preset)**: per questi **non ho trovato fonti ufficiali con valori numerici**. Quelli sotto sono **punti di partenza non verificati**, da regolare con l'orecchio; l'unica base verificata è la scala di Retune Speed (0-5 ms robotico, 10-50 naturale):
- Naturale: Retune 30-50 ms, Humanize alto, intensità 40-60%.
- Melodico: Retune 15-25 ms, Humanize medio, vibrato originale.
- Robotico: Retune 0-5 ms, Humanize 0, vibrato azzerato, formanti fissi.
- Scuro / brillante: formanti -2/-3 e +2/+3 semitoni circa; EQ shelf basso o alto.
- Ruvido: saturazione più alta e compressione più forte.
- Morbido/atmosferico: compressione leggera, riverbero lungo con filtro, high-cut.
- Potente: compressione in serie, presenza 3-5 kHz.
- Vibrato controllato: Pitch Modulation 50-80%, o vibrato sintetico aggiunto.
- Armonie: copie a +3/+4/+7/-5 semitoni nella tonalità, volume basso, formanti mantenuti, ritardo casuale 10-30 ms.
- Doppie: vedi ADT. Sperimentali: pitch estremo, formanti invertiti, vocoder, ring-mod.

## 4. Correzione del timing
- **Time-stretch locale**: si accorcia o allunga ogni nota/sillaba (Melodyne fa così con le maniglie di tempo [V]). Con PSOLA/WSOLA si ripetono o saltano cicli di pitch; con phase vocoder o Rubber Band si ottiene qualità migliore su vocali lunghe.
- **Allineamento a una guida**: confronti le due registrazioni (guida e voce) con DTW (Dynamic Time Warping) su caratteristiche come MFCC o energia, e deformi il tempo della voce. Tecnica nota; strumento aperto da usare in browser: **non verificato**.
- Limiti: le consonanti (t, k, p) vanno spostate ma non allungate, altrimenti suonano "sciolte"; stretch oltre ~±20-30% degrada la qualità (non verificato, stima pratica); se la guida è sporca, il DTW sbaglia. Melodyne separa le note con il Separation Type tool, e quando non sono separate sposta solo l'inizio [V].

## 5. Tonalità e tempo reale su iPhone
- Latenza nei browser (misure su MacBook, non su iPhone): ~55-67 ms con le impostazioni predefinite, scende a ~14-19 ms disattivando echoCancellation, noiseSuppression, autoGainControl e richiedendo latencyHint 0 [V: jefftk.com]. Non ho trovato misure ufficiali su iPhone: **non verificato**. Il browser non può dire la latenza totale reale; con Bluetooth è molto più alta [V].
- Per cantare e sentirsi con effetto serve cuffie con cavo e latenza sotto ~20-30 ms (soglia non verificata). Con altoparlante, retroazione.
- Finestra di rilevamento: per scendere a ~80 Hz servono circa 2 periodi (~25 ms). La finestra minima è la latenza minima di pitch (stima matematica nostra).
- Raccomandazione: in tempo reale solo monitoraggio leggero (Pitchy + correzione veloce); la qualità vera si ottiene registrando e poi elaborando offline.

## Tabella: cosa fare ora

| Funzione | iPhone ora | Solo computer / dopo |
|---|---|---|
| Pitch detection McLeod/YIN | Sì | |
| Retune Speed / Humanize / Flex-Tune su PSOLA | Sì (offline su registrazione) | |
| Vibrato, armonie, doppie ADT | Sì | |
| EQ, compressore, de-esser, saturazione, delay, riverbero | Sì (Web Audio nativo) | |
| Formant shift LPC | Sì, con prove di CPU | |
| pYIN offline | Sì, riscritto in JS | |
| CREPE | Taglia tiny, offline | Full |
| Rubber Band WASM | Da provare; GPL: no vendita senza licenza | Sì |
| SoundTouch | Sì (LGPL, ok con regole) | |
| WORLD | No | Sì (analisi/risintesi) |
| Melodyne-DNA, Throat Modeling | No | Non replicabili ora |
| Allineamento DTW alla guida | Prova su clip brevi | Brani interi |

**Avviso licenze per la vendita**: Rubber Band (GPL/commerciale) e pYIN (GPL) impongono obblighi se vendi; SoundTouch è LGPL (obblighi più leggeri); Pitchy (0BSD), CREPE (MIT) e WORLD (BSD modificata) sono i più liberi [V]. Per vendere, preferire questi ultimi.

## Fonti
- https://help.antarestech.com/hc/en-us/articles/42858099043092
- https://media.uaudio.com/support/manuals/dd/Auto-Tune%20Realtime%20Advanced%20Manual.pdf
- https://helpcenter.celemony.com/M5/doc/melodyneStudio5/en/M5tour_ToolModulationDrift_2
- https://helpcenter.celemony.com/M5/doc/melodyneStudio5/en/M5tour_ToolTiming_2
- https://github.com/c4dm/pyin
- https://github.com/marl/crepe
- https://github.com/ianprime0509/pitchy
- https://github.com/mmorise/World
- https://breakfastquay.com/rubberband/why.html
- https://www.github.com/Daninet/rubberband-wasm
- https://cdn.jsdelivr.net/npm/@soundtouchjs/core@1.0.10/README.md
- https://superpowered.com/free-open-source-time-stretching-pitch-shifting
- https://www.izotope.com/en/learn/crafting-a-basic-vocal-chain
- https://www.soundonsound.com/techniques/vocal-processing
- https://craiganderton.org/a-truly-authentic-adt-automatic-double-tracking-effect-for-studio-mixing/
- https://www.synchroarts.com/posts/automatic-double-tracking
- https://caniuse.com/wf-audio-worklet
- https://bugs.webkit.org/show_bug.cgi?id=244203
- https://www.lesswrong.com/posts/ooXEzrX7Y9Go6D7st/browser-audio-latency (articolo di jefftk)
