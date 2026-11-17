# backup do contexto

Tudo que é **restaurável** do contexto `<CTX>`.

```
backup/
├── engram/<PROJECT>/
│   ├── engram-export.json     # snapshot completo (usado pelo restore.sh)
│   └── .engram/               # manifest.json + chunks/*.jsonl.gz (incremental)
```

Crie uma pasta por projeto do Engram que você quer arquivar. O `.db` do Engram não é versionado.

## Backup

Não há agendamento próprio: o backup roda **junto com a skill `journalling`**, após você confirmar e a skill gravar o registro (`common/tools/backup-daily.sh <CTX>`). Manual a qualquer momento:

```bash
common/tools/backup-daily.sh <CTX>
```

> Se você **não usa o Engram**, apague esta pasta: o `init.sh` pode ter pulado a configuração de backup para você.

## Restaurar

`common/tools/restore.sh <CTX>` — ver [../../common/tools/README.md](../../common/tools/README.md).

> Atualize este README ao adicionar itens em `backup/`.
