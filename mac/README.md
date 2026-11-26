# Sultan Sound sul Mac — tutto locale, senza limiti, gratis

Un comando avvia **l'app** e il **motore che canta i tuoi testi** (ACE-Step 1.5, licenza MIT, canta in italiano) direttamente sul Mac.
Niente abbonamenti, niente chiavi, niente limiti giornalieri. I testi non escono dal Mac.

## Cosa serve
- Mac con chip Apple (M1/M2/M3/M4…), consigliati **16 GB** di memoria o più; ~15 GB liberi sul disco.
- Python 3.11 o 3.12 (python.org) · consigliato `ffmpeg` (con Homebrew: `brew install ffmpeg`).

## Avvio
1. Scarica il progetto (GitHub → Code → Download ZIP) e aprilo.
2. Apri il Terminale nella cartella e scrivi: `bash mac/avvia.sh`
3. La prima volta prepara tutto (scarica circa 6 GB): può volerci mezz'ora. Le volte dopo pochi secondi.
4. Si apre l'app su `http://localhost:8765`. In **1 Testo → Crea una base IA** scrivi nel riquadro dello spazio: `http://localhost:7860`.

## Cosa è provato (26/11, su un server Linux, non ancora su un Mac vero)
- La stessa catena dell'avvio sul Mac (app da `localhost:8765` → motore su `localhost:7860`): **funziona**, nessun errore, canzone cantata di 10 s generata in 21 s.
- Motore solo processore (senza scheda grafica): 15 s di canzone con voce italiana in 1-5 minuti secondo il carico. Sul Mac con la scheda grafica Apple (`SULTAN_DEVICE=auto` → MPS) dovrebbe essere più veloce: **da misurare sul tuo Mac**.

## Motori valutati per il Mac (licenze controllate nel repository ufficiale)
| Motore | Licenza | Italiano | Verdetto |
|---|---|---|---|
| **ACE-Step 1.5** | MIT (codice e pesi) | sì | **Usato**: canta i tuoi testi |
| DiffRhythm | Apache 2.0 | **no** (pronuncia solo cinese, inglese, francese, tedesco, coreano; usa espeak-ng, GPL) | Solo basi strumentali, eventualmente più avanti |
| YuE2 | codice Apache, **pesi CC BY-NC 4.0** (vietato uso commerciale) | — | **Non usare** (regola licenze) |
| YuE (prima versione) | Apache 2.0 secondo la scheda dei pesi | inglese/cinese/giapponese/coreano | Richiede ~24 GB di scheda grafica NVIDIA: non adatto al Mac |
