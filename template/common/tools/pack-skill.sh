#!/usr/bin/env bash
#
# pack-skill.sh — empacota uma skill do repo em `<nome>.skill` (zip com a pasta da skill
# na raiz), formato aceito em Settings → Capabilities → Skills do Claude (Cowork).
#
# Uso:
#   pack-skill.sh <nome|caminho> [--out <dir>]
#
# <nome> é procurado em common/skills/, common/skills/opcional/ e <ctx>/skills/. Default de --out: ~/Downloads.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
skill=""
out="$HOME/Downloads"

while [ $# -gt 0 ]; do
  case "$1" in
    --out) out="${2:?--out precisa de um diretório}"; shift 2 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed '/^!/d'; exit 0 ;;
    -*) echo "opção desconhecida: $1" >&2; exit 1 ;;
    *) skill="$1"; shift ;;
  esac
done
[ -n "$skill" ] || { echo "uso: pack-skill.sh <nome|caminho> [--out <dir>]" >&2; exit 1; }

dir=""
if [ -f "$skill/SKILL.md" ]; then
  dir="$(cd "$skill" && pwd)"
else
  for c in "$ROOT/common/skills/$skill" "$ROOT/common/skills/opcional/$skill" "$ROOT"/*/skills/"$skill"; do
    [ -f "$c/SKILL.md" ] && { dir="$c"; break; }
  done
fi
[ -n "$dir" ] || { echo "erro: skill '$skill' não encontrada (procurei em common/skills, common/skills/opcional e <ctx>/skills)" >&2; exit 1; }

name="$(basename "$dir")"
mkdir -p "$out"
out="$(cd "$out" && pwd)"
rm -f "$out/$name.skill"
(cd "$(dirname "$dir")" && zip -qr "$out/$name.skill" "$name" -x '*.DS_Store')
echo "gerado: $out/$name.skill"
