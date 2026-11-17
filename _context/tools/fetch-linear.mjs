#!/usr/bin/env node
/**
 * fetch-linear.mjs — busca os status das issues direto na API GraphQL do Linear,
 * pedindo SOMENTE os campos usados pelos scripts (nunca a `description` inteira).
 *
 * Substitui o `search_issues_by_identifier` do MCP, que devolve descrição +
 * comentários de cada issue (~250KB para 25 issues). Aqui o payload é ~3KB e o
 * resultado vai direto para arquivo — nada entra no contexto do agente.
 *
 * Uso:
 *   node fetch-linear.mjs --doc <CTX>/docs/<chave>-tasks.md --out <CTX>/tools/.tmp/<chave>.linear.json
 *   node fetch-linear.mjs --ids <LINEAR_TEAM>-3989,<LINEAR_TEAM>-3999 --out .tmp/x.json
 *   node fetch-linear.mjs --project <projectId> --out .tmp/x.json --full   # todas as issues do projeto
 *   node fetch-linear.mjs --doc <md> --out <json> --full                   # inclui description (project-init)
 *
 * Token: `LINEAR_ACCESS_TOKEN` (ou `LINEAR_API_KEY`) no ambiente.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const MIN_FIELDS = 'identifier title url priority state{name} assignee{name} labels{nodes{name}}';
const FULL_FIELDS = `${MIN_FIELDS} description`;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (!k?.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[k.slice(2)] = true;
    else {
      out[k.slice(2)] = next;
      i += 1;
    }
  }
  return out;
}

/** IDs da coluna `ID` das tabelas mestre (`| # | Título | ...`). */
function readDocIds(path) {
  const md = readFileSync(path, 'utf8');
  const ids = [];
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\|\s*#\s*\|\s*Título\s*\|/.test(lines[i])) continue;
    const cols = lines[i]
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    const idCol = cols.indexOf('ID');
    for (let j = i + 2; j < lines.length && lines[j].startsWith('|'); j += 1) {
      const cells = lines[j].split('|').slice(1, -1);
      if (cells.length !== cols.length) continue;
      const id = cells[idCol]?.trim();
      if (/^[A-Z]+-\d+$/.test(id)) ids.push(id);
    }
  }
  return [...new Set(ids)];
}

const a = parseArgs(process.argv.slice(2));
if (!a.out || (!a.doc && !a.ids && !a.project)) {
  console.error('uso: fetch-linear.mjs (--doc <md> | --ids <LINEAR_TEAM>-1,<LINEAR_TEAM>-2 | --project <id>) --out <json> [--team <KEY>] [--full]');
  process.exit(1);
}

const token = process.env.LINEAR_ACCESS_TOKEN || process.env.LINEAR_API_KEY;
if (!token) {
  console.error('fetch-linear: defina LINEAR_ACCESS_TOKEN (ou LINEAR_API_KEY) no ambiente');
  process.exit(2);
}

const team = a.team ?? process.env.LINEAR_TEAM;
if (!a.project && !team) { console.error('informe o time do Linear com --team <KEY> (ou exporte LINEAR_TEAM).'); process.exit(1); }
const ids = a.ids
  ? String(a.ids)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : a.project
    ? []
    : readDocIds(a.doc);
if (!ids.length && !a.project) {
  console.error('fetch-linear: nenhum ID encontrado');
  process.exit(1);
}
const nums = [...new Set(ids.map((id) => Number(String(id).replace(/^\D+/, ''))))].filter(Number.isFinite);
const fields = a.full ? FULL_FIELDS : MIN_FIELDS;
const endpoint = a.url ?? 'https://api.linear.app/graphql';

const nodes = [];
let after = null;
for (let page = 0; page < 20; page += 1) {
  const byProject = Boolean(a.project);
  const argDecl = byProject ? '$project:ID!' : '$team:String!,$nums:[Float!]!';
  const filter = byProject
    ? 'project:{id:{eq:$project}}'
    : 'team:{key:{eq:$team}}, number:{in:$nums}';
  const query = `query(${argDecl}${after ? ',$after:String' : ''}){
    issues(filter:{${filter}}, first:100${after ? ', after:$after' : ''}){
      pageInfo{hasNextPage endCursor}
      nodes{ ${fields} }
    }
  }`;
  const variables = byProject ? { project: a.project } : { team, nums };
  if (after) variables.after = after;
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    console.error(`fetch-linear: falha de rede — ${err.message}`);
    process.exit(1);
  }
  const json = await res.json();
  if (json.errors?.length) {
    console.error(`fetch-linear: ${json.errors.map((e) => e.message).join('; ')}`);
    process.exit(1);
  }
  const pageNodes = json.data?.issues?.nodes ?? [];
  nodes.push(...pageNodes);
  const info = json.data?.issues?.pageInfo;
  if (!info?.hasNextPage) break;
  after = info.endCursor;
}

mkdirSync(dirname(a.out), { recursive: true });
writeFileSync(a.out, JSON.stringify({ issues: { nodes } }, null, 2));
const scope = a.project ? `projeto ${a.project}` : `${nodes.length}/${ids.length} issues`;
console.error(`ok: ${a.out} (${scope}${a.full ? ', full' : ''})`);
