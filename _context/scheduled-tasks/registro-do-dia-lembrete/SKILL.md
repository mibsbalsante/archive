---
name: registro-do-dia-lembrete
description: Prompt da rotina agendada que dispara a skill journalling no fim do dia útil.
---

Use a skill `journalling` para o registro de hoje. Leia primeiro <ARCHIVE_DIR>/<CTX>/journal/GUIA.md. Se GUIA.md ou referencia-avd.md ainda tiverem "_a preencher_", diga isso em uma linha e encerre. Caso contrário, colete Linear, Slack e GitHub (só leitura), monte o rascunho no formato do template e APRESENTE para mim; não grave nada antes da confirmação explícita. Após a confirmação, a skill grava o registro, salva o gist no Engram (project: journal) e roda <ARCHIVE_DIR>/common/tools/backup-daily.sh <CTX>. Responda em português, curto e direto.
