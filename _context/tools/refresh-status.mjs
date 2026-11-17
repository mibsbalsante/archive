#!/usr/bin/env node
/**
 * refresh-status.mjs — atualiza SOMENTE as colunas `Status` e `PR` das tabelas
 * mestre de um doc de tasks (e a seção `Próximas tasks`), a partir do estado
 * atual do Linear, e imprime a tabela de próximas tasks agrupada por repositório.
 *
 *  Uso:
 *   node refresh-status.mjs --doc <doc.md> --linear <linear.json> [--prs <prs.json>] [--dry-run]
 *
 *  Garantias:
 *   - não toca em nenhuma outra parte do documento (índice, ordem, grafo,
 *     divergências, descrições verbatim);
 *   - idempotente: rodar duas vezes com a mesma entrada produz o mesmo arquivo.
 *
 *  Saída (stdout): TODAS as tasks não encerradas do projeto, de todos os repos,
 *  agrupadas por repositório e com elegíveis primeiro. Encerradas
 *  (`Done`/`Canceled`/`Duplicate`) ficam fora.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const STATUS_EMOJI = {
  backlog: '⚪',
  todo: '⚪',
  'in progress': '🟡',
  'in review': '🔵',
  validation: '🟣',
  done: '✅',
  canceled: '⛔',
  cancelled: '⛔',
  duplicate: '🔁',
  blocked: '🔒',
};
const NOT_STARTED = new Set(['backlog', 'todo']);
const CLOSED = new Set(['done', 'canceled', 'cancelled']);
const TERMINAL = new Set([...CLOSED, 'duplicate']);

function args(argv) {
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

function readLinear(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const nodes = raw?.issues?.nodes ?? raw?.nodes ?? (Array.isArray(raw) ? raw : [raw?.issue ?? raw]);
  return Object.fromEntries(
    nodes.filter(Boolean).map((n) => {
      const key = String(n.state?.name ?? 'Backlog').trim().toLowerCase();
      const label = n.state?.name ?? '—';
      const emoji = STATUS_EMOJI[key] ?? '⚪';
      return [
        n.identifier,
        {
          statusKey: key,
          status: `${emoji} ${label}`,
          statusLabel: label,
          statusEmoji: emoji,
          title: n.title ?? '',
          url: n.url ?? '',
          assignee: n.assignee?.name ?? null,
        },
      ];
    }),
  );
}

const prCell = (pr) => {
  if (!pr) return '—';
  const url = `https://github.com/${process.env.GITHUB_ORG ?? '<GITHUB_ORG>'}/${pr.repo}/pull/${pr.number}`;
  return `[#${pr.number}](${url}) (${pr.draft ? 'draft' : pr.state})`;
};

const escapeCell = (s) => String(s ?? '').replace(/\|/g, '\\|');

const depLink = (id, urls) => (urls[id] ? `[${id}](${urls[id]})` : `[${id}](#${id.toLowerCase()})`);

const linkDeps = (cell, urls) => {
  const ids = String(cell ?? '').match(new RegExp(`\\b(${process.env.LINEAR_TEAM ?? '[A-Z]+'})-\\d+`, 'g'));
  if (!ids?.length) return '—';
  return [...new Set(ids)].map((id) => depLink(id, urls)).join(', ');
};

const linkDepsWithStatus = (cell, urls, byId) => {
  const ids = String(cell ?? '').match(new RegExp(`\\b(${process.env.LINEAR_TEAM ?? '[A-Z]+'})-\\d+`, 'g'));
  if (!ids?.length) return '—';
  return [...new Set(ids)]
    .map((id) => {
      const emoji = byId[id]?.statusEmoji;
      return `${emoji ? `${emoji} ` : ''}${depLink(id, urls)}`;
    })
    .join(', ');
};

const a = args(process.argv.slice(2));
if (!a.doc || !a.linear) {
  console.error('uso: refresh-status.mjs --doc <md> --linear <json> [--prs <json>] [--dry-run]');
  process.exit(1);
}

const doc = readFileSync(a.doc, 'utf8');
const lines = doc.split('\n');
const linear = readLinear(a.linear);
const prs = a.prs ? JSON.parse(readFileSync(a.prs, 'utf8')) : {};

const headerRepos = (() => {
  const m = /^> Repositórios:\s*(.+)$/m.exec(doc);
  return m ? [...m[1].matchAll(/\*\*([^*]+)\*\*/g)].map((x) => x[1]) : null;
})();

const colByHeader = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());

