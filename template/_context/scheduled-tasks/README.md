# scheduled-tasks

Prompts originais das rotinas agendadas do Claude (Code e Cowork). Não são instalados pelo `bootstrap.sh`: rotinas moram em `~/.claude/scheduled-tasks/<id>/`, não em `~/.claude/skills`.

| Rotina | Agenda | Dependência | Para quê |
|---|---|---|---|
| [registro-do-dia-lembrete](registro-do-dia-lembrete/SKILL.md) | `0 18 * * 1-5` | skill [archive-journalling](../../common/skills/opcional/archive-journalling/SKILL.md) | inicia o registro do dia; avisa por notificação quando precisa de confirmação |

## Instalar em outra máquina

```bash
cp -R <CTX>/scheduled-tasks/registro-do-dia-lembrete ~/.claude/scheduled-tasks/
```

Depois crie o agendamento no app com o mesmo id e cron da tabela.

> Atualize a tabela ao adicionar uma rotina. Edite sempre a cópia daqui e recopie para `~/.claude/scheduled-tasks/`.
