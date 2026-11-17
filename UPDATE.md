# Atualização do template

O template (`github.com/<org>/archive`) é imutável: nenhum dado seu vive nele. Atualizar = aplicar os arquivos do template sobre a sua instalação, preservando o que você editou.

## Comando

```bash
# a partir da instalação
bash <(curl -fsSL <url-do-raw>/init.sh) --update --dir "$PWD"

# sem confirmação por arquivo (ainda gera backup)
bash <(curl -fsSL <url-do-raw>/init.sh) --update --dir "$PWD" --yes

# sobrescrever também o que você editou
bash <(curl -fsSL <url-do-raw>/init.sh) --update --dir "$PWD" --force-update
```

`--dir` é obrigatório (ou perguntado). A pasta precisa ter `.archive-version`; sem ela, o script aborta.

## O que o `--update` percorre

Somente arquivos do template:

```
claude/  skills/README.md  docs/README.md  tools/README.md  backup/README.md
common/  init.sh  README.md  UPDATE.md  .gitignore
```

Nunca percorre `<ctx>/docs`, `<ctx>/journal`, `<ctx>/backup`, `<ctx>/tools/projects.json`, `<ctx>/claude/memory/AGENTS.md` nem `<ctx>/skills`.

## Algoritmo

Para cada arquivo do template, renderizado com os valores da instalação (`.archive-meta`) e comparado ao disco:

| Estado | Ação |
|---|---|
| destino não existe | cria |
| destino == render | nada |
| destino == `.archive-base/<arquivo>` | sobrescreve (só o template mudou) |
| destino != base, é config (`claude/`, `opencode/`) | exibe diff, pede `s/N` por arquivo, `cp` para `.old`, sobrescreve |
| destino != base, não é config | grava `<arquivo>.new`, mantém o original |
| `--force-update` | sobrescreve qualquer divergência |

Configs pedem confirmação individual porque são editados à mão e instalam no HOME. Responder `n` mantém o arquivo e **não** gera `.old`.

## Metadados

Dois artefatos por instalação, criados pelo `init.sh`:

| Arquivo | Conteúdo |
|---|---|
| `.archive-version` | commit curto do template aplicado (ou `sem-git-<data>`) |
| `.archive-meta` | `CTX`, `ARCHIVE_NAME`, `ARCHIVE_DIR`, `GITHUB_*`, `LINEAR_*`, `WORKSPACE_DIR` |
| `.archive-base/<arquivo>` | cópia renderizada de cada arquivo do template como ficou após o install/update |

`.archive-base` é a linha de base do próximo diff. Sem ele, qualquer arquivo preenchido pelo install seria tratado como editado.

> Se você versionar a instalação e quiser `--update` funcionando em outra máquina, versione `.archive-meta` e `.archive-base/`. Sem eles, todo config vira conflito no primeiro update.

## Saída

```
+ criado          ~ sobrescrito      ! conflito (.new)
= mantido (você respondeu n)
```

## Resolver conflitos

```bash
diff arquivo arquivo.new     # arquivo.new = versão do template, SEM os seus valores
```

- Mudança do template que você quer: `mv arquivo.new arquivo`.
- Mudança irrelevante: `rm arquivo.new`.
- Se o `.new` de um arquivo do template tiver `<CTX>`/`<GITHUB_ORG>` não substituídos, é esperado: o `--update` não reescreve valores nos conflitos.

## Depois de atualizar

```bash
find . -name '*.new'
git diff
git add -A && git commit -m "chore: atualiza o template"
```

## Mover a instalação

`.archive-meta` guarda `ARCHIVE_DIR` absoluto. Ao mover:

```bash
# 1. mova a pasta
# 2. ajuste o valor e os arquivos que usam caminho absoluto
sed -i '' "s|/<caminho-antigo>|/<caminho-novo>|g" .archive-meta
grep -rl "<caminho-antigo>" . | xargs sed -i '' "s|/<caminho-antigo>|/<caminho-novo>|g"
# 3. ou exporte ENGRAM_ARCHIVE=<novo-path>, que tem precedência nos scripts
```

## Versionamento

`.archive-version` guarda o commit curto do template. O `--update` imprime `antiga → nova`. Não edite o arquivo à mão.

O valor sai de `git -C <template> rev-parse --short HEAD`; instalado via `curl` (sem `.git`), vira `sem-git-<AAAA-MM-DD>`.
