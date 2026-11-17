---
name: archive-project-init
description: >
  Inicializa um projeto refinado no SDD: consolida o projeto Linear + os artefatos
  do repo de SDD num doc único de tasks (markdown legível, ordem por
  prioridade/dependência, descrição completa de cada issue). Formato fixo e
  determinístico (script + template); a seção "## Descrições completas (verbatim do
  Linear)" é imutável. Use para "inicializar projeto", "inicializar a entrega",
  "organizar/ordenar tasks do projeto" ou "ordenar issues por dependência".
  Triggers: project-init, iniciar tarefa, archive-project-init.
argument-hint: <link-do-projeto-linear> <chave-da-entrega>
arguments: [project_url, delivery_key]
allowed-tools: Read, Grep, Glob, Bash, Write, Task
---

# Inicialização de projeto

Global. Gera o doc operacional da entrega em `<ARCHIVE_DIR>/<CTX>/docs/`. Para a próxima task depois, use `archive-project-next-task`.

## Regras

1. **Determinístico** — gerado por `<ARCHIVE_DIR>/<CTX>/tools/build-tasks.mjs`; o template do passo 7 é só fallback.
2. **`Status`/`PR` só nas tabelas mestre** (entre `<!-- status:start -->`/`<!-- status:end -->`) — nunca no resumo, ordem ou metadados de seção.
3. **`## Descrições completas (verbatim do Linear)` é imutável** — regerar sempre com `--bodies-from <doc atual>`.
4. Insumos (`config`, `prs`, export do Linear) são **temporários** (`<ARCHIVE_DIR>/<CTX>/tools/.tmp/`) — nunca commitar.

## Entradas (perguntar antes só o que faltar)

Recebido: link `$project_url` · chave `$delivery_key`. Placeholder vazio ou literal = não informado.

- **Link do projeto Linear** — a URL traz o id que o `get_project` resolve em 1 chamada.
- **Chave da entrega** — pasta em `$SDD_REPO/domains/**/<chave>/` (`SDD_REPO` = caminho do repo de SDD/refinamento técnico; exporte no ambiente ou ajuste os comandos).
- **Nome do projeto para PRs** — épico curto do título (`[<LINEAR_TEAM>-0000] [<nome>] …`).
- **Repos** (multi) — viram a coluna `Repositório`.

## Etapa 0

```bash
git -C $SDD_REPO switch main && git -C $SDD_REPO pull origin main
```

## Fluxo

1. **Artefatos** — `find <SDD_REPO>/domains -type d -name "<chave>"`; ler **só `issue-tree.md`** (deps + códigos).
2. **Linear (1 fetch)** — `node <ARCHIVE_DIR>/<CTX>/tools/fetch-linear.mjs --ids <ids do issue-tree + overrides> --out <ARCHIVE_DIR>/<CTX>/tools/.tmp/<chave>.linear.json --full`. O script fala direto com a GraphQL do Linear (`LINEAR_ACCESS_TOKEN`) e pede só os campos usados + `description` — **as descrições vão para o arquivo, nunca para o contexto**. `--project <id>` traz todas as issues do projeto (cuidado: pode incluir issues fora do `issue-tree`, que viram `overrides`). Sem token → fallback: `get_project` + **1** `search_issues_by_identifier` (evitar `get_issue`), gravando o resultado no mesmo arquivo.
3. **PRs** — `node <ARCHIVE_DIR>/<CTX>/tools/collect-prs.mjs --linear <ARCHIVE_DIR>/<CTX>/tools/.tmp/<chave>.linear.json --out <ARCHIVE_DIR>/<CTX>/tools/.tmp/<chave>.prs.json` (1 busca `gh` com os IDs unidos por `OR` + `in:title`, filtrando pelo `[<LINEAR_TEAM>-####]` do título).
4. **Mapear** — `[B#]/[F#] ↔ <LINEAR_TEAM>-####` e `Blocked by` (do `issue-tree.md`); `Bloqueia` = inverso, o script calcula.
5. **Config** — `<ARCHIVE_DIR>/<CTX>/tools/.tmp/<chave>.config.json`: `projeto{nome,url,id,time,timeKey}`, `repos`, `fonteSdd`, `snapshot`, `prioridade`, `codigos`, `overrides` (issues fora do `issue-tree.md`), `divergencias`.
6. **Gerar** —
   ```bash
   node <ARCHIVE_DIR>/<CTX>/tools/build-tasks.mjs \
     --linear <ARCHIVE_DIR>/<CTX>/tools/.tmp/<chave>.linear.json \
     --tree <SDD_REPO>/domains/**/<chave>/issue-tree.md \
     --config <ARCHIVE_DIR>/<CTX>/tools/.tmp/<chave>.config.json \
     --prs <ARCHIVE_DIR>/<CTX>/tools/.tmp/<chave>.prs.json \
     [--bodies-from <ARCHIVE_DIR>/<CTX>/docs/<pasta>/<chave>-tasks.md] \
     --out <ARCHIVE_DIR>/<CTX>/docs/<pasta>/<chave>-tasks.md
   ```
   `--bodies-from` só na regeração.
