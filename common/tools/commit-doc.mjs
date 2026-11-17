#!/usr/bin/env node
/**
 * commit-doc.mjs — salva um doc operacional no repositório do arquivo e commita lá.
 *
 * Os docs não ficam mais no work repo nem num branch separado: agora vão para
 * o arquivo (branch `main`), em `<ctx>/docs/` (default: $ENGRAM_CTX).
 *
 * Uso:
 *   node commit-doc.mjs <arquivo> [<arquivo>...] --ctx <ctx> [--to <rel-no-archive>] \
 *        [--repo <path>] [--message <msg>] [--push]
 *
 * <arquivo> é copiado para <repo>/<ctx>/docs/<to|basename>. Sem --to, usa o basename.
 * Quando --to aponta para um diretório (termina em `/`), mantém o basename de cada arquivo.
 * Repo resolvido por: --repo > $ENGRAM_ARCHIVE > ~/Work/<ARCHIVE_NAME>.
 * A autoria de IA entra como trailer `Co-authored-by`.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { homedir } from 'node:os';

function parseArgs(argv) {
  const out = { files: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (!k?.startsWith('--')) { out.files.push(k); continue; }
    const next = argv[i + 1];
    const key = k.slice(2);
    const val = next === undefined || next.startsWith('--') ? true : next;
    if (val !== true) i += 1;
    out[key] = val;
  }
  return out;
}

const a = parseArgs(process.argv.slice(2));
if (!a.files.length) {
  console.error('uso: commit-doc.mjs <arquivo>... --ctx <ctx> [--to <rel-no-archive>] [--repo <path>] [--message <msg>] [--push]');
  process.exit(1);
}

const repo = resolve(
  typeof a.repo === 'string' ? a.repo : process.env.ENGRAM_ARCHIVE ?? join(homedir(), 'Work/<ARCHIVE_NAME>'),
);
if (!existsSync(join(repo, '.git'))) {
  console.error(`commit-doc: ${repo} não é um repositório git (<ARCHIVE_NAME>).`);
  process.exit(1);
}

const ctx = typeof a.ctx === 'string' ? a.ctx : process.env.ENGRAM_CTX;
if (!ctx) {
  console.error('informe o contexto com --ctx <nome> (ou exporte ENGRAM_CTX).');
  process.exit(1);
}
const docsDir = join(repo, ctx, 'docs');
const toIsDir = typeof a.to === 'string' && a.to.endsWith('/');
const toBase = typeof a.to === 'string' ? a.to.replace(/^\/+/, '') : undefined;

let copied = 0;
for (const src of a.files) {
  const abs = resolve(src);
  if (!existsSync(abs)) { console.error(`aviso: ${abs} não existe (pulado)`); continue; }
  if (abs === repo || abs.startsWith(repo + sep)) {
    console.log(`= ${relative(repo, abs)} (já no repo, commit in place)`);
    copied += 1;
    continue;
  }
  const rel = toBase === undefined ? basename(abs) : toIsDir ? join(toBase, basename(abs)) : toBase;
  const dest = join(docsDir, rel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(abs, dest);
  console.log(`+ ${ctx}/docs/${rel}`);
  copied += 1;
}
if (!copied) { console.error('commit-doc: nenhum arquivo copiado.'); process.exit(1); }

const message = a.message ?? 'docs: atualiza docs operacionais';
const coAuthor = a['co-author'] ?? 'DeepSeek V4 Flash <noreply@deepseek.com>';
const body = `${message}\n\nCo-authored-by: ${coAuthor}`;

execFileSync('git', ['-C', repo, 'add', '-A'], { stdio: 'inherit' });
const staged = execFileSync('git', ['-C', repo, 'diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim();
if (!staged) { console.log('nada a commitar.'); process.exit(0); }
execFileSync('git', ['-C', repo, 'commit', '-m', body], { stdio: 'inherit' });
if (a.push === true) execFileSync('git', ['-C', repo, 'push'], { stdio: 'inherit' });
console.log(`ok: ${copied} arquivo(s) → ${repo}${a.push === true ? ' (push)' : ''}.`);
