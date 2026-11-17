#!/usr/bin/env bash
#
# backup-daily.sh — backup do Engram (+ journal) de um contexto para o repo do arquivo.
#
# Uso:
#   backup-daily.sh <ctx>      # ctx = pasta de primeiro nível (ex.: personal)
#
# Faz `engram export` + `engram sync` de cada projeto em <ctx>/backup/engram/,
# commita (só <ctx>/backup e <ctx>/journal) e envia. Chamado pela skill
# archive-journalling; roda fora do shell interativo, por isso o PATH explícito e o
# fallback para o node do fnm.
#
set -euo pipefail

CTX="${1:-${ENGRAM_CTX:-}}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/share/fnm/aliases/default/bin:$PATH"
export ENGRAM_ARCHIVE="$ROOT"

[ -n "$CTX" ] || { echo "erro: informe o contexto: backup-daily.sh <ctx>" >&2; exit 1; }
command -v node >/dev/null || { echo "erro: node não encontrado no PATH" >&2; exit 1; }
[ -d "$ROOT/$CTX/backup/engram" ] || { echo "erro: $CTX/backup/engram não existe em $ROOT" >&2; exit 1; }

echo "== $(date '+%Y-%m-%d %H:%M:%S') backup ctx=$CTX =="
node "$ROOT/common/tools/refresh-archive.mjs" --ctx "$CTX" --all --sync --push
