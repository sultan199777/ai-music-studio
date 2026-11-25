#!/usr/bin/env python3
"""
Converte campioni CC0 (VSCO-2-CE e VCSL di Versilian Studios) in file leggeri
per l'app: mono, 22050 Hz, ADPCM IMA a 4 bit, in JSON (assets/inst/<id>.json).

Uso (serve ffmpeg e numpy; i repository vanno clonati prima, senza file):
  git clone --filter=blob:none --no-checkout --depth 1 https://github.com/sgossner/VSCO-2-CE.git vsco
  git clone --filter=blob:none --no-checkout --depth 1 https://github.com/sgossner/VCSL.git vcsl
  python3 tools/build-instruments.py <cartella con vsco e vcsl> [id ...]

L'altezza di ogni nota viene MISURATA (autocorrelazione) e confrontata col nome
del file: i due archivi usano convenzioni d'ottava diverse.
"""
import base64, json, os, re, subprocess, sys
import numpy as np

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'inst')
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

# id, repo, cartella, filtro (regex sul nome file), secondi, nota min, nota max, passo minimo (semitoni)
INSTR = [
    ('piano', 'vcsl', 'Chordophones/Zithers/Grand Piano, Steinway B/Sus/', r'_vl3_rr1', 2.2, 36, 96, 5),
    ('upright', 'vsco', 'Keys/Upright Piano/', r'dyn2_rr1', 2.4, 36, 96, 4),
    ('epiano', 'vcsl', 'Electrophones/TX81Z/FM Piano/', r'_vl2', 2.4, 36, 90, 5),
    ('clavi', 'vcsl', 'Electrophones/TX81Z/Clavisynth/', r'_vl2', 1.6, 36, 90, 5),
    ('organ', 'vsco', 'Keys/Organ/Quiet/', r'', 2.0, 36, 90, 5),
    ('harp', 'vcsl', 'Chordophones/Composite Chordophones/Concert Harp/', r'_mf1', 2.4, 36, 96, 4),
    ('dantranh', 'vcsl', 'Chordophones/Zithers/Dan Tranh/Normal/', r'_mf_1', 2.0, 40, 90, 4),
    ('violins', 'vsco', 'Strings/Violin Section/susVib/', r'v1|_1\.wav', 2.2, 55, 96, 4),
    ('violas', 'vsco', 'Strings/Viola Section/susvib/', r'', 2.2, 48, 84, 4),
    ('cellos', 'vsco', 'Strings/Cello Section/susvib/', r'', 2.2, 36, 76, 4),
    ('pizz', 'vsco', 'Strings/Violin Section/Pizz/', r'_v2_rr1', 1.0, 55, 96, 4),
    ('contrabass', 'vsco', 'Strings/Solo Contrabass/Pizz/', r'v2.*rr1|_rr1', 1.6, 28, 60, 4),
    ('flute', 'vsco', 'Woodwinds/Flute/susvib/', r'', 2.0, 60, 96, 4),
    ('clarinet', 'vsco', 'Woodwinds/Clarinet/susLong/', r'', 2.0, 50, 90, 4),
    ('oboe', 'vsco', 'Woodwinds/Oboe/Vib/', r'', 2.0, 58, 90, 4),
    ('sax', 'vcsl', 'Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato/', r'_vl3_rr1', 2.0, 44, 80, 4),
    ('trumpet', 'vsco', 'Brass/Trumpet/susvib/', r'', 2.0, 54, 84, 4),
    ('horn', 'vsco', 'Brass/F Horn/sus/', r'v2|_1\.wav', 2.0, 40, 77, 4),
    ('trombone', 'vsco', 'Brass/Tenor Trombone/sus/', r'', 2.0, 40, 72, 4),
    ('harmonica', 'vcsl', 'Aerophones/Free Aerophones/Harmonica-Hohner-Special20-C/Sustains/Normal/', r'', 1.8, 60, 90, 4),
    ('ocarina', 'vcsl', 'Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains/Sus/', r'', 1.8, 57, 84, 4),
    ('vibes', 'vcsl', 'Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/', r'rr1', 2.4, 53, 89, 4),
    ('marimba', 'vcsl', 'Idiophones/Struck Idiophones/Marimba/', r'_med_01', 1.4, 40, 96, 4),
    ('glock', 'vsco', 'Percussion/Glock/', r'', 2.0, 67, 108, 4),
    ('kalimba', 'vcsl', 'Idiophones/Plucked Idiophones/Kalimba, Tanzania/', r'rr2', 1.6, 40, 90, 3),
    ('balafon', 'vcsl', 'Idiophones/Struck Idiophones/Balafon/Soft Mallet/', r'_vl2_rr1', 1.2, 48, 90, 4),
    ('chimes', 'vcsl', 'Idiophones/Struck Idiophones/Hand Chimes/', r'_r01_main', 2.6, 48, 96, 4),
    ('bells', 'vcsl', 'Idiophones/Struck Idiophones/Tubular Bells 1/', r'_f_|_ff_', 2.6, 48, 84, 4),
    ('glass', 'vcsl', 'Idiophones/Friction Idiophones/Wine Glasses/Sustains/Fast/', r'', 2.4, 60, 90, 2),
    # 26/11: tavolozza trap/drill/dark (tutti CC0)
    ('harpsi', 'vcsl', 'Chordophones/Zithers/Harpsichord, English/Sustains/Normal/', r'_rr1', 2.0, 36, 90, 5),
    ('xylo', 'vcsl', 'Idiophones/Struck Idiophones/Xylophone/Medium Mallets/', r'_ff_', 1.4, 60, 96, 5),
    ('vibbow', 'vcsl', 'Idiophones/Struck Idiophones/Vibraphone/Bowed/', r'', 3.0, 45, 80, 3),
    ('vlnspic', 'vsco', 'Strings/Violin Section/Spic/', r'_v2_rr1', 0.6, 55, 96, 4),
    ('cellospic', 'vsco', 'Strings/Cello Section/spic/', r'_v2_RR1', 0.7, 36, 72, 4),
    ('vlntrem', 'vsco', 'Strings/Violin Section/Trem/', r'_v2', 2.2, 55, 96, 4),
    ('cellotrem', 'vsco', 'Strings/Cello Section/trem/', r'_v2_1', 2.2, 36, 72, 4),
    ('violin', 'vsco', 'Strings/Solo Violin/Arco Vib/', r'_f\.', 2.2, 55, 96, 4),
    ('bassarco', 'vsco', 'Strings/Solo Contrabass/SusVib/', r'_v3_rr1', 2.4, 28, 60, 4),
    ('tuba', 'vsco', 'Brass/Tuba/sus/', r'_v2_rr1', 2.0, 28, 60, 4),
    ('bassoon', 'vsco', 'Woodwinds/Bassoon/sus/', r'_v2_1', 2.0, 34, 72, 4),
    ('hornmute', 'vsco', 'Brass/F Horn/mute/', r'_v2_1', 1.8, 40, 77, 4),
    ('tbnstac', 'vsco', 'Brass/Tenor Trombone/stac/', r'_v2_rr1', 0.8, 40, 72, 4),
    ('pipeorgan', 'vcsl', 'Aerophones/Edge-blown Aerophones/Pipe Organ/Loud/', r'', 2.6, 33, 84, 5),
    ('psaltbow', 'vcsl', 'Chordophones/Zithers/Psaltery, Bowed and Plucked/LongBow/', r'', 2.6, 55, 90, 3),
    ('psaltpluck', 'vcsl', 'Chordophones/Zithers/Psaltery, Bowed and Plucked/Pluck/', r'', 1.6, 55, 90, 3),
    ('mbira', 'vcsl', 'Idiophones/Plucked Idiophones/Mbira dzaVadzimu Nyamaropa, Zimbabwe, Low B/', r'_rr1', 1.6, 40, 84, 4),
    ('kawai', 'vcsl', 'Chordophones/Zithers/Grand Piano, Kawai/Sustains/', r'_v3_rr1', 2.4, 33, 96, 5),
]


