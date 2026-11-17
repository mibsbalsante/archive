# Journal — registro diário de trabalho

Registro diário de trabalho (opcional). Serve como matéria-prima para escrever a avaliação de desempenho (AVD) no fim do ciclo. Versão em arquivos do sistema que seria montado no Notion; o backup (`common/tools/backup-daily.sh`, acionado pela skill) commita e envia esta pasta junto com a memória do Engram.

> Se você não faz avaliação de desempenho com competências e valores, pode apagar esta pasta inteira — nada fora dela depende do journal.

## Estrutura

| Arquivo | Papel | Estado |
|---|---|---|
| [GUIA.md](GUIA.md) | Fonte de verdade da skill `archive-journalling` (convenções, rotina, como escrever a AVD) | esqueleto — preencher |
| [referencia-avd.md](referencia-avd.md) | Formato, escala, competências, valores e feedback da AVD | esqueleto — preencher |
| [metas.md](metas.md) | Metas do ciclo (Desenvolvimento AVD / Entrega) | esqueleto — preencher |
| [_template-dia.md](_template-dia.md) | Template de um registro diário | pronto |
| `AAAA/AAAA-MM-DD.md` | Registro de cada dia (uma seção por entrega) | gerado pela skill |

## Fluxo

1. "registro do dia" / "fechar o dia" → skill `archive-journalling` ([../../common/skills/opcional/archive-journalling/SKILL.md](../../common/skills/opcional/archive-journalling/SKILL.md)).
2. Skill coleta (Linear, Slack, GitHub), mostra o rascunho e **só grava após confirmação**.
3. Grava `AAAA/AAAA-MM-DD.md`, atualiza `metas.md` se confirmado e salva um gist no Engram (`project: journal`, `topic_key: journal/AAAA-MM-DD`, ponteiro para o arquivo).
4. A skill roda `common/tools/backup-daily.sh <CTX>`, que commita e envia (`<CTX>/backup/engram/journal/` + esta pasta).

> Atualize esta tabela sempre que um arquivo novo entrar na pasta.
