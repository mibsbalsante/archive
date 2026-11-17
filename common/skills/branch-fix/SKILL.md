---
name: branch-fix
description: Corrige erros em um branch. Por padrão isola em uma worktree; ao final pergunta quais scripts do package.json rodar e se deve commitar/dar push.
argument-hint: <branch> [-c] [-n] + erros nas linhas seguintes
arguments: [branch]
disable-model-invocation: true
allowed-tools: Bash(git *) Bash(npm *) Bash(pnpm *) Bash(yarn *) Bash(bun *) Bash(mkdir *) Bash(cp *) Bash(cat *) Bash(ls *) Edit Write Read Grep Glob AskUserQuestion
---

## Contexto

- Raiz: !`git rev-parse --show-toplevel`
- Branch atual: !`git branch --show-current`
- Não commitado: !`git status --short || true`
- Worktrees: !`git worktree list || true`
- Lockfile: !`ls -1 pnpm-lock.yaml yarn.lock package-lock.json bun.lockb 2>/dev/null || true`
- Scripts: !`sed -n '/"scripts"/,/^  }/p' package.json 2>/dev/null || true`

## Entrada

$ARGUMENTS

Branch alvo: `$branch`. Primeira linha: o branch + flags. Linhas seguintes: os erros a corrigir (stack trace, saída de build, output de lint/tsc, ou descrição livre).

| Flag | Efeito |
| :--- | :--- |
| `-c` | Preferir a variante de checagem dos scripts (`lint:ci`, `format:check`, `tsc --noEmit`) em vez da que auto-corrige |
| `-n` | Não criar worktree — trabalhar no branch ativo, no diretório atual |

## Passos

### 0. Confirmar recebimento

Antes de qualquer tool call, diga em uma linha: branch alvo, flags detectadas e quantos erros foram colados. Ex.: "Corrigindo 2 erros em `<GITHUB_USER>/<TASK-ID>-...` (worktree)." Isso dá feedback imediato antes do fetch/worktree/install, que podem demorar.

### 1. Ambiente

Com `-n`: se houver mudanças não commitadas, pare e pergunte (stash, commit ou abortar). Senão, `git fetch origin` e checkout do branch.

Sem `-n`: crie a worktree.

```
git fetch origin
git worktree add ../.worktrees/<repo>-<branch-com-hifens> <branch>
```

Se o branch só existir no remoto, use `-b <branch> --track origin/<branch>`. Se a worktree já existir, reutilize.

Registre para o `/branch-fix-clean`:

```
mkdir -p ~/Work/.branch-fix-registry
echo "<caminho>" >> ~/Work/.branch-fix-registry/${CLAUDE_SESSION_ID}.txt
```

Diga em uma linha onde vai trabalhar (worktree criada ou branch ativo), antes de instalar deps — esse passo é o mais lento.

Worktree nova não tem `node_modules`. Instale com o gerenciador do lockfile e copie `.env*` da raiz, se existir.

### 2. Corrigir

Para cada erro: localize a origem real (`arquivo:linha`), entenda a causa, corrija a causa. Erros com a mesma raiz se resolvem juntos. Siga as convenções do repo e dos arquivos vizinhos. Mudança mínima — sem refatoração oportunista. Não commite nem faça push sem pedido explícito.

Se um erro não for reproduzível a partir do que foi colado, tente rodar o build/teste correspondente antes de adivinhar.

Ignore e não inclua no commit arquivos modificados sem relação com os erros (artefatos gerados, mudanças pré-existentes de outra tarefa) — só avise no resumo final.

### 3. Perguntar quais scripts rodar

Sempre pergunte, mesmo que os scripts sejam óbvios. Use `AskUserQuestion` com multi-seleção, montando as opções a partir dos scripts que existem de fato no `package.json` da raiz. Com `-c`, ofereça a variante de checagem quando ela existir.

Ordem sugerida: format → lint → typecheck → build → test. Script agregado (`check`, `validate`, `verify`) vira opção única no topo.

### 4. Rodar

Rode o que foi selecionado, na ordem acima. Se falhar, corrija e rode de novo — no máximo 3 ciclos, depois pare e reporte o que sobrou.

### 5. Perguntar sobre commit e push

Use `AskUserQuestion`: "Commit e push" / "Só commit" / "Não". Se "Não", pule pro resumo.

Se commitar: carregue `commit-conventions` (ou o `CLAUDE.md` do projeto, se definir algo diferente) para o formato da mensagem. Stage só os arquivos alterados para o fix — nunca `-A`, nunca os fora de escopo do passo 2. Inclua o trailer:

```
Co-authored-by: <modelo do system prompt> <noreply@anthropic.com>
```

Sem `--no-verify`/`--amend`; hook falhou → corrige e cria novo commit. Se "Commit e push", dê `git push` (`-u origin <branch>` se o remoto não existir ainda).

### 6. Reportar

Resumo final, curto:

- Onde trabalhou (worktree ou branch ativo)
- Cada erro → causa → o que mudou (`arquivo:linha`)
- Resultado de cada script, com o comando exato
- O que ficou sem resolver e por quê
- Commit/push: hash + mensagem, ou "não solicitado"
- Arquivos fora de escopo deixados de fora do commit, se houver

Se usou worktree, lembre: `/branch-fix-clean` remove no fim da sessão.
