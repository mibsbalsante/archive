#!/usr/bin/env bash
#
# archive — instalador.
#
# Este repo é um TEMPLATE imutável: ele nunca guarda os seus dados. O script
# cria a sua instalação (o "arquivo") em um diretório que você escolhe e omite
# a si mesmo de lá. Depois de instalar, você trabalha na SUA pasta — este repo
# pode ser apagado (ou usado só para atualizar).
#
# Uso:
#   bash init.sh                              # interativo (TTY)
#   bash init.sh --guided                     # perguntas numeradas via stdin (agentes)
#   bash init.sh --non-interactive [flags]    # sem prompt; exige as flags obrigatórias
#   bash <(curl -fsSL <url-do-raw>/init.sh)   # sem clonar o repo
#
# Obrigatórias: --dir, --github-org, --linear-workspace, --linear-team
# (sem elas, no modo interativo o script pergunta; nos outros, sai com erro).
#
# Flags de valor:
#   --dir <path>              onde criar a instalação
#   --ctx <nome>              nome do contexto (default: personal)
#   --archive-name <nome>     nome do repo da instalação (default: basename do --dir)
#   --github-user <login>     default: `gh api user`
#   --github-org <login>      organização do GitHub dos repos de trabalho
#   --linear-workspace <slug> slug do workspace no Linear
#   --linear-team <KEY>       prefixo/time de issues no Linear (ex.: ABC)
#   --workspace-dir <nome>    pasta de repos de trabalho, relativa a ~ (default: Work)
#
# Modos e controle:
#   --guided                  imprime as perguntas e lê respostas de stdin
#   --non-interactive         nunca pergunta; falta de flag obrigatória = erro 2
#   --yes                     confirma tudo (instalação e configs do --update)
#   --print-config            imprime o JSON do que seria feito e sai
#   --with-memory/--no-memory backup de memória: Engram (default do prompt: nenhum)
#   --git/--no-git            `git init` na instalação (default: sim)
#   --dry-run                 mostra, não escreve
#
# Atualização (ver UPDATE.md):
#   --update                  atualiza a instalação em --dir
#   --force-update            sobrescreve também os arquivos que você editou
#
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG="$SRC/template"            # conteúdo instalado na pasta do arquivo pessoal
TPL="$PKG/_context"            # molde do contexto (<ctx>/)
STAMP=".archive-version"

target=""
ctx="personal"
archive_name=""
github_user=""
github_org=""
linear_workspace=""
linear_team=""
workspace_dir="Work"
do_memory="ask"
do_git="ask"
mode="install"
interactive="auto"      # auto | off (--non-interactive) | on (--guided)
print_config=false
force_update=false
yes_all=false

usage() { grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed '/^!/d'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) target="${2:?}"; shift 2 ;;
    --ctx) ctx="${2:?}"; shift 2 ;;
    --archive-name) archive_name="${2:?}"; shift 2 ;;
    --github-user) github_user="${2:?}"; shift 2 ;;
    --github-org) github_org="${2:?}"; shift 2 ;;
    --linear-workspace) linear_workspace="${2:?}"; shift 2 ;;
    --linear-team) linear_team="${2:?}"; shift 2 ;;
    --workspace-dir) workspace_dir="${2:?}"; shift 2 ;;
    --with-skills|--no-skills|--skills|--opencode)
      echo "aviso: $1 não é mais do init.sh — use <instalação>/$ctx/claude/bootstrap.sh" >&2
      exit 1 ;;
    --update) mode="update"; shift ;;
    --force-update) force_update=true; shift ;;
    --yes|-y) yes_all=true; shift ;;
    --non-interactive|--no-input) interactive="off"; shift ;;
    --guided) interactive="on"; shift ;;
    --with-memory) do_memory=true; shift ;;
    --no-memory) do_memory=false; shift ;;
    --git) do_git=true; shift ;;
    --no-git) do_git=false; shift ;;
    --print-config) print_config=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "opção desconhecida: $1" >&2; exit 1 ;;
  esac
done

use_prompt() {  # a decisão de perguntar: só interativo e sem --non-interactive
  $yes_all && return 1     # --yes confirma tudo: não consome stdin
  case "$interactive" in
    off) return 1 ;;
    on)  return 0 ;;
    *)   [ -t 0 ] ;;
  esac
}

