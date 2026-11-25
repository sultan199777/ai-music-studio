# Il tuo spazio di separazione su Hugging Face (gratis, dall'iPhone)

Serve una volta sola, circa 10 minuti. Non costa niente e non chiede carte di credito.

1. Apri **huggingface.co** in Safari → **Sign up** (account gratuito, conferma l'email).
2. In alto a destra tocca la tua foto → **New Space**.
   - Space name: `sultan-separa`
   - License: **mit**
   - SDK: **Gradio**
   - Hardware: **CPU basic · FREE**
   - Visibilità: **Public**
   - Tocca **Create Space**.
3. Nello spazio tocca **Files** → **+ Add file** → **Create a new file**, tre volte:
   - nome `app.py`: incolla tutto il testo di https://raw.githubusercontent.com/sultan199777/ai-music-studio/main/space/app.py
   - nome `requirements.txt`: incolla https://raw.githubusercontent.com/sultan199777/ai-music-studio/main/space/requirements.txt
   - nome `packages.txt`: scrivi solo `ffmpeg`
   - ogni volta tocca **Commit new file**.
   (Per copiare: apri il link, tieni premuto sul testo → Seleziona tutto → Copia.)
4. Aspetta che in alto compaia **Running** (la prima volta 5-10 minuti).
5. Nell'app: **Libreria → Impara da una base → Dove separo → Sul mio spazio Hugging Face**,
   nome dello spazio: `tuonome/sultan-separa` (tuonome = il nome del tuo account).
6. Carica il video. La prima volta dopo una pausa lo spazio si "sveglia" in 1-3 minuti.

Note
- Il video va al tuo spazio, che lo divide e non conserva nulla (file temporanei cancellati dopo 30 minuti).
- Modelli: htdemucs (Meta, MIT) e Mel-Band RoFormer di Kimberley Jensen (MIT, scheda del modello su Hugging Face). Libreria audio-separator (MIT).
- Lo spazio gratuito si addormenta dopo un po' senza uso: è normale.
