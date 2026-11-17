---
name: implement-task
description: Variação enxuta de uma skill `implement-task` existente no ambiente (procura a original; depende dela e herda updates), com uma rodada de perguntas, exploração mínima, comandos escopados, sem rodar testes, sem esperar checks de CI (o usuário reporta o resultado), branch no padrão do repo e PR Draft na convenção do repo, só labels no Linear, sem teste visual nem merge com main. Agnóstico de repo e de CLI. Triggers: desenvolver issue, implement-task, implementar issue Linear.
argument-hint: <ISSUE-ID> [branch-base] [path-docs-extras]
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Task, AskUserQuestion, mcp__linear-server__*, mcp__plugin_linear_linear__*, mcp__claude_ai_Linear__*, mcp__github__*
---

# implement-task

Wrapper de uma skill `implement-task` existente: rodar as Fases 1-8 do original — **fonte da verdade, ler antes de agir**; não duplicar o fluxo — com os ajustes abaixo. **Agnóstico de repo** — deriva convenções do `CLAUDE.md`/config de cada projeto; nada de pnpm ou de time do Linear fixo.

Entrada: `<ISSUE-ID> [branch-base] [path-docs-extras]`, recebida como texto logo após a invocação. Campo ausente ou vazio = não informado. Sem base, usar a atual; sem path, pedir no setup.

## Fonte da verdade (original)

Procurar a skill `implement-task` existente no ambiente pela primeira alternativa que existir — nunca executar o fluxo de memória:

1. Skill de plugin `implement-task` já carregada na sessão (Claude Code) — qualquer namespace (ex.: `<plugin>:implement-task`).
2. `${CLAUDE_PLUGIN_ROOT}/skills/implement-task/SKILL.md` (o Claude Code define a variável).
3. Skill `implement-task` de plugin instalada em `~/.claude/plugins/**/skills/implement-task/SKILL.md` — também o caso do OpenCode, que não define `CLAUDE_PLUGIN_ROOT`.
4. Skill de projeto em `<repo>/.claude/skills/implement-task/SKILL.md` ou `<repo>/.opencode/skills/implement-task/SKILL.md`.

> Esta skill **não** vem com o original: ela é um wrapper fino. Se o ambiente não tiver nenhuma `implement-task` original, parar e avisar — nunca reproduzir o fluxo de memória nem inventar fases.

Os `shared/*.md` citados pelo original (`HUMAN-DECISION-OPS`, `WORKTREE-OPS`, `LINEAR-OPS`, `PATTERN-SEARCH`, `tdd-prompt`) ficam em `<CLAUDE_PLUGIN_ROOT>/shared/`; o addendum do repo, em `<CLAUDE_PLUGIN_ROOT>/skills/implement-task/repos/<repo>.md`, quando houver.

## Precedência de convenções

Convenção do repo (`CLAUDE.md`, `AGENTS.md`, `.claude/rules/*`, addendum do repo) > convenção global do usuário (`~/.config/opencode/AGENTS.md`, `~/.claude/CLAUDE.md`) > default do original. O original só decide o que nenhuma das anteriores aborda: "agnóstico de repo" não é licença para aplicar um default quando o repo já diz outra coisa.

## Equivalência de tools

O original é escrito para Claude Code. Sem `CLAUDE_PLUGIN_ROOT` (OpenCode), traduzir:

| Original | OpenCode |
| --- | --- |
| `AskUserQuestion` | tool `question` — uma rodada só |
| `ToolSearch` | catálogo de tools via `execute` → `search(...)` |
| `Task` / subagente | tool `subagent` |
| `mcp__linear-server__*`, `mcp__plugin_linear_linear__*`, `mcp__claude_ai_Linear__*` | `tools.linear.*` |
| `mcp__github__*` | `gh` via shell |
| `EnterWorktree` / `ExitWorktree` | `tools.opencode.worktree_create` / `worktree_remove` |

## Setup (uma rodada só)

Após ler a issue e o modo (Fase 1) e checar `CODEOWNERS` (`CODEOWNERS`, `.github/`, `docs/`), fazer **uma** pergunta (`question` no OpenCode, `AskUserQuestion` no Claude Code) só com o aplicável e pedir na mesma mensagem o **path de docs extras** em texto livre (vazio = sem extras). Nunca re-perguntar; fora disso, só em bloqueio real.

- **Modo** (só standalone com detalhe técnico): Planejado / Autônomo.
- **UI/Figma** (só com sinal de UI): delegar ao especialista de frontend do repo, se existir / seguir no lite.
- **Feature flag** (só se o projeto usa): Sim / Não.
- **Reviewers** (só sem CODEOWNERS): indicar ou pular.
- **Observações** (sempre): texto livre multiline — permite pular linha; vazio = sem observações.

## Economia (sempre)

- **Linear sem prefixo fixo:** usar as tools do Linear disponíveis no ambiente (Claude Code: `mcp__linear-server__*`, `mcp__plugin_linear_linear__*`, `mcp__claude_ai_Linear__*`; OpenCode: `tools.linear.*`) — descobrir só se necessário.
- **Exploração mínima:** só arquivos da issue + vizinhos + testes + `CLAUDE.md` do app + path informado. Sem mapear o repo, sem buscar similares, sem sugerir criar/atualizar `CLAUDE.md`.
- **Comandos escopados:** escopar ao pacote/módulo afetado conforme o repo (`--filter` em pnpm/turbo, `-pl` no Maven, etc.); colar só o erro.
- **Análise de impacto escrita uma vez** (PR + Linear).

## Overrides por fase

- **F1 Figma:** se houver especialista de frontend no repo, delegar e encerrar.
- **F3 Nome da branch:** antes de criar qualquer branch, ler o padrão do repo (`grep -i branch` em `CLAUDE.md`, `AGENTS.md`, `.claude/rules/*`). Havendo padrão, ele **substitui** a derivação `<type>/<issue-id>-<short-description>` do original — inclusive quando o original proíbe usar o `gitBranchName` da issue. A derivação por tipo só vale com repo silencioso. Confrontar o nome final com o padrão lido e renomear antes de criar se não casar — nunca criar fora do padrão.
- **F3 Branch existente:** quando a resolução achar vários nomes, a pergunta de setup oferece **só** os nomes encontrados — nunca "criar branch nova". Se o usuário mandar descartar os commits, reusar o **mesmo nome** (reset da branch), preservando o padrão que já estava lá.
- **F3 Branch:** direto da base (nunca a principal).
- **F3/8 PR:** título na convenção do repo/ticket já na criação (no rf: `[<ISSUE-ID>] [<Projeto>] <Nome>`); sempre **Draft** (nunca `gh pr ready`).
- **F5/6 Testes:** escrever, nunca executar; F6 só lint + build escopados.
- **F7 Teste visual:** pular.
- **F8 Linear:** não mudar `status`; só labels existentes (`ed-ai-generated` + projeto + tipo).
- **F8 CI:** nunca esperar nem acompanhar checks — `gh pr checks --watch`/polling são proibidos. Abrir o Draft, entregar os links dos PRs e **pedir ao usuário que reporte o resultado do CI**. Encerrar com `SHIP_INDETERMINATE: <PR_URL> | CI: aguardando o usuário | SHA: <sha>`, sem reivindicar `SHIP_DONE` nem `SHIP_FAILED`. Quando o usuário reportar: passou → `SHIP_DONE`; falhou → colar só o erro, propor o fix mínimo e pedir autorização antes de commitar/pushar.
- **F8 Merge com main:** pular.

Resto (classificação, plano, convenções, commits, resumo) segue o original.
