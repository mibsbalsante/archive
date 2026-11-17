#!/usr/bin/env node
/**
 * index-engram.mjs — indexa o conhecimento NÃO-regenerável de `<ctx>/docs/` no Engram.
 *
 * Os arquivos continuam sendo a fonte da verdade; o Engram guarda uma observação
 * curada por doc (com `--topic` estável → upsert idempotente), para busca/recall
 * rápido via `mem_search`/`mem_context`. Rodar de novo ATUALIZA, não duplica.
 *
 * NÃO indexa (regenerável/descartável): `*-tasks.md`, `*-linear-tasks.md`,
 * `*-todos.md`, `.tmp/`, `temp-error-logs.md`, `README.md` e
 * `readonly/` (externo — só com `--include-readonly`).
 *
 * Uso:
 *   node index-engram.mjs --ctx <ctx> [--root <archive>] [--project <project>] \
 *        [--scope project] [--engram <bin>] [--include-readonly] [--dry-run]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_FILES = new Set(['README.md', 'temp-error-logs.md']);
const REGENERABLE = [/-tasks\.md$/i, /-tasks-por-projeto\.md$/i, /^.*-todos\.md$/i];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (!k?.startsWith('--')) continue;
    const next = argv[i + 1];
    const key = k.slice(2);
    const val = next === undefined || next.startsWith('--') ? true : next;
    if (val !== true) i += 1;
    out[key] = val;
  }
  return out;
}

function engramBin(explicit) {
  if (explicit) return explicit;
  if (process.env.ENGRAM_BIN) return process.env.ENGRAM_BIN;
  if (existsSync('/opt/homebrew/bin/engram')) return '/opt/homebrew/bin/engram';
  return 'engram';
}

function walkMarkdown(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = relative(base, abs).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.tmp' || entry.name === '.git') continue;
      walkMarkdown(abs, base, out);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(rel);
    }
  }
  return out;
}

function firstHeading(md) {
  return /^#\s+(.+)$/m.exec(md)?.[1]?.trim();
}

function firstParagraph(md) {
  const lines = md.split('\n');
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith('```')) inFence = !inFence;
    if (inFence) continue;
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('<!--') || t.startsWith('|') || t.startsWith('>')) continue;
    return t.replace(/\*\*/g, '').slice(0, 300);
  }
  return '';
}

function subHeadings(md) {
  return [...md.matchAll(/^#{2,3}\s+(.+)$/gm)]
    .map((m) => m[1].replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .slice(0, 6);
}

function classify(rel) {
  const n = rel.toLowerCase();
  if (/adr|arquitetura|architecture/.test(n)) return 'architecture';
  if (/prd|plan|plano/.test(n)) return 'architecture';
  if (/convention|convencao|inicializacao|sop/.test(n)) return 'policy';
  return 'discovery';
}

function slug(rel) {
  return rel
    .replace(/\.md$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildBody(rel, md) {
  const what = firstParagraph(md);
  const headings = subHeadings(md);
  const parts = [`**What**: ${what || '(sem parágrafo introdutório)'}`];
  parts.push(`**Where**: ${ctx}/docs/${rel}`);
  if (headings.length) parts.push(`**Learned**: ${headings.join(' | ')}`);
  return parts.join('\n').slice(0, 2500);
}

const a = parseArgs(process.argv.slice(2));
const dryRun = a['dry-run'] === true;
const repoRoot = typeof a.root === 'string' ? resolve(a.root) : resolve(fileURLToPath(new URL('../..', import.meta.url)));
const ctx = typeof a.ctx === 'string' ? a.ctx : process.env.ENGRAM_CTX;
if (!ctx) {
  console.error('informe o contexto com --ctx <nome> (ou exporte ENGRAM_CTX).');
  process.exit(1);
}
const srcDir = join(repoRoot, ctx, 'docs');
const project = typeof a.project === 'string' ? a.project : process.env.ENGRAM_PROJECT;
if (!project) {
  console.error('informe o projeto do Engram com --project <nome> (ou exporte ENGRAM_PROJECT).');
  process.exit(1);
}
const scope = typeof a.scope === 'string' ? a.scope : 'project';
const includeReadonly = a['include-readonly'] === true;
const engram = engramBin(typeof a.engram === 'string' ? a.engram : undefined);

if (!existsSync(srcDir)) {
  console.error(`index-engram: ${srcDir} não existe.`);
  process.exit(1);
}

const docs = walkMarkdown(srcDir).filter((rel) => {
  const base = rel.split('/').pop();
  if (SKIP_FILES.has(base)) return false;
  if (REGENERABLE.some((re) => re.test(base))) return false;
  if (rel.startsWith('readonly/') && !includeReadonly) return false;
  return true;
});

if (!docs.length) {
  console.log('nada a indexar (nenhum doc não-regenerável encontrado).');
  process.exit(0);
}

for (const rel of docs) {
  const md = readFileSync(join(srcDir, rel), 'utf8');
  const title = firstHeading(md) ?? rel.replace(/\.md$/i, '');
  const type = classify(rel);
  const topic = `archive-docs/${slug(rel)}`;
  const body = buildBody(rel, md);
  if (dryRun) {
    console.log(`[dry-run] ${topic} (${type}) — "${title}"  ← ${ctx}/docs/${rel}`);
    continue;
  }
  execFileSync(
    engram,
    ['save', title, body, '--type', type, '--project', project, '--scope', scope, '--topic', topic],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  console.log(`✓ ${topic} (${type}) — "${title}"`);
}

console.log(`\nindex-engram: ${docs.length} doc(s) indexado(s) no projeto "${project}"${dryRun ? ' (dry-run)' : ''}.`);
