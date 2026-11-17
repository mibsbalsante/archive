# _context — molde de um contexto

Esta pasta **não é um contexto**: é o esqueleto que o [`init.sh`](../init.sh) copia para criar o seu (`<CTX>/`). O nome começa com `_` porque os scripts de `common/tools/` ignoram pastas `_*` ao descobrir contextos.

> **Nota:** se você rodar `restore.sh` antes de criar um contexto, ele não vai encontrar nada — crie o seu com `init.sh` primeiro.

> Este é o README do molde. O `init.sh` gera um README próprio para o seu contexto (`<CTX>/README.md`); este arquivo não é copiado — use-o como checklist.

## O que vai aqui

```
<ctx>/
├── docs/                   # docs operacionais (<ctx>/docs)
├── journal/                # registro diário de trabalho (opcional)
├── backup/engram/<PROJECT>/ # export do Engram por projeto
├── claude/                 # memória + config do Claude Code / OpenCode
├── skills/                 # skills específicas deste contexto
├── tools/                  # geradores dos docs de tasks (Linear/GitHub)
└── scheduled-tasks/        # prompts de rotinas agendadas (opcional)
```

## Checklist depois do init

| Item | O que fazer |
|---|---|
| `journal/GUIA.md` | preencher: convenções, rotinas, projeto/lista fixa. Se você não usa AVD, pode ignorar o journal inteiro. |
| `journal/referencia-avd.md` | preencher só se usar avaliação de desempenho; senão, apagar junto com `metas.md`. |
| `docs/README.md` | descrever a sua organização de docs; a seção `## Projetos` é gerada por `tools/projects.mjs sync`. |
| `tools/projects.json` | registrar os projetos de trabalho (`projects.mjs add`). |
| `claude/memory/AGENTS.md` | é o seu contexto global de agente — ajuste o que for pessoal. |
| `backup/engram/<PROJECT>/` | criar uma pasta por projeto do Engram (o backup cria sozinho). |
| `skills/` | skills específicas deste contexto (vazio por padrão). |

## Projetos de trabalho

Os projetos abaixo são **placeholders**: troque pela sua lista real.

| `project` (Engram) | repo de trabalho |
|---|---|
| `<PROJECT>` | `~/Work/<REPO>` |

> Atualize os índices ao adicionar pastas/projetos.