guided_read() {  # guided_read <var> <pergunta> <default|-> — uma linha de stdin
  local cur="${!1:-}" q="$2" def="$3" line
  [ -n "$cur" ] && return 0
  if [ "$def" = "-" ]; then
    printf '%s > ' "$q"
  else
    printf '%s [%s] > ' "$q" "$def"
  fi
  IFS= read -r line || line=""
  [ -z "$line" ] && line="$def"
  printf -v "$1" '%s' "$line"
}

guided_mode() {  # lê todas as respostas de uma vez (uma por linha)
  ctx=""          # o default não pode suprimir a leitura: a ordem das linhas importa
  echo
  echo "== modo guiado =="
  echo "Responda uma por linha. Linha vazia = default. Abortar: Ctrl-C."
  echo

  guided_read target "1/7 destino" "-"
  guided_read ctx "2/7 contexto" "personal"
  guided_read github_org "3/7 github org" "-"
  guided_read linear_workspace "4/7 linear workspace" "-"
  guided_read linear_team "5/7 linear team" "-"
  guided_read github_user "6/7 github user" "$(gh api user --jq .login 2>/dev/null || echo '')"
  local mem
  guided_read mem "7/7 memória (1=Engram, 2=nenhum)" "2"
  case "$mem" in 1) do_memory=true ;; *) do_memory=false ;; esac
  [ -z "$ctx" ] && ctx="personal"
  [ -n "$target" ] && target="${target/#\~/$HOME}"
}

fatal_missing() {  # fatal_missing <flag> <descrição>
  echo "erro: falta --$1 ($2)" >&2
  if [ "$interactive" = "auto" ] && [ ! -t 0 ]; then
    echo "      não há TTY para perguntar: informe a flag, use --guided (stdin) ou --non-interactive --yes." >&2
  else
    echo "      passe a flag, ou rode sem --non-interactive." >&2
  fi
  exit 2
}

ask() {  # ask <var> <pergunta> <default>
  local cur="${!1:-}" answer
  [ -n "$cur" ] && return 0
  if ! use_prompt; then printf -v "$1" '%s' "${3:-}"; return 0; fi
  read -r -p "$2 [${3:-}]: " answer
  printf -v "$1" '%s' "${answer:-${3:-}}"
}

ask_required() {  # ask_required <var> <pergunta> <flag>
  local cur="${!1:-}" answer
  [ -n "$cur" ] && return 0
  use_prompt || fatal_missing "${3:-<valor>}" "$2"
  while :; do
    read -r -p "$2: " answer
    [ -n "$answer" ] && { printf -v "$1" '%s' "$answer"; return 0; }
    echo "  (obrigatório)"
  done
}

ask_yes() {  # ask_yes <var> <pergunta> — não-interativo = false (default seguro)
  local cur="${!1:-}" answer
  { [ "$cur" = true ] || [ "$cur" = false ]; } && return 0
  use_prompt || { printf -v "$1" '%s' false; return 0; }
  read -r -p "$2 [s/N]: " answer
  case "$answer" in s|S|y|Y) printf -v "$1" '%s' true ;; *) printf -v "$1" '%s' false ;; esac
}

version() { git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo "sem-git-$(date +%Y%m%d)"; }

# ---------------------------------------------------------------------------
# --update: reaplica só os arquivos do template que você NÃO editou
# ---------------------------------------------------------------------------
managed_files() {  # caminhos relativos à instalação (o que o --update gerencia)
  [ -d "$PKG" ] && (cd "$PKG" && find . -type f -not -name "$STAMP" \
    -not -path './_context/*' -not -path './common/*' -not -path './personal/*' \
    -not -name '.gitkeep' \
    | sed 's|^\./||')
  [ -d "$TPL" ] && (cd "$TPL" && find . -type f -not -name "$STAMP" -not -path './backup/engram/*' \
    | sed 's|^\./||; s|^|_context/|')
  (cd "$PKG/common" && find . -type f | sed 's|^\./||; s|^|common/|')
}

