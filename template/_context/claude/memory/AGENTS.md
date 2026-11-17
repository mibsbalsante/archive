# Global context

<!--
PLACEHOLDER — ajuste ao seu perfil.
Este arquivo é o contexto global do OpenCode/Claude Code, instalado por
`bootstrap.sh --memory` em ~/.config/opencode/AGENTS.md (e importado por ~/.claude/CLAUDE.md).
Cada projeto pode sobrescrevê-lo com seu próprio AGENTS.md/CLAUDE.md.
Troque <CTX>, <GITHUB_USER>, <GITHUB_ORG>, <LINEAR_WORKSPACE>, <LINEAR_TEAM>, <REPO> pelos seus valores.
-->

Each project's `AGENTS.md`/`CLAUDE.md` overrides these rules.

**Profile:** frontend priority, scope varies. High technical level — don't explain basics. Bilingual (pt/en), direct, no recap.

**Behavior:** don't speculate. Ask for clarification when ambiguous. Assume the user can solve the problem — act with confidence and precision. When asked for a shell command to recall syntax: command + short example only.

**Code comments:** only when the code genuinely needs description. JSDoc is an exception. Cite flags by their full constant name, never abbreviated. Task IDs belong in the PR description, not in comments — they become dead comments once the task is delivered. Temporary code that a specific future task will remove or replace: use `// todo: será <removido/alterado> em <TASK-ID> (<motivo curto>)`, list it in the PR description, and drop the comment when that task starts. Never use this for placeholders describing code to be added later.

## Code scope

- Don't touch code outside the current task. Flag out-of-scope issues that could break the project.
- Ignore files outside the task — some are maintained by other teams.
- Improvements can be noted; the branch diff is what matters for review.
- Maintenance improvements in the Design System are welcome — separate commit.

## Shell

Don't run any shell command unless it's the immediate next step of an explicit request. Authorization applies to that message only. Tests and lint are **always running in parallel** — never run them; ask for manual execution when output is needed.

End every message requiring a manual script with:
> 🔴 **Rodar manualmente:** `<comando>`

If a Stop hook injects typecheck/lint output into context: treat as informational, don't act.

## PRs

Never remove sections from the PR template — keep all of them. When the template has checkbox groups (e.g. type of change), keep all checkboxes — only mark the relevant ones.

<!--
Se você usa um template de PR com seção de estatísticas, documente aqui o formato acordado.
Ex.:

### Estatísticas

`Estatísticas` é uma **subseção de `## Mudanças`** (`### Estatísticas`), posicionada **no topo dessa seção** — nunca uma seção `##` própria.
-->

### PRs parados (>2 dias)

PR aberto há mais de 2 dias **sem PR dependente** na stack: sugerir recriar — fechar e abrir um novo com o mesmo diff. PR antigo sem dependentes distorce a métrica de lead time.

## Branches

`<GITHUB_USER>/<task-id>-nome-da-task` — lowercase, hífens, português. Ex: `<GITHUB_USER>/ABC-1234-adiciona-filtros-na-tabela`

## Linear / GitHub naming

**Linear:** `[<repo>][<domínio>] <nome> — T-NN`
**PR:** `[<LINEAR_TEAM>-0000] [<repo>][<domínio>] <nome>`

Travessão longo (em dash).

**Status no Linear:** nunca mover tasks manualmente no Linear — o status acompanha o status do PR.

## Commits

`feat: mensagem em português` — simple Conventional Commits. Details stay in the PR title and branch name.

### Autoria de IA

Ao criar commits, sempre indicar autoria de IA. Usar `Co-authored-by` no corpo do commit como trailer:

```
Co-authored-by: <Modelo> <noreply@deepseek.com>
```

O modelo deve ser o informado no system prompt ("You are powered by the model named ..."). A mensagem de commit continua sendo Conventional Commit em português; a indicação de IA entra como trailer/rodapé.

## React.js

Design System first for UI. Default branch: `main`.

**Business rules:** confirm what will be saved before creating/editing any documentation file. Check connections between apps to simplify delivery.

**Sources:** code solution → `Fonte: NomeDoArquivo → nomeDaFuncao()` | external → `Ref: [name]`

**Free-read:** `<ARCHIVE_DIR>/` (docs do arquivo) · repos de leitura livre: _a preencher_

## Project docs

Always create documentation files (`.md`) in the archive repo `<ARCHIVE_DIR>` (branch `main`, `<CTX>/docs/`), not in the project repo. This keeps operational docs versioned and shared across machines, separate from repo documentation.

## Skills (sync)

**Sentido único:** skill nova/atualizada nasce no arquivo (`common/skills/`, `common/skills/opcional/` ou `<CTX>/skills/`) → `~/.claude/skills` (symlink, via `<CTX>/claude/bootstrap.sh --skills`) → OpenCode e Claude Code (leem esse diretório nativamente). Nunca instalar/editar direto em `~/.config/opencode/skills` nem copiar à mão para `~/.claude/skills`.

Skill manual (`disable-model-invocation: true`) precisa de comando `/` em `<CTX>/claude/opencode/commands/` para o OpenCode. Detalhes, checklist e diferenças entre ferramentas: `common/docs/skills-sync.md`.

## Memória (Engram) — uso consciente de tokens

- **Boot enxuto:** iniciar com `mem_context` em `compact=true` e `max_bytes` baixo (~6000); não carregar prompts antigos.
- **Busca sob demanda:** `mem_search` com `response_format=compact` e `limit` 5–8; `mem_get_observation` só quando precisar do texto completo.
- **`topic_key` sempre** em conhecimento durável (upsert em vez de duplicar): ex. `architecture/auth-model`.
- **Sessões paralelas (vários repos e apps ao mesmo tempo):** nunca passar `session_id` em `mem_save`/`mem_session_summary`; sem ele o engram resolve a sessão do projeto. Se falhar com `session_already_ended`, repetir a mesma chamada sem `session_id`; não abrir sessão nova com `mem_session_start` nem inventar ID. Passar `project` explícito só se a resolução for ambígua.
- **Docs ≠ memória:** `<CTX>/docs` é leitura humana; a memória guarda gists atômicos **+ ponteiro**, nunca o texto do doc.
