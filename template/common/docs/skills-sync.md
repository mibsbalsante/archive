# Skills — fonte única e sentido do sync

Regra: **skill nova ou atualizada nasce no arquivo e só depois chega às ferramentas.** O fluxo nunca volta.

```
arquivo (fonte)  →  ~/.claude/skills (instalação, symlink)  →  OpenCode + Claude Code (leitura)
```

Não existe cópia intermediária: o OpenCode lê `~/.claude/skills` nativamente, e o Claude Code lê o mesmo diretório. Um alvo só, dois consumidores.

## Prefixo `archive-`

Toda skill deste arquivo carrega o prefixo **`archive-`** no `name` (e na pasta), e todo comando `/` replicado tem o mesmo prefixo. Assim nada colide com skills/comandos de quem instala:

| Skill | Comando |
|---|---|
| `archive-branch-fix` | `/archive-branch-fix` |
| `archive-branch-fix-clean` | `/archive-branch-fix-clean` |
| `archive-comment-check` | `/archive-comment-check` |
| `archive-journalling` | `/archive-journalling` |
| `archive-trashcan` | `/archive-trashcan` |
| `archive-project-init` | `/archive-project-init` |
| `archive-project-next-task` | `/archive-project-next-task` |
| `archive-implement-task` | `/archive-implement-task` |

O gatilho antigo continua na `description` (`Triggers: journalling, ...`), então "registro do dia" e "trashcan" ainda carregam a skill certa. **Nomes de arquivo de dados não levam prefixo** (`journal/.trashcan.md` é o dump, não a skill).

## Camadas

| Camada | Caminho | Papel |
|---|---|---|
| Fonte | `common/skills/<nome>/` · `common/skills/opcional/<nome>/` · `<ctx>/skills/<nome>/` | onde a skill é escrita e versionada |
| Instalação | `~/.claude/skills/<nome>` → symlink para a fonte | único ponto instalado |
| Consumidor | OpenCode (global) | lê `~/.claude/skills` e `~/.config/opencode/skills` |
| Consumidor | Claude Code (global) | lê `~/.claude/skills` |
| Empacotamento | `common/tools/pack-skill.sh <nome>` | gera `<nome>.skill` para o Cowork (não lê o destino, lê a fonte) |

Onde cada skill mora:

- `common/skills/` — só `git`/`gh`, sem plugin, Linear ou repo de empresa.
- `common/skills/opcional/` — dependem de plugin, Linear/GitHub CLI e dos scripts de `<ctx>/tools/`; podem ser removidas sem quebrar as demais.
- `<ctx>/skills/` — dependem de ferramentas específicas de um contexto.

Skills de **projeto** (`.claude/skills/` dentro de um repo de trabalho) não passam por aqui: pertencem ao work repo e já são lidas pelos dois agentes. Esta nota vale para as skills **pessoais**.

## Instalar / atualizar

```bash
<ctx>/claude/bootstrap.sh --skills     # cria/atualiza os symlinks em ~/.claude/skills
```

O `--skills` é idempotente:

- fonte nova → cria o symlink;
- symlink já apontando para a fonte → não faz nada;
- diretório real de uma instalação antiga (cópia) → move para `<nome>.old` e cria o symlink;
- symlink apontando para outro lugar → substitui.

Como o destino é symlink, **editar no repo já vale nas duas ferramentas** — não há passo de re-instalação nem risco de drift. Só rode o `--skills` quando adicionar ou remover uma skill.

## Checklist de skill nova

1. Criar `<ctx>/skills/<nome>/SKILL.md` (ou `common/skills/`, `common/skills/opcional/` se for genérica/opcional).
2. Frontmatter: `name` igual ao nome da pasta (`^[a-z0-9]+(-[a-z0-9]+)*$`), `description` de 1–1024 caracteres com os gatilhos.
3. Atualizar o índice da pasta (`README.md`) do contexto e/ou de `common/skills/`.
4. Rodar `<ctx>/claude/bootstrap.sh --skills`.
5. Se a skill for de invocação manual (`disable-model-invocation: true`), criar o comando `/` correspondente em `<ctx>/claude/opencode/commands/<nome>.md` e rodar `bootstrap.sh --opencode` — o OpenCode não expõe como `/` skill alguma marcada como não-auto-invocável.
6. Se for usar no Cowork: `common/tools/pack-skill.sh <nome>` e subir o `.skill` em Settings → Capabilities → Skills.

## Frontmatter por ferramenta

| Campo | Ferramenta | Efeito |
|---|---|---|
| `disable-model-invocation: true` | Claude Code | só o usuário invoca (`/nome`); agente não escolhe sozinho |
| `metadata["opencode/autoinvoke"]: "false"` | OpenCode | esconde de `<available_skills>` (mesmo efeito) |
| `metadata["opencode/slash"]: "true"` | OpenCode | expõe `/nome` no TUI |
| `allowed-tools` | Claude Code | restringe ferramentas da skill |

O OpenCode traduz `disable-model-invocation: true` para `autoinvoke: false` — por isso esse skill continua carregável pelo nome, mas não é oferecido ao modelo. O `/` no OpenCode vem de `~/.config/opencode/commands/` (wrapper que só faz `skill({ name })`).

Campos desconhecidos de uma ferramenta são ignorados pela outra, então dá para declarar os dois no mesmo `SKILL.md`; enquanto não fizer isso, o wrapper de comando é o que garante paridade.

## Não fazer

- **Não** criar `~/.config/opencode/skills/` com cópia: vira segunda fonte e o OpenCode passa a ter precedência/duplicata.
- **Não** editar direto em `~/.claude/skills`: é symlink para o repo (edição ali é edição no repo, mas fora do git flow e sem commit).
- **Não** copiar o repo para dentro de `~/.claude/skills` à mão: use o `bootstrap.sh`.
- **Não** versionar `~/.config/opencode/opencode.json(c)`: tem chaves de API em plaintext.
- **Não** commitar docs no work repo — o destino de docs é o arquivo (`<ctx>/docs/`).

## Diferenças conhecidas entre as ferramentas

Não são divergências de conteúdo — as skills pessoais são idênticas nos dois lados. São diferenças de **superfície**:

| Item | OpenCode | Claude Code |
|---|---|---|
| Skills pessoais | via `~/.claude/skills` | via `~/.claude/skills` |
| `archive-branch-fix`, `archive-branch-fix-clean`, `archive-comment-check` | carregáveis pelo nome + `/` via wrapper; fora de `<available_skills>` | `/` nativo; fora da escolha automática |
| Skills de plugin | nenhuma | `engram` (19), `karpathy` (1), `postman` (17), `warp` — não são pessoais, não sincronizam |
| Built-ins | `opencode`, `report` | — |
| Cowork | — | precisa do pacote `.skill` (`pack-skill.sh`) |

Skill de plugin e built-in **ficam fora** desta nota: são do fornecedor, não versionadas aqui.

## Troubleshooting

Skill não aparece:

1. `opencode api GET /api/skill` lista o que o OpenCode carregou — inclui `autoinvoke: false`.
2. Conferir que `~/.claude/skills/<nome>` é symlink vivo: `ls -l ~/.claude/skills`.
3. `SKILL.md` em maiúsculas, `name` igual à pasta, `description` presente.
4. Nome duplicado entre `~/.claude/skills` e `~/.config/opencode/skills` (ou skill de projeto) — o mais próximo do projeto vence.
