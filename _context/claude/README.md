# claude — memória e config do Claude Code

Espelho versionado da configuração e memória do Claude Code do contexto, para bootstrap em máquina nova e consulta.

## Layout

```
claude/
├── bootstrap.sh          # instala o Claude numa máquina nova (ver abaixo)
├── settings.base.json    # settings.json básico e SEM segredos (template)
├── memory/
│   ├── AGENTS.md         # memória global — FONTE DA VERDADE (~/.config/opencode/AGENTS.md)
│   └── CLAUDE.md         # stub: só `@~/.config/opencode/AGENTS.md` (~/.claude/CLAUDE.md)
└── opencode/             # o que o OpenCode V2 NÃO lê de ~/.claude/ (ver abaixo)
    └── commands/         # → ~/.config/opencode/commands/
```

> **Memória global: `AGENTS.md` é a fonte da verdade.** O OpenCode lê `~/.config/opencode/AGENTS.md` nativamente e o Claude Code lê `~/.claude/CLAUDE.md`, que só contém `@~/.config/opencode/AGENTS.md` (import `@path`). Edite **sempre** o AGENTS.md; o `bootstrap.sh --memory` instala os dois no lugar certo.

> **OpenCode V2 não lê `.claude/commands/`.** Skills são lidas de `~/.claude/skills/`, mas comandos de barra só vêm de `~/.config/opencode/commands/` ou `<repo>/.opencode/commands/`. Todo comando novo precisa ser **duplicado** (ou virar shim) nesses caminhos — ver [opencode/README.md](opencode/README.md).

Skills (criadas, não as de projeto): gerais em [`../../common/skills/`](../../common/skills/README.md) e opcionais em [`../../common/skills/opcional/`](../../common/skills/opcional/). O `bootstrap.sh --skills` instala as duas. Referências e instalação no Cowork: [`skills/`](skills/README.md).

## Bootstrap em máquina nova

```bash
git clone <url-do-seu-repo> <ARCHIVE_DIR>
cd <ARCHIVE_DIR>/<CTX>/claude

./bootstrap.sh            # só ~/.claude/settings.json (faz backup .old se existir)
./bootstrap.sh --settings # idem, explícito (para combinar com outras flags)
./bootstrap.sh --memory   # CLAUDE.md global (backup .old)
./bootstrap.sh --skills   # skills (common + opcionais + contexto)
./bootstrap.sh --opencode # comandos globais em ~/.config/opencode/commands/
./bootstrap.sh --all      # tudo
```

O settings só é escrito quando pedido — sem flag, ou com `--settings`/`--all`. `--memory`, `--skills` e `--opencode` **não** tocam `~/.claude/settings.json`. O script **sempre** faz backup `.old` do settings/memória existentes antes de sobrescrever. `settings.base.json` **não contém segredos** — tokens de MCP e API keys devem ser configurados manualmente na máquina nova.

## MCPs remotos (OAuth, sem segredo no repo)

Claude Code guarda MCP de escopo `user` em `~/.claude.json` (não espelhado). Em máquina nova, registrar uma vez e autenticar no `/mcp`:

```bash
claude mcp add --transport http --scope user datadog https://mcp.datadoghq.com/api/unstable/mcp-server/mcp
```

Para escopar a um repo, usar `--scope project` (grava no `.mcp.json` do repo, como o do Linear). OpenCode: ver [opencode/README.md](opencode/README.md).

## Atualizar este espelho

Copiar de volta a config viva para `config/` e a memória para `memory/`, depois commitar na `main`.

> Nota: `worktrees/` e `settings.local.json` do projeto **não** entram (locais/efêmeros). Config/agents/rules específicos de um repo de trabalho não vêm no template: crie `<CTX>/claude/config/` se quiser espelhá-los.
