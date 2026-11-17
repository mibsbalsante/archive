#!/usr/bin/env node
/**
 * collect-prs.mjs — monta o mapa `<LINEAR_TEAM>-#### → { repo, number, state, draft }` para
 * o doc de tasks com UMA busca `gh search prs` (IDs unidos por `OR` + `in:title`),
 * em vez de uma busca por issue.
 *
 * O `in:title` evita casar por corpo (um PR de outra issue entrando no mapa). Ainda
 * assim filtramos localmente pelo `[<LINEAR_TEAM>-####]` do título, que é a fonte de verdade.
 *
 * Uso:
 *   node collect-prs.mjs --doc <CTX>/docs/<chave>-tasks.md --out <CTX>/tools/.tmp/<chave>.prs.json
 *   node collect-prs.mjs --linear .tmp/<chave>.linear.json --out .tmp/<chave>.prs.json
 *   node collect-prs.mjs --ids <LINEAR_TEAM>-3989,<LINEAR_TEAM>-3999 --out .tmp/x.json [--owner <org>]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';

const CHUNK = 40;

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

/** IDs dos `nodes` de um JSON do `fetch-linear.mjs`. */
function readLinearIds(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const nodes = raw?.issues?.nodes ?? raw?.nodes ?? [];
  return [...new Set(nodes.map((n) => n?.identifier).filter((id) => /^[A-Z]+-\d+$/.test(id)))];
}

/** PR aberto ganha de fechado; empate → número maior (mais recente). */
function better(cand, cur) {
  const openCand = cand.state === 'open';
  const openCur = cur.state === 'open';
  if (openCand !== openCur) return openCand;
  return cand.number > cur.number;
}

const a = parseArgs(process.argv.slice(2));
if (!a.out || (!a.doc && !a.ids && !a.linear)) {
  console.error('uso: collect-prs.mjs (--doc <md> | --ids <LINEAR_TEAM>-1,<LINEAR_TEAM>-2 | --linear <json>) --out <json> [--owner <org>]');
  process.exit(1);
}

const owner = a.owner ?? process.env.GITHUB_ORG;
if (!owner) { console.error('informe a organização com --owner <org> (ou exporte GITHUB_ORG).'); process.exit(1); }
const ids = a.ids
  ? String(a.ids)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : a.linear
    ? readLinearIds(a.linear)
    : readDocIds(a.doc);
if (!ids.length) {
  console.error('collect-prs: nenhum ID encontrado');
  process.exit(1);
}

const wanted = new Set(ids);
const chunks = [];
for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));

const prs = {};
let searches = 0;
for (const chunk of chunks) {
  const query = `${chunk.join(' OR ')} in:title`;
  searches += 1;
  let raw = '[]';
  try {
    raw = execFileSync(
      'gh',
      ['search', 'prs', '--owner', owner, query, '--limit', '100', '--json', 'number,state,isDraft,repository,title'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (err) {
    console.error(`collect-prs: gh falhou — ${String(err.stderr ?? err.message).trim()}`);
    continue;
  }
  for (const pr of JSON.parse(raw)) {
    const tags = String(pr.title).match(/\[[A-Z]+-\d+\]/g) ?? [];
    for (const tag of tags) {
      const id = tag.slice(1, -1);
      if (!wanted.has(id)) continue;
      const cand = { repo: pr.repository?.name, number: pr.number, state: pr.state, draft: !!pr.isDraft };
      if (!prs[id] || better(cand, prs[id])) prs[id] = cand;
    }
  }
}

mkdirSync(dirname(a.out), { recursive: true });
writeFileSync(a.out, JSON.stringify(prs, null, 2));
console.error(`ok: ${a.out} (${Object.keys(prs).length} PRs, ${searches} busca(s))`);
