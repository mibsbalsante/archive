#!/usr/bin/env node
/**
 * build-tasks.mjs — gera o documento de tasks de um projeto (formato fixo, agrupado por repositório).
 *
 * Uso:
 *   node build-tasks.mjs --linear <linear.json> [--tree <issue-tree.md>] \
 *        --config <config.json> [--prs <prs.json>] [--bodies-from <doc.md>] \
 *        --out <saida.md>
 *
 * Determinístico: mesma entrada -> mesmo byte-a-byte de saída.
 * Os corpos de `#### Descrição completa (Linear)` são copiados verbatim de
 * --bodies-from e nunca reescritos.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const STATUS = {
  backlog: '⚪ Backlog',
  todo: '⚪ Backlog',
  'in progress': '🟡 Em andamento',
  'in review': '🔵 Em revisão',
  validation: '🟣 Em validação',
  done: '✅ Concluída',
  canceled: '⛔ Cancelada',
  cancelled: '⛔ Cancelada',
  duplicate: '🔁 Duplicada',
  blocked: '🔒 Bloqueada',
};
const NOT_STARTED = new Set(['backlog', 'todo']);
const CLOSED = new Set(['done', 'canceled', 'cancelled']);

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!k?.startsWith('--')) continue;
    out[k.slice(2)] = argv[i + 1];
  }
  return out;
}

function readJson(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const nodes =
    raw?.issues?.nodes ?? raw?.issue?.issues?.nodes ?? raw?.nodes ?? (Array.isArray(raw) ? raw : [raw?.issue ?? raw]);
  return nodes.filter(Boolean);
}

const statusEmoji = (name) => STATUS[String(name ?? '').trim().toLowerCase()] ?? `⚪ ${name}`;
const milestoneOf = (title) => /^\[([^\]]+)\]/.exec(title ?? '')?.[1] ?? '—';
const stripMilestone = (title) => String(title ?? '').replace(/^\[[^\]]+\]\s*/, '');
const escapeCell = (s) => String(s ?? '').replace(/\|/g, '\\|');
const plain = (s) => String(s ?? '').replace(/`/g, '').replace(/\|/g, '/');
const anchor = (id) => id.toLowerCase();
const docLink = (id, codes) => (codes[id] ? `[${codes[id]}] [${id}](#${anchor(id)})` : `[${id}](#${anchor(id)})`);

function repoOf(labels, repos) {
  const lower = labels.map((l) => l.toLowerCase());
  return repos.find((r) => lower.includes(r.toLowerCase())) ?? labels.find((l) => /api|monorepo|bff|front|backend/i.test(l)) ?? '—';
}

function autonomiaOf(labels) {
  if (labels.includes('AFK')) return 'AFK';
  if (labels.includes('HITL')) return 'HITL';
  return '—';
}

function prCell(pr) {
  if (!pr) return '—';
  const url = `https://github.com/${process.env.GITHUB_ORG ?? '<GITHUB_ORG>'}/${pr.repo}/pull/${pr.number}`;
  return `[#${pr.number}](${url}) (${pr.draft ? 'draft' : pr.state})`;
}

function codeOf(description, override) {
  if (override?.codigo) return override.codigo;
  const arch = /\*\*Archetype\*\*:\s*`?([A-Z])-/.exec(description ?? '');
  const local = /\*\*ID\*\* \(código local\):\s*`?\[ISSUE-(\d+)\]/.exec(description ?? '');
  return arch && local ? `${arch[1]}${local[1]}` : null;
}

function parseTree(md) {
  const blockedBy = {};
  for (const line of md.split('\n')) {
    const head = /^\s*-\s*\[([BF])-ISSUE-(\d+)\](.*)$/.exec(line);
    if (!head) continue;
    const code = `${head[1]}${head[2]}`;
    const blk = /\[blocked by ([^\]]+)\]/.exec(head[3]);
    blockedBy[code] = blk
      ? blk[1]
          .split(',')
          .map((s) => s.trim().replace(/^([BF])-ISSUE-/, '$1'))
          .filter(Boolean)
      : [];
  }
  return { blockedBy };
}

function levelsOf(ids, blockedBy) {
  const level = {};
  const pending = new Set(ids);
  let guard = 0;
  while (pending.size && guard++ < 1000) {
    for (const id of [...pending]) {
      const deps = (blockedBy[id] ?? []).filter((d) => ids.includes(d));
      if (deps.every((d) => level[d] !== undefined)) {
        level[id] = deps.length ? Math.max(...deps.map((d) => level[d])) + 1 : 0;
        pending.delete(id);
      }
    }
  }
  for (const id of pending) level[id] = 0;
  return level;
}

function codeKey(c) {
  const m = /^([A-Za-z]+)(\d+)$/.exec(String(c ?? ''));
  return m ? [m[1].toUpperCase(), Number(m[2])] : ['Z', 9999];
}
function cmpCode(x, y) {
  const [lx, nx] = codeKey(x.codigo);
  const [ly, ny] = codeKey(y.codigo);
  return lx !== ly ? (lx < ly ? -1 : 1) : nx - ny;
}

/** Extrai o corpo verbatim de cada issue, delimitado por <a id="isp-####"></a>. */
function extractBodies(docPath) {
  if (!docPath) return {};
  const md = readFileSync(docPath, 'utf8');
  const idx = md.indexOf('## Descrições completas (verbatim do Linear)');
  if (idx === -1) return {};
  const tail = md.slice(idx);
  const starts = [];
  const re = /<a id="(isp-\d+)"><\/a>/gi;
  let m;
  while ((m = re.exec(tail))) starts.push({ id: m[1].toUpperCase(), pos: m.index, end: re.lastIndex });
  const bodies = {};
  for (let i = 0; i < starts.length; i += 1) {
    const end = i + 1 < starts.length ? starts[i + 1].pos : tail.length;
    const block = tail.slice(starts[i].end, end);
    const di = block.indexOf('#### Descrição completa (Linear)');
    if (di === -1) continue;
    bodies[starts[i].id] = block
      .slice(di + '#### Descrição completa (Linear)'.length)
      .replace(/^\s*\n/, '')
      .replace(/<\/details>[\s\S]*$/, '')
      .replace(/\n-{3,}\s*$/, '')
      .replace(/\s+$/, '');
  }
  return bodies;
}

/** Rebaixa headings do corpo para negrito (fora de blocos de código), evitando conflito de nível. */
function demoteHeadings(text) {
  let fence = false;
  return String(text ?? '')
    .split('\n')
    .map((l) => {
      if (/^\s*(```|~~~)/.test(l)) fence = !fence;
      if (fence) return l;
      const m = /^(#{1,6})\s+(.*?)\s*$/.exec(l);
      return m ? `**${m[2]}**` : l;
    })
    .join('\n');
}

/** Trunca em limite de palavra (nunca no meio). */
function shorten(text, max) {
  const clean = String(text ?? '').replace(/"/g, "'");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const at = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('_'), cut.lastIndexOf('-'), cut.lastIndexOf('`'));
  return `${(at > max * 0.5 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

const a = args(process.argv.slice(2));
if (!a.linear || !a.config || !a.out) {
  console.error('uso: build-tasks.mjs --linear <json> --config <json> --out <md> [--tree <md>] [--prs <json>] [--bodies-from <md>]');
  process.exit(1);
}

const cfg = JSON.parse(readFileSync(a.config, 'utf8'));
const repos = cfg.repos ?? [];
const overrides = cfg.overrides ?? {};
const prs = a.prs ? JSON.parse(readFileSync(a.prs, 'utf8')) : {};
const tree = a.tree ? parseTree(readFileSync(a.tree, 'utf8')) : { blockedBy: {} };

const issues = readJson(a.linear).map((n) => {
  const labels = (n.labels?.nodes ?? []).map((l) => l.name);
  const id = n.identifier;
  const ov = overrides[id] ?? {};
  return {
    id,
    titulo: n.title ?? ov.titulo ?? id,
    codigo: cfg.codigos?.[id] ?? ov.codigo ?? codeOf(n.description, ov) ?? '—',
    repositorio: ov.repositorio ?? repoOf(labels, repos),
    milestone: ov.milestone ?? milestoneOf(n.title),
    statusKey: String(n.state?.name ?? 'Backlog').toLowerCase(),
    status: statusEmoji(n.state?.name),
    pr: prs[id] ?? null,
    url: n.url,
    autonomia: autonomiaOf(labels),
    priority: n.priority ?? 0,
    descricao: n.description ?? '',
  };
});

const byId = Object.fromEntries(issues.map((i) => [i.id, i]));
const codeToId = Object.fromEntries(issues.filter((i) => i.codigo !== '—').map((i) => [i.codigo, i.id]));
const codes = Object.fromEntries(issues.map((i) => [i.id, i.codigo]));

const blockedBy = {};
for (const issue of issues) {
  blockedBy[issue.id] =
    overrides[issue.id]?.blockedBy ?? (tree.blockedBy[issue.codigo] ?? []).map((c) => codeToId[c]).filter(Boolean);
}
const blocks = Object.fromEntries(issues.map((i) => [i.id, []]));
for (const [id, deps] of Object.entries(blockedBy)) for (const d of deps) blocks[d]?.push(id);

const ids = issues.map((i) => i.id);
const level = levelsOf(ids, blockedBy);
const order = issues.slice().sort((x, y) => level[x.id] - level[y.id] || cmpCode(x, y));
const docDeps = (list) => (list?.length ? list.map((id) => docLink(id, codes)).join(', ') : '—');
const isEligible = (i) => NOT_STARTED.has(i.statusKey) && (blockedBy[i.id] ?? []).every((d) => CLOSED.has(byId[d]?.statusKey));

const repoOrder = [...repos, ...new Set(issues.map((i) => i.repositorio).filter((r) => !repos.includes(r)))];
const byRepo = Object.fromEntries(repoOrder.map((r) => [r, order.filter((i) => i.repositorio === r)]));

const L = [];
const p = (s = '') => L.push(s);
const H = (id, title, depth = 2) => {
  p(`<a id="${id}"></a>`);
  p();
  p(`${'#'.repeat(depth)} ${title}`);
  p();
};

p(`# ${cfg.projeto.nome} — Tasks (ordem de entrega)`);
p();
p(`> Projeto Linear: [${cfg.projeto.nome}](${cfg.projeto.url}) (\`${cfg.projeto.id}\`) · time **${cfg.projeto.time}** (\`${cfg.projeto.timeKey}\`).`);
p('>');
p(`> Repositórios: ${repos.map((r) => `**${r}**`).join(' · ')}.`);
p('>');
if (cfg.fonteSdd) {
  p(`> Fonte SDD: \`${cfg.fonteSdd}\`.`);
  p('>');
}
p(`> Snapshot: **${cfg.snapshot}**. \`Status\` e \`PR\` (e a seção *Próximas tasks*) são mantidos pelo \`archive-project-next-task\`; o resto é gerado pelo \`archive-project-init\`.`);
p();

H('indice', 'Índice');
p(
  `[Resumo](#resumo) · [Legenda](#legenda) · [Próximas tasks](#proximas) · [Ordem de entrega](#ordem) · [Grafo](#grafo) · [Divergências](#divergencias) · [Descrições](#descricoes)`,
);
p();
for (const repo of repoOrder) {
  if (!byRepo[repo].length) continue;
  const items = byRepo[repo].map((i) => `[${i.codigo} ${i.id}](#${anchor(i.id)})`).join(' · ');
  p(`- **[${repo}](#repo-${repo})** — ${items}`);
}
p();

H('legenda', 'Legenda');
p('| Emoji | Estado no Linear | Significado |');
p('|---|---|---|');
p('| ⚪ | `Backlog` / `Todo` | não iniciada |');
p('| 🟡 | `In Progress` | em andamento |');
p('| 🔵 | `In Review` | em revisão |');
p('| 🟣 | `Validation` | em validação |');
p('| ✅ | `Done` | concluída |');
p('| ⛔ | `Canceled` | cancelada |');
p('| 🔁 | `Duplicate` | duplicada |');
p('| 🔒 | `Blocked` | bloqueio externo (não iniciável) |');
p();
p('- `B#` = backend; `F#` = frontend.');
p('- **AFK** = executável por agente sem humano; **HITL** = exige validação humana.');
p('- `Bloqueia` = quem depende desta task; `Bloqueada por` = pré-requisitos diretos.');
p();

H('resumo', 'Resumo');
const porRepo = repos.map((r) => `${issues.filter((i) => i.repositorio === r).length} ${r}`).join(' · ');
const afk = issues.filter((i) => i.autonomia === 'AFK').length;
const hitl = issues.filter((i) => i.autonomia === 'HITL').length;
const semLabel = issues.length - afk - hitl;
p(`- **${issues.length} issues** — ${porRepo}.`);
p(`- **Milestones**: ${[...new Set(issues.map((i) => i.milestone))].map((m) => `\`${m}\``).join(' · ')}.`);
p(`- **Autonomia**: ${afk} AFK · ${hitl} HITL${semLabel ? ` · ${semLabel} sem label` : ''}.`);
p();

H('proximas', 'Próximas tasks');
p('Elegíveis (dependências em `Done`/`Canceled`), por repositório. `▶` marca a próxima de cada repo.');
p();
p('<!-- proximas:start -->');
p();
p('| Repositório | Próxima | Código | Nome | Bloqueada por |');
p('|---|---|---|---|---|');
for (const repo of repoOrder) {
  const eligible = byRepo[repo].filter(isEligible);
  if (!eligible.length) {
    p(`| ${repo} | — | — | — | — |`);
    continue;
  }
  eligible.forEach((i, n) => {
    p(`| ${repo} | ${n === 0 ? '▶ ' : ''}[${i.id}](#${anchor(i.id)}) | ${i.codigo} | ${escapeCell(stripMilestone(i.titulo))} | ${docDeps(blockedBy[i.id])} |`);
  });
}
p();
p('<!-- proximas:end -->');
p();

H('ordem', 'Ordem de entrega (topológica)');
p('Cada nível só entra depois que todas as dependências dos níveis anteriores estiverem concluídas. Tasks do mesmo nível podem rodar em paralelo. A sequência canônica é a coluna `#` da tabela mestre de cada repositório.');
p();
const levels = [...new Set(issues.map((i) => level[i.id]))].sort((x, y) => x - y);
for (const lvl of levels) {
  const items = issues
    .filter((i) => level[i.id] === lvl)
    .sort(cmpCode)
    .map((i) => `\`${i.codigo}\` ${i.id} (${i.repositorio})`)
    .join(' · ');
  p(`- **Level ${lvl}** — ${items}`);
}
p();

for (const repo of repoOrder) {
  const list = byRepo[repo];
  if (!list.length) continue;
  H(`repo-${repo}`, repo);
  p(`**Ordem de entrega (níveis globais):**`);
  p();
  for (const lvl of levels) {
    const at = list.filter((i) => level[i.id] === lvl).sort(cmpCode);
    if (!at.length) continue;
    p(`- **Level ${lvl}** — ${at.map((i) => `\`${i.codigo}\` ${i.id}`).join(' · ')}`);
  }
  p();
  p('<!-- status:start — região mantida pelo archive-project-next-task (só Status e PR) -->');
  p();
  p('| # | Título | ID | Código | Repositório | Milestone | AFK/HITL | Status | PR | Linear | Bloqueia | Bloqueada por |');
  p('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const i of list) {
    p(
      `| ${order.indexOf(i) + 1} | ${escapeCell(i.titulo)} | ${i.id} | ${i.codigo} | ${i.repositorio} | ${i.milestone} | ${i.autonomia} | ${i.status} | ${prCell(i.pr)} | [abrir](${i.url}) | ${docDeps(blocks[i.id])} | ${docDeps(blockedBy[i.id])} |`,
    );
  }
  p();
  p('<!-- status:end -->');
  p();
}

H('grafo', 'Grafo de dependências');
p('```mermaid');
p('flowchart LR');
const nodeId = (i) => (i.codigo === '—' ? i.id.replace(/-/g, '_') : i.codigo);
for (const i of order) p(`  ${nodeId(i)}["${i.codigo} · ${shorten(stripMilestone(i.titulo), 44)}"]`);
for (const i of order) for (const d of blockedBy[i.id]) if (byId[d]) p(`  ${nodeId(byId[d])} --> ${nodeId(i)}`);
p('```');
p();

H('divergencias', 'Divergências / atenção');
for (const d of cfg.divergencias ?? []) p(`- ${d}`);
p();

p('---');
p();
H('descricoes', 'Descrições completas (verbatim do Linear)');
p('Descrição de cada issue exatamente como está no Linear. Este bloco é imutável.');
p();

const bodies = extractBodies(a['bodies-from'] ?? a['descriptions-from']);
for (const repo of repoOrder) {
  const list = byRepo[repo];
  if (!list.length) continue;
  H(`descricoes-${repo}`, repo, 3);
  for (const i of list) {
    p(`<a id="${anchor(i.id)}"></a>`);
    p();
    p('<details>');
    p(`<summary>${i.codigo} · ${i.id} — ${plain(stripMilestone(i.titulo))}</summary>`);
    p();
    p(`> **Milestone:** \`${i.milestone}\` · **Repositório:** \`${i.repositorio}\` · **Prioridade Linear:** P${i.priority} · **Autonomia:** ${i.autonomia}`);
    p('>');
    p(`> **Linear:** ${i.url}`);
    p('>');
    p(`> **Bloqueada por:** ${docDeps(blockedBy[i.id])} · **Bloqueia:** ${docDeps(blocks[i.id])}`);
    p();
    p('#### Descrição completa (Linear)');
    p();
    p(demoteHeadings(bodies[i.id] ?? i.descricao));
    p();
    p('</details>');
    p();
  }
}

writeFileSync(a.out, L.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n'));
console.log(`ok: ${a.out} (${issues.length} issues, ${repoOrder.length} repos)`);
