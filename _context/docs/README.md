# docs operacionais

Documentação operacional do trabalho em andamento do contexto `<CTX>`, versionada no repo do arquivo (branch `main`, `<CTX>/docs/`).

Subpastas por feature quando há vários arquivos (ex.: `<projeto>/`); docs de arquivo único ficam soltos.

- <Projeto ou área> — docs de investigação, planos e decisões de <projeto ou área>.
- <Projeto ou área> — <descrição curta>.

## Ferramentas

- [../tools/](../tools/README.md) — geradores determinísticos dos docs de tasks (`build-tasks`, `refresh-status`, `next-task`).
- [../../common/tools/](../../common/tools/README.md) — backup/restore/indexação (`backup-daily`, `restore`, `refresh-archive`, `index-engram`, `commit-doc`).
- [../journal/](../journal/README.md) — registro diário de trabalho.

## Projetos

Arquivo principal de cada projeto (subpasta em `<CTX>/docs/`), resolvido por `../tools/projects.json`. Esta lista é gerada por `projects.mjs sync` — não editar à mão:

<!-- projects:start -->
<!-- projects:end -->
