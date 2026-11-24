# (eseguito da beatlab-samples.py) conversione vera e propria
def convert():
    os.makedirs(OUT, exist_ok=True)
    lists = {r: list_repo(r) for r in (V, C)}
    manifest = {'v': 1, 'sr': SR, 'instruments': {}, 'kits': {}, 'sources': {
        'VSCO-2-CE': {'url': 'https://github.com/sgossner/VSCO-2-CE', 'license': 'CC0-1.0'},
        'VCSL': {'url': 'https://github.com/sgossner/VCSL', 'license': 'CC0-1.0'},
        'stargate-sample-pack': {'url': 'https://github.com/stargatedaw/stargate-sample-pack', 'license': 'CC0-1.0'}}}
    flagged = []; total = 0
    for I in INSTR:
        files = [f for f in lists[I['repo']] if f.startswith(I['dir'] + '/') and f.lower().endswith('.wav') and re.search(I['rx'], f)]
        bynote = {}
        for f in files:
            n = note_midi(os.path.basename(f))
            if n is None: continue
            score = 99
            for k, tok in enumerate(I['pref']):
                if tok in f: score = k; break
            if n not in bynote or score < bynote[n][0]: bynote[n] = (score, f)
        notes = spaced(list(bynote.keys()))
        samples = []; seen = set()
        pre = []
        for n in notes:
            f = bynote[n][1]; src = os.path.join(SRC, I['repo'], f)
            x = decode(src, SR); x = trim_start(x, SR)
            pre.append((n, f, x, detect_midi(x, SR, n)))
        # i nomi dei file usano a volte un'ottava diversa dalla mia (do centrale = C3 o C4): la misura decide, per tutto lo strumento
        ks = [round((d - n)/12) for (n, f, x, d) in pre if d is not None and abs((d - n) - 12*round((d - n)/12)) < 0.35]
        K = max(set(ks), key=ks.count) if ks else 0
        for (n, f, x, det) in pre:
            root = n + 12*K; cents = 0; note = ''
            if det is not None and abs((det - root)) < 0.6: cents = (det - root)*100
            elif det is not None and abs((det - n - 12*round((det - n)/12))) < 0.35 and round((det - n)/12) != K: note = 'ottava diversa dalla maggioranza, uso quella dello strumento'
            else: note = 'altezza non verificabile: assunta come le altre dello strumento'
            if note: flagged.append((I['id'], n, note))
            if abs(cents) > 60: cents = 0
            x = x[: int(I['maxlen']*SR)]
            ls = le = None
            if I.get('sustain'):
                lp = I['loop']
                if len(x)/SR < lp + 1.0: lp = 0.4*len(x)/SR
                g = 10**((-20 - rms_db(x[: int(0.6*SR)]))/20)
                y, ls, le = make_loop(x * g, SR, lp)
            else:
                x = fade_out(x, SR, min(0.5, 0.2*len(x)/SR + 0.05))
                g = 10**((-20 - rms_db(x[: int(0.6*SR)]))/20); y = x * g
            pk = np.max(np.abs(y)) + 1e-9
            if pk > 0.9: y = y * (0.9/pk)
            if root in seen: continue
            seen.add(root)
            rel = '%s/%d.mp3' % (I['id'], root); encode(y, SR, os.path.join(OUT, rel), 80)
            s = {'m': int(root), 'f': rel, 'c': round(cents, 1)}
            if ls is not None: s['ls'] = round(ls, 4); s['le'] = round(le, 4)
            samples.append(s); total += os.path.getsize(os.path.join(OUT, rel))
        samples.sort(key=lambda s: s['m'])
        manifest['instruments'][I['id']] = {'name': I['name'], 'group': I['group'], 'sustain': bool(I.get('sustain')), 'rel': I['rel'], 'gain': I['gain'], 'mono': bool(I.get('mono')),
            'source': I['repo'], 'license': 'CC0-1.0', 'info': I['info'], 'samples': samples}
        print(I['id'], len(samples), 'campioni, spostamento ottave', K, flush=True)
    # ---- kit di batteria (stargate-sample-pack / fugue-state-audio: sintetizzati, pubblico dominio) ----
    D = os.path.join(SRC, 'stargate-sample-pack', 'stargate-sample-pack', 'fugue-state-audio', 'drums')
    names = {'synthkit': 'Synth (pulito)', 'distkit': 'Distorto', 'sdbkit': 'Pesante (SDB)', 'x0xproc1': 'Analogico 1', 'x0xproc2': 'Analogico 2'}
    spec = {'kick': ('kicks', 'kick', 0.9, 0.05), 'snare': ('snares', 'snare', 0.5, 0.06), 'clap': ('claps', 'clap', 0.5, 0.06), 'hat': ('hihats', 'hatclsd', 0.12, 0.03), 'ohat': ('hihats', 'hatopen', 0.6, 0.1), 'perc': ('toms', 'midtom', 0.6, 0.08)}
    for kit, label in names.items():
        k = {'name': 'Kit ' + label, 'files': {}}
        for lane, (d, suf, ml, fd) in spec.items():
            p = os.path.join(D, d, '%s-%s.wav' % (kit, suf))
            if not os.path.exists(p): print('manca', p); continue
            x = decode(p, SR_DRUM); x = trim_start(x, SR_DRUM, -60, 0.0005)[: int(ml*SR_DRUM)]; x = fade_out(x, SR_DRUM, fd)
            pk = np.max(np.abs(x)) + 1e-9; x = x * (0.95/pk)
            rel = 'drums/%s-%s.mp3' % (kit, lane); encode(x, SR_DRUM, os.path.join(OUT, rel), 96); k['files'][lane] = rel; total += os.path.getsize(os.path.join(OUT, rel))
        manifest['kits'][kit] = k
    # ---- 808 intonato da campione (stargate: sdbkit-sub-a) ----
    p = os.path.join(D, 'kicks', 'sdbkit-sub-a.wav')
    if os.path.exists(p):
        x = decode(p, SR); x = trim_start(x, SR, -55, 0.002); det = detect_midi(x, SR, 33)
        pk = np.max(np.abs(x)) + 1e-9; x = x * (0.9/pk); x = fade_out(x, SR, 0.15)
        rel = 'bass808/sub.mp3'; encode(x, SR, os.path.join(OUT, rel), 64)
        manifest['instruments']['sub808s'] = {'name': '808 (campione intonato)', 'group': 'Bassi', 'sustain': False, 'rel': 0.08, 'gain': 1.0, 'mono': True, 'source': 'stargate-sample-pack', 'license': 'CC0-1.0',
            'info': 'Sub bass di una cassa sintetica (Fugue State Audio, stargate-sample-pack) intonato con la velocita\' di lettura',
            'samples': [{'m': int(round(det)) if det else 33, 'f': rel, 'c': round(((det - round(det))*100) if det else 0, 1)}]}
        print('808 sample: durata %.2f s, altezza rilevata %s' % (len(x)/SR, det)); total += os.path.getsize(os.path.join(OUT, rel))
    manifest['total_bytes'] = total
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('totale', round(total/1e6, 2), 'MB; segnalazioni (' + str(len(flagged)) + '):'); [print('  ', f) for f in flagged]
convert()
