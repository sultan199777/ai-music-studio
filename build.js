/*
 * Assembla la pagina finale (dist/index.html) unendo l'interfaccia con i due
 * motori di calcolo. Prima di assemblare esegue tutti i test: se uno fallisce,
 * la pagina non viene creata.
 *
 * Uso:  node build.js
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const testFiles = fs.readdirSync(path.join(root, 'tests'))
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join('tests', f));

const run = cp.spawnSync(process.execPath, ['--test', ...testFiles], { cwd: root, encoding: 'utf8' });
const grab = (name) => {
  const m = run.stdout.match(new RegExp('^# ' + name + ' (\\d+)', 'm'));
  return m ? Number(m[1]) : NaN;
};
const total = grab('tests');
const passed = grab('pass');
const failed = grab('fail');

if (run.status !== 0 || failed > 0 || !(total > 0)) {
  console.error(run.stdout);
  console.error(run.stderr);
  console.error('Test falliti: pagina non creata.');
  process.exit(1);
}

const date = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
let html = read('src/app.shell.html');
const parts = {
  CSS: 'src/app.css', BODY: 'src/app.body.html', LYRICS_ENGINE: 'src/lyrics-engine.js', AUDIO_ANALYSIS: 'src/audio-analysis.js',
  KEY_DETECT: 'src/key-detect.js', FORMANT: 'src/formant.js' /* VOICE LAB */, VOICE_CHAIN: 'src/voice-chain.js', REALTIME: 'src/realtime-tune.js', VOICE_LAB: 'src/voice-lab.js', VOICE_LAB_CSS: 'src/voice-lab.css', AUTOTUNE: 'src/autotune.js', POLISH: 'src/polish.js', MASTER: 'src/master.js', BACKING: 'src/backing.js', SAMPLES: 'src/samples-data.js', INSTRUMENTS: 'src/instruments.js', SULTAN_BRAIN: 'src/sultan-brain.js', ARTIST_LAB: 'src/artist-lab.js', WORD_BANK: 'src/word-bank.js', TIMING: 'src/timing.js', SIG_FX: 'src/sig-fx.js', TASTE: 'src/taste.js', REMIX: 'src/remix.js', DNA: 'src/dna.js', ARCHIVE: 'src/archive.js', AUTO_SECTIONS: 'src/auto-sections.js', GUIDE_VOICE: 'src/guide-voice.js', PROD_FX: 'src/prod-fx.js', OMINO: 'src/omino.js', SULTAN_AI: 'src/sultan-ai.js', QUALITY: 'src/quality-check.js', BEAT_THIS: 'src/beat-this.js', LOCAL_AI: 'src/local-ai.js', SING_GUIDE: 'src/sing-guide.js', EAR: 'src/ear.js', SOUND_LAB: 'src/sound-lab.js', COACH: 'src/coach.js', SONG_MAP: 'src/song-map.js', BEAT_LEARN: 'src/beat-learn.js', AI_SEP: 'src/ai-separator.js', MIXER: 'src/mixer.js', CLIPS: 'src/clips.js', VOICE_FX: 'src/voice-fx.js', SYNTH_DESIGN: 'src/synth-design.js', MASTER_PRO: 'src/master-pro.js', STUDIO_AGENT: 'src/studio-agent.js', TRANSCRIBE: 'src/transcribe.js', STUDIO_AI: 'src/studio-ai.js', STYLE_PRESETS: 'src/style-presets.js', ARRANGER: 'src/arranger.js', STYLE_CARD: 'src/style-card.js',
  LYRICS_TO_BASE: 'src/lyrics-to-base.js', CLIP_FX: 'src/clip-fx.js', BASE_ANALYSIS: 'src/base-analysis.js', MANGA: 'src/manga-filter.js',
  PITCH_EDITOR: 'src/pitch-editor.js', VIDEO_IDEAS: 'src/video-ideas.js', PROMO: 'src/promo-plan.js', PRODUCER: 'src/producer-actions.js', APP: 'src/app.js'
};
// ---- Beat Lab (blocco aggiunto): file nuovi, stesso meccanismo ----
const BEATLAB_FILES = ['beatlab-voices', 'beatlab-engine', 'beatlab-patterns', 'beatlab-sampler', 'beatlab-theory', 'beatlab-mix', 'beatlab-midi', 'beatlab-store', 'beatlab-ui', 'beatlab-ui-inst', 'beatlab-ui-edit', 'beatlab-ui-mix', 'beatlab-boot'];
parts.BEATLAB_CSS = 'src/beatlab.css';
// ---- fine Beat Lab ----
for (const k of Object.keys(parts)) html = html.replace('/*__' + k + '__*/', () => read(parts[k]));
html = html.replace('/*__BEATLAB_JS__*/', () => BEATLAB_FILES.map((f) => `;(function(){\n/* ${f} */\n${read('src/' + f + '.js')}\n})();`).join('\n'));
html = html.replace('__TEST_SUMMARY__', () => `${passed} test automatici superati su ${total}`).replace('__BUILD_DATE__', () => date);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
console.log(`OK: dist/index.html (${Math.round(html.length / 1024)} KB), test ${passed}/${total}`);

