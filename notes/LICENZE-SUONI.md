# Suoni di batteria (campioni)
Cassa, rullante, clap e hi-hat vengono dal pacchetto "stargate-sample-pack" (https://github.com/stargatedaw/stargate-sample-pack), licenza CC0 1.0 (pubblico dominio, uso libero anche commerciale, nessuna attribuzione obbligatoria).
- Casse e hi-hat: cartella `stargate` (sintetizzati dal team Stargate DAW).
- Rulli e clap: cartella `freesound` (README: tutti CC0; autori nei nomi file: yellowtree, alexthegr81, sami-kullstrom, toxicfilmzsrsounds, bastianpusch).
Convertiti in mono 22,05 kHz, accorciati e normalizzati (src/samples-data.js).

# Strumenti melodici (campioni)
29 strumenti da VSCO 2 Community Edition (https://github.com/sgossner/VSCO-2-CE) e VCSL (https://github.com/sgossner/VCSL) di Versilian Studios, licenza CC0 1.0. Note scelte ogni 3-6 semitoni, mono 22 050 Hz, ADPCM IMA 4 bit, in assets/inst/<id>.json (sito: docs/inst/). Generati con tools/build-instruments.py (altezza di ogni nota misurata).
Chitarre (acustica, classica, elettrica pulita): sintetizzate (Karplus-Strong), nessun campione.
