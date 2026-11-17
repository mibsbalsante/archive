---
name: trashcan
description: Anota qualquer texto no dump diário (<CTX>/journal/.trashcan.md) para a rotina de journalling incorporar depois. Só acrescenta; nunca lê, edita ou limpa o arquivo. Triggers: trashcan, joga na trashcan, anota na trashcan, guarda no dump do dia.
argument-hint: '<texto a guardar>'
allowed-tools: Bash(mkdir *) Bash(date *) Bash(cat >> *)
---

## Entrada

$ARGUMENTS

Se vazio, peça o texto em uma linha e encerre.

## O que fazer

Acrescentar o texto ao fim de `<ARCHIVE_DIR>/<CTX>/journal/.trashcan.md` (criar se não existir), no formato:

```
<!-- AAAA-MM-DD HH:MM -->

<texto literal>

```

- **Texto intocado, markup só quando falta:** ler a mensagem como veio. Se já for markdown, gravar byte a byte (títulos, listas, tabelas, blocos de código, ênfase, links, quebras e indentação). Se for texto cru (colado do Slack/Linear, lista sem marcador, URL solta, log/código sem cerca), **só acrescentar sintaxe markdown**: marcador de lista e indentação de aninhamento, `[texto](url)` ou `<url>` para URL solta, cerca de código para bloco de código/log, crases para identificadores óbvios (flags `UPPER_SNAKE`, nomes de arquivo/comando).
- **Nunca alterar caracteres existentes:** não trocar hífens (`-`, `—`, `–`), pontuação, maiúsculas, palavras nem ordem; não reescrever, resumir, encurtar URL nem escapar. Na dúvida se algo precisa de markup, deixar como veio.
- Gravar com heredoc de delimitador entre aspas (`cat >> arquivo <<'TRASHCAN_EOF'`), para o shell não expandir `$`, crases, `\` nem aspas. Nunca usar `echo`/`printf` com o texto inline.
- O marcador é comentário HTML (não vira título), para não colidir com `#` do texto. Hora local via `date '+%Y-%m-%d %H:%M'`.
- Sempre append (`>>`); nunca sobrescrever, reordenar ou apagar entradas.
- O arquivo é ignorado pelo git (`.gitignore`). Quem consome e limpa é a `journalling`, após o commit do dia.

Responder só com `anotado` (uma linha). Não interpretar, classificar nem agir sobre o conteúdo.
