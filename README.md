# archive

Instalador de um **arquivo pessoal** para documentação operacional, memória do [Engram](https://github.com/Gentleman-Programming/engram), skills e journal — organizado por **contexto**.

Este repositório é um **template imutável**: ele não guarda os seus dados e não deve ser editado. O `init.sh` cria a sua instalação (o "arquivo") numa pasta que você escolhe, com os placeholders já preenchidos. A partir daí você trabalha na **sua** pasta, e este repo serve só para instalar e atualizar.

## Instalar

Duas formas — o resultado é o mesmo:

```bash
# 1) sem clonar nada
bash <(curl -fsSL <url-do-raw>/init.sh)

# 2) clonando temporariamente (permite inspecionar o script antes de rodar)
git clone <url-deste-repo> /tmp/archive-template
bash /tmp/archive-template/init.sh
rm -rf /tmp/archive-template
```

O script pergunta **onde salvar** a instalação (default `~/Work/<nome-do-repo>`) e os seus dados (organização do GitHub, workspace e time do Linear). No fim, a instalação tem o seu próprio `git`, se você quiser.

Depois de instalar, **pode apagar o repo de origem**: a cópia que importa está na sua pasta.

### Dois instaladores, duas responsabilidades

| Script | Onde escreve | O que faz |
|---|---|---|
| `init.sh` (raiz) | **só** na pasta da instalação | cria/atualiza o arquivo pessoal: copia o molde, preenche placeholders, versiona |
| `<ctx>/claude/bootstrap.sh` | **fora** da instalação (`~/.claude`, `~/.config/opencode`) | instala na máquina: `settings.json`, `AGENTS.md`/`CLAUDE.md`, symlinks de skill, comandos do OpenCode |

O `init.sh` **não** toca no seu HOME. Depois de criar a instalação, rode o bootstrap explicitamente:

```bash
<ctx>/claude/bootstrap.sh --dry-run    # mostra o que seria escrito
<ctx>/claude/bootstrap.sh              # pergunta item e arquivo, com backup
<ctx>/claude/bootstrap.sh --all        # tudo
```

Nada é sobrescrito em silêncio: **todo arquivo existente vira `<arquivo>.old` antes**, e cada escrita pede confirmação (sem TTY ou com `--yes`, aplica sem perguntar).

### O que a instalação contém

```
<archive>/
├── init.sh                 # também serve para atualizar (ver UPDATE.md)
├── .archive-version        # commit do template usado na instalação
├── common/                 # skills e scripts que valem para qualquer contexto
│   ├── skills/             # skills gerais (sem dependência de empresa)
│   │   └── opcional/       # skills que dependem de Linear/GitHub/empresa
│   └── tools/              # backup, restore, indexação, commit de docs
├── <ctx>/                  # o seu contexto (o molde `_context/` renomeado)
│   ├── docs/  journal/  claude/  skills/  tools/
│   └── backup/engram/      # export do Engram por projeto (opcional)
└── personal/               # contexto de exemplo, vazio
```

Um **contexto** é uma pasta de primeiro nível com `backup/engram/`: "lugar" onde o trabalho acontece (máquina pessoal, do trabalho, um cliente), restaurável de forma independente. Para criar outro dentro da sua instalação, siga o checklist de [`_context/README.md`](_context/README.md):

```bash
cp -R _context novo-ctx
# depois troque <CTX> pelos dados do novo contexto
```

> O `init.sh` é o instalador do repo **inteiro**, não um criador de contexto. Além de instalar, ele só faz `--update`.

## Atualizar

Ver [UPDATE.md](UPDATE.md). Resumo:

```bash
# dentro da sua instalação
bash <(curl -fsSL <url-do-raw>/init.sh) --update --dir "$PWD"
```

O `--update` só escreve arquivos do template e **nunca toca em `<ctx>/`**. Arquivos que você editou recebem a versão nova como `arquivo.new` — nada é sobrescrito sem `--force-update`.

## Placeholders

| Placeholder | Significado | Quem preenche |
|---|---|---|
| `<CTX>` | nome do contexto (pasta de primeiro nível) | `init.sh` |
| `<ARCHIVE_NAME>` | nome do repo da instalação | `init.sh` |
| `<ARCHIVE_DIR>` | caminho absoluto da instalação | `init.sh` |
| `<GITHUB_USER>` | seu usuário do GitHub | `init.sh` (`gh api user`) |
| `<GITHUB_ORG>` | organização do GitHub dos repos de trabalho | `init.sh` (obrigatório) |
| `<LINEAR_WORKSPACE>` | slug do workspace no Linear (`linear.app/<slug>`) | `init.sh` (obrigatório) |
| `<LINEAR_TEAM>` | time/prefixo de issues no Linear (ex.: `ABC`) | `init.sh` (obrigatório) |
| `<WORKSPACE_DIR>` | pasta de repos de trabalho, relativa a `~` | `init.sh` |
| `<PROJECT>` | nome de um projeto do Engram | você, por contexto |
| `<REPO>` | nome de um repositório de trabalho | você, por contexto |
| `<SDD_REPO>` | caminho do repo de SDD/refinamento técnico | você (skill `project-init`) |

Dentro da instalação, `<PROJECT>`, `<REPO>` e `<SDD_REPO>` continuam na sua mão — dependem dos seus projetos reais.

### Variáveis de ambiente lidas pelos scripts

| Variável | Usada por | Valor |
|---|---|---|
| `ENGRAM_CTX` | `refresh-archive`, `index-engram`, `commit-doc` | nome do contexto (quando `--ctx` é omitido) |
| `ENGRAM_PROJECT` | `refresh-archive`, `index-engram` | projeto do Engram (quando `--project` é omitido) |
| `ENGRAM_ARCHIVE` | todos | caminho da instalação (default `~/Work/<ARCHIVE_NAME>`) |
| `ENGRAM_BIN` | `refresh-archive`, `index-engram` | binário do Engram |
| `GITHUB_ORG` | `collect-prs`, `build-tasks`, `refresh-status` | organização dos PRs / URL do GitHub |
| `LINEAR_TEAM` | `fetch-linear`, `refresh-status` | prefixo de issues no Linear |
| `LINEAR_ACCESS_TOKEN` / `LINEAR_API_KEY` | `fetch-linear` | token da API GraphQL do Linear |
| `SDD_REPO` | skill `project-init` | caminho do repo de SDD/refinamento técnico |

## Gerenciador de memória

O template assume o **Engram** por default, mas o backup é opcional:

- **Com Engram:** instale o binário e o backup roda junto da skill `journalling` (`common/tools/backup-daily.sh <ctx>`), uma pasta por projeto em `<ctx>/backup/engram/<PROJECT>/`.
- **Sem gerenciador:** o `init.sh` remove `<ctx>/backup/engram/`; docs e journal continuam versionados normalmente.

Para mudar depois, apague ou crie `<ctx>/backup/engram/`.

## Atualizar o backup

```bash
common/tools/backup-daily.sh <ctx>     # export + sync de todos os projetos, commit e push
```

O `.db` do Engram **não** é versionado (binário + WAL); o que vai para o git é o export JSON e os chunks por projeto.

## Restaurar (máquina nova)

```bash
git clone <url-da-sua-instalação> <ARCHIVE_DIR>
cd <ARCHIVE_DIR>
common/tools/restore.sh              # lista os contextos e pergunta qual
common/tools/restore.sh <ctx>        # ou direto
```

Detalhes e opções: [common/tools/README.md](common/tools/README.md).

## Como contribuir com o template

Este repo é para ser genérico: nada de nome de pessoa, empresa, cliente ou projeto real. Ao mudar algo aqui:

- `common/` — skills e scripts de qualquer contexto.
- `common/skills/opcional/` — skills que dependem de Linear/GitHub.
- `_context/` — o molde de contexto (o `init.sh` copia e renomeia).
- `UPDATE.md` — as regras de atualização; se mudar o que o `--update` faz, atualize lá.

**Todo README acima de uma pasta deve ser atualizado quando um arquivo/script/skill novo entrar nela.**

## Segurança

- A instalação que você criar deve ser um repo **privado**: ela contém memória e docs internos.
- **Nunca** versionar `~/.config/opencode/opencode.json` (contém chaves de API em plaintext).
- `.tmp/`, `temp-error-logs.md`, `node_modules/` e lockfiles ficam de fora.
