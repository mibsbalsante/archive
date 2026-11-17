# tools — geradores dos docs de tasks

> Scripts gerais de arquivo/backup (`commit-doc`, `refresh-archive`, `index-engram`, `backup-daily`, `restore`) ficam em [../../common/tools/](../../common/tools/README.md).

Scripts determinísticos usados pelas skills `project-init` e `project-next-task`.
Transformam **arquivo → arquivo** (nada de payload grande no contexto do agente):
os insumos ficam em `<CTX>/tools/.tmp/`, descartável e apagado no fim de cada execução.

> O que persiste é apenas o `.md` gerado + estes scripts + o `README.md`.

> Os exemplos abaixo usam `<CTX>` (o nome do seu contexto) e `<LINEAR_TEAM>`/`<GITHUB_ORG>`/`<GITHUB_USER>`.

## `next-task.mjs` — orquestra o project-next-task (1 comando)

```bash
node <CTX>/tools/next-task.mjs [<handle>] [--doc <md>] [--no-commit] [--dry-run] [--keep-tmp] [--list]
```

O `<handle>` (ex.: `projeto-a`) é resolvido em `projects.json`; sem ele, usa o `default`
do dicionário. Faz, em sequência: `fetch-linear` ∥ `collect-prs` → `refresh-status` → `common/tools/commit-doc`,
e imprime **somente a tabela final**. `--list` imprime os handles.

## `projects.json` + `projects.mjs` — dicionário de projetos

```bash
node <CTX>/tools/projects.mjs list
node <CTX>/tools/projects.mjs get <handle>
node <CTX>/tools/projects.mjs add <handle> --doc <rel> [--nome <nome>] [--linear <id>] [--default]
node <CTX>/tools/projects.mjs sync     # regenera a seção ## Projetos do README
```

- `projects.json` é a **fonte da verdade**: `handle → { doc, nome, linear }` (`linear` = id do projeto no
  Linear, ou `""`). O `next-task` lê daqui — sem path hardcoded.
- A seção `## Projetos` do `<CTX>/docs/README.md` é **gerada** por `sync` (entre
  `<!-- projects:start -->`/`<!-- projects:end -->`); não editar essa lista à mão.
- O `project-init` registra/atualiza a entrada com `projects.mjs add` ao criar o doc de tasks.

## `fetch-linear.mjs` — status do Linear via GraphQL enxuta

```bash
node <CTX>/tools/fetch-linear.mjs (--doc <md> | --ids <LINEAR_TEAM>-1,<LINEAR_TEAM>-2 | --project <id>) --out <json> [--full]
```

- Fala direto com `https://api.linear.app/graphql` usando `LINEAR_ACCESS_TOKEN` (ou
  `LINEAR_API_KEY`) e pede **só os campos usados** (`identifier title url priority
  state{name} assignee{name} labels`; `--full` adiciona `description`).
- `--project <id>` traz todas as issues do projeto (pode incluir issues fora do
  `issue-tree`).
- Substitui o `search_issues_by_identifier` do MCP, que devolve descrição + comentários
  de cada issue (~250KB para 25 issues). O resultado vai direto para o arquivo — nada
  entra no contexto do agente.
- Saída no shape `{ issues: { nodes: [...] } }` (o mesmo que os outros scripts esperam).

## `collect-prs.mjs` — mapa de PRs por issue

```bash
node <CTX>/tools/collect-prs.mjs (--doc <md> | --ids <LINEAR_TEAM>-1,<LINEAR_TEAM>-2 | --linear <json>) --out <json> [--owner <GITHUB_ORG>]
```

- **1** busca `gh search prs` com os IDs unidos por `OR` + `in:title` (chunk de 40),
  em vez de uma busca por issue. Mapeia `<LINEAR_TEAM>-#### → { repo, number, state, draft }`.
- `in:title` + filtro local pelo `[<LINEAR_TEAM>-####]` do título evitam casar por corpo
  (um PR de outra issue entrando no mapa).

## `build-tasks.mjs` — gera o doc completo (project-init)

```bash
node <CTX>/tools/build-tasks.mjs \
  --linear <CTX>/tools/.tmp/<chave>.linear.json \
  --tree <issue-tree.md> \
  --config <CTX>/tools/.tmp/<chave>.config.json \
  --prs <CTX>/tools/.tmp/<chave>.prs.json \
  --bodies-from <CTX>/docs/<chave>-tasks.md \   # opcional: preserva as descrições verbatim
  --out <CTX>/docs/<chave>-tasks.md
```

