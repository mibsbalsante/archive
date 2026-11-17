---
name: branch-fix-clean
description: Remove as worktrees criadas pelo /branch-fix nesta sessão, checando antes se há trabalho não salvo.
argument-hint: '[--all] [--force]'
disable-model-invocation: true
allowed-tools: Bash(git *) Bash(cat *) Bash(rm *) Bash(ls *)
---

## Contexto

- Registradas nesta sessão: !`cat ~/Work/.branch-fix-registry/${CLAUDE_SESSION_ID}.txt 2>/dev/null || echo "(nenhuma)"`
- Worktrees do repo: !`git worktree list || true`

## Entrada

$ARGUMENTS

| Flag | Efeito |
| :--- | :--- |
| _(nenhuma)_ | Só as worktrees registradas nesta sessão |
| `--all` | Todas sob `../.worktrees/`, inclusive de sessões anteriores |
| `--force` | Remove mesmo com trabalho não salvo, após confirmação explícita |

## Passos

1. Monte a lista. Se estiver vazia, diga e encerre.

2. Para cada uma: `git -C <caminho> status --short` e `git -C <caminho> log --oneline @{u}.. 2>/dev/null`.

3. Se houver mudança não commitada **ou** commit sem push: **não remova**. Mostre o que tem lá e pergunte. Só siga com `--force` após um "sim" explícito — worktree removida não volta.

4. Nas limpas: `git worktree remove <caminho>`, depois `git worktree prune`.

5. Limpe as linhas correspondentes de `~/Work/.branch-fix-registry/${CLAUDE_SESSION_ID}.txt`; apague o arquivo se esvaziar.

6. Reporte em tabela: caminho, branch, removida ou mantida + motivo.