def names(repo_dir, prefix):
    out = subprocess.run(['git', '-C', repo_dir, 'ls-tree', '-r', '--name-only', 'HEAD', '--', prefix], capture_output=True, text=True, check=True).stdout
    return [l for l in out.splitlines() if l.lower().endswith('.wav') and '/'.join(l.split('/')[:-1]) + '/' == prefix]


def name_midi(fn):
    m = re.findall(r'(?<![A-Za-z])([A-G])(#|b)?(-?\d)(?!\d)', os.path.basename(fn))
    if not m:
        return None
    n, acc, octv = m[-1] if len(m) == 1 else m[0]
    return NOTE[n] + (1 if acc == '#' else -1 if acc == 'b' else 0) + 12 * (int(octv) + 1)


def load(repo_dir, path, sec):
    raw = subprocess.run(['git', '-C', repo_dir, 'show', 'HEAD:' + path], capture_output=True, check=True).stdout
    pcm = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', 'pipe:0', '-ac', '1', '-ar', str(SR), '-f', 's16le', 'pipe:1'], input=raw, capture_output=True, check=True).stdout
    x = np.frombuffer(pcm, dtype=np.int16).astype(np.float64) / 32768
    if len(x) == 0:
        return None
    thr = np.max(np.abs(x)) * 0.05
    start = int(np.argmax(np.abs(x) > thr))
    x = x[max(0, start - 40):]
    n = min(len(x), int(sec * SR))
    x = x[:n].copy()
    f = min(n, int(0.25 * SR))
    x[n - f:] *= np.linspace(1, 0, f) ** 2
    pk = np.max(np.abs(x))
    return x / pk * 0.89 if pk > 0 else None


