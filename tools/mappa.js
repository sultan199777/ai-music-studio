// Genera notes/MAPPA.md: mappa compatta del progetto (file, scopo, funzioni esportate, sezioni di app.js)
// così non serve rileggere tutti i file. Uso: node tools/mappa.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const out = ['# Mappa del progetto (generata da tools/mappa.js, non modificare a mano)', '', 'Leggi questo file PRIMA di aprire i sorgenti: dice dove sta ogni cosa.', ''];
const first = (s) => { const m = s.match(/\/\*\s*([\s\S]*?)\*\//); return m ? m[1].replace(/^\s*\*\s?/gm, '').trim().split('\n').slice(0, 3).join(' ').slice(0, 220) : ''; };
const exp = (s) => { const m = s.match(/return\s*\{([^{}]*)\};?\s*\}\);?\s*$/); return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 200) : ''; };
out.push('## src/ (moduli)', '', '| File | Righe | Scopo | Esporta |', '|---|---|---|---|');
for (const f of fs.readdirSync(path.join(root, 'src')).sort()) {
  const p = path.join(root, 'src', f), s = fs.readFileSync(p, 'utf8'), n = s.split('\n').length;
  if (f === 'samples-data.js') { out.push(`| ${f} | ${n} | campioni batteria CC0 codificati | dati |`); continue; }
  out.push(`| ${f} | ${n} | ${f.endsWith('.js') ? first(s).replace(/\|/g, '/') : ''} | ${f.endsWith('.js') ? exp(s).replace(/\|/g, '/') : ''} |`);
}
const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8').split('\n');
out.push('', '## src/app.js: sezioni (riga: titolo)', '');
app.forEach((l, i) => { const m = l.match(/\/\*\s*=+\s*(.*?)\s*=+\s*\*\//) || l.match(/^\s*\/\/\s*-{3,}\s*(.*?)\s*-{3,}/); if (m) out.push(`- ${i + 1}: ${m[1]}`); });
out.push('', '## Funzioni principali di app.js (riga: nome)', '');
const fn = []; app.forEach((l, i) => { const m = l.match(/^\s{2}(?:async )?function (\w+)/); if (m) fn.push(`${m[1]}:${i + 1}`); });
out.push(fn.join(', '), '', '## tests/', '');
for (const f of fs.readdirSync(path.join(root, 'tests')).sort().filter((x) => x.endsWith('.js'))) { const s = fs.readFileSync(path.join(root, 'tests', f), 'utf8'); out.push(`- ${f}: ${(s.match(/^test\(/gm) || []).length} test`); }
out.push('', '## Altro', '', '- build.js: esegue i test e crea dist/index.html (artifact) e docs/ (sito GitHub Pages)', '- notes/STATO.md: cosa è fatto e cosa no (aggiornare ogni passo)', '- notes/ARCHITETTURA.md, notes/LICENZE-SUONI.md', '- src/app.body.html / app.css / app.shell.html: interfaccia', '');
fs.writeFileSync(path.join(root, 'notes/MAPPA.md'), out.join('\n'));
console.log('notes/MAPPA.md', out.join('\n').length, 'caratteri');