if [ "$mode" = update ]; then
  ask_required target "--dir da instalação a atualizar" "dir"
  target="${target/#\~/$HOME}"
  [ -f "$target/$STAMP" ] || { echo "erro: $target não parece uma instalação (falta $STAMP)" >&2; exit 1; }
  meta="$target/.archive-meta"
  [ -f "$meta" ] || { echo "erro: $meta não encontrado (instalação antiga?) — reinstale com init.sh" >&2; exit 1; }
  # shellcheck disable=SC1090
  . "$meta"
  old="$(cat "$target/$STAMP")"
  new="$(version)"
  echo "== atualizando $target: $old → $new =="
  echo "   contexto: $CTX · org: $GITHUB_ORG · time: $LINEAR_TEAM"

  # renderiza um arquivo do template com os valores desta instalação
  render() {  # render <src> <dst>
    sed -e "s|<CTX>|$CTX|g" \
        -e "s|<ARCHIVE_NAME>|$ARCHIVE_NAME|g" \
        -e "s|<ARCHIVE_DIR>|$ARCHIVE_DIR|g" \
        -e "s|<GITHUB_USER>|$GITHUB_USER|g" \
        -e "s|<GITHUB_ORG>|$GITHUB_ORG|g" \
        -e "s|<LINEAR_WORKSPACE>|$LINEAR_WORKSPACE|g" \
        -e "s|<LINEAR_TEAM>|$LINEAR_TEAM|g" \
        -e "s|<WORKSPACE_DIR>|$WORKSPACE_DIR|g" "$1" > "$2"
  }

  # configs de agente (Claude/OpenCode): pedem permissão arquivo a arquivo e
  # sempre geram backup, porque foram editados à mão e/ou vivem no HOME
  is_config() {  # is_config <caminho-relativo-na-instalação>
    case "$1" in
      */claude/*|*/.claude/*|*/.opencode/*|*/.config/opencode/*) return 0 ;;
      *) return 1 ;;
    esac
  }
  approve_config() {  # approve_config <dst> — true = pode escrever
    local f="$1"
    echo
    echo "  --- config: ${f#$target/} ---"
    diff -u "$f" "$2" 2>/dev/null | sed -n '3,40p' | sed 's/^/    /'
    $yes_all && { echo "  (--yes: aplicando sem perguntar)"; return 0; }
    if ! use_prompt; then
      echo "  (mantido: não-interativo — use --yes para aplicar)"
      return 1
    fi
    read -r -p "  aplicar? [s/N] " a
    case "$a" in s|S|y|Y) return 0 ;; *) return 1 ;; esac
  }

  changed=0; skipped=0; added=0; denied=0
  while IFS= read -r rel; do
    src="$PKG/$rel"
    [ -f "$src" ] || continue
    # arquivos do molde vivem dentro do contexto (renomeado na instalação)
    case "$rel" in
      _context/*) dst="$target/$CTX/${rel#_context/}"; basedst="$target/.archive-base/$CTX/${rel#_context/}" ;;
      *)          dst="$target/$rel";                  basedst="$target/.archive-base/$rel" ;;
    esac
    [ "$rel" = "_context/README.md" ] && continue   # README do molde ≠ README da instalação
    case "$rel" in */backup/engram/*/.gitkeep) continue ;; esac  # placeholder do molde, não do usuário

    tmp="$(mktemp)"; render "$src" "$tmp"

    # config de agente existente: mostra o diff, pede permissão e faz backup .old
    if [ -f "$dst" ] && ! cmp -s "$dst" "$tmp" && is_config "$dst"; then
      if ! approve_config "$dst" "$tmp"; then
        denied=$((denied+1)); echo "  = ${dst#$target/} (mantido por decisão sua)"
        rm -f "$tmp"; continue
      fi
      cp "$dst" "$dst.old"
      echo "  backup: ${dst#$target/} -> ${dst#$target/}.old"
      cp "$tmp" "$dst"; changed=$((changed+1)); echo "  ~ ${dst#$target/} (config confirmado)"
      mkdir -p "$(dirname "$basedst")"; cp "$tmp" "$basedst"
      rm -f "$tmp"; continue
    fi

    if [ ! -e "$dst" ]; then
      mkdir -p "$(dirname "$dst")"; cp "$tmp" "$dst"; chmod +x "$dst" 2>/dev/null || true
      added=$((added+1)); echo "  + ${dst#$target/}"
    elif cmp -s "$dst" "$tmp"; then
      :                                   # já está atualizado
    elif [ -f "$basedst" ] && cmp -s "$dst" "$basedst"; then
      cp "$tmp" "$dst"; changed=$((changed+1)); echo "  ~ ${dst#$target/}"
    elif $force_update; then
      cp "$tmp" "$dst"; changed=$((changed+1)); echo "  ~ ${dst#$target/} (sobrescrito: --force-update)"
    else
      cp "$tmp" "$dst.new"
      skipped=$((skipped+1)); echo "  ! ${dst#$target/} (editado — versão nova em ${dst#$target/}.new)"
    fi
    mkdir -p "$(dirname "$basedst")"; cp "$tmp" "$basedst"   # base da próxima atualização
    rm -f "$tmp"
  done < <(managed_files)

  echo "$new" > "$target/$STAMP"
  echo
  echo "atualizado: $old → $new"
  echo "  novos: $added · atualizados: $changed · conflitos: $skipped · mantidos: $denied"
  [ "$skipped" -gt 0 ] && echo "  revise os *.new e apague-os depois de mesclar (ver UPDATE.md)."
  echo "  NENHUM arquivo em $CTX/ foi alterado."
  exit 0
fi

# ---------------------------------------------------------------------------
# install
# ---------------------------------------------------------------------------
[ -d "$TPL" ] || { echo "erro: molde $TPL não encontrado" >&2; exit 1; }

echo "== archive: instalação =="
echo "origem: $SRC ($(version))"
echo

[ "$interactive" = "on" ] && guided_mode

ask_required target "Onde salvar a sua instalação (caminho absoluto)" "dir"
target="${target/#\~/$HOME}"

if [ -e "$target" ] && [ -n "$(ls -A "$target" 2>/dev/null)" ]; then
  echo "erro: $target já existe e não está vazio." >&2
  echo "      escolha outra pasta, ou atualize a instalação existente com --update --dir $target" >&2
  exit 1
fi

ask_required github_org "Organização do GitHub dos repos de trabalho (login exato)" "github-org"
ask_required linear_workspace "Slug do workspace no Linear (linear.app/<slug>)" "linear-workspace"
ask_required linear_team "Prefixo/time de issues no Linear (ex.: ABC)" "linear-team"
ask github_user "Seu usuário do GitHub" "$(gh api user --jq .login 2>/dev/null || true)"
ask workspace_dir "Pasta de workspaces, relativa a ~ (repos de trabalho)" "Work"
ask archive_name "Nome do repo da instalação" "$(basename "$target")"
[ -z "$archive_name" ] && archive_name="$(basename "$target")"

if $print_config; then
  printf '{"dir":"%s","ctx":"%s","archive_name":"%s","github_user":"%s","github_org":"%s","linear_workspace":"%s","linear_team":"%s","workspace_dir":"%s","memory":%s,"git":%s}\n' \
    "$target" "$ctx" "$archive_name" "$github_user" "$github_org" "$linear_workspace" "$linear_team" "$workspace_dir" \
    "$( [ "$do_memory" = true ] && echo true || echo false )" \
    "$( [ "$do_git" = true ] && echo true || echo false )"
  exit 0
fi
echo
echo "== valores =="
printf '  %-16s %s\n' \
  DESTINO "$target" \
  CTX "$ctx" \
  ARCHIVE_NAME "$archive_name" \
  GITHUB_USER "$github_user" \
  GITHUB_ORG "$github_org" \
  LINEAR_WORKSPACE "$linear_workspace" \
  LINEAR_TEAM "$linear_team" \
  WORKSPACE_DIR "~/$workspace_dir"
echo
if use_prompt && ! $yes_all; then
  read -r -p "Criar a instalação em $target? [s/N] " ok
  case "$ok" in s|S|y|Y) ;; *) echo "cancelado."; exit 0 ;; esac
elif ! $yes_all && [ "$interactive" = off ]; then
  echo "erro: --non-interactive exige --yes para confirmar a criação." >&2
  exit 2
fi

mkdir -p "$target"

# 1) o conteúdo do template vai inteiro para a instalação; o molde vira <ctx>/
mkdir -p "$target/$ctx"
cp -R "$TPL/." "$target/$ctx/"
rm -f "$target/$ctx/backup/engram/exemplo/.gitkeep"
rmdir "$target/$ctx/backup/engram/exemplo" 2>/dev/null || true
mkdir -p "$target/common"
cp -R "$PKG/common/." "$target/common/"
cp -R "$PKG/personal" "$target/personal"
[ -f "$PKG/UPDATE.md" ] && cp "$PKG/UPDATE.md" "$target/UPDATE.md"
[ -f "$PKG/.gitignore" ] && cp "$PKG/.gitignore" "$target/.gitignore"
cp "$SRC/init.sh" "$target/init.sh"   # o mesmo instalador serve ao --update
chmod +x "$target/init.sh" "$target/common/tools/"*.sh "$target/claude/bootstrap.sh" 2>/dev/null || true
echo "$(version)" > "$target/$STAMP"

# README da instalação (o README do template fica no template: fala sobre o template)
cat > "$target/README.md" <<'ARCHIVE_README'
# @@archive_name@@

Arquivo pessoal: documentação operacional, memória do Engram, skills e journal, organizado por **contexto**.

```
@@archive_name@@/
├── init.sh        # instalador / atualizador do template (UPDATE.md)
├── common/        # skills e scripts de qualquer contexto
├── @@ctx@@/          # o seu contexto (docs, journal, claude, skills, tools, backup)
└── personal/      # contexto de exemplo, vazio
```

## Contextos

Cada pasta de primeiro nível com `backup/engram/` é um contexto (pasta `_*` é ignorada). Crie outro copiando `@@ctx@@/` e trocando os dados, conforme o checklist do molde.

## Uso diário

| O quê | Comando |
|---|---|
| backup + commit da memória e do journal | `common/tools/backup-daily.sh @@ctx@@` |
| restaurar em máquina nova | `common/tools/restore.sh @@ctx@@` |
| instalar skills/settings/comandos na máquina | `@@ctx@@/claude/bootstrap.sh --all` (ver `@@ctx@@/claude/README.md`) |
| preparar o ambiente dos scripts | `source .archive-env` |
| gerar o doc de tasks de um projeto | skill `/archive-project-init` |
| próxima task | skill `/archive-project-next-task` |
| registro do dia | skill `/archive-journalling` |

## Atualizar o template

Ver [UPDATE.md](UPDATE.md):

```bash
bash <(curl -fsSL <url-do-raw>/init.sh) --update --dir "$PWD"
```

## Próximos passos

1. preencha `@@ctx@@/docs/README.md`, `@@ctx@@/tools/projects.json` e `@@ctx@@/claude/memory/AGENTS.md`
2. (opcional) preencha `@@ctx@@/journal/GUIA.md` — ou apague a pasta se não usar journal
3. resolva os placeholders que dependem de você: `<PROJECT>`, `<REPO>`, `<SDD_REPO>`
ARCHIVE_README
sed -i.bak "s|@@archive_name@@|$archive_name|g; s|@@ctx@@|$ctx|g" "$target/README.md" && rm -f "$target/README.md.bak"

# 2) o molde virou <ctx>/ no passo 1 — nada a renomear
# 3) README do contexto
cat > "$target/$ctx/README.md" <<CTX_README
# $ctx

Contexto desta instalação. O que é geral está em [../common/](../common/README.md).

| Pasta | Conteúdo | README |
|---|---|---|
| [docs/](docs/README.md) | docs operacionais | [docs/README.md](docs/README.md) |
| [journal/](journal/README.md) | registro diário de trabalho (opcional) | [journal/README.md](journal/README.md) |
| [backup/](backup/README.md) | export do Engram por projeto | [backup/README.md](backup/README.md) |
| [claude/](claude/README.md) | memória + config do Claude Code / OpenCode | [claude/README.md](claude/README.md) |
| [skills/](skills/README.md) | skills deste contexto | [skills/README.md](skills/README.md) |
| [tools/](tools/README.md) | geradores dos docs de tasks (Linear/GitHub) | [tools/README.md](tools/README.md) |

## Projetos (Engram)

| \`project\` (Engram) | repo de trabalho |
|---|---|
| \`<PROJECT>\` | \`~/$workspace_dir/<REPO>\` |

> Atualize os índices ao adicionar pastas/projetos.
CTX_README

# 4) substituição dos placeholders: SÓ nos arquivos da instalação, nunca na origem
PLACEHOLDERS=(
  "CTX=$ctx"
  "ARCHIVE_NAME=$archive_name"
  "ARCHIVE_DIR=$target"
  "GITHUB_USER=$github_user"
  "GITHUB_ORG=$github_org"
  "LINEAR_WORKSPACE=$linear_workspace"
  "LINEAR_TEAM=$linear_team"
  "WORKSPACE_DIR=$workspace_dir"
)

echo
echo "== preenchendo placeholders =="
count=0
while IFS= read -r -d '' f; do
  case "$f" in
    "$target/UPDATE.md") continue ;;   # tabela de placeholders do --update
    */backup/engram/*/*.json|*/backup/engram/*/.engram/*) continue ;;
  esac
  for pair in "${PLACEHOLDERS[@]}"; do
    key="${pair%%=*}"; val="${pair#*=}"
    [ -n "$val" ] || continue
    esc=$(printf '%s' "$val" | sed -e 's/[&|\\]/\\&/g')
    sed -i.bak "s|<${key}>|${esc}|g" "$f"
    rm -f "$f.bak"
  done
  count=$((count + 1))
done < <(find "$target" -type f \( -name '*.md' -o -name '*.sh' -o -name '*.mjs' -o -name '*.json' -o -name '*.jsonc' \) -print0)
echo "$count arquivo(s) preenchido(s)"

# metadados: o --update usa isto para reconstruir os valores desta instalação
cat > "$target/.archive-meta" <<META
CTX=$ctx
ARCHIVE_NAME=$archive_name
ARCHIVE_DIR=$target
GITHUB_USER=$github_user
GITHUB_ORG=$github_org
LINEAR_WORKSPACE=$linear_workspace
LINEAR_TEAM=$linear_team
WORKSPACE_DIR=$workspace_dir
META

# .archive-env: valores prontos para os scripts (source antes de rodar qualquer tool)
cat > "$target/.archive-env" <<ENV
# Gerado pelo init.sh. Use: source .archive-env
export ENGRAM_ARCHIVE="$target"
export ENGRAM_CTX="$ctx"
export GITHUB_ORG="$github_org"
export LINEAR_TEAM="$linear_team"
# export ENGRAM_PROJECT="<PROJECT>"   # descomente e troque pelo seu projeto do Engram
ENV

# base: cópia renderizada de cada arquivo do template como ficou na instalação.
# Sem ela, --update não distinguiria "só placeholder preenchido" de "editado por você".
mkdir -p "$target/.archive-base"
while IFS= read -r -d '' f; do
  rel="${f#$target/}"
  mkdir -p "$target/.archive-base/$(dirname "$rel")"
  cp "$f" "$target/.archive-base/$rel"
done < <(find "$target" -type f -print0 \
   -not -path '*/.git/*' -not -path '*/.archive-base/*' -not -name '.archive-meta')

# 5) gerenciador de memória (só decide o que fica em <ctx>/backup)
if [ "$do_memory" = ask ]; then
  if use_prompt; then
    echo
    echo "Gerenciador de memória: 1) Engram  2) Nenhum"
    read -r -p "Escolha [2]: " mem
    case "${mem:-2}" in 1) do_memory=true ;; *) do_memory=false ;; esac
  else
    do_memory=false   # default seguro: sem backup de memória
  fi
fi
if [ "$do_memory" = true ]; then
  command -v engram >/dev/null 2>&1 || echo "aviso: binário 'engram' não encontrado no PATH — instale antes de usar o backup." >&2
  echo "- backup configurado para o Engram: uma pasta por projeto em $ctx/backup/engram/<PROJECT>/"
else
  rm -rf "$target/$ctx/backup/engram" 2>/dev/null || true
  echo "- sem gerenciador de memória: backup removido do contexto (os scripts ficam prontos, mas não são chamados)"
fi

# 6) git próprio da instalação (histórico seu, independente deste template)
if git -C "$target" rev-parse --git-dir >/dev/null 2>&1; then
  echo "- $target já é um repo git, não inicializei outro"
else
  if [ "$do_git" = ask ]; then
    if use_prompt; then
      read -r -p "Inicializar git em $target? [S/n] " g
      case "${g:-s}" in s|S|y|Y) do_git=true ;; *) do_git=false ;; esac
    else
      do_git=true
    fi
  fi
  if [ "$do_git" = true ]; then
    git -C "$target" init -q -b main && echo "- git inicializado (branch main)"
  else
    echo "- sem git (você pode rodar git init depois)"
  fi
fi

cat <<EOF

pronto. Sua instalação: $target
  (esta pasta pode ser movida; os caminhos absolutos gravados nos arquivos
   deixam de valer — rode ./init.sh --update --dir <novo-path> se mover)

próximos passos:
  0. instale na máquina (skills, comandos, settings, memória):
       $ctx/claude/bootstrap.sh --all --dry-run   # veja o que seria escrito
       $ctx/claude/bootstrap.sh --all             # escreve, com backup .old
  1. preencha $ctx/docs/README.md, $ctx/tools/projects.json e $ctx/claude/memory/AGENTS.md
  2. (opcional) preencha $ctx/journal/GUIA.md — ou apague a pasta se não usar journal
  3. confira os placeholders restantes: <PROJECT>, <REPO>, <SDD_REPO>

O repositório de origem ($SRC) não guarda seus dados: pode apagá-lo.
Para atualizar depois, veja UPDATE.md.
EOF
