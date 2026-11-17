#!/usr/bin/env bash
#
# restore.sh — importa no Engram local os exports de um contexto (<ctx>, personal, ...).
#
# Uso:
#   restore.sh                      # lista os contextos e pergunta qual restaurar
#   restore.sh <ctx> [opções]
#
# Opções:
#   --project <nome>   restaura só esse projeto
#   --dry-run          mostra o que seria importado
#   --yes              não pede confirmação
#
# Contexto = pasta de primeiro nível com `backup/engram/<projeto>/engram-export.json`.
# Rode numa máquina nova/limpa: o import em um banco que já tem essas memórias
# pode duplicá-las.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

ctx=""
only_project=""
dry_run=false
assume_yes=false

while [ $# -gt 0 ]; do
  case "$1" in
    --project) only_project="${2:?--project precisa de um nome}"; shift 2 ;;
    --dry-run) dry_run=true; shift ;;
    --yes|-y)  assume_yes=true; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed '/^!/d'; exit 0 ;;
    -*) echo "opção desconhecida: $1" >&2; exit 1 ;;
    *) ctx="$1"; shift ;;
  esac
done

contexts=()
for d in "$ROOT"/*/backup/engram; do
  [ -d "$d" ] || continue
  name="$(basename "$(dirname "$(dirname "$d")")")"
  case "$name" in _*|common) continue ;; esac  # `_context/` é molde, não contexto
  contexts+=("$name")
done
[ ${#contexts[@]} -gt 0 ] || { echo "erro: nenhum contexto com backup/engram em $ROOT" >&2; exit 1; }

if [ -z "$ctx" ]; then
  echo "Contextos disponíveis:"
  i=1
  for c in "${contexts[@]}"; do
    n=$(find "$ROOT/$c/backup/engram" -name engram-export.json | wc -l | tr -d ' ')
    echo "  $i) $c ($n projeto(s) com export)"
    i=$((i + 1))
  done
  read -r -p "Escolha (número ou nome): " choice
  if [[ "$choice" =~ ^[0-9]+$ ]]; then
    ctx="${contexts[$((choice - 1))]:-}"
  else
    ctx="$choice"
  fi
fi

base="$ROOT/$ctx/backup/engram"
[ -d "$base" ] || { echo "erro: contexto '$ctx' inválido (esperado: ${contexts[*]})" >&2; exit 1; }

files=()
for f in "$base"/*/engram-export.json; do
  [ -f "$f" ] || continue
  project="$(basename "$(dirname "$f")")"
  if [ -n "$only_project" ] && [ "$project" != "$only_project" ]; then continue; fi
  files+=("$f")
done
[ ${#files[@]} -gt 0 ] || { echo "nada para importar em $base" >&2; exit 1; }

echo "Importar do contexto '$ctx':"
for f in "${files[@]}"; do echo "  - ${f#$ROOT/}"; done

$dry_run && { echo "[dry-run] nada importado."; exit 0; }

if ! $assume_yes; then
  read -r -p "Confirmar import no Engram local? [s/N] " ok
  [[ "$ok" =~ ^[sSyY]$ ]] || { echo "cancelado."; exit 0; }
fi

for f in "${files[@]}"; do
  echo "→ engram import ${f#$ROOT/}"
  engram import "$f"
done
echo "pronto."
