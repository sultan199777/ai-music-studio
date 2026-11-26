#!/bin/bash
# Sultan Sound sul Mac: un solo comando avvia l'app (http://localhost:8765) e il motore ACE-Step (porta 7860).
# Prima volta: crea l'ambiente Python e scarica ACE-Step (~6 GB). Poi parte in pochi secondi. Tutto gratis e locale.
set -e
cd "$(dirname "$0")/.."
command -v python3 >/dev/null || { echo "Serve Python 3.11 o 3.12: installalo da https://www.python.org/downloads/macos/"; exit 1; }
command -v ffmpeg >/dev/null || echo "Consiglio: installa ffmpeg (brew install ffmpeg) per leggere più formati audio."
if [ ! -d mac/.venv ]; then
  echo "Prima volta: preparo l'ambiente (qualche minuto)…"
  python3 -m venv mac/.venv
  mac/.venv/bin/pip install --upgrade pip
  mac/.venv/bin/pip install -r mac/requirements-mac.txt
fi
echo "Avvio il motore ACE-Step (la prima volta scarica i pesi, ~6 GB)…"
SULTAN_DEVICE=auto SULTAN_HOST=127.0.0.1 SULTAN_PORT=7860 mac/.venv/bin/python space-crea/app.py > mac/motore.log 2>&1 &
MOTORE=$!
trap 'kill $MOTORE 2>/dev/null' EXIT
python3 -m http.server 8765 --bind 127.0.0.1 -d docs > /dev/null 2>&1 &
APP=$!
trap 'kill $MOTORE $APP 2>/dev/null' EXIT
sleep 2; open "http://localhost:8765/" 2>/dev/null || true
echo ""
echo "App: http://localhost:8765  ·  Nel riquadro «Il tuo spazio basi IA» scrivi:  http://localhost:7860"
echo "Il motore è pronto quando in mac/motore.log compare «Running on local URL». Chiudi questa finestra per spegnere tutto."
wait $MOTORE
