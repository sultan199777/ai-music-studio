#!/usr/bin/env python3
"""
Beat Lab - prepara i campioni CC0 (VSCO-2-CE, VCSL, stargate-sample-pack) per il sito.
Per ogni strumento: sceglie 1 campione ogni ~3-4 semitoni, lo converte in mono, toglie il silenzio iniziale,
lo accorcia, lo porta a un volume coerente, (per gli strumenti "tenuti") crea un loop senza click,
misura l'intonazione vera (autocorrelazione) e scrive docs/samples/manifest.json con i crediti.
Uso: python3 -I tools/beatlab-samples.py <cartella con VSCO-2-CE, VCSL, stargate-sample-pack> <docs/samples>
"""
import sys, os, re, json, subprocess, math, shutil
import numpy as np

SRC = sys.argv[1]; OUT = sys.argv[2]
SR = 32000          # strumenti
SR_DRUM = 44100
NOTE = {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def note_midi(name):
    m = re.search(r'(?<![A-Za-z])([A-G])(#|b)?(-?\d)(?!\d)', name)
    if not m: return None
    s = NOTE[m.group(1)] + (1 if m.group(2)=='#' else -1 if m.group(2)=='b' else 0)
    return 12*(int(m.group(3))+1) + s

def decode(path, sr):
    p = subprocess.run(['ffmpeg','-v','error','-i',path,'-ac','1','-ar',str(sr),'-f','f32le','-'], capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr.decode())
    return np.frombuffer(p.stdout, dtype=np.float32).copy()

def encode(x, sr, path, kbps):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    p = subprocess.run(['ffmpeg','-y','-v','error','-f','f32le','-ar',str(sr),'-ac','1','-i','-','-c:a','libmp3lame','-b:a',f'{kbps}k','-ar',str(sr),path], input=x.astype(np.float32).tobytes(), capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr.decode())

def trim_start(x, sr, thr_db=-48, pre=0.003):
    pk = np.max(np.abs(x)) + 1e-12; thr = pk * 10**(thr_db/20)
    i = int(np.argmax(np.abs(x) > thr)); i = max(0, i - int(pre*sr)); return x[i:]

def fade_out(x, sr, sec):
    n = min(len(x), int(sec*sr)); x = x.copy(); x[-n:] *= np.linspace(1,0,n)**2; return x

def rms_db(x):
    return 20*math.log10(math.sqrt(np.mean(x**2))+1e-12)

def detect_midi(x, sr, nominal):
    """altezza in note MIDI (decimale) o None. Finestra dopo l'attacco; picco di autocorrelazione piu' corto tra i forti."""
    st = int(0.12*sr); seg = x[st: st+int(0.45*sr)]
    if len(seg) < int(0.15*sr): seg = x[: int(0.45*sr)]
    seg = seg - np.mean(seg)
    if np.max(np.abs(seg)) < 1e-4: return None
    n = len(seg); f = np.fft.rfft(seg, 2*n); ac = np.fft.irfft(f*np.conj(f))[:n]
    # normalizzazione (NACF)
    cs = np.cumsum(seg**2); tot = cs[-1]
    norm = np.array([ (tot + (tot - cs[k-1] if k>0 else tot)) for k in range(n)]) if False else None
    lag_min = int(sr/4500); lag_max = min(n-2, int(sr/24))
    ac0 = ac[0]; r = ac[lag_min:lag_max]/ (ac0+1e-12)
    # pesa per la finestra triangolare per non favorire lag corti
    r = r * (n/(n-np.arange(lag_min,lag_max)))
    pm = np.max(r)
    if pm < 0.5: return None
    # primo massimo locale >= 0.9*pm
    cand = None
    for i in range(1, len(r)-1):
        if r[i] >= 0.9*pm and r[i] >= r[i-1] and r[i] >= r[i+1]: cand = i; break
    if cand is None: return None
    a,b,c = r[cand-1], r[cand], r[cand+1]; den = (a-2*b+c)
    off = 0.5*(a-c)/den if abs(den)>1e-12 else 0
    lag = lag_min + cand + off
    return 69 + 12*math.log2((sr/lag)/440.0)

def make_loop(x, sr, loop_start, xfade=0.22, pad=0.06):
    """Crossfade: la fine del loop sfuma verso il pezzo subito PRIMA dell'inizio del loop, poi si aggiunge un po' del materiale
    che segue l'inizio (pad) cosi' il loop regge anche con piccoli scarti del decoder. Ritorna (campione, inizio, fine)."""
    a = int(loop_start*sr); n = len(x); X = min(int(xfade*sr), a)
    y = x.copy()
    w = np.linspace(0,1,X)
    y[n-X:] = x[n-X:]*np.cos(w*np.pi/2) + x[a-X:a]*np.sin(w*np.pi/2)
    P = int(pad*sr); y = np.concatenate([y, x[a:a+P]])
    return y, a/sr, n/sr

# ---------------- elenco strumenti ----------------
V = 'VCSL'; C = 'VSCO-2-CE'
INSTR = [
 # id, nome italiano, gruppo, repo, cartella, regex file, preferenze (in ordine), maxlen s, sostenuto, rilascio s, guadagno, nota
 dict(id='piano', name='Pianoforte', group='Tastiere', repo=V, dir='Chordophones/Zithers/Grand Piano, Steinway B/NoSus', rx=r'_Close_', pref=['_vl3_','_vl2_'], maxlen=4.0, sustain=False, rel=0.35, gain=1.0, info='Pianoforte a coda Steinway B (VCSL), senza pedale, forza media'),
 dict(id='epiano', name='Piano elettrico (FM)', group='Tastiere', repo=V, dir='Electrophones/TX81Z/FM Piano', rx=r'', pref=['_vl2','_vl3'], maxlen=3.2, sustain=False, rel=0.3, gain=1.0, info='Sintetizzatore FM Yamaha TX81Z campionato (VCSL): suono tipo Rhodes/DX7'),
 dict(id='clavi', name='Clavisynth (tastiera pizzicata)', group='Tastiere', repo=V, dir='Electrophones/TX81Z/Clavisynth', rx=r'', pref=['_vl2','_vl3'], maxlen=2.5, sustain=False, rel=0.25, gain=1.0, info='TX81Z Clavisynth (VCSL)'),
 dict(id='organo', name='Organo a canne', group='Tastiere', repo=V, dir='Aerophones/Edge-blown Aerophones/Pipe Organ/Quiet', rx=r'Man3Quiet', pref=[''], maxlen=4.0, sustain=True, loop=1.2, rel=0.25, gain=0.9, info='Organo a canne (VCSL), registro piano'),
 dict(id='arpa', name='Arpa', group='Corde', repo=V, dir='Chordophones/Composite Chordophones/Concert Harp', rx=r'KSHarp', pref=['_mf1','_f1'], maxlen=3.5, sustain=False, rel=0.4, gain=1.0, info='Arpa da concerto (VCSL)'),
 dict(id='strum', name='Strumstick (simile a chitarra)', group='Corde', repo=V, dir='Chordophones/Composite Chordophones/Strumstick/Finger', rx=r'_Main_', pref=['_vl2_rr1','_vl2_','_vl3_'], maxlen=2.8, sustain=False, rel=0.25, gain=1.0, info='Strumstick a 3 corde pizzicata con le dita (VCSL). Non e\' una chitarra: e\' lo strumento a corde pizzicate piu\' vicino presente nei pacchetti CC0'),
 dict(id='basso', name='Basso (contrabbasso pizzicato)', group='Bassi', repo=C, dir='Strings/Solo Contrabass/Pizz', rx=r'', pref=['_v1_rr1','_v3_rr1','_rr1'], maxlen=2.4, sustain=False, rel=0.18, gain=1.1, mono=True, info='Contrabbasso solista pizzicato (VSCO 2 CE)'),
 dict(id='archi', name='Archi (violini sezione)', group='Archi', repo=C, dir='Strings/Violin Section/susVib', rx=r'', pref=['_v2','_v1'], maxlen=4.2, sustain=True, loop=1.4, rel=0.3, gain=1.0, info='Sezione di violini, tenuto con vibrato (VSCO 2 CE)'),
 dict(id='celli', name='Archi gravi (violoncelli sezione)', group='Archi', repo=C, dir='Strings/Cello Section/susvib', rx=r'', pref=['_v3_','_v1_'], maxlen=4.2, sustain=True, loop=1.4, rel=0.3, gain=1.0, info='Sezione di violoncelli, tenuto con vibrato (VSCO 2 CE)'),
 dict(id='corno', name='Ottoni: corno francese', group='Ottoni', repo=C, dir='Brass/F Horn/sus', rx=r'', pref=['_v2_','_v1_','_v3_'], maxlen=3.6, sustain=True, loop=1.1, rel=0.2, gain=1.0, info='Corno francese tenuto (VSCO 2 CE)'),
 dict(id='tromba', name='Ottoni: tromba', group='Ottoni', repo=C, dir='Brass/Trumpet/sus', rx=r'', pref=['_v3_','_v1_'], maxlen=3.2, sustain=True, loop=1.0, rel=0.15, gain=1.0, info='Tromba tenuta (VSCO 2 CE)'),
 dict(id='trombone', name='Ottoni: trombone', group='Ottoni', repo=C, dir='Brass/Tenor Trombone/sus', rx=r'', pref=['_v2_','_v3_','_v1_'], maxlen=3.6, sustain=True, loop=1.1, rel=0.2, gain=1.0, info='Trombone tenore tenuto (VSCO 2 CE)'),
 dict(id='flauto', name='Fiati: flauto', group='Fiati', repo=C, dir='Woodwinds/Flute/susvib', rx=r'', pref=['_1.wav'], maxlen=3.4, sustain=True, loop=1.0, rel=0.2, gain=1.0, info='Flauto traverso tenuto con vibrato (VSCO 2 CE)'),
 dict(id='clarinetto', name='Fiati: clarinetto', group='Fiati', repo=C, dir='Woodwinds/Clarinet/susLong', rx=r'', pref=[''], maxlen=3.6, sustain=True, loop=1.1, rel=0.2, gain=1.0, info='Clarinetto tenuto (VSCO 2 CE)'),
 dict(id='vibra', name='Vibrafono', group='Mallet', repo=V, dir='Idiophones/Struck Idiophones/Vibraphone/Soft Mallets', rx=r'', pref=['_v2_','_v1_'], maxlen=3.5, sustain=False, rel=0.5, gain=1.0, info='Vibrafono, mazze morbide (VCSL)'),
 dict(id='marimba', name='Marimba', group='Mallet', repo=V, dir='Idiophones/Struck Idiophones/Marimba', rx=r'Outrigger', pref=['_med_','_loud_','_soft_'], maxlen=2.2, sustain=False, rel=0.25, gain=1.0, info='Marimba (VCSL)'),
 dict(id='campane', name='Campane tubolari', group='Mallet', repo=V, dir='Idiophones/Struck Idiophones/Tubular Bells 1', rx=r'', pref=['_f_','_ff_','_pp_'], maxlen=4.5, sustain=False, rel=0.8, gain=0.9, info='Campane tubolari (VCSL): buone per atmosfere cupe e cinematografiche'),
 dict(id='carillon', name='Carillon (glockenspiel)', group='Mallet', repo=V, dir='Idiophones/Struck Idiophones/Glockenspiel', rx=r'glock_loud', pref=[''], maxlen=3.0, sustain=False, rel=0.6, gain=0.9, info='Glockenspiel (VCSL)'),
 dict(id='chimes', name='Campanelle a mano', group='Mallet', repo=V, dir='Idiophones/Struck Idiophones/Hand Chimes', rx=r'sus_', pref=['_r01_'], maxlen=3.5, sustain=False, rel=0.8, gain=0.9, info='Hand chimes (VCSL)'),
]
def spaced(notes, gap=3, maxgap=5):
    """sceglie le note in modo che la distanza fra campioni vicini sia circa 'gap' (mai oltre il possibile)"""
    notes = sorted(set(notes)); out = [notes[0]]
    for i,n in enumerate(notes[1:], 1):
        if n - out[-1] >= gap: out.append(n)
        elif i == len(notes)-1 and n != out[-1]: out.append(n)
    return out

def list_repo(repo):
    return [l.rstrip('\n') for l in open(os.path.join(SRC, repo + '.list'))]

def main():
    os.makedirs(OUT, exist_ok=True)
    lists = {r: list_repo(r) for r in (V, C)}
    manifest = {'v': 1, 'sr': SR, 'instruments': {}, 'kits': {}, 'sources': {
        'VSCO-2-CE': {'url': 'https://github.com/sgossner/VSCO-2-CE', 'license': 'CC0-1.0'},
        'VCSL': {'url': 'https://github.com/sgossner/VCSL', 'license': 'CC0-1.0'},
        'stargate-sample-pack': {'url': 'https://github.com/stargatedaw/stargate-sample-pack', 'license': 'CC0-1.0'}}}
    report = []
    sel_all = []
    for I in INSTR:
        files = [f for f in lists[I['repo']] if f.startswith(I['dir'] + '/') and f.lower().endswith('.wav') and re.search(I['rx'], f)]
        bynote = {}
        for f in files:
            n = note_midi(os.path.basename(f))
            if n is None: continue
            score = 99
            for k, tok in enumerate(I['pref']):
                if tok in f: score = k; break
            if f in bynote.get(n, (99, None))[1:]: continue
            if n not in bynote or score < bynote[n][0]: bynote[n] = (score, f)
        notes = spaced(list(bynote.keys()))
        I['_sel'] = [(n, bynote[n][1]) for n in notes]
        sel_all += [(I['repo'], f) for _, f in I['_sel']]
        print(I['id'], len(files), 'file ->', len(notes), 'scelti', notes[0], '..', notes[-1])
    open(os.path.join(OUT, '_selection.txt'), 'w').write('\n'.join(r + '\t' + f for r, f in sel_all))
    json.dump(manifest, open(os.path.join(OUT, '_partial.json'), 'w'))

if __name__ == '__main__':
    if len(sys.argv) > 3 and sys.argv[3] == 'select': main()
    else:
        exec(open(os.path.join(os.path.dirname(__file__), 'beatlab-samples-convert.py')).read())
