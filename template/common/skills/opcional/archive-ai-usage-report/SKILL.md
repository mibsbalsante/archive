---
name: archive-ai-usage-report
description: Mede uso de agentes de IA de código (Claude Code, OpenCode, Cursor e harnesses declarados) a partir dos registros locais da máquina — por dia, semana, modelo, skill, plugin, comando, MCP, gerenciador de memória e harness. Gera uma página HTML autocontida. Triggers: uso de IA, relatório de uso, ai usage, estatística de agente, quais skills usei, quais comandos o modelo roda, quais MCPs usei, ccaudit, archive-ai-usage-report.
argument-hint: '[--since AAAA-MM-DD] [--until AAAA-MM-DD] [--months N] [--harness nome] [--html saida.html] [--json saida.json]'
---

# archive-ai-usage-report

Responde "como usei agentes de IA" por contagem. Um script, três adapters fixos e um arquivo de configuração para o resto. Saída única: **página HTML** (e JSON opcional); o executor não imprime tabela no terminal.

Nada aqui depende de empresa: lê só os registros locais do harness. Funciona igual em qualquer contexto.

## Como rodar

```bash
# tudo relativo à pasta desta skill (SKILL.md, ai_usage.py e harnesses.json vivem juntos)
cd <pasta-da-skill>

python3 ai_usage.py                                  # julho até hoje
python3 ai_usage.py --since 2026-07-01 --until 2026-11-18 --json uso.json
python3 ai_usage.py --months 3 --harness opencode
```

Requisitos: Python 3.9+ e só biblioteca padrão. Nada de rede, LLM ou `pip install`.

## Onde o HTML é gerado

Ordem de resolução:

1. `--html caminho.html` (arquivo) ou `--html pasta/` / `--out-dir pasta` (mantém o nome com data)
2. `$AI_USAGE_OUT` (diretório)
3. **`.ai-usage/` no diretório atual** — default
4. `$TMPDIR/ai-usage-report/` — só se o cwd não for gravável

```
<repo>/.ai-usage/uso-ia-AAAA-MM-DD.html
```

**Por que o cwd e não o cache do sistema:** o harness só abre/previewa arquivos **dentro das pastas da sessão**; caminho em `$TMPDIR` dá o erro "arquivo fora das pastas da sessão". `.ai-usage/` fica dentro do projeto e é ignorado pelo git (entrada pronta no `.gitignore` da instalação).

O caminho absoluto é a **última linha** da saída — é o que se usa para abrir/previewar no chat.

## O que a página mostra (nesta ordem)

1. KPIs — chamadas, sessões, harnesses
2. **Harnesses**
3. Chamadas por mês
4. Dias de pico
5. **Skills mais usadas**
6. **Comandos executados pelo modelo** (shell)
7. **Comandos digitados pelo usuário** (barra)
8. **Top 5 modelos — uso por semana** (uma série por modelo)
9. Modelos (contagem)
10. **Gerenciador de memória** — lista de gerenciadores detectados **antes** da tabela, depois tabela por harness e as operações
11. **Servidores MCP**
12. Notas e limitações (inclui harnesses declarados sem registro e as linhas do Cursor)

## Regras

1. **Só leitura** nos diretórios dos harnesses. Escreve apenas no `--html`/`--json`.
2. **Harness presente sem adapter = declarado no `harnesses.json`** (`type: none`) e listado nas notas. Silêncio é erro.
3. **Dimensão sem dado = "sem dados"**, nunca zero.
4. **Contagem, não estimativa.** Não converter linhas do Cursor em chamadas/tokens.
5. **Duas dimensões de comando, nunca somadas:** o que o **modelo** executa no shell e o que o **usuário** digita na barra.
6. **Gerenciador de memória:** declarar os detectados antes da tabela; nunca assumir Engram quando não houver sinal.

## Pipeline

1. Descoberta pelos adapters; 2. leitura de `{ts, harness, session, tool, skill, model, cmd}`; 3. dedup (JSONL: última ocorrência por `session+message`; OpenCode: só `session_v2`); 4. canônico de modelo (dropa sufixo de data) e semana ISO (segunda-feira); 5. classificação de skill/plugin/MCP/memória/comando; 6. agregação; 7. HTML.

## Adapters

| Harness | Caminho | Modelo | Ferramentas |
|---|---|---|---|
| **Claude Code** | `~/.claude/projects/**/*.jsonl` (inclui `subagents/`) | `message.model` | `content[]` `tool_use`: `name`; skill em `input.skill`/`input.name`; comando de shell em `input.command`; comando de barra em `<command-name>` |
| **OpenCode** | `opencode.db` → **`session_v2`** + `session_message` | `data.$.model.id` | `data.$.content[]` `type: "tool"`: `name`; skill em `state.input.name`; shell em `state.input.command`/`cmd` |
| **Cursor** | `~/.cursor/ai-tracking/ai-code-tracking.db` | — | só **linhas** (`composerLinesAdded`, `tabLinesAdded`, `humanLinesAdded`) |
| **Declarados** | `harnesses.json` | coluna `model` | coluna `tool` |

### Adicionar harness (`harnesses.json`)

```json
{ "harnesses": [
  { "name": "Copilot", "type": "sqlite", "path": "~/.copilot/usage.db",
    "table": "events", "ts": "created_at", "tool": "tool_name", "session": "session_id" },
  { "name": "Windsurf", "type": "jsonl", "path": "~/.windsurf/logs/*.jsonl",
    "ts": "time", "tool": "tool", "model": "model" },
  { "name": "Aider", "type": "none", "path": "~/.aider", "note": "sem registro estruturado" }
] }
```

`type: none` **sempre** aparece nas notas.

### Classificação

- **MCP:** por servidor. Claude Code `mcp__<srv>__<tool>` (id uuid → `mcp:uuid`); OpenCode `<srv>_<tool>` com prefixos `engram`, `linear`, `figma`, `datadog`, `claude_in_chrome`.
- **Skills:** ferramenta de skill → nome de destino; prefixo `plugin:` marca plugin.
- **Memória:** operação do Engram (`engram_mem_*`/`mem_*`) **e** leitura de arquivo de memória (`AGENTS.md`, `CLAUDE.md`, `.engram/`) — os gerenciadores aparecem na lista antes da tabela.
- **Comando do modelo:** família normalizada — sem `cd`/`export`/`source`, sem `echo`/`pwd`/estruturas de controle, mantendo subcomando de `git`/`gh`/`pnpm`/`npm`/`npx`/`go`/`make`/`docker`/`kubectl`/`python3`/`node`/`bun`.
- **Comando do usuário:** `/x` da barra; builtins do harness (`/compact`, `/clear`, `/model`, `/mcp`) marcados `(builtin)`.
- **Semanas:** segunda-feira da semana; a série de cada modelo só cobre as semanas em que ele aparece.

## Exportar para outra máquina

O pacote instalável sai de qualquer lugar com:

```bash
common/tools/pack-skill.sh archive-ai-usage-report          # gera ~/Downloads/archive-ai-usage-report.skill
common/tools/pack-skill.sh --install ~/Downloads/archive-ai-usage-report.skill   # instala em ~/.claude/skills
```

O `.skill` é um zip com a pasta na raiz; `__pycache__`/`*.pyc` ficam de fora automaticamente.
