# AI Music Intelligence Studio, Fase 1

Prototipo locale: gira nel browser, non usa server, non spende denaro.

## Cosa contiene

Motori di calcolo (puri, testati, in `src/`):
- `lyrics-engine.js` analisi testi · `audio-analysis.js` voce · `key-detect.js` tonalità · `autotune.js` correzione, armonia, spostamento
- `polish.js` riduzione rumore, EQ, compressore, riverbero, eco · `backing.js` basi sintetiche · `lyrics-to-base.js` base consigliata dal testo
- `base-analysis.js` velocità e tonalità di una base importata · `clip-fx.js` effetti a tempo · `manga-filter.js` cartone/neon/manga
- `promo-plan.js` piano di 30 giorni · `producer-actions.js` comandi dell'AI Producer

Interfaccia: `app.shell.html`, `app.css`, `app.body.html`, `app.js` (10 sezioni, pensata per iPhone).
`tests/`: 84 test automatici. `build.js`: esegue i test e assembla `dist/index.html`.
`docs/ARCHITETTURA.md`: architettura completa e fasi.

## Limiti dichiarati
Niente microfono nella pagina (si importa da Memo Vocali); niente correzione del tempo né separazione tracce; niente voce clonata, personaggio animato 3D o pubblicazione automatica sui social (servono servizi esterni).

## Come vedere il risultato

Apri `dist/index.html` nel browser (doppio clic). Funziona anche senza internet, ma i caratteri tornano quelli di sistema.

## Come eseguire i test

Serve Node.js (versione 20 o più recente).

```
node --test tests/*.test.js
```

## Come rigenerare la pagina dopo una modifica

```
node build.js
```

Se un test fallisce la pagina non viene creata.
