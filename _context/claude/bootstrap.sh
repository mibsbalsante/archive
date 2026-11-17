#!/usr/bin/env bash
#
# bootstrap.sh — inicializa o Claude Code numa máquina nova a partir deste arquivo.
#
# Escreve um `.claude/settings.json` básico e SEM segredos, mas só quando o
# settings é pedido (sem nenhuma flag, ou com `--settings`). Se já existir um
# settings no destino, faz backup como `<destino>.old` antes de sobrescrever.
#
# Uso:
#   ./bootstrap.sh                 # instala em ~/.claude/settings.json
#   ./bootstrap.sh <destino>       # outro caminho de settings.json
#   ./bootstrap.sh --settings      # só o settings (explícito)
#   ./bootstrap.sh --memory        # também instala o CLAUDE.md global (com .old)
#   ./bootstrap.sh --skills        # também linka as skills (common/skills + common/skills/opcional + <ctx>/skills)
#   ./bootstrap.sh --opencode      # também copia os comandos globais do OpenCode
#   ./bootstrap.sh --all           # settings + memória + skills + opencode
#
# Flags não pedem o settings implicitamente: `--opencode` sozinho não toca
# ~/.claude/settings.json.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
OPENCODE_HOME="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
SKILLS_SRC=("$SCRIPT_DIR/../../common/skills" "$SCRIPT_DIR/../../common/skills/opcional" "$SCRIPT_DIR/../skills")

target="$CLAUDE_HOME/settings.json"
do_settings=false
do_memory=false
do_skills=false
do_opencode=false
flags_seen=false

for arg in "$@"; do
  case "$arg" in
    --settings) do_settings=true; flags_seen=true ;;
    --memory) do_memory=true; flags_seen=true ;;
    --skills) do_skills=true; flags_seen=true ;;
    --opencode) do_opencode=true; flags_seen=true ;;
    --all)    do_settings=true; do_memory=true; do_skills=true; do_opencode=true; flags_seen=true ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed '/^!/d'
      exit 0 ;;
    *) target="$arg" ;;
  esac
done

$flags_seen || do_settings=true

backup() {
  local f="$1"
  if [ -f "$f" ]; then
    cp "$f" "$f.old"
    echo "backup: $f -> $f.old"
  fi
}

# 1) settings.json básico (sem segredos) — só quando pedido
if $do_settings; then
  base="$SCRIPT_DIR/settings.base.json"
  [ -f "$base" ] || { echo "erro: $base não encontrado" >&2; exit 1; }
  mkdir -p "$(dirname "$target")"
  backup "$target"
  cp "$base" "$target"
  echo "settings escrito: $target"
fi

# 2) memória global
#    AGENTS.md é a fonte da verdade (lida nativamente pelo OpenCode);
#    CLAUDE.md é só um stub com `@~/.config/opencode/AGENTS.md` para o Claude Code.
if $do_memory; then
  for pair in "AGENTS.md:$OPENCODE_HOME/AGENTS.md" "CLAUDE.md:$CLAUDE_HOME/CLAUDE.md"; do
    src="$SCRIPT_DIR/memory/${pair%%:*}"
    dst="${pair#*:}"
    if [ -f "$src" ]; then
      mkdir -p "$(dirname "$dst")"
      backup "$dst"
      cp "$src" "$dst"
      echo "memória escrita: $dst"
    else
      echo "aviso: $src não encontrado (pulando $dst)" >&2
    fi
  done
fi

# 3) skills pessoais — symlink para a fonte (fonte única: este repo).
#    O OpenCode lê ~/.claude/skills nativamente, então não há cópia para o
#    OpenCode. Editar no repo já vale nas duas ferramentas.
if $do_skills; then
  dst="$CLAUDE_HOME/skills"
  mkdir -p "$dst"
  shopt -s nullglob
  for src in "${SKILLS_SRC[@]}"; do
    for d in "$src"/*/; do
      name="$(basename "$d")"
      [ -f "$d/SKILL.md" ] || continue   # ignora agrupadores (ex.: opcional/) que não são skills
      d="${d%/}"
      d="$(cd "$d" && pwd -P)"
      link="$dst/$name"
      # compara o alvo resolvido: symlink criado com caminho relativo/`..`
      # continua sendo o mesmo alvo
      same=false
      if [ -L "$link" ]; then
        current="$(cd "$link" 2>/dev/null && pwd -P || true)"
        [ "$current" = "$d" ] && same=true
      fi
      if $same; then
        echo "skill já linkada: $name"
        continue
      fi
      # instalação antiga por cópia: backup FORA de ~/.claude/skills, senão
      # vira skill duplicada na descoberta de OpenCode/Claude
      if [ -e "$link" ]; then
        backup_dir="$CLAUDE_HOME/skills.old"
        mkdir -p "$backup_dir"
        rm -rf "$backup_dir/$name"
        mv "$link" "$backup_dir/$name"
        echo "backup: skill $name -> $backup_dir/$name"
      fi
      rm -f "$link"
      ln -s "$d" "$link"
      echo "skill linkada: $name -> $d"
    done
  done
  echo
  echo "as skills são symlinks para este repo — não precisa reinstalar a cada edição."
fi

# 4) comandos globais do OpenCode (o OpenCode V2 não lê ~/.claude/commands)
if $do_opencode; then
  src="$SCRIPT_DIR/opencode/commands"
  dst="$OPENCODE_HOME/commands"
  if [ -d "$src" ]; then
    mkdir -p "$dst"
    shopt -s nullglob
    for f in "$src"/*.md; do
      cp "$f" "$dst/$(basename "$f")"
      echo "comando OpenCode instalado: $(basename "$f") -> $dst"
    done
    echo
    echo "lembrete: comandos de projeto (.claude/commands/) devem ser duplicados"
    echo "em <repo>/.opencode/commands/ — ver opencode/README.md"
  else
    echo "aviso: $src não encontrado (pulando OpenCode)" >&2
  fi
fi

echo
if $do_settings || $do_memory; then
  echo "pronto. Reinicie o Claude Code para carregar o settings."
else
  echo "pronto. Nada a reiniciar: o OpenCode recarrega comandos e config sozinho."
fi
echo "segredos (tokens de MCP, API keys) NÃO são versionados — configure-os manualmente."
