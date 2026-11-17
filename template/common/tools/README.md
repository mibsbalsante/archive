# common/tools

Scripts de backup, restore e indexação do arquivo. Todos aceitam `--ctx <nome>` — contexto = pasta de primeiro nível com `backup/engram/` (pastas `_*` são ignoradas). Repo resolvido por `--repo` > `$ENGRAM_ARCHIVE` > `~/Work/<ARCHIVE_NAME>`.

| Script | Para quê |
|---|---|
| [backup-daily.sh](backup-daily.sh) | backup completo de um contexto (acionado pela skill `archive-journalling`) |
| [restore.sh](restore.sh) | importa no Engram local os exports de um contexto |
| [refresh-archive.mjs](refresh-archive.mjs) | export + sync do Engram por projeto, commit e push |
| [index-engram.mjs](index-engram.mjs) | indexa `<ctx>/docs` no Engram (gist + ponteiro) |
| [commit-doc.mjs](commit-doc.mjs) | copia um doc para `<ctx>/docs/` e commita |
| [pack-skill.sh](pack-skill.sh) | empacota uma skill em `<nome>.skill` (upload no Cowork) |

> Sem Engram? Os scripts de memória dependem do binário `engram`. Se você não usa o Engram, ignore `backup-daily.sh`, `refresh-archive.mjs`, `index-engram.mjs` e `restore.sh`; `commit-doc.mjs` e `pack-skill.sh` continuam funcionando.

## `backup-daily.sh`

```bash
common/tools/backup-daily.sh <ctx>
```

Chama `refresh-archive --ctx <ctx> --all --sync --push`. Define PATH explícito (`/opt/homebrew/bin`, node do fnm) para rodar fora do shell interativo. Ver [`<ctx>/backup/README.md`](../../_context/backup/README.md).

## `restore.sh`

```bash
common/tools/restore.sh                      # lista contextos e pergunta qual
common/tools/restore.sh <ctx> [--project <nome>] [--dry-run] [--yes]
```

Faz `engram import` de cada `<ctx>/backup/engram/<projeto>/engram-export.json`. Rode em máquina nova/limpa: importar em um banco que já tem as memórias pode duplicá-las.

## `refresh-archive.mjs`

```bash
node common/tools/refresh-archive.mjs --ctx <ctx> [--project <nome> | --all] \
     [--sync] [--no-engram] [--push] [--dry-run] [--message <msg>]
```

Atualiza `<ctx>/backup/engram/<project>/engram-export.json` e, com `--sync`, os chunks em `.engram/`. Com `--all` percorre todos os projetos do contexto, gera **um** commit só com `<ctx>/backup` e `<ctx>/journal`, sem trailer de IA (modo automático). Sem `--all`, faz `git add -A` e commita com trailer `Co-authored-by`. O projeto default vem de `$ENGRAM_PROJECT`.

## `index-engram.mjs`

```bash
node common/tools/index-engram.mjs --ctx <ctx> --project <nome-engram> \
     [--root <archive>] [--scope project] [--engram <bin>] [--include-readonly] [--dry-run]
```

Um `engram save` por doc de `<ctx>/docs/` com `--topic archive-docs/<slug>` (upsert idempotente). `--scope` aqui é o escopo do Engram (project/personal/global), não o contexto. Ignora task docs regeneráveis e descartáveis.

## `commit-doc.mjs`

```bash
node common/tools/commit-doc.mjs <arquivo>... --ctx <ctx> [--to <rel-no-archive>] [--repo <path>] [--message <msg>] [--push]
```

Arquivo já dentro do repo → commit in place; externo → copiado para `<ctx>/docs/<to|basename>`. Autoria de IA como trailer `Co-authored-by`.

## `pack-skill.sh`

```bash
common/tools/pack-skill.sh <nome|caminho> [--out <dir>]    # default --out: ~/Downloads
```

Procura a skill em `common/skills/`, `common/skills/opcional/` e `<ctx>/skills/`; gera `<nome>.skill` (zip com a pasta da skill na raiz). Ver [`<ctx>/claude/skills/README.md`](../../_context/claude/skills/README.md).

> Atualize a tabela e a seção ao adicionar um script.
