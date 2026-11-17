#!/usr/bin/env bash
#
# bootstrap.sh — instala ESTE arquivo na máquina (Claude Code + OpenCode).
#
# O bootstrap é o segundo instalador: o `init.sh` (na raiz) cria o seu archive
# pessoal numa pasta; este script leva a configuração da instalação para o HOME.
# Ele é o único que escreve FORA da pasta do archive.
#
# Uso:
#   ./bootstrap.sh                     # pergunta cada item
#   ./bootstrap.sh --all               # settings + memória + skills + opencode
#   ./bootstrap.sh --settings          # ~/.claude/settings.json
#   ./bootstrap.sh --memory            # ~/.config/opencode/AGENTS.md + ~/.claude/CLAUDE.md
#   ./bootstrap.sh --skills            # symlinks de skill em ~/.claude/skills
#   ./bootstrap.sh --opencode          # comandos em ~/.config/opencode/commands
#   ./bootstrap.sh --dry-run           # mostra o que faria, sem escrever
#   ./bootstrap.sh --yes               # não pergunta arquivo a arquivo (ainda faz backup)
#   ./bootstrap.sh <destino>           # outro caminho de settings.json
#
# Nada é sobrescrito em silêncio: todo arquivo existente é copiado para
# `<arquivo>.old` antes, e cada escrita pede confirmação (exceto com --yes).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
OPENCODE_HOME="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
SKILLS_SRC=("$SCRIPT_DIR/../../common/skills" "$SCRIPT_DIR/../../common/skills/opcional" "$SCRIPT_DIR/../skills")

target="$CLAUDE_HOME/settings.json"
do_settings=""
do_memory=""
do_skills=""
do_opencode=""
dry_run=false
assume_yes=false
flags_seen=false

for arg in "$@"; do
  case "$arg" in
    --settings) do_settings=true; flags_seen=true ;;
    --memory) do_memory=true; flags_seen=true ;;
    --skills) do_skills=true; flags_seen=true ;;
    --opencode) do_opencode=true; flags_seen=true ;;
    --all) do_settings=true; do_memory=true; do_skills=true; do_opencode=true; flags_seen=true ;;
    --dry-run) dry_run=true ;;
    --yes|-y) assume_yes=true ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed '/^!/d'; exit 0 ;;
    *) target="$arg" ;;
  esac
done

if ! $flags_seen; then
  echo "== bootstrap do archive: o que instalar nesta máquina =="
  echo "(cada item escreve fora da pasta do archive; backup .old é sempre gerado)"
  ask() { local def="$1" q="$2" a; read -r -p "$q [$def]: " a; echo "${a:-$def}"; }
  case "$(ask 's' '1) settings.json do Claude? [s/N]')" in s|S|y|Y) do_settings=true ;; *) do_settings=false ;; esac
  case "$(ask 's' '2) memória global (AGENTS.md + CLAUDE.md)? [s/N]')" in s|S|y|Y) do_memory=true ;; *) do_memory=false ;; esac
  case "$(ask 's' '3) skills (symlink em ~/.claude/skills)? [s/N]')" in s|S|y|Y) do_skills=true ;; *) do_skills=false ;; esac
  case "$(ask 's' '4) comandos do OpenCode? [s/N]')" in s|S|y|Y) do_opencode=true ;; *) do_opencode=false ;; esac
fi

# confirma uma escrita e faz backup .old do destino
ask_write() {  # ask_write <arquivo> — pergunta; SEM backup (quem chama faz se escrever)
  local f="$1" a
  $assume_yes && return 0
  # sem TTY (script/CI): não pergunta e mantém o arquivo — use --yes para aplicar
  if [ ! -t 0 ]; then
    echo "  mantido $f (sem TTY para confirmar; use --yes)"
    return 1
  fi
  read -r -p "  escrever $f? [s/N] " a
  case "$a" in s|S|y|Y) return 0 ;; *) echo "  mantido $f"; return 1 ;; esac
}

