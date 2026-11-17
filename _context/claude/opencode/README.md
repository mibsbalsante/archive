# opencode — config do OpenCode (V2)

Espelho dos arquivos que o **OpenCode V2** precisa e que **não** são lidos de `~/.claude/`.

## Por que existe

O OpenCode V2 lê as **skills** de `~/.claude/skills/` e `<repo>/.claude/skills/` (compatibilidade), mas **não** lê comandos de `.claude/commands/`. A lista de comandos (`/` no TUI) vem só de:

```
~/.config/opencode/commands/     # global
<repo>/.opencode/commands/       # projeto (ou .opencode/command/)
```

Consequência: **todo comando que precisa aparecer no `/` do OpenCode tem que ser duplicado** nesses caminhos. Skills não precisam de duplicação — só de invocação (`@skill-id`) ou de um shim que carregue a skill.

## Layout

```
opencode/
├── commands/                 # → ~/.config/opencode/commands/  (global)
│   ├── archive-implement-task.md     # shim: skill archive-implement-task (só com common/skills/opcional instalado)
│   ├── archive-branch-fix.md         # shim: skill archive-branch-fix
│   ├── archive-branch-fix-clean.md   # shim: skill archive-branch-fix-clean
│   ├── archive-comment-check.md      # shim: skill archive-comment-check
│   ├── archive-journalling.md        # shim: skill archive-journalling (opcional)
│   ├── archive-project-init.md       # shim: skill archive-project-init (opcional)
│   ├── archive-project-next-task.md  # shim: skill archive-project-next-task (opcional)
│   └── archive-trashcan.md           # shim: skill archive-trashcan (opcional)
└── global-config/            # → ~/.config/opencode/opencode.jsonc (global, SEM segredos)
    └── opencode.jsonc
```

Todo comando carrega o prefixo `archive-` — igual ao nome da skill — para nunca colidir com os comandos de quem instala. O atalho `/archive-journalling` chama a skill `archive-journalling`.

`project-commands/` e `project-config/` (shims e config específicos de um repo de trabalho) **não** vêm no template: crie em `<repo>/.opencode/` se precisar, com os shims equivalentes dos comandos daquele repo.

## Config global (`~/.config/opencode/opencode.jsonc`)

Espelho em [`global-config/opencode.jsonc`](global-config/opencode.jsonc). Como `settings.base.json`, **não vai com segredos**: `FIGMA_API_KEY` e `DASHSCOPE_API_KEY` usam `{env:...}` e precisam ser exportados na máquina nova (ou colados no arquivo local).

### MCP do Linear: remoto com OAuth, não local

O MCP do Linear é `type: "remote"` apontando para o MCP hospedado:

```jsonc
"linear": {
  "type": "remote",
  "url": "https://mcp.linear.app/mcp",
  "enabled": true
}
```

Autenticação (uma vez por máquina, abre o browser):

```bash
opencode mcp auth linear     # credencial OAuth fica fora do repo/config
opencode mcp list            # linear deve aparecer como "connected"
```

**Por que o servidor local estava quebrado** (config antiga, `npx -y mcp-server-linear@1.6.0`):

1. **`npx` não resolvia**: o processo do app não herda o `PATH` do shell — o Node vem do `nvm` (`~/.nvm/versions/node/<v>/bin`), fora do `PATH` padrão do launchd (`/usr/bin:/bin:/usr/sbin:/sbin`). O spawn falhava com `NotFound: ChildProcess.spawn (npx ...)`; o `figma` falhava igual, mesmo padrão de `npx`, o que confirma que o problema é o binário e não o Linear.
2. **Sem credencial**: mesmo resolvendo o `npx`, o `LINEAR_ACCESS_TOKEN` referenciado via `{env:...}` não existia no ambiente — o `mcp-server-linear` precisa de um **personal API key** do Linear. O token OAuth do MCP hospedado (audience `mcp.linear.app`) não serve como API key.

O `engram` nunca sofreu disso porque usa caminho absoluto (`/opt/homebrew/bin/engram`).

> Alternativa local (se um dia precisar do server via stdio): usar caminho absoluto do `npx` e exportar `LINEAR_ACCESS_TOKEN` com um personal API key. Para uso normal, o remoto com OAuth dispensa token no ambiente.

## Formatter (sempre relativo ao projeto)

`formatter` fica **no config do projeto** (`<repo>/.opencode/opencode.json`), nunca no global, e o comando usa o binário do próprio repo:

```json
"formatter": { "prettier": { "command": ["pnpm", "exec", "prettier", "--write", "$FILE"] } }
```

O OpenCode roda o comando com cwd = raiz do projeto, então `pnpm exec` resolve o prettier pinado do workspace e o `.prettierrc` do repo. Sem isso, um formatter global rodaria em repos que não têm prettier.

## Instalar / atualizar

```bash
cd <ARCHIVE_DIR>/<CTX>/claude
./bootstrap.sh --opencode            # só ~/.config/opencode/commands/ (não toca settings)
```

O app desktop **não instala** o binário `opencode` no PATH. Criar o symlink para o CLI do bundle:

```bash
ln -sf /Applications/OpenCode.app/Contents/Resources/opencode-cli ~/.local/bin/opencode
opencode --version
```

Depois de restaurar o config global, autenticar os MCPs remotos (um por vez, abre o browser):

```bash
opencode mcp auth linear             # OAuth do MCP hospedado
opencode mcp auth datadog            # remoto, site US1
opencode mcp list                    # devem aparecer como "connected"
```

## Convenção ao criar comando novo

1. Criar o comando em `.claude/commands/<nome>.md` (fonte única, vai para o git do repo).
2. Criar o shim `<repo>/.opencode/commands/<nome>.md` com frontmatter `description` + "Leia `.claude/commands/<nome>.md` e siga".

Para uma **skill** nova (`common/skills/`, `common/skills/opcional/` ou `<CTX>/skills/`), nada a fazer: o OpenCode a descobre direto em `~/.claude/skills/`. Só crie um shim de comando se quiser chamá-la por `/` (ex.: `disable-model-invocation: true`).

## Armadilhas de frontmatter

O OpenCode faz parse **estrito** do YAML: frontmatter inválido derruba a **skill inteira** (ela some da lista e não carrega).

- `argument-hint` que começa com `[` precisa de aspas:
  `argument-hint: '[--all] [--force]'` (sem aspas o YAML lê como flow sequence e quebra).
- `description` com `: ` no meio pode quebrar; use bloco `>` quando tiver dúvida.
- Sintoma típico: a skill existe em `~/.claude/skills/<id>/SKILL.md` mas não aparece em `/api/skill`.

Diagnóstico rápido (o app desktop é server + client):

```bash
OC=/Applications/OpenCode.app/Contents/Resources/opencode-cli
$OC api get "/api/skill?location%5Bdirectory%5D=$PWD"    # skills registradas
$OC api get "/api/command?location%5Bdirectory%5D=$PWD"  # comandos do "/"
```
