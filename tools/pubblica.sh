#!/bin/bash
# Pubblica in un colpo (per ENTRAMBE le chat): commit, unione con main, build+test, push su main.
# Uso: bash tools/pubblica.sh "messaggio del commit" "Co-Authored-By: ..." "Claude-Session: ..."
# Conflitti in docs/ (file generati): si tiene la versione di main e si ricostruisce. Conflitti in src/: si ferma e li elenca.
set -e
cd "$(dirname "$0")/.."
MSG="$1"; FIRMA="${2:-}"; SESS="${3:-}"
BR=$(git rev-parse --abbrev-ref HEAD)
git add -A; git commit -qm "$MSG

$FIRMA
$SESS" || true
git fetch -q origin main
git merge -q --no-edit origin/main || true
git checkout --theirs docs/sw.js docs/index.html 2>/dev/null || true
if git diff --name-only --diff-filter=U | grep -v '^docs/' ; then echo "CONFLITTI in sorgenti: risolvere a mano (tenere entrambi i lati)"; exit 1; fi
if grep -rl '^<<<<<<<' src tests build.js notes tools >/dev/null 2>&1; then echo "MARCATORI DI CONFLITTO:"; grep -rl '^<<<<<<<' src tests build.js notes tools; exit 1; fi
node build.js > /tmp/build-pubblica.log 2>&1 || { tail -30 /tmp/build-pubblica.log; exit 1; }
tail -2 /tmp/build-pubblica.log
git add -A; git commit -qm "Unione con main

$FIRMA
$SESS" || true
[ "$BR" != "main" ] && git push -q origin "$BR" || true
git push -q origin HEAD:main
[ "$(git ls-remote origin main | cut -f1)" = "$(git rev-parse HEAD)" ] && echo "PUBBLICATO: $(git rev-parse --short HEAD)" || echo "ATTENZIONE: main remoto diverso da HEAD"
