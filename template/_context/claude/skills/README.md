# claude/skills

Skills para o Claude (Code e Cowork). **Não guarda cópias**: a fonte é a skill original, instalada por symlink em `~/.claude/skills` — o mesmo diretório que o OpenCode lê. Regras e checklist: [../../common/docs/skills-sync.md](../../../common/docs/skills-sync.md).

| Skill | Original | Instalar |
|---|---|---|
| gerais (`common/skills`) | [../../common/skills/README.md](../../../common/skills/README.md) | Code + OpenCode: `../bootstrap.sh --skills` |
| opcionais (`common/skills/opcional`) | [../../common/skills/opcional/](../../../common/skills/opcional/) | idem — `--skills` instala as três pastas |
| do contexto (`<CTX>/skills`) | [../skills/README.md](../skills/README.md) | idem |
| Cowork | — | `../../../common/tools/pack-skill.sh <nome>` e subir o `.skill` |

## Cowork

O Cowork não lê `~/.claude/skills`. Gere o pacote e faça o upload em Settings → Capabilities → Skills:

```bash
common/tools/pack-skill.sh archive-journalling      # gera ~/Downloads/journalling.skill
```

Reempacote e suba de novo sempre que a skill original mudar. No Cowork a skill pode rodar sem acesso ao repo, `engram` e `gh`.

> Atualize a tabela ao referenciar uma skill nova.
