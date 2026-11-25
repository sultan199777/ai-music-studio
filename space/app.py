# Sultan Sound — motore di separazione (Hugging Face Space gratuito, CPU).
# Riceve un video o un audio dall'app sull'iPhone, separa voce, batteria, basso e resto, e li restituisce.
# Modelli (licenza MIT): htdemucs (veloce, 4 tracce) e Mel-Band RoFormer (voce più pulita) tramite audio-separator (MIT).
# Parole: faster-whisper (MIT) con il modello Whisper small (MIT), sulla voce separata.
# Nessun file viene conservato: tutto sta in una cartella temporanea cancellata alla fine.
import os, shutil, subprocess, tempfile, glob
import gradio as gr
from audio_separator.separator import Separator

MAX_SEC = 360  # al massimo 6 minuti di audio per richiesta
_seps = {}

def _sep(model, out):
    s = Separator(output_dir=out, output_format="MP3")
    s.load_model(model_filename=model)
    return s

def _pick(files, name):
    for f in files:
        if "(" + name + ")" in os.path.basename(f).lower():
            return f
    return None

def separa(file, modo="veloce", parole=True, lingua="it", progress=gr.Progress()):
    if not file:
        raise gr.Error("Nessun file ricevuto")
    _pulisci()
    work = tempfile.mkdtemp(prefix="sultan-")
    if True:
        wav = os.path.join(work, "in.wav")
        progress(0.02, desc="Estraggo l'audio")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", file, "-t", str(MAX_SEC), "-vn", "-ac", "2", "-ar", "44100", wav], check=True)
        out = os.path.join(work, "out"); os.makedirs(out)
        voce = None; base_in = wav
        if modo == "pulita":
            progress(0.1, desc="Estraggo la voce (Mel-Band RoFormer)")
            files = [os.path.join(out, f) for f in _sep("vocals_mel_band_roformer.ckpt", out).separate(wav)]
            voce = _pick(files, "vocals"); base_in = _pick(files, "other") or _pick(files, "instrumental")
        progress(0.5 if modo == "pulita" else 0.1, desc="Divido batteria, basso e resto (htdemucs)")
        files = [os.path.join(out, f) for f in _sep("htdemucs.yaml", out).separate(base_in)]
        drums, bass, other, v2 = _pick(files, "drums"), _pick(files, "bass"), _pick(files, "other"), _pick(files, "vocals")
        if voce is None:
            voce = v2
        testo = {"lines": [], "text": ""}
        if parole and voce:
            progress(0.92, desc="Trascrivo le parole (Whisper)")
            try:
                testo = _trascrivi(voce, lingua or "it")
            except Exception as e:  # le parole sono un di più: se falliscono, le tracce arrivano lo stesso
                testo = {"lines": [], "text": "", "errore": str(e)[:200]}
        progress(1, desc="Fatto")
        return voce, drums, bass, other, testo

_wh = {}
def _trascrivi(path, lingua):
    from faster_whisper import WhisperModel  # MIT
    if "m" not in _wh:
        _wh["m"] = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = _wh["m"].transcribe(path, language=lingua, vad_filter=True, beam_size=1)
    lines = [{"t0": round(s.start, 2), "t1": round(s.end, 2), "text": s.text.strip()} for s in segs if s.text.strip()]
    return {"lines": lines, "text": "\n".join(l["text"] for l in lines)}

def _pulisci():
    # le cartelle di lavoro più vecchie di 30 minuti si cancellano (gradio ha già consegnato i file)
    import time
    for d in glob.glob(os.path.join(tempfile.gettempdir(), "sultan-*")):
        try:
            if time.time() - os.path.getmtime(d) > 1800:
                shutil.rmtree(d, ignore_errors=True)
        except OSError:
            pass

demo = gr.Interface(
    fn=separa,
    inputs=[gr.File(label="Video o audio"), gr.Radio(["veloce", "pulita"], value="veloce", label="Modo"), gr.Checkbox(value=True, label="Trascrivi le parole"), gr.Textbox(value="it", label="Lingua")],
    outputs=[gr.File(label="Voce"), gr.File(label="Batteria"), gr.File(label="Basso"), gr.File(label="Resto"), gr.JSON(label="Parole")],
    title="Sultan Sound · separazione",
    description="Motore di separazione per l'app Sultan Sound. Carica un video o un audio: escono voce, batteria, basso e resto.",
    api_name="separa",
    concurrency_limit=1,
)

if __name__ == "__main__":
    demo.queue(max_size=8).launch()
