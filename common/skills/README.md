# common/skills

Skills gerais — usam só `git`/`gh`, sem plugin nem repo específico. Instaladas por `<ctx>/claude/bootstrap.sh --skills` (junto com as opcionais e as do contexto).

> **Prefixo obrigatório:** toda skill daqui chama-se `archive-<nome>` (pasta e `name`), para nunca colidir com as skills de quem instala. O gatilho curto fica na `description`. Ver [../docs/skills-sync.md](../docs/skills-sync.md).

> **Fonte única e instalação:** a skill nasce aqui e vai por symlink para `~/.claude/skills`, lido pelo OpenCode e pelo Claude Code.

| Skill | Para quê |
|---|---|
| [archive-branch-fix](archive-branch-fix/SKILL.md) | correção guiada no branch atual |
| [archive-branch-fix-clean](archive-branch-fix-clean/SKILL.md) | variação enxuta do `archive-branch-fix` |
| [archive-comment-check](archive-comment-check/SKILL.md) | avalia comentários de review contra o código do branch e sugere respostas |

Skills que dependem de plugin/empresa ficam em [`opcional/`](opcional/) ou em `<ctx>/skills/`.

## opcional/

Skills que dependem de Linear, Slack, `gh` e dos scripts de `<ctx>/tools/`. Elas funcionam só se você configurou essas ferramentas; por isso ficam separadas — as de `skills/` são instaladas sempre, estas também são instaladas pelo `bootstrap.sh --skills`, mas você pode removê-las sem quebrar as demais.

| Skill | Dependência | Para quê |
|---|---|---|
| [archive-implement-task](opcional/archive-implement-task/SKILL.md) | uma skill `implement-task` original existente no ambiente (wrapper fino; inútil sem o original) | desenvolve uma issue do Linear com fluxo enxuto |
| [archive-project-init](opcional/archive-project-init/SKILL.md) | `<ctx>/tools` + Linear | gera o doc de tasks de um projeto |
| [archive-project-next-task](opcional/archive-project-next-task/SKILL.md) | `<ctx>/tools` + Linear + `gh` | atualiza status e lista as próximas tasks |
| [archive-journalling](opcional/archive-journalling/SKILL.md) | `<ctx>/journal` + Linear, Slack, GitHub | registro diário que alimenta a AVD |
| [archive-trashcan](opcional/archive-trashcan/SKILL.md) | `<ctx>/journal` | anota texto solto no dump diário que a `archive-journalling` consome |

> Atualize a tabela ao adicionar uma skill.