def detect_midi(x):
    """Altezza misurata: autocorrelazione normalizzata su 0,2 s dopo l'attacco."""
    a = int(0.08 * SR)
    seg = x[a:a + int(0.2 * SR)]
    if len(seg) < 2000:
        seg = x[:int(0.2 * SR)]
    seg = seg - seg.mean()
    best, lag = 0, 0
    ac = np.correlate(seg, seg, 'full')[len(seg) - 1:]
    if ac[0] <= 0:
        return None
    ac = ac / ac[0]
    lo, hi = int(SR / 2200), int(SR / 40)
    for L in range(lo, min(hi, len(ac) - 1)):
        if ac[L] > best and ac[L] >= ac[L - 1] and ac[L] >= ac[L + 1]:
            best, lag = ac[L], L
            if best > 0.85:
                break
    if best < 0.45 or lag == 0:
        return None
    return 69 + 12 * np.log2(SR / lag / 440)


IMA_STEP = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767]
IMA_IDX = [-1, -1, -1, -1, 2, 4, 6, 8]


def ima_encode(x):
    s = np.clip(np.round(x * 32767), -32768, 32767).astype(int).tolist()
    pred, idx, out, nib = 0, 0, bytearray(), []
    for v in s:
        step = IMA_STEP[idx]
        d = v - pred
        code = 0
        if d < 0:
            code = 8
            d = -d
        diff = step >> 3
        if d >= step: code |= 4; d -= step; diff += step
        if d >= step >> 1: code |= 2; d -= step >> 1; diff += step >> 1
        if d >= step >> 2: code |= 1; diff += step >> 2
        pred = pred - diff if code & 8 else pred + diff
        pred = max(-32768, min(32767, pred))
        idx = max(0, min(88, idx + IMA_IDX[code & 7]))
        nib.append(code)
    if len(nib) % 2:
        nib.append(0)
    for i in range(0, len(nib), 2):
        out.append(nib[i] | (nib[i + 1] << 4))
    return bytes(out)


def build(base, spec):
    iid, repo, prefix, filt, sec, lo, hi, gap = spec
    rd = os.path.join(base, repo)
    files = [f for f in names(rd, prefix) if re.search(filt, os.path.basename(f))] if filt else names(rd, prefix)
    cand = {}
    for f in files:
        m = name_midi(f)
        if m is not None and m not in cand:
            cand[m] = f
    if not cand:  # nomi senza nota (es. Player_dyn2_rr1_000): si misura tutto
        cand = {i: f for i, f in enumerate(sorted(files))}
        numbered = True
    else:
        numbered = False
    notes, offs = [], []
    keys, last = [], -99
    for key in sorted(cand):  # si scaricano solo le note distanziate (risparmio di banda)
        if numbered or key - last >= gap:
            keys.append(key); last = key
    if numbered:
        keys = keys[::max(1, len(keys) // 16)]
    for key in keys:
        x = load(rd, cand[key], sec)
        if x is None:
            continue
        meas = detect_midi(x)
        if numbered:
            if meas is None:
                continue
            m = int(round(meas))
        else:
            m = key
            if meas is not None:
                off = round((meas - key) / 12) * 12
                if abs(meas - key - off) < 0.6:
                    offs.append(off)
        notes.append([m, x, meas])
    if not numbered and offs:
        off = max(set(offs), key=offs.count)
        for n in notes:
            n[0] += off
    sel, last = [], -99
    for m, x, meas in sorted(notes, key=lambda n: n[0]):
        if lo <= m <= hi and m - last >= gap:
            sel.append((m, x)); last = m
    data = {'id': iid, 'sr': SR, 'enc': 'ima', 'src': repo + ':' + prefix, 'license': 'CC0 1.0',
            'notes': [{'m': int(m), 'n': len(x), 'd': base64.b64encode(ima_encode(x)).decode()} for m, x in sel]}
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, iid + '.json'), 'w') as fh:
        json.dump(data, fh, separators=(',', ':'))
    size = os.path.getsize(os.path.join(OUT, iid + '.json'))
    print('%-10s %2d note %s  %d KB' % (iid, len(sel), [m for m, _ in sel], size // 1024), flush=True)


if __name__ == '__main__':
    base = sys.argv[1]
    only = set(sys.argv[2:])
    for spec in INSTR:
        if not only or spec[0] in only:
            try:
                build(base, spec)
            except Exception as e:  # uno strumento rotto non ferma gli altri
                print('ERRORE', spec[0], e, flush=True)
