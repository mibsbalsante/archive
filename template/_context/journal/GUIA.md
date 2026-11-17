# Guia para IA — leia primeiro

> Nada aqui pode ser inventado: competências, valores, metas e impacto vêm só da AVD e do que o dono do journal disser. Slack liberado.

## Objetivos

Registrar entregas todo dia útil e, no fim do ciclo, escrever a AVD só com o que está no journal.

## Mapa

- Registros: `<CTX>/journal/AAAA/AAAA-MM-DD.md` (template: [_template-dia.md](_template-dia.md)).
- Metas: [metas.md](metas.md) — "Desenvolvimento (AVD)" e "Entrega" nunca se misturam na análise.
- Referência: [referencia-avd.md](referencia-avd.md) — competências, valores, escala, formato.
- Ciclo: _a preencher_ · Fuso: _a preencher_ (ex.: horário de Brasília, UTC−3)
- Projetos (lista fixa, no Linear):
  - _a preencher_

## Convenções do registro

- **O que:** verbo no passado + resultado, uma linha; entrega macro, nunca issue a issue.
- **Data:** o dia em que aconteceu.
- **Impacto:** número ou consequência; nunca inventar; `[a confirmar]` se for estimativa.
- **Competência:** pela definição da Referência AVD.
- **Meu papel:** o que de fato fiz (Defini/decidi · Liderei/orquestrei · Executei · Apoiei · Mentorei), sem inflar.
- **Contexto:** 1–2 frases do porquê.
- **Projeto:** lista fixa; se nenhuma servir, perguntar antes de criar uma nova.
- **Tipo Suporte:** atendimento sob demanda (scripts, liberações, correções manuais), nem sempre com task 1:1. Obrigatórios: O que, Status, Meu papel, Contexto. Link, Impacto, Competência, Valor, Envolvidos e Meta são opcionais: só entram se informados no contexto ou na task; nunca `[a confirmar]` neles.

## Rotina diária (dias úteis, fim do expediente)

1. Linear: issues atribuídas a mim (`assignee: me`) atualizadas ou concluídas no dia (título, url, status, projeto, labels, data de conclusão, anexos).
2. Slack: minhas mensagens e threads do dia, nos canais informados.
3. GitHub: PRs abertos/atualizados/mergeados e reviews do dia, só da organização `<GITHUB_ORG>` (usar `--owner <GITHUB_ORG>` no `gh search`).
4. Agrupar por assunto em 2–4 blocos; separar o concluído no dia.
5. Perguntar o que aconteceu fora das ferramentas (discussões, decisões, incidentes, mentoria, alinhamentos, code reviews, release trains).
6. Dia sem nada relevante: dizer em uma linha e encerrar.
7. Metas: só mencionar as que o dia tocou; avisar em uma linha se alguma com prazo em até 7 dias estiver "Não iniciada".
8. Sexta: listar as metas por prazo com status e apontar as sem nenhuma entrada nas últimas 4 semanas.

## Gravação

Nada é gravado antes da confirmação. Depois: criar/atualizar `AAAA/AAAA-MM-DD.md`, atualizar Status e Link da meta se o progresso for confirmado e salvar o gist no Engram (`project: journal`, `topic_key: journal/AAAA-MM-DD`).

## Como escrever a AVD no fim do ciclo

1. Ler a Referência AVD; consultar todos os registros e as metas.
2. Seguir a estrutura da AVD (resultados, cultura, competências com nota proposta, conceito final).
3. Só evidências do journal, citando o arquivo; listar lacunas em vez de preenchê-las.
4. Usar "Meu papel" para distinguir liderança de execução.
5. Comparar com as metas de desenvolvimento e o feedback anterior.
6. Propor notas com justificativa; a decisão é do dono do journal.
