---
name: comment-check
description: Avalia comentários de review contra o código do branch atual e diz quais procedem, com resposta sugerida para cada um.
argument-hint: '[comentários colados] — vazio busca os da PR atual'
disable-model-invocation: true
allowed-tools: Bash(git *) Bash(gh *) Read Grep Glob
---

## Contexto

- Branch: !`git branch --show-current`
- Arquivos alterados: !`git diff --name-only origin/HEAD...HEAD 2>/dev/null || true`
- Diff: !`git diff origin/HEAD...HEAD 2>/dev/null || true`
- Comentários da PR: !`gh pr view --comments 2>/dev/null || true`

## Entrada

$ARGUMENTS

Se houver texto acima, são esses os comentários. Se não, use os da PR. Se as duas fontes estiverem vazias, diga e encerre.

**Execute já, nesta mesma resposta** — não confirme, não peça os comentários, não espere outra mensagem. Comece direto pelo passo 1.

## Passos

### 1. Separar

Um item por comentário. Descarte o que não é acionável (aprovações, "lgtm", ruído de bot).

### 2. Avaliar contra o código atual

Leia o trecho apontado **no estado atual do branch**, não só no diff — o comentário pode já ter sido resolvido por um commit posterior.

| Veredito | Quando |
| :--- | :--- |
| **Procede** | O problema existe hoje e a correção é clara |
| **Procede em parte** | A observação é válida, mas a solução sugerida ou o escopo não |
| **Não procede** | Premissa incorreta, ignora contexto, ou já resolvido |
| **Falta contexto** | Depende de algo fora do repo (produto, API externa, histórico) |

Todo veredito precisa de evidência em `arquivo:linha`. Sem evidência, é "falta contexto".

Seja honesto nas duas direções: não defenda o branch quando o revisor está certo, nem concorde só porque veio de um revisor.

### 3. Reportar

```
N. <comentário em uma linha> — <arquivo:linha>
   Veredito: <categoria>
   Por quê: <1-3 frases com a evidência>
   Resposta sugerida: <texto curto, pronto para colar na PR>
```

### 4. Oferecer a correção

Se houver itens que procedem, monte o bloco pronto para colar na próxima mensagem:

```
/branch-fix <branch-atual> -n -c
<um problema por linha, descrito como erro a corrigir e não como citação do comentário>
```

Pergunte se quer rodar assim, ajustar a lista, ou tratar só parte. Este comando só analisa — não corrija nada aqui.