Determinístico: mesma entrada → mesmo byte-a-byte de saída.

- `--linear` — saída do `fetch-linear.mjs` (shape `{ issues: { nodes: [...] } }`).
- `--tree` — `issue-tree.md` do SDD (fonte do `Blocked by`).
- `--config` — cabeçalho, repos, `codigos` (`<LINEAR_TEAM>-#### → B#/F#`), overrides, prioridade, divergências.
- `--prs` — mapa `<LINEAR_TEAM>-#### → { repo, number, state, draft }`.
- `--bodies-from` — doc anterior; os corpos de `#### Descrição completa (Linear)` são
  copiados verbatim (nunca reescritos) e reemitidos na ordem canônica.

### Formato fixo do doc (agrupado por repositório)

1. `# <projeto> — Tasks (ordem de entrega)` + cabeçalho
2. `## Índice` — links de seção + issues agrupadas por repositório (`[B1 <LINEAR_TEAM>-3989](#<LINEAR_TEAM>-3989)`)
3. `## Legenda` — emoji ↔ estado Linear, `B#`/`F#`, AFK/HITL
4. `## Resumo` (contagens estáticas — **sem status**)
5. `## Próximas tasks` — elegíveis por repositório (sem elegível, a 1ª da fila), `▶` na
   próxima de cada repo, entre `<!-- proximas:start -->` e `<!-- proximas:end -->`
   (derivado de status)
6. `## Ordem de entrega (topológica)` — visão global cross-repo (levels; **sem status**)
7. `## <repositório>` (um por repo) — levels do repo + tabela mestre
   `# · Título · ID · Código · Repositório · Milestone · AFK/HITL · Status · PR · Linear · Bloqueia · Bloqueada por`,
   entre `<!-- status:start -->` e `<!-- status:end -->` (**único lugar** com Status/PR)
8. `## Grafo de dependências` (Mermaid global, rótulos truncados em limite de palavra)
9. `## Divergências / atenção`
10. `## Descrições completas (verbatim do Linear)` — **imutável**; agrupada por repo, um
    `<details><summary>CÓD · <LINEAR_TEAM>-#### — título</summary>` por issue, corpo **sem blockquote**
    e headings do Linear rebaixados para negrito

Âncoras: cada issue tem `<a id="<LINEAR_TEAM>-####"></a>` (usada no índice, nas células de dependência,
na seção *Próximas tasks* e nas descrições). Os links de dependência **dentro do doc** são
internos (`[B7] [<LINEAR_TEAM>-3999](#<LINEAR_TEAM>-3999)`); só a coluna `Linear` e a saída do `refresh-status`
usam a URL completa.

## `refresh-status.mjs` — atualiza status/PR e imprime as tasks (project-next-task)

```bash
node <CTX>/tools/refresh-status.mjs --doc <CTX>/docs/<chave>-tasks.md \
     --linear <CTX>/tools/.tmp/<chave>.linear.json --prs <CTX>/tools/.tmp/<chave>.prs.json [--dry-run]
```

- Altera **somente** as células `Status` e `PR` das tabelas mestre e **reconstrói** a seção
  `## Próximas tasks` (entre `<!-- proximas:start -->`/`<!-- proximas:end -->`). Idempotente
  e consistente com o `build-tasks.mjs`.
- Imprime no stdout **todas as tasks não encerradas**, de **todos** os repositórios:
  `Repositório | Task | Nome | Milestone | Status | Bloqueada por | Bloqueia`
  (ids com link do Linear; `▶` na primeira não encerrada de cada repo, elegíveis primeiro;
  `Task` traz o código junto — `[<LINEAR_TEAM>-####](url) \| B#`; `Status` = emoji + nome cru do
  estado no Linear, sem tradução; cada item de `Bloqueada por` leva o emoji do status da task
  bloqueadora).
- Ordem: por repositório (ordem do cabeçalho `> Repositórios:`), e dentro de cada repo
  **elegíveis primeiro** (dependências `Done`/`Canceled`). Fora: `Done`, `Canceled` e
  `Duplicate`; entram `Backlog`/`Todo`, `In Progress`, `In Review`, `Validation` e `Blocked`.
