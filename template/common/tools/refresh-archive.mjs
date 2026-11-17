#!/usr/bin/env node
/**
 * refresh-archive.mjs — atualiza os artefatos do Engram no repositório do arquivo e commita.
 *
 * Atualiza `<ctx>/backup/engram/<project>/engram-export.json` (snapshot) e, com `--sync`,
 * os chunks incrementais em `<ctx>/backup/engram/<project>/.engram/`. Depois commita
 * (e envia com `--push`).
 *
 * Com `--all`, percorre todos os projetos existentes em `<ctx>/backup/engram/`, gera UM
 * commit e stageia apenas `<ctx>/backup` e `<ctx>/journal` (modo automático, sem trailer de IA).
 *
 * Uso:
 *   node refresh-archive.mjs --ctx <ctx> [--project <project> | --all] [--repo <archive>] \
 *        [--sync] [--no-engram] [--push] [--dry-run] [--message <msg>]
 *
 * Repo resolvido por: --repo > $ENGRAM_ARCHIVE > ~/Work/<ARCHIVE_NAME>.
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

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

const a = parseArgs(process.argv.slice(2));
const dryRun = a['dry-run'] === true;
const repo = resolve(
  typeof a.repo === 'string' ? a.repo : process.env.ENGRAM_ARCHIVE ?? join(homedir(), 'Work/<ARCHIVE_NAME>'),
);
if (!existsSync(join(repo, '.git'))) {
  console.error(`refresh-archive: ${repo} não é um repositório git (<ARCHIVE_NAME>).`);
  process.exit(1);
}

const ctx = typeof a.ctx === 'string' ? a.ctx : process.env.ENGRAM_CTX;
if (!ctx) {
  console.error('informe o contexto com --ctx <nome> (ou exporte ENGRAM_CTX).');
  process.exit(1);
}
const all = a.all === true;
const doEngram = a['no-engram'] !== true;
const doSync = a.sync === true;
const doPush = a.push === true;
const engram = engramBin(typeof a.engram === 'string' ? a.engram : undefined);

const backupDir = join(repo, ctx, 'backup/engram');
const projects = all
  ? existsSync(backupDir)
    ? readdirSync(backupDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : []
  : [typeof a.project === 'string' ? a.project : process.env.ENGRAM_PROJECT];

if (!all && !projects[0]) {
  console.error('informe o projeto com --project <nome> (ou exporte ENGRAM_PROJECT) — ou use --all.');
  process.exit(1);
}
if (!projects.length) {
  console.error(`refresh-archive: nenhum projeto em ${backupDir}.`);
  process.exit(1);
}

const message =
  typeof a.message === 'string'
    ? a.message
    : all
      ? `chore: backup diário — ${ctx}`
      : `chore: refresh memória Engram — ${projects[0]}`;

if (dryRun) {
  for (const p of projects) {
    console.log(`[dry-run] engram export → ${join(backupDir, p, 'engram-export.json')} (project=${p})`);
    if (doSync) console.log(`[dry-run] engram sync → ${join(backupDir, p, '.engram')} (project=${p})`);
  }
  console.log(`[dry-run] git add ${all ? `${ctx}/backup ${ctx}/journal` : '-A'} && commit${doPush ? ' && push' : ''} em ${repo}`);
  process.exit(0);
}

if (doEngram) {
  for (const project of projects) {
    const projDir = join(backupDir, project);
    mkdirSync(projDir, { recursive: true });
    try {
      execFileSync(engram, ['export', join(projDir, 'engram-export.json'), '--project', project], { stdio: 'inherit' });
    } catch {
      console.warn(`engram export falhou para ${project} (projeto sem memória?).`);
    }
    if (doSync) {
      try {
        execFileSync(engram, ['sync', '--project', project], { cwd: projDir, stdio: 'inherit' });
      } catch {
        console.warn(`engram sync falhou para ${project} (sem memórias novas?).`);
      }
    }
  }
}

const addPaths = all ? [`${ctx}/backup`, `${ctx}/journal`].filter((p) => existsSync(join(repo, p))) : ['-A'];
execFileSync('git', ['-C', repo, 'add', ...(all ? ['--', ...addPaths] : addPaths)], { stdio: 'inherit' });
const staged = execFileSync('git', ['-C', repo, 'diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim();
if (!staged) {
  console.log('nada a commitar.');
  process.exit(0);
}
const body = all ? message : `${message}\n\nCo-authored-by: DeepSeek V4 Flash <noreply@deepseek.com>`;
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
const today = new Date().toLocaleDateString('sv-SE');
let amend = false;
if (all) {
  const [subject, day] = git('log', '-1', '--format=%s%n%ad', '--date=short').split('\n');
  amend = subject === message && day === today;
}
if (amend) {
  execFileSync('git', ['-C', repo, 'commit', '--amend', '--no-edit'], { stdio: 'inherit' });
  if (doPush) execFileSync('git', ['-C', repo, 'push', '--force-with-lease'], { stdio: 'inherit' });
} else {
  execFileSync('git', ['-C', repo, 'commit', '-m', body], { stdio: 'inherit' });
  if (doPush) execFileSync('git', ['-C', repo, 'push'], { stdio: 'inherit' });
}
console.log(`ok: ${projects.join(', ')} atualizado(s)${doPush ? ' e enviado(s)' : ''} em ${repo}.`);
