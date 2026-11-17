---
name: archive-journalling
description: Registro diário de trabalho no journal do <ARCHIVE_NAME> (<CTX>/journal), que alimenta a AVD. Coleta Linear, Slack e GitHub, mostra o rascunho e só grava após confirmação. Triggers: registro do dia, fechar o dia, log do dia, registro de ontem, revisão de sexta, archive-journalling.
argument-hint: '[data AAAA-MM-DD] — vazio = hoje; "ontem" = dia útil anterior'
---

# archive-journalling

Fonte de verdade: `<ARCHIVE_DIR>/<CTX>/journal/GUIA.md` — **ler primeiro**. Convenções, rotina e campos estão lá; esta skill só resume o fluxo. Referência de competências/valores: `referencia-avd.md`; metas: `metas.md`; template: `_template-dia.md`.

Se `GUIA.md` ou `referencia-avd.md` ainda tiverem `_a preencher_`, avise e pare: sem a AVD não há competência/valor a usar.

Data alvo: `$ARGUMENTS` (vazio = hoje; "ontem" = dia útil anterior).

## Coleta (só leitura)

1. **Linear:** issues atualizadas na data (título, url, status, projeto, labels, data de conclusão, anexos).
2. **Slack:** minhas mensagens e threads da data, no usuário/canais do `GUIA.md`.
3. **GitHub:** PRs abertos/atualizados/mergeados e reviews do dia (`gh`).
4. **Dump (`trashcan`):** ler `<ARCHIVE_DIR>/<CTX>/journal/.trashcan.md` (ignorado pelo git; ausente ou vazio = nada). Tratar as entradas como fonte extra do dia, ao lado das ferramentas.
5. Perguntar o que aconteceu fora das ferramentas (discussões, decisões, incidentes, mentoria, alinhamentos, code reviews, release trains).

Cuidados:
- O filtro de data do Linear costuma ter só limite inferior, e `updatedAt` pode esconder a atividade do dia: confira a data de cada item.
- Threads longas misturam dias: confira o horário de cada mensagem. Não diga que executei o que só preparei.
- Se algo não abrir (permissão), diga isso em vez de supor.

## Apresentação

Agrupar por assunto em 2–4 blocos, separando o concluído no dia. Montar as entradas no formato do template (macro, não issue a issue). Metas: só as tocadas pelo dia; avisar em uma linha se alguma com prazo em até 7 dias estiver "Não iniciada". Sexta: listar as metas por prazo e apontar as sem entrada nas últimas 4 semanas. Dia sem nada relevante: uma linha e encerrar.

## Gravação — só após confirmação explícita

Nunca grave antes do ok. Depois:

1. Criar/atualizar `<ARCHIVE_DIR>/<CTX>/journal/AAAA/AAAA-MM-DD.md`.
2. Se eu confirmar progresso, atualizar Status/Link em `metas.md`.
3. Se o dump tinha entradas, acrescentar ao fim do arquivo do dia a seção `## Dump (trashcan)` com o conteúdo literal: cada marcador `<!-- AAAA-MM-DD HH:MM -->` vira `### HH:MM` e o corpo segue intacto (markdown e links preservados).
4. Salvar o gist com `engram save "Journal AAAA-MM-DD" "<gist curto das entregas + Where: <CTX>/journal/AAAA/AAAA-MM-DD.md>" --type discovery --project journal --scope project --topic journal/AAAA-MM-DD` (PATH com `/opt/homebrew/bin`). Não usar `mem_save`: a tool MCP trava no projeto da sessão (`session_project_mismatch`). Nunca o texto completo do registro; nunca pedir execução manual.
5. Sempre rodar, automaticamente e depois do passo 4, `<ARCHIVE_DIR>/common/tools/backup-daily.sh <CTX>` (commit e push só de `backup` + `journal`). O script mantém 1 commit de backup por dia (amend + `--force-with-lease` se o commit do dia já existe). Se o script falhar, avisar e não insistir.
6. **Só se o backup (commit) do passo 5 tiver terminado com sucesso** e o dump foi incorporado: limpar o dump (`: > <ARCHIVE_DIR>/<CTX>/journal/.trashcan.md`). Se o script falhou, ou o dump recebeu entradas novas desde a leitura, não limpar (no segundo caso, remover só as linhas já incorporadas).
7. Se um arquivo novo for criado em `<CTX>/journal/`, atualizar a tabela do `<CTX>/journal/README.md`.

Não invente impacto, competência, valor nem meta; `[a confirmar]` quando for estimativa. "Meu papel" reflete o que de fato fiz.
