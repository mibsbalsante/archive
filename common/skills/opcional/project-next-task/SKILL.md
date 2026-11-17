---
name: project-next-task
description: >
  Atualiza os status do doc de tasks a partir do Linear e responde as tasks do
  projeto. Altera só Status e PR das tabelas mestre; a saída é uma única tabela com
  TODAS as tasks não encerradas de todos os repositórios, agrupadas por repositório
  e com elegíveis primeiro. Commita o doc no branch main do repo <ARCHIVE_DIR>.
  Use para "qual a próxima task", "o que pego agora",
  "atualiza os status e me diz a próxima" ou "next task".
argument-hint: '[<handle>] [--dry-run]'
allowed-tools: Bash, Read
---

# Próxima task (refresh de status)

Global, para o projeto já inicializado pelo `project-init`. O doc alvo vem do dicionário `<ARCHIVE_DIR>/<CTX>/tools/projects.json` (via `<handle>`; sem handle, usa o `default`). Atualiza o doc com o status fresco do Linear **antes** de responder e devolve **só uma tabela**.

## Fluxo

Um único comando faz tudo — fetch do Linear → PRs → refresh do doc → commit — e imprime só a tabela:

```bash
node <ARCHIVE_DIR>/<CTX>/tools/next-task.mjs $ARGUMENTS
```

`$ARGUMENTS` = `<handle>` opcional (ex.: `projeto-a`, `projeto-b`; vazio = `default`) + flags.

- **Não** leia o doc, **não** chame o MCP do Linear, **não** rode `gh` à mão: o `next-task.mjs` orquestra os três scripts (ver `<ARCHIVE_DIR>/<CTX>/tools/README.md`).
- `--dry-run` calcula sem escrever o doc e sem commitar; `--no-commit` escreve mas não commita; `--list` lista os handles.
- **Responda apenas a tabela impressa**, sem texto extra.

## Pode / não pode

- **Pode** (via script): células `Status`/`PR` das tabelas mestre (entre `<!-- status:start -->`/`<!-- status:end -->`) e a seção `## Próximas tasks`.
- **Nunca:** cabeçalho, índice, ordem de entrega, grafo, divergências e a seção `## Descrições completas (verbatim do Linear)`.
- Desatualizado fora disso → não corrigir aqui; sugerir rodar `project-init`.

## Saída (única tabela, por repositório)

| Repositório | Task | Nome | Milestone | Status | Bloqueada por | Bloqueia |
|---|---|---|---|---|---|---|
| <serviço> | ▶ [<LINEAR_TEAM>-3996](url) \| B11 | <nome da task> | US5 | ⚪ Backlog | ✅ [<LINEAR_TEAM>-3989](url) | [<LINEAR_TEAM>-4005](url) |
| <front> | [<LINEAR_TEAM>-4000](url) \| F3 | <nome da task> | US4 | 🟡 In Progress | 🟡 [<LINEAR_TEAM>-3997](url) | [<LINEAR_TEAM>-4008](url) |

- **Todas** as tasks **não encerradas**, de **todos** os repositórios, agrupadas por repositório (ordem do cabeçalho) e com **elegíveis primeiro**.
- Fora da tabela: `Done`, `Canceled`, `Duplicate`. Entram `Backlog`/`Todo`, `In Progress`, `In Review`, `Validation` e `Blocked`.
- `▶` = próxima de cada repo (1ª elegível). `Task` = `<LINEAR_TEAM>-####` com link + ` | ` + código (`B#`/`F#`); `Bloqueada por`/`Bloqueia` = `<LINEAR_TEAM>-####` com link (`,` entre vários; `—` vazio); cada item de `Bloqueada por` leva o **emoji do status** da task bloqueadora (`✅` Done, `⛔` Canceled, `🟡` In Progress, `⚪` Backlog…); `Status` = **emoji + nome** do estado no Linear (sem tradução); `Nome` = título sem `[Macro]`.

## Fallback (sem script)

Só se o `next-task.mjs` falhar (ex.: `LINEAR_ACCESS_TOKEN` ausente no ambiente). `<doc>` = `node <ARCHIVE_DIR>/<CTX>/tools/projects.mjs get <handle>`:

1. Buscar via MCP `search_issues_by_identifier` (todos os IDs da tabela mestre) e salvar o resultado em `<ARCHIVE_DIR>/<CTX>/tools/.tmp/<handle>.linear.json`.
2. `gh search prs --owner <GITHUB_ORG> "<IDs unidos por OR> in:title" --limit 100 --json number,state,isDraft,repository,title` → montar `<ARCHIVE_DIR>/<CTX>/tools/.tmp/<handle>.prs.json`.
3. Rodar `refresh-status.mjs --doc <doc> --linear … --prs …` (ver `<ARCHIVE_DIR>/<CTX>/tools/README.md`).

Editar `Status`/`PR` à mão é o último recurso.

## Tokens

- 1 comando; nenhum payload do Linear/`gh` entra no contexto (os insumos vão para `<CTX>/tools/.tmp/`, apagado no fim).
- Não ler o doc (as descrições são enormes) nem re-buscar em caso de erro.

## Armadilhas

- O commit é feito pelo `commit-doc.mjs`, que grava no repo `<ARCHIVE_DIR>` (branch `main`) — **nunca** no work repo.
- Cancelada satisfaz o pré-requisito, mas pode indicar escopo descartado; `Contract from` soft não bloqueia, mas pode impedir o fechamento.
- Doc inexistente → rodar `project-init` primeiro.