install_file() {  # install_file <origem> <destino>
  local src="$1" dst="$2"
  if $dry_run; then echo "  [dry-run] $src -> $dst"; return 0; fi
  mkdir -p "$(dirname "$dst")"
  # destino novo: não há o que confirmar nem backup a fazer
  if [ ! -e "$dst" ]; then
    cp "$src" "$dst"; echo "  criado: $dst"; return 0
  fi
  # destino existente: confirma (sem TTY mantém) e faz .old só se for escrever
  ask_write "$dst" || return 0
  cp "$dst" "$dst.old"; echo "  backup: $dst -> $dst.old"
  cp "$src" "$dst"; echo "  atualizado: $dst"
}

# 1) settings.json (sem segredos)
if [ "$do_settings" = true ]; then
  echo "-- settings"
  base="$SCRIPT_DIR/settings.base.json"
  [ -f "$base" ] || { echo "erro: $base não encontrado" >&2; exit 1; }
  install_file "$base" "$target"
fi

# 2) memória global: AGENTS.md é a fonte (OpenCode lê nativamente);
#    CLAUDE.md é só o stub `@~/.config/opencode/AGENTS.md` para o Claude Code.
if [ "$do_memory" = true ]; then
  echo "-- memória"
  for pair in "AGENTS.md:$OPENCODE_HOME/AGENTS.md" "CLAUDE.md:$CLAUDE_HOME/CLAUDE.md"; do
    src="$SCRIPT_DIR/memory/${pair%%:*}"
    dst="${pair#*:}"
    [ -f "$src" ] || { echo "  aviso: $src não encontrado (pulando $dst)" >&2; continue; }
    install_file "$src" "$dst"
  done
fi

# 3) skills — symlink para a fonte (fonte única: a instalação).
#    O OpenCode lê ~/.claude/skills nativamente; editar na origem já vale nos dois.
if [ "$do_skills" = true ]; then
  echo "-- skills"
  dst="$CLAUDE_HOME/skills"
  shopt -s nullglob
  for src in "${SKILLS_SRC[@]}"; do
    for d in "$src"/*/; do
      name="$(basename "$d")"
      [ -f "$d/SKILL.md" ] || continue   # ignora agrupadores (ex.: opcional/) que não são skills
      d="${d%/}"; d="$(cd "$d" && pwd -P)"
      link="$dst/$name"
      if [ -L "$link" ] && [ "$(cd "$link" 2>/dev/null && pwd -P || true)" = "$d" ]; then
        echo "  já linkada: $name"
        continue
      fi
      if $dry_run; then echo "  [dry-run] link $link -> $d"; continue; fi
      mkdir -p "$dst"
      # instalação antiga por cópia: backup FORA de ~/.claude/skills,
      # senão vira skill duplicada na descoberta do OpenCode/Claude
      if [ -e "$link" ]; then
        backup_dir="$CLAUDE_HOME/skills.old"
        mkdir -p "$backup_dir"; rm -rf "$backup_dir/$name"
        mv "$link" "$backup_dir/$name"
        echo "  backup: skill $name -> $backup_dir/$name"
      fi
      if $assume_yes; then
        ln -sfn "$d" "$link"; echo "  linkada: $name -> $d"
      else
        read -r -p "  linkar $name -> $d? [s/N] " a
        case "$a" in s|S|y|Y) ln -sfn "$d" "$link"; echo "  linkada: $name" ;; *) echo "  mantido $name" ;; esac
      fi
    done
  done
  echo "  (skills são symlinks para a instalação: editar lá já vale)"
fi

# 4) comandos globais do OpenCode (o OpenCode V2 não lê ~/.claude/commands)
if [ "$do_opencode" = true ]; then
  echo "-- comandos do OpenCode"
  src="$SCRIPT_DIR/opencode/commands"
  dst="$OPENCODE_HOME/commands"
  if [ -d "$src" ]; then
    shopt -s nullglob
    for f in "$src"/*.md; do
      install_file "$f" "$dst/$(basename "$f")"
    done
  else
    echo "  aviso: $src não encontrado (pulando OpenCode)" >&2
  fi
fi

echo
$dry_run && echo "dry-run: nada foi escrito."
if [ "$do_settings" = true ] || [ "$do_memory" = true ]; then
  echo "pronto. Reinicie o Claude Code para carregar o settings/memória."
else
  echo "pronto. O OpenCode recarrega comandos e config sozinho."
fi
echo "segredos (tokens de MCP, API keys) NÃO são versionados — configure-os manualmente."
