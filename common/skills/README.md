# common/skills

Skills gerais — usam só `git`/`gh`, sem plugin nem repo específico. Instaladas por `<ctx>/claude/bootstrap.sh --skills` (junto com as opcionais e as do contexto).

> **Fonte única e instalação:** a skill nasce aqui e vai por symlink para `~/.claude/skills`, lido pelo OpenCode e pelo Claude Code. Ver [../docs/skills-sync.md](../docs/skills-sync.md).

| Skill | Para quê |
|---|---|
| [branch-fix](branch-fix/SKILL.md) | correção guiada no branch atual |
| [branch-fix-clean](branch-fix-clean/SKILL.md) | variação enxuta do `branch-fix` |
| [comment-check](comment-check/SKILL.md) | avalia comentários de review contra o código do branch e sugere respostas |

Skills que dependem de plugin/empresa ficam em [`opcional/`](opcional/) ou em `<ctx>/skills/`.

## opcional/

Skills que dependem de Linear, Slack, `gh` e dos scripts de `<ctx>/tools/`. Elas funcionam só se você configurou essas ferramentas; por isso ficam separadas — as de `skills/` são instaladas sempre, estas também são instaladas pelo `bootstrap.sh --skills`, mas você pode removê-las sem quebrar as demais.

| Skill | Dependência | Para quê |
|---|---|---|
| [implement-task](opcional/implement-task/SKILL.md) | uma skill `implement-task` existente no ambiente (wrapper fino; inútil sem o original) | desenvolve uma issue do Linear com fluxo enxuto |
| [project-init](opcional/project-init/SKILL.md) | `<ctx>/tools` + Linear | gera o doc de tasks de um projeto |
| [project-next-task](opcional/project-next-task/SKILL.md) | `<ctx>/tools` + Linear + `gh` | atualiza status e lista as próximas tasks |
| [journalling](opcional/journalling/SKILL.md) | `<ctx>/journal` + Linear, Slack, GitHub | registro diário que alimenta a AVD |
| [trashcan](opcional/trashcan/SKILL.md) | `<ctx>/journal` | anota texto solto no dump diário que a `journalling` consome |

> Atualize a tabela ao adicionar uma skill.