const rows = [];
for (let i = 0; i < lines.length; i += 1) {
  if (!/^\|\s*#\s*\|\s*Título\s*\|/.test(lines[i])) continue;
  const cols = colByHeader(lines[i]);
  const col = (name) => cols.indexOf(name);
  for (let j = i + 2; j < lines.length && lines[j].startsWith('|'); j += 1) {
    const cells = lines[j].split('|').slice(1, -1);
    if (cells.length !== cols.length) continue;
    const id = cells[col('ID')].trim();
    const entry = linear[id];
    if (entry && !a['dry-run']) {
      cells[col('Status')] = ` ${entry.status} `;
      cells[col('PR')] = ` ${prCell(prs[id])} `;
      lines[j] = `|${cells.join('|')}|`;
    }
    rows.push({
      id,
      titulo: cells[col('Título')].trim(),
      codigo: cells[col('Código')].trim(),
      repositorio: cells[col('Repositório')].trim(),
      milestone: cells[col('Milestone')].trim(),
      statusKey: entry?.statusKey ?? 'backlog',
      status: entry?.status ?? '—',
      statusLabel: entry?.statusLabel ?? '—',
      statusEmoji: entry?.statusEmoji ?? '',
      assignee: entry?.assignee ?? null,
      url: entry?.url ?? (/\((https?:[^)]+)\)/.exec(cells[col('Linear')])?.[1] ?? ''),
      blockedBy: cells[col('Bloqueada por')].trim(),
      blocks: cells[col('Bloqueia')].trim(),
    });
  }
}
if (!rows.length) {
  console.error('tabela mestre não encontrada (header `| # | Título | ...`)');
  process.exit(1);
}

const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
const urls = Object.fromEntries(rows.map((r) => [r.id, r.url]));
const codesById = Object.fromEntries(rows.map((r) => [r.id, r.codigo]));
const depIds = (cell) => String(cell ?? '').match(new RegExp(`\\b(${process.env.LINEAR_TEAM ?? '[A-Z]+'})-\\d+`, 'g')) ?? [];
const docDeps = (cell) => {
  const ids = [...new Set(depIds(cell))];
  if (!ids.length) return '—';
  return ids.map((id) => (codesById[id] ? `[${codesById[id]}] [${id}](#${id.toLowerCase()})` : `[${id}](#${id.toLowerCase()})`)).join(', ');
};
const isEligible = (r) => NOT_STARTED.has(r.statusKey) && depIds(r.blockedBy).every((id) => !byId[id] || CLOSED.has(byId[id].statusKey));

const repoOrder = [...new Set([...(headerRepos ?? []), ...rows.map((r) => r.repositorio)])];

const notStarted = rows.filter((r) => NOT_STARTED.has(r.statusKey));
const perRepo = repoOrder
  .map((repo) => {
    const list = notStarted.filter((r) => r.repositorio === repo);
    return { repo, eligible: list.filter(isEligible), blocked: list.filter((r) => !isEligible(r)) };
  })
  .filter((g) => g.eligible.length || g.blocked.length);

// --- reconstrói a seção Próximas tasks do doc ---
const start = lines.indexOf('<!-- proximas:start -->');
const end = lines.indexOf('<!-- proximas:end -->');
if (start !== -1 && end > start) {
  const block = ['', '| Repositório | Próxima | Código | Nome | Bloqueada por |', '|---|---|---|---|---|'];
  for (const { repo, eligible, blocked } of perRepo) {
    const list = eligible.length ? eligible : blocked.slice(0, 1);
    list.forEach((r, n) => {
      const nome = escapeCell(r.titulo.replace(/^\[[^\]]+\]\s*/, ''));
      block.push(`| ${repo} | ${n === 0 ? '▶ ' : ''}[${r.id}](#${r.id.toLowerCase()}) | ${r.codigo} | ${nome} | ${docDeps(r.blockedBy)} |`);
    });
  }
  block.push('');
  lines.splice(start + 1, end - start - 1, ...block);
}

if (!a['dry-run']) writeFileSync(a.doc, lines.join('\n'));

// --- tabela de saída (stdout): todas as tasks não encerradas, por repositório ---
const out = [
  '| Repositório | Task | Nome | Milestone | Status | Bloqueada por | Bloqueia |',
  '|---|---|---|---|---|---|---|',
];
let openCount = 0;
for (const repo of repoOrder) {
  const list = rows.filter((r) => r.repositorio === repo && !TERMINAL.has(r.statusKey));
  if (!list.length) continue;
  const eligible = list.filter(isEligible);
  const rest = list.filter((r) => !isEligible(r));
  [...eligible, ...rest].forEach((r, n) => {
    openCount += 1;
    const nome = r.titulo.replace(/^\[[^\]]+\]\s*/, '').replace(/\|/g, '\\|');
    const mark = n === 0 ? '▶ ' : '';
    out.push(
      `| ${repo} | ${mark}[${r.id}](${r.url}) \\| ${r.codigo} | ${nome} | ${r.milestone} | ${r.status} | ${linkDepsWithStatus(r.blockedBy, urls, byId)} | ${linkDeps(r.blocks, urls)} |`,
    );
  });
}

console.log(out.join('\n'));
if (!a['dry-run']) console.error(`ok: status/PR + Próximas tasks atualizados em ${a.doc} (${openCount} tasks não encerradas)`);
