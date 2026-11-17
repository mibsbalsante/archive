# archive

Template de arquivo pessoal: documentação operacional, memória do [Engram](https://github.com/Gentleman-Programming/engram), skills e journal, organizados por **contexto**.

Este repositório **não é** o seu arquivo — é o instalador. Ele cria uma pasta separada, com os seus dados, que passa a ser o seu arquivo pessoal.

## Estrutura do repositório

```
archive/
├── init.sh          # instalador e atualizador (ver UPDATE.md)
├── README.md        # este arquivo
├── UPDATE.md        # regras do --update
├── AGENTS.md        # contrato para agentes (CLAUDE.md → symlink)
└── template/        # tudo que é instalado
    ├── _context/    # molde de contexto → vira <ctx>/
    ├── common/      # skills e scripts de qualquer contexto
    └── personal/    # contexto de exemplo, vazio
```

## Instalar

```bash
# opção 1 — sem clonar
bash <(curl -fsSL <url-do-raw>/init.sh)

# opção 2 — inspecionando o código antes
git clone <url-deste-repo> /tmp/archive-template
bash /tmp/archive-template/init.sh
rm -rf /tmp/archive-template
```

Três formas de rodar: interativa (padrão, precisa de TTY), `--guided` (respostas numeradas via stdin) e `--non-interactive` (sem prompt; falta de flag obrigatória = erro). Para automação/agente: [AGENTS.md](AGENTS.md).

```bash
./init.sh --non-interactive --yes \
  --dir ~/Work/archive --github-org <org> \
  --linear-workspace <slug> --linear-team <ABC> --github-user <login>

./init.sh --non-interactive ... --print-config   # JSON do plano, sem escrever
```

O `init.sh` pergunta:

| Pergunta | Default | Vai para |
|---|---|---|
| onde salvar a instalação | `~/Work/<nome-do-repo>` | pasta do arquivo pessoal |
| nome do contexto | `personal` | `<ctx>/` |
| org do GitHub | — (obrigatório) | `<GITHUB_ORG>` |
| workspace do Linear | — (obrigatório) | `<LINEAR_WORKSPACE>` |
| time do Linear | — (obrigatório) | `<LINEAR_TEAM>` |
| usuário do GitHub | `gh api user` | `<GITHUB_USER>` |
| pasta de repos de trabalho | `Work` | `<WORKSPACE_DIR>` |
| gerenciador de memória | Engram / nenhum | `<ctx>/backup/engram/` |

Ao terminar, a instalação tem git próprio e o repo de origem pode ser apagado.

## Instalação resultante

```
<archive>/
├── init.sh        # o mesmo instalador, para --update
├── common/        # skills e scripts de qualquer contexto
├── <ctx>/         # docs, journal, claude, skills, tools, backup
└── personal/      # contexto de exemplo
```

A instalação ganha um `.archive-env` com os valores já resolvidos — `source .archive-env` antes de usar os scripts de `common/tools/` sem flags:

```bash
cd <archive> && source .archive-env
node common/tools/index-engram.mjs --project <PROJECT>
```

Dois scripts distintos:

| Script | Escreve em | Função |
|---|---|---|
| `init.sh` (raiz) | **só** a pasta da instalação | cria e atualiza o arquivo pessoal |
| `<ctx>/claude/bootstrap.sh` | `~/.claude`, `~/.config/opencode` | instala settings, memória, skills e comandos na máquina |

O bootstrap nunca roda sozinho: é acionado à mão, pede confirmação por arquivo e gera `.old` antes de sobrescrever.

```bash
<ctx>/claude/bootstrap.sh --dry-run   # o que seria escrito
<ctx>/claude/bootstrap.sh --all       # aplica tudo
```

## Atualizar

```bash
bash <(curl -fsSL <url-do-raw>/init.sh) --update --dir "$PWD"
```

Algoritmo, metadados e resolução de conflitos: [UPDATE.md](UPDATE.md).

## Placeholders

| Placeholder | Preenchido por |
|---|---|
| `<CTX>`, `<ARCHIVE_NAME>`, `<ARCHIVE_DIR>`, `<WORKSPACE_DIR>` | `init.sh` |
| `<GITHUB_USER>`, `<GITHUB_ORG>` | `init.sh` |
| `<LINEAR_WORKSPACE>`, `<LINEAR_TEAM>` | `init.sh` |
| `<PROJECT>`, `<REPO>`, `<SDD_REPO>` | você, por contexto |

## Skills

Todas prefixadas com `archive-` para não colidir com as suas: `archive-branch-fix`, `archive-branch-fix-clean`, `archive-comment-check`, `archive-implement-task`, `archive-journalling`, `archive-project-init`, `archive-project-next-task`, `archive-trashcan`. O mesmo prefixo nos comandos `/`.

## Contribuir com o template

Apenas conteúdo em `template/`. Regras:

- nada de nome de pessoa, empresa, cliente ou projeto real;
- `template/common/` — skills e scripts de qualquer contexto;
- `template/_context/` — molde de contexto (o `init.sh` copia e renomeia);
- todo README de pasta é índice: atualize ao adicionar arquivo.

Mudanças em `init.sh` ou `UPDATE.md` devem manter o contrato de atualização descrito em `UPDATE.md`.

## Segurança

- O repo que você criar com o `init.sh` deve ser **privado**.
- Nunca versionar `~/.config/opencode/opencode.json` (chaves de API em plaintext).
- `.tmp/`, `node_modules/`, lockfiles e `*.old`/`*.new` ficam de fora.
