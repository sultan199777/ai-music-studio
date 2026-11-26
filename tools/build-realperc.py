#!/usr/bin/env python3
"""
Colpi VERI (registrati) per batteria, percussioni ed effetti: VCSL e VSCO-2-CE di Versilian Studios, licenza CC0.
Uscita: assets/inst/realperc.json  {id: [{n, d}]} — mono 22050 Hz, ADPCM IMA (come gli strumenti), normalizzati.
Uso: python3 tools/build-realperc.py <cartella con vcsl e vsco clonati senza file (git --filter=blob:none)>
"""
import base64, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
import importlib.util
spec = importlib.util.spec_from_file_location('bi', os.path.join(os.path.dirname(__file__), 'build-instruments.py'))
bi = importlib.util.module_from_spec(spec); spec.loader.exec_module(bi)
import numpy as np

# id, repo, cartella, filtro sul nome, quanti file, secondi massimi
PACK = [
    ('clap', 'vcsl', 'Idiophones/Struck Idiophones/Claps/', r'Clap_rr', 4, 0.5),
    ('hatc', 'vcsl', 'Idiophones/Struck Idiophones/Hi-Hat Cymbal/', r'HiHat_HitC_v3', 3, 0.35),
    ('hato', 'vcsl', 'Idiophones/Struck Idiophones/Hi-Hat Cymbal/', r'HiHat_HitO_', 2, 1.2),
    ('snare', 'vcsl', 'Membranophones/Struck Membranophones/Snare Drum, Modern 1/', r'HitSN_v7', 2, 0.6),
    ('snare2', 'vcsl', 'Membranophones/Struck Membranophones/Snare Drum, Modern 2/', r'HitNS_v4', 2, 0.6),
    ('rim', 'vcsl', 'Membranophones/Struck Membranophones/Snare Drum, Modern 1/', r'stick_v1', 2, 0.3),
    ('shaker', 'vcsl', 'Idiophones/Struck Idiophones/Shaker, Small/', r'Down_rr|Up_rr', 4, 0.35),
    ('tamb', 'vcsl', 'Idiophones/Struck Idiophones/Tambourine 1/', r'_Hit_', 2, 0.6),
    ('conga', 'vcsl', 'Membranophones/Struck Membranophones/Conga/', r'v2_rr', 3, 0.6),
    ('bongo', 'vcsl', 'Membranophones/Struck Membranophones/Bongos/', r'v2_rr', 3, 0.4),
    ('cajon', 'vcsl', 'Idiophones/Struck Idiophones/Cajon/', r'_f_rr', 3, 0.6),
    ('cowbell', 'vcsl', 'Idiophones/Struck Idiophones/Cowbells/', r'Hit_v3', 1, 0.6),
    ('claves', 'vcsl', 'Idiophones/Struck Idiophones/Claves/', r'Hit_v2', 1, 0.4),
    ('tom', 'vcsl', 'Membranophones/Struck Membranophones/Tom 1/Stick/', r'v3_rr', 2, 0.8),
    ('bdrum', 'vcsl', 'Membranophones/Struck Membranophones/Bass Drum 1/', r'hit_v3', 2, 2.5),
    ('crash', 'vcsl', 'Idiophones/Struck Idiophones/Suspended Cymbal 1/', r'hit_f1', 1, 3.0),
    ('swell', 'vcsl', 'Idiophones/Struck Idiophones/Suspended Cymbal 1/', r'cresc_2s|cresc_4s', 2, 4.5),
    ('ocean', 'vcsl', 'Membranophones/Other Membranophones/Ocean Drum/', r'Sus_', 2, 8.0),
    ('timp', 'vsco', 'Percussion/Timpani/', r'Roll_v5', 2, 4.0),
]

def build(base):
    out, credits = {}, []
    for iid, repo, prefix, filt, count, sec in PACK:
        rd = os.path.join(base, repo)
        files = [f for f in bi.names(rd, prefix) if re.search(filt, os.path.basename(f))][:count]
        hits = []
        for f in files:
            x = bi.load(rd, f, sec)
            if x is None: continue
            pk = float(np.max(np.abs(x))) or 1.0
            x = (x / pk * 0.9).astype(np.float64)
            hits.append({'n': len(x), 'd': base64.b64encode(bi.ima_encode(x)).decode()})
        out[iid] = hits
        print('%-8s %d colpi' % (iid, len(hits)), flush=True)
    data = {'sr': bi.SR, 'enc': 'ima', 'license': 'CC0 1.0 (VCSL, VSCO-2-CE, Versilian Studios)', 'hits': out}
    p = os.path.join(bi.OUT, 'realperc.json')
    with open(p, 'w') as fh: json.dump(data, fh, separators=(',', ':'))
    print('scritto', p, os.path.getsize(p) // 1024, 'KB')

if __name__ == '__main__':
    build(sys.argv[1])