7. **Fallback** — se o script não cobrir algo, seguir este formato à mão e registrar em `divergencias`:
   1. `# <projeto> — Tasks (ordem de entrega)` + cabeçalho (`> Projeto Linear:` · `> Repositórios:` · `> Fonte SDD:` · `> Snapshot:`)
   2. `## Índice` — links + issues por repositório (`[B1 <LINEAR_TEAM>-3989](#<LINEAR_TEAM>-3989)`)
   3. `## Legenda` — emoji ↔ estado Linear, `B#`/`F#`, AFK/HITL
   4. `## Resumo` — contagens estáticas (**sem status**)
   5. `## Próximas tasks` — elegíveis por repo, `▶` na próxima de cada, entre `<!-- proximas:start -->`/`<!-- proximas:end -->`
   6. `## Ordem de entrega (topológica)` — global cross-repo (levels; **sem status**)
   7. `## <repositório>` (1 por repo) — levels do repo + tabela mestre `# · Título · ID · Código · Repositório · Milestone · AFK/HITL · Status · PR · Linear · Bloqueia · Bloqueada por`, entre `<!-- status:start -->`/`<!-- status:end -->`
   8. `## Grafo de dependências` (Mermaid global)
   9. `## Divergências / atenção`
   10. `## Descrições completas (verbatim do Linear)` — **imutável**; por repo, 1 `<details>` por issue com `<a id="<LINEAR_TEAM>-####"></a>` antes
8. **Salvar + registrar** — o doc vai para `<ARCHIVE_DIR>/<CTX>/docs/<pasta>/<chave>-tasks.md`; registre no dicionário com `node <ARCHIVE_DIR>/<CTX>/tools/projects.mjs add <handle> --doc <CTX>/docs/<pasta>/<chave>-tasks.md --nome "<nome>" [--linear <id-do-projeto>] [--default]` (o `add` regenera a seção `## Projetos` do `<CTX>/docs/README.md`). O `<handle>` é o que o `archive-project-next-task` recebe.
9. **Limpeza (obrigatória)** — `rm -rf <ARCHIVE_DIR>/<CTX>/tools/.tmp`. Persiste só o `<chave>-tasks.md`, `tools/` e `README.md`.
10. **Commit** — `node <ARCHIVE_DIR>/common/tools/commit-doc.mjs <ARCHIVE_DIR>/<CTX>/docs/<pasta>/<chave>-tasks.md <ARCHIVE_DIR>/<CTX>/tools/projects.json <ARCHIVE_DIR>/<CTX>/docs/README.md [--push]` (arquivos já no repo → commit in place).

## Tokens

Arquivo → arquivo; ao contexto só a projeção que decide.

- **Nunca** buscar descrições pelo MCP: `fetch-linear.mjs --full` grava em arquivo e o payload enxuto não entra no contexto. Se truncar, ler `~/.local/share/opencode/tool-output/tool_*.txt` — nunca re-fetch.
- Descrições nunca no contexto (o script lê do arquivo).
- `gh` enxuto: **1** busca de PRs via `collect-prs.mjs`; exploração pesada → sub-agent `explore`; paralelizar chamadas independentes.

## Armadilhas

- Os docs são versionados no repo privado `<ARCHIVE_DIR>` (branch `main`) — o `commit-doc.mjs` commita in place quando o arquivo já está no repo (nada de `git add -f` manual no work repo).
- **Nunca** commitar docs nos repos de trabalho.
- `gh search prs` casa por corpo: o `collect-prs.mjs` filtra pelo `[<LINEAR_TEAM>-####]` do título (senão um PR de outra issue entra no mapa).
- Cancelada pode quebrar a cadeia; `Contract from` órfão → `divergencias`.
- Não reescrever as descrições verbatim: mudança de escopo no Linear → `divergencias`.