// --- versione app (PWA): stessa app, ma con microfono, installabile e funzionante offline ---
const pwa = path.join(root, 'docs'); // GitHub Pages serve la cartella /docs
fs.mkdirSync(pwa, { recursive: true });
const shell = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#07070F"><link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icon-192.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Music Studio"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><style>:root{color-scheme:light}html{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${html}<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})})}</script></body></html>`;
const stamp = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
fs.writeFileSync(path.join(pwa, 'index.html'), shell.split('__BUILD__').join(stamp));
fs.writeFileSync(path.join(pwa, 'manifest.webmanifest'), JSON.stringify({ name: 'Sultan Sound', short_name: 'Sultan', start_url: './', scope: './', display: 'standalone', background_color: '#07070F', theme_color: '#07070F', lang: 'it', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] }, null, 1));
const ver = Date.now().toString(36);
fs.writeFileSync(path.join(pwa, 'sw.js'), `const V='studio-${ver}';const F=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(F)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x.indexOf('studio-')===0).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return iso(r)}).catch(()=>caches.match(e.request).then(m=>m?iso(m):caches.match('index.html').then(iso))))});
// isolamento (COOP/COEP): permette alla separazione AI di usare più processori in parallelo
function iso(r){if(!r||r.status===0)return r;const h=new Headers(r.headers);h.set('Cross-Origin-Opener-Policy','same-origin');h.set('Cross-Origin-Embedder-Policy','require-corp');h.set('Cross-Origin-Resource-Policy','same-origin');return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h})}
`);
fs.writeFileSync(path.join(pwa, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Permissions-Policy: microphone=(self), camera=(), geolocation=()\n/sw.js\n  Cache-Control: no-cache\n');
// strumenti a campioni: un file per strumento, caricato a richiesta (inst/<id>.json)
const instSrc = path.join(root, 'assets', 'inst'), instDst = path.join(pwa, 'inst');
fs.mkdirSync(instDst, { recursive: true });
let nInst = 0;
for (const f of fs.readdirSync(instSrc)) { fs.copyFileSync(path.join(instSrc, f), path.join(instDst, f)); nInst++; }
// separazione AI v2: unblend (MIT) + onnxruntime-web 1.26 (MIT), copiati com'erano (solo l'import di ORT reso relativo)
for (const d of ['unblend', 'ort126', 'tf']) fs.cpSync(path.join(root, 'assets', d), path.join(pwa, d), { recursive: true });
console.log('OK: docs/ (index.html, manifest, sw.js, _headers, ' + nInst + ' strumenti in inst/)');

// il numero di versione appare anche nella copia per l'artifact
{ const dp = path.join(root, 'dist', 'index.html'); fs.writeFileSync(dp, fs.readFileSync(dp, 'utf8').split('__BUILD__').join(stamp)); }
