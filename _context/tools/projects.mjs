#!/usr/bin/env node
/**
 * projects.mjs — dicionário de projetos do contexto `<CTX>` (handle → doc de tasks).
 *
 * Fonte da verdade: `<CTX>/tools/projects.json`. A seção `## Projetos` do
 * `<CTX>/docs/README.md` é GERADA a partir dela (entre `<!-- projects:start -->`
 * e `<!-- projects:end -->`), então não edite a lista do README à mão.
 *
 * Uso:
 *   node projects.mjs list
 *   node projects.mjs get <handle>
 *   node projects.mjs add <handle> --doc <rel> [--nome <nome>] [--linear <id>] [--default]
 *   node projects.mjs sync                 # regenera a seção Projetos do README
 *
 * Handles consumidos por `next-task.mjs <handle>`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ctx = process.env.ENGRAM_CTX ?? basename(resolve(toolsDir, '..'));
const root = resolve(toolsDir, '../..');
const dictPath = join(toolsDir, 'projects.json');
const readmePath = join(root, ctx, 'docs/README.md');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (!k?.startsWith('--')) { out._.push(k); continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[k.slice(2)] = true;
    else { out[k.slice(2)] = next; i += 1; }
  }
  return out;
}

const readDict = () => JSON.parse(readFileSync(dictPath, 'utf8'));
const writeDict = (d) => writeFileSync(dictPath, `${JSON.stringify(d, null, 2)}\n`);

function syncReadme(dict) {
  const lines = readFileSync(readmePath, 'utf8').split('\n');
  const start = lines.indexOf('<!-- projects:start -->');
  const end = lines.indexOf('<!-- projects:end -->');
  if (start === -1 || end < start) {
    console.error(`projects: marcadores <!-- projects:start -->/<!-- projects:end --> ausentes em ${readmePath}`);
    process.exit(1);
  }
  const prefix = `${ctx}/docs/`;
  const block = Object.entries(dict.projects).map(([handle, p]) => {
    const rel = p.doc.startsWith(prefix) ? p.doc.slice(prefix.length) : p.doc;
    return `- [${rel}](${rel}) — ${p.nome}${handle === dict.default ? ' _(default)_' : ''}`;
  });
  lines.splice(start + 1, end - start - 1, ...block);
  writeFileSync(readmePath, lines.join('\n'));
}

const a = parseArgs(process.argv.slice(2));
const cmd = a._[0] ?? 'list';
const dict = readDict();

if (cmd === 'list') {
  for (const [handle, p] of Object.entries(dict.projects)) {
    console.log(`${handle}${handle === dict.default ? ' (default)' : ''}\t${p.doc}\t${p.linear || '—'}`);
  }
} else if (cmd === 'get') {
  const handle = a._[1];
  const p = dict.projects[handle];
  if (!p) {
    console.error(`projects: handle desconhecido "${handle}" — disponíveis: ${Object.keys(dict.projects).join(', ')}`);
    process.exit(1);
  }
  console.log(p.doc);
} else if (cmd === 'add') {
  const handle = a._[1];
  if (!handle) {
    console.error('uso: projects.mjs add <handle> --doc <rel> [--nome <nome>] [--linear <id>] [--default]');
    process.exit(1);
  }
  const prev = dict.projects[handle] ?? {};
  const doc = typeof a.doc === 'string' ? a.doc : prev.doc;
  if (!doc) { console.error('add: --doc é obrigatório na criação'); process.exit(1); }
  dict.projects[handle] = {
    doc,
    nome: typeof a.nome === 'string' ? a.nome : prev.nome ?? handle,
    linear: typeof a.linear === 'string' ? a.linear : prev.linear ?? '',
  };
  if (a.default === true || !dict.default) dict.default = handle;
  writeDict(dict);
  syncReadme(dict);
  console.log(`✓ ${handle} → ${doc}`);
} else if (cmd === 'sync') {
  syncReadme(dict);
  console.log('✓ README sincronizado');
} else {
  console.error(`comando desconhecido: ${cmd} (use list|get|add|sync)`);
  process.exit(1);
}
