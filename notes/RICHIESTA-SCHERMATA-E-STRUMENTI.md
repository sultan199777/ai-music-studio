# Richiesta dell'utente per la chat B (24/11/2026, sera) — priorità alta

## 1. Schermata nuova: pulita, semplice, moderna, stimolante
Problema detto dall'utente: "troppi tasti, troppe cose, non sono chiari, è confusionale". Vuole struttura visiva delineata, funzionale, semplice, moderna.
- Un flusso a 4 passi ben visibili: **1 Testo → 2 Base → 3 Canta → 4 Mix/Esporta**. Un passo alla volta in primo piano; il resto in "Avanzate" chiuso.
- Per ogni passo MAX 1-2 tasti grandi (azione principale) e il resto nascosto sotto "Altre opzioni". Etichette in italiano semplice, niente gergo.
- Tasti principali oggi: #sb-make (crea dal testo), #sb-six (proposte), #b-play (crea e ascolta), #b-mel (cambia melodia), #rec-go/#rec-live (Mic 1 / Mic 2), #sg-go (guida al canto), #ai-on (assistente).
- NON cambiare gli id né gli attributi data-*: si possono spostare e ridisegnare. Poi `node tools/mappa.js`.
- Prima prova: iPhone (Safari), poi computer. Test con screenshot reali.

## 2. Sfondo che segue l'emozione, mentre canta
- Mentre la base suona / l'utente canta, lo sfondo cambia colore con l'umore (es. rosso = rabbia/aggressivo, blu scuro = malinconico, viola = dark, oro/arancio = euforico, rosa = romantico, grigio-verde = nostalgico).
- Dato disponibile: `cur().moodTarget` (umore scelto dal Cervello) e `Ear.moodOf(...)` (umore misurato). Hook: A ha messo `document.body.dataset.mood` (vedi app.js, funzione applyMoodBg): B decide colori e animazione in CSS usando `body[data-mood="..."]`.
- Deve restare leggibile (contrasto) e non pesare sulla batteria: gradiente CSS, niente canvas pesanti.

## 3. Più strumenti
Oggi: 29 strumenti campionati (CC0) + sintesi. Pochi perché ogni strumento reale pesa e va scaricato sul telefono, e servono licenze libere.
Fonti libere da usare (verificare LICENSE di ognuna, solo CC0/CC-BY/MIT/Apache, MAI GPL o CC BY-NC/SA):
- VCSL (Versilian Community Sample Library, CC0): https://github.com/sgossner/VCSL — già usato in parte (VSCO-2-CE).
- sfzinstruments (raccolta di strumenti SFZ con licenze indicate): https://sfzinstruments.github.io/pianos e https://sfzinstruments.github.io/misc
- Altre fonti libere: FreePats, Salamander Piano (CC-BY, serve credito) — controllare caso per caso.
Metodo: scaricare solo poche note per strumento (una ogni terza) e ricavare le altre con trasposizione; mono 22 kHz; caricamento a richiesta (non tutto all'avvio). Obiettivo: 100+ strumenti, organizzati per famiglia (tasti, chitarre, archi, fiati scuri, bassi, percussioni, synth, voci/cori, suoni FX). Escludere i fiati "da bambini" (flauto, ocarina) dai preset trap; tenerli disponibili a mano.
Aggiornare notes/LICENZE-SUONI.md per ogni libreria aggiunta.
