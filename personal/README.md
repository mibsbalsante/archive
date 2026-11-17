# personal

Contexto do PC pessoal (**vazio**; mantido como exemplo de contexto mínimo).

```
personal/
└── backup/engram/<project>/     # engram-export.json + .engram/ (criado pelo backup)
```

Para começar a fazer backup neste PC:

```bash
mkdir -p personal/backup/engram/<project> && common/tools/backup-daily.sh personal
```

Restaurar: `common/tools/restore.sh personal` (ver [../common/tools/README.md](../common/tools/README.md)). Adicione `docs/`, `skills/`, etc. conforme necessário e atualize este README.
