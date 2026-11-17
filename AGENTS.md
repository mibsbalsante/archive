# AGENTS.md — como um agente instala este repositório

Este repo é o **instalador**. Ele não guarda os dados de ninguém. Sua tarefa, ao ser acionado, é criar uma instalação numa pasta escolhida pelo usuário.

Leia `README.md` (visão geral) e `UPDATE.md` (atualização) antes de agir.

## Regra de ouro

**Nunca invente valores.** Quatro inputs não têm default e não podem ser deduzidos: `--dir`, `--github-org`, `--linear-workspace`, `--linear-team`. Se o usuário não os informou, **pergunte antes de rodar**, numa única mensagem, com o formato abaixo. Se ele não souber, pare e explique o que é cada um.

| Flag | O que é | Como descobrir (sugestão para o usuário) |
|---|---|---|
| `--dir` | caminho absoluto da instalação | sugira `~/Work/archive`; nunca assuma |
| `--github-org` | login da organização dos repos de trabalho | `gh api user/orgs --jq '.[].login'` |
| `--linear-workspace` | slug do workspace (`linear.app/<slug>`) | olhar a URL do Linear |
| `--linear-team` | prefixo de issues (ex.: `ABC`) | `ABC-123` → `ABC` |

## Fluxo

### 1. Coletar

Pergunte só o que falta. Opcionais com default: `--ctx` (`personal`), `--archive-name` (basename do `--dir`), `--github-user` (`gh api user`), `--workspace-dir` (`Work`).

Se o usuário já deu tudo, pule para o passo 2.

### 2. Valide o plano

```bash
./init.sh --non-interactive --print-config \
  --dir "$HOME/Work/archive" --github-org <org> \
  --linear-workspace <ws> --linear-team <TEAM> --github-user <user> \
  [--ctx <ctx>] [--no-memory|--with-memory] [--git|--no-git]
```

Imprime um JSON com o que será feito. **Mostre ao usuário e peça confirmação** antes de escrever.

### 3. Instalar

```bash
./init.sh --non-interactive --yes \
  --dir "$HOME/Work/archive" --github-org <org> \
  --linear-workspace <ws> --linear-team <TEAM> --github-user <user> \
  [--ctx <ctx>] [--no-memory]
```

`--yes` confirma a criação e o `git init`. Sem ele, `--non-interactive` aborta com erro 2.

### 4. Configurar a máquina (opcional, peça permissão)

O `init.sh` **não** escreve no HOME. Se o usuário quiser skills/settings/comandos:

```bash
cd <dir>/<ctx>/claude
./bootstrap.sh --dry-run        # mostre a saída
./bootstrap.sh --all            # depois do ok explícito
```

Sem TTY o bootstrap mantém os arquivos existentes e não pergunta. Para aplicar de fato em automação, use `--yes` — **e avise que isso sobrescreve `~/.claude/settings.json`, `~/.config/opencode/AGENTS.md`, `~/.claude/CLAUDE.md` e os comandos do OpenCode, sempre gerando `.old`.**

### 5. Encerrar

Reporte: caminho da instalação, contexto criado, placeholders que restam para o usuário (`<PROJECT>`, `<REPO>`, `<SDD_REPO>`) e o comando do bootstrap, se ele não rodou.

## Modos do `init.sh`

| Modo | Quando usar |
|---|---|
| padrão (TTY) | uso humano; pergunta interativamente |
| `--guided` | agente que escreve em stdin: uma resposta por linha, vazia = default |
| `--non-interactive` | agente sem stdin; falta de flag obrigatória = erro 2 com a flag faltante |
| `--print-config` | mostrar o plano sem escrever |

O `--guided` consome exatamente 7 linhas, nesta ordem:

```
1  --dir               (obrigatório)
2  --ctx               (default: personal)
3  --github-org        (obrigatório)
4  --linear-workspace  (obrigatório)
5  --linear-team       (obrigatório)
6  --github-user       (default: gh api user)
7  memória: 1=Engram, 2=nenhum (default: 2)
```

## Atualizar uma instalação

```bash
./init.sh --update --dir <instalação>
```

Nunca toca em `<ctx>/docs`, `journal`, `backup`, `tools/projects.json`, `claude/memory/AGENTS.md` nem `skills/`. Configs divergentes pedem confirmação por arquivo e geram `.old`. Em automação use `--yes`; para ver antes, rode sem `--yes` e leia a saída.

## O que não fazer

- Não editar arquivos dentro de `template/` durante uma instalação.
- Não rodar `init.sh` de dentro de uma instalação (ele é o instalador do template).
- Não usar `--force-update` sem o usuário pedir explicitamente: apaga as edições dele.
- Não criar contexto novo com `init.sh`: copie `<ctx>/` e siga o checklist de `template/_context/README.md`.
- Não inventar `<PROJECT>`, `<REPO>` ou `<SDD_REPO>` — são dados reais do usuário.
