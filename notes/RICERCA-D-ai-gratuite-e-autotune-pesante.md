# Ricerca D (24/11/2026): AI gratuite nell'app e autotune pesante
Etichette: dati dalle fonti = Misurato/riportato; scelte nostre = Ipotesi.

## Autotune pesante da trap (fonte: Antares, "Auto-Tune for Rap/Hip-Hop")
- Velocità: trap duro 0-5 ms; melodico 10-25; stile Future ~15-20 con molta compressione e saturazione; evitare 30-40 (suona "per caso"); ad-lib più duri della voce principale; doppie e armonie con 3-5 di differenza.
- Ordine catena: compressione (3-6 dB) PRIMA dell'autotune, poi EQ, delay, riverbero ULTIMO. Delay a quarti, 2-3 ripetizioni, 15-20% feedback; riverbero grande/plate scuro; saturazione a nastro/valvola; doppia spostata su un lato.
- Scala: cromatica = più libertà melodica; tonalità del brano = effetto più evidente. Flex-Tune spento per la trap.
- Implementato come caratteri: Trap scura pesante, Trap malinconica, Ad-lib duro, Drill freddo (voice-chain.js). Valori di partenza NON verificati a orecchio.

## AI gratuite nel browser (iPhone) - NON ancora integrate
- LLM piccoli con WebLLM/transformers.js: servono WebGPU (Safari 26 su iOS ok). Download al primo uso: SmolLM2 360M ~204 MB, Qwen3 0.6B ~335 MB, Gemma3 1B ~563 MB, Llama 3.2 1B ~695 MB. Rischi: limiti di memoria iPhone, il telefono rallenta, modelli piccoli deboli in italiano. Licenze da controllare modello per modello.
- Separazione voce/strumentale: demucs-web (MIT) ~172 MB ONNX, WebGPU poi WASM, richiede SharedArrayBuffer (intestazioni COOP/COEP: GitHub Pages non le imposta, serve un trucco con service worker). iOS Safari non confermato. È il lavoro dell'altra chat ("Impara da una base").
- Fonti: pinggy.io/blog/run_llm_in_browser_webgpu, github.com/timcsy/demucs-web, antarestech.com/blog/auto-tune-for-rap-hip-hop-how-trap-producers-use-pitch-correction
