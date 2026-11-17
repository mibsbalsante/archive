#!/usr/bin/env node
/**
 * next-task.mjs — orquestra o `archive-project-next-task` num único comando:
 *   fetch-linear (GraphQL enxuto) ∥ collect-prs (2 buscas gh) → refresh-status → commit
 *
 * Nada de payload grande entra no contexto do agente: os insumos vão para
 * `<CTX>/tools/.tmp/` e o script imprime SOMENTE a tabela final.
 *
 * Uso:
 *   node next-task.mjs [<handle>] [--doc <md>] [--no-commit] [--dry-run] [--keep-tmp] [--list]
 *
 * <handle> resolve em `<CTX>/tools/projects.json` (ex.: projeto-a, projeto-b);
 * sem <handle>, usa o `default` do dicionário. `--list` imprime os handles.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (!k?.startsWith('--')) { out._.push(k); continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[k.slice(2)] = true;
    else {
      out[k.slice(2)] = next;
      i += 1;
    }
  }
  return out;
}

async function run(cmd, args) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    return { stdout, stderr };
  } catch (err) {
    const detail = String(err.stderr ?? err.message).trim();
    throw new Error(`${cmd} ${args.join(' ')} falhou: ${detail}`);
  }
}

const a = parseArgs(process.argv.slice(2));
const scripts = resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = resolve(scripts, '../..');
const ctx = basename(resolve(scripts, '..'));
const dict = JSON.parse(readFileSync(join(scripts, 'projects.json'), 'utf8'));

if (a.list === true) {
  for (const [handle, p] of Object.entries(dict.projects)) {
    process.stdout.write(`${handle}${handle === dict.default ? ' (default)' : ''}\t${p.doc}\n`);
  }
  process.exit(0);
}

const handle = a._[0] ?? dict.default;
const entry = dict.projects[handle];
if (!entry) {
  console.error(`next-task: handle desconhecido "${handle}" — disponíveis: ${Object.keys(dict.projects).join(', ')}`);
  process.exit(1);
}
const doc = a.doc
  ? (isAbsolute(a.doc) ? a.doc : join(root, a.doc))
  : join(root, entry.doc);
if (!existsSync(doc)) {
  console.error(`next-task: doc não encontrado (${doc}) — rode o archive-project-init primeiro`);
  process.exit(1);
}

const chave = basename(doc).replace(/-tasks\.md$/, '');
const tmp = join(scripts, '.tmp');
mkdirSync(tmp, { recursive: true });
const linear = join(tmp, `${chave}.linear.json`);
const prs = join(tmp, `${chave}.prs.json`);

await Promise.all([
  run('node', [join(scripts, 'fetch-linear.mjs'), '--doc', doc, '--out', linear]),
  run('node', [join(scripts, 'collect-prs.mjs'), '--doc', doc, '--out', prs]),
]);

const refreshArgs = [join(scripts, 'refresh-status.mjs'), '--doc', doc, '--linear', linear, '--prs', prs];
if (a['dry-run']) refreshArgs.push('--dry-run');
const { stdout: table } = await run('node', refreshArgs);

if (!a['no-commit'] && !a['dry-run']) {
  const project = /^#\s+(.+?)\s+—\s+Tasks/.exec(readFileSync(doc, 'utf8'))?.[1] ?? entry.nome ?? chave;
  const args = [join(root, 'common/tools/commit-doc.mjs'), doc, '--message', `docs: refresh de status do projeto ${project}`];
  await run('node', args);
}

if (!a['keep-tmp']) rmSync(tmp, { recursive: true, force: true });

process.stdout.write(table);
