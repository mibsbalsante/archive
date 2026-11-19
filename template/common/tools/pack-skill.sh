#!/usr/bin/env bash
#
# pack-skill.sh — empacota uma skill do repo em `<nome>.skill` (zip com a pasta da skill
# na raiz), formato aceito em Settings → Capabilities → Skills do Claude (Cowork) e
# instalável em `~/.claude/skills`.
#
# Uso:
#   pack-skill.sh <nome|caminho> [--out <dir>]     # gera <dir>/<nome>.skill
#   pack-skill.sh --all [--out <dir>]              # todas as skills das três fontes
#   pack-skill.sh --install <arquivo.skill>        # instala em ~/.claude/skills (cópia) e valida
#
# <nome> é procurado em common/skills/, common/skills/opcional/ e <ctx>/skills/.
# Default de --out: ~/Downloads.
#
# Regras:
# - Recusa skill sem frontmatter `name:` + `description:` no SKILL.md.
# - Ignora lixo: __pycache__, *.pyc, .DS_Store, *.old.
# - Nome do arquivo = nome da pasta (com o prefixo `archive-`).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
skill=""
out="$HOME/Downloads"
do_all=false
install=""

usage() { grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed '/^!/d'; }

install_skill() {
  local file="$1" target="${CLAUDE_SKILLS:-$HOME/.claude/skills}"
  [ -f "$file" ] || { echo "erro: não encontrei $file" >&2; exit 1; }
  local name="${file##*/}"; name="${name%.skill}"
  local tmp; tmp="$(mktemp -d)"
  unzip -q "$file" -d "$tmp"
  if [ ! -f "$tmp/$name/SKILL.md" ]; then
    echo "erro: pacote inválido — esperava $name/SKILL.md dentro de $file" >&2
    rm -rf "$tmp"; exit 1
  fi
  mkdir -p "$target"
  # o destino é symlink para a fonte: instalação por cópia o substituiria por diretório
  if [ -e "$target/$name" ] || [ -L "$target/$name" ]; then
    rm -rf "$target/$name.old"
    mv "$target/$name" "$target/$name.old"
    echo "backup: $target/$name -> $target/$name.old"
  fi
  cp -R "$tmp/$name" "$target/$name"
  chmod +x "$target/$name"/*.py 2>/dev/null || true
  rm -rf "$tmp"
  echo "instalado: $target/$name"
}

pack() {  # pack <dir> — valida e empacota uma skill
  local dir="$1"
  local name; name="$(basename "$dir")"
  local skill_md="$dir/SKILL.md"
  [ -f "$skill_md" ] || { echo "pulando $name (sem SKILL.md)"; return 0; }
  if ! grep -q '^name:' "$skill_md" || ! grep -q '^description:' "$skill_md"; then
    echo "erro: $name sem frontmatter name/description" >&2; return 1
  fi
  mkdir -p "$out"
  local out_dir; out_dir="$(cd "$out" && pwd)"
  rm -f "$out_dir/$name.skill"
  # zip a partir do diretório pai → a pasta da skill fica na raiz do pacote
  ( cd "$(dirname "$dir")" && zip -qr -X "$out_dir/$name.skill" "$name" \
      -x '*/__pycache__/*' '*.pyc' '*/.DS_Store' '*.old' )
  echo "gerado: $out_dir/$name.skill"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --all) do_all=true; shift ;;
    --out) out="${2:?--out precisa de um diretório}"; shift 2 ;;
    --install) install="${2:?--install precisa de um arquivo .skill}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "opção desconhecida: $1" >&2; exit 1 ;;
    *) skill="$1"; shift ;;
  esac
done

if [ -n "$install" ]; then install_skill "$install"; exit 0; fi

if $do_all; then
  shopt -s nullglob
  status=0
  for d in "$ROOT"/common/skills/*/ "$ROOT"/common/skills/opcional/*/ "$ROOT"/*/skills/*/; do
    [ -f "${d}SKILL.md" ] || continue
    pack "${d%/}" || status=1
  done
  exit "$status"
fi

[ -n "$skill" ] || { echo "uso: pack-skill.sh <nome|caminho> | --all | --install <arquivo>" >&2; exit 1; }

dir=""
if [ -f "$skill/SKILL.md" ]; then
  dir="$(cd "$skill" && pwd)"
else
  for c in "$ROOT/common/skills/$skill" "$ROOT/common/skills/opcional/$skill" "$ROOT"/*/skills/"$skill"; do
    [ -f "$c/SKILL.md" ] && { dir="$c"; break; }
  done
fi
[ -n "$dir" ] || { echo "erro: skill '$skill' não encontrada (procurei em common/skills, common/skills/opcional e <ctx>/skills)" >&2; exit 1; }

pack "$dir"
