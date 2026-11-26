# Sultan Sound — motore di BASI IA senza limiti (Hugging Face Space gratuito, solo CPU).
# Usa ACE-Step 1.5 (codice e pesi MIT, github/huggingface ACE-Step). Al primo avvio scarica il codice ufficiale
# e i pesi (circa 6 GB), poi usa mezza precisione (bfloat16) per stare nei 16 GB dello spazio gratuito.
# Misurato su 4 CPU: 30 s di base in 34-59 s, memoria massima 8,8 GB. Sullo spazio gratuito (2 CPU) circa il doppio.
import os, subprocess, sys, time, tempfile, glob, shutil
import gradio as gr

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ace")
if not os.path.exists(ROOT):
    subprocess.run(["git", "clone", "--depth", "1", "https://huggingface.co/spaces/ACE-Step/Ace-Step-v1.5", ROOT], check=True)
    hp = os.path.join(ROOT, "acestep", "handler.py"); src = open(hp).read()
    src = src.replace('self.dtype = torch.bfloat16 if device in ["cuda","xpu"] else torch.float32', 'self.dtype = torch.bfloat16')  # mezza precisione anche su CPU
    open(hp, "w").write(src)
sys.path.insert(0, ROOT)
import torch
torch.set_num_threads(os.cpu_count() or 2)
from huggingface_hub import snapshot_download
CK = os.path.join(ROOT, "checkpoints")
if not os.path.exists(os.path.join(CK, "acestep-v15-turbo")):
    snapshot_download("ACE-Step/Ace-Step1.5", allow_patterns=["acestep-v15-turbo/*", "vae/*", "Qwen3-Embedding-0.6B/*"], local_dir=CK)
from acestep.handler import AceStepHandler
from acestep.llm_inference import LLMHandler
from acestep.inference import GenerationParams, GenerationConfig, generate_music

H = AceStepHandler()
H.initialize_service(project_root=ROOT, config_path="acestep-v15-turbo", device="cpu", use_flash_attention=False, compile_model=False, offload_to_cpu=False, offload_dit_to_cpu=False)
LLM = LLMHandler()  # non caricato: niente «ragionamento» del modello linguistico (troppo pesante per la CPU gratuita)
OUT = os.path.join(tempfile.gettempdir(), "sultan-crea"); os.makedirs(OUT, exist_ok=True)

def crea(stile, testo="", bpm=0, durata=60, tonalita="", progress=gr.Progress()):
    for f in glob.glob(os.path.join(OUT, "*")):  # file vecchi di oltre 30 minuti
        if time.time() - os.path.getmtime(f) > 1800: os.remove(f)
    strum = not (testo or "").strip()
    p = GenerationParams(caption=(stile or "italian trap, instrumental")[:500], lyrics="[Instrumental]" if strum else testo[:4000], instrumental=strum,
                         bpm=int(bpm) if bpm and bpm > 30 else None, keyscale=tonalita or "", duration=float(max(10, min(180, durata))), inference_steps=8, thinking=False,
                         vocal_language="unknown" if strum else "it")
    progress(0.1, desc="Compongo")
    r = generate_music(H, LLM, p, GenerationConfig(batch_size=1, audio_format="mp3"), save_dir=OUT)
    if not getattr(r, "success", False): raise gr.Error(str(getattr(r, "error", "errore")))
    a = (r.audios or [None])[0]; path = a.get("path") if isinstance(a, dict) else a
    return path

def rifai(audio, inizio=0, fine=15, stile="", progress=gr.Progress()):
    """IDEA 3: rifà SOLO un pezzo della base (da «inizio» a «fine» secondi), il resto resta uguale (ACE-Step «repaint»)."""
    if not audio: raise gr.Error("Nessun audio")
    p = GenerationParams(task_type="repaint", src_audio=audio, repainting_start=float(inizio), repainting_end=float(fine), caption=(stile or "")[:500], lyrics="[Instrumental]", instrumental=True, inference_steps=8, thinking=False, vocal_language="unknown")
    progress(0.1, desc="Rifaccio il pezzo")
    r = generate_music(H, LLM, p, GenerationConfig(batch_size=1, audio_format="mp3"), save_dir=OUT)
    if not getattr(r, "success", False): raise gr.Error(str(getattr(r, "error", "errore")))
    a = (r.audios or [None])[0]; return a.get("path") if isinstance(a, dict) else a

demo_crea = gr.Interface(fn=crea, inputs=[gr.Textbox(label="Stile (es. dark italian trap, piano intro, 808)"), gr.Textbox(label="Testo (vuoto = base strumentale)"), gr.Number(value=0, label="BPM (0 = sceglie lui)"), gr.Number(value=60, label="Durata in secondi"), gr.Textbox(value="", label="Tonalità (es. A minor)")],
                    outputs=gr.File(label="Base"), title="Sultan Sound · basi IA", api_name="crea", concurrency_limit=1)
demo_rifai = gr.Interface(fn=rifai, inputs=[gr.File(label="Base"), gr.Number(value=0, label="Da (secondi)"), gr.Number(value=15, label="A (secondi)"), gr.Textbox(label="Stile del pezzo nuovo")], outputs=gr.File(label="Base rifatta"), title="Rifai un pezzo", api_name="rifai", concurrency_limit=1)
demo = gr.TabbedInterface([demo_crea, demo_rifai], ["Crea", "Rifai un pezzo"])
if __name__ == "__main__":
    demo.queue(max_size=8).launch()
