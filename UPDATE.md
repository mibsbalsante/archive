# Atualizando uma instalação

Duas coisas diferentes podem ser "atualizadas", e elas nunca se misturam:

| O quê | Onde vive | Como atualizar |
|---|---|---|
| **O template** (scripts, skills, molde de contexto) | repo de origem (`github.com/<org>/archive`) | `init.sh --update` |
| **Os seus dados** (docs, journal, memória) | a sua instalação (`$ARCHIVE_DIR/<ctx>/`) | `git pull` no repo da sua instalação |

## Regra de ouro

O repositório de origem **nunca** guarda dados seus, e **nunca** é editado por você. Ele só é lido pelo `init.sh`. Por isso o `pull` do template é sempre um clone limpo — não existe merge.

```
   repo de origem (template)          a sua instalação
   ─────────────────────────          ─────────────────
   init.sh  common/  _context/   ──►  common/  <ctx>/  init.sh  .archive-version
   (clone temporário)                 (seu git, seus commits)
```

## Opção 1 — atualizar direto da origem (recomendado)

```bash
# de dentro da sua instalação
git clone --depth 1 <url-do-template> /tmp/archive-template
bash /tmp/archive-template/init.sh --update --dir "$PWD"
rm -rf /tmp/archive-template
```

Ou, sem clonar nada:

```bash
bash <(curl -fsSL <url-do-raw>/init.sh) --update --dir "$PWD"
```

Sem `--dir`, o script pergunta. Ele **recusa** atualizar uma pasta que não tenha o arquivo `.archive-version`.

## Como o `--update` decide o que escrever

Para cada arquivo do template:

| Situação | Ação | Saída |
|---|---|---|
| Não existe na sua instalação | cria | `+ arquivo` |
| Existe e é idêntico | não faz nada | — |
| Existe e difere (você editou) | grava `arquivo.new` ao lado | `! arquivo (conflito)` |
| Existe e difere, com `--force-update` | sobrescreve | `~ arquivo (sobrescrito)` |

Ao final, o script grava a nova versão em `.archive-version` e mostra a contagem de novos, atualizados e conflitos.

Como ele sabe que você editou? Cada instalação guarda dois metadados, criados pelo `init.sh`:

| Arquivo | O que é |
|---|---|
| `.archive-meta` | os valores da instalação (`CTX`, `GITHUB_ORG`, `LINEAR_TEAM`…) — usados para reaplicar as substituições nos arquivos do template |
| `.archive-base/<arquivo>` | cópia de cada arquivo do template **como ficou na instalação** — é a base da comparação |

### Configs de agente pedem permissão arquivo a arquivo

Os arquivos de `claude/` (settings, memória, comandos, config do OpenCode) são tratados à parte: qualquer mudança neles **mostra o diff, pergunta individualmente** e faz backup `<arquivo>.old` antes de escrever. Com `--yes`, aplica sem perguntar — mas **continua gerando o `.old`**. Responder "n" mantém o seu arquivo e não gera backup.

O `--update` renderiza o arquivo novo com os seus valores e compara com o disco: igual à base = só o template mudou (atualiza); diferente da base = você editou (vira `.new`).

**Nada dentro de `<ctx>/` é tocado** — `docs/`, `journal/`, `backup/`, `tools/projects.json`, `claude/memory/AGENTS.md` e `skills/` são seus. O `--update` só percorre os arquivos do template: `common/`, `claude/`, `skills/README.md`, `docs/README.md` do molde, `init.sh`, `README.md`, `UPDATE.md`, `.gitignore` e os `.md` de exemplo.

Depois de atualizar:

```bash
cd "$ARCHIVE_DIR"
find . -name '*.new'            # os conflitos para revisar
git diff                        # confira antes de commitar
git add -A && git commit -m "chore: atualiza o template"
```

## O que fazer com os conflitos

Cada `arquivo.new` é a versão **nova do template**. Escolha:

- **Editou de propósito** (ex.: regra sua em `claude/memory/AGENTS.md`): compare com `diff arquivo arquivo.new`, puxe só as mudanças do template e apague o `.new` — o `.new` **não** recebe as suas substituições (`<CTX>` etc.), porque o `--update` não reescreve nada que não venha do template.
- **Não editou**: a diferença aparece só quando o template mudou. Veja `diff arquivo arquivo.new`; se a mudança não te interessa, mantenha o seu (`rm arquivo.new`).

> Recomendação: a partir da primeira atualização, **pare de editar `common/`** e ponha as suas versões em `<ctx>/skills/` ou em scripts próprios — assim não há conflito.
>
> Para inspecionar o que muda antes de aplicar: `git -C <clone-do-template> log --oneline -- common/ _context/`.

## Opção 2 — reinstalar em outra pasta (zero risco)

Se a instalação está muito divergente, e os seus dados vivem em `git`:

```bash
git clone <url-do-seu-repo-instalacao> /tmp/instalacao-nova
bash <template>/init.sh --dir /tmp/instalacao-nova-2 ...
```

Não há migração automática: o `--update` é o caminho para preservar os dados.

## Mudou a pasta da instalação?

O `init.sh` grava caminhos absolutos (`<ARCHIVE_DIR>`) em vários arquivos. Se você mover a instalação:

```bash
bash <template>/init.sh --update --dir "$NEW_PATH"   # não conserta caminhos absolutos
grep -rl "<CAMINHO-ANTIGO>" "$NEW_PATH"              # ache quem ainda aponta para o lugar antigo
```

O caminho da instalação é resolvido pelos scripts a partir de `$ENGRAM_ARCHIVE` ou de `--repo`, com default `~/Work/<ARCHIVE_NAME>` — mover só exige ajustar esses defaults (ou exportar `ENGRAM_ARCHIVE`).

## Versionamento

`.archive-version` guarda o commit curto do template usado na instalação (ou `sem-git-<data>` quando instalado via curl sem `.git`). O `--update` mostra `antiga → nova`. Não edite esse arquivo à mão.
