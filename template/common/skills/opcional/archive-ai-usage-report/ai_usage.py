#!/usr/bin/env python3
"""ai_usage.py — uso de agentes de IA de código a partir dos registros locais.

Só leitura, sem rede e sem LLM. Saída: página HTML e JSON opcional.

    python3 ai_usage.py                                   # julho até hoje, imprime HTML
    python3 ai_usage.py --since 2026-07-01 --until 2026-11-18
    python3 ai_usage.py --months 3 --html uso.html --json uso.json
    python3 ai_usage.py --harness opencode
"""

from __future__ import annotations

import argparse
import datetime as dt
import glob
import html
import json
import os
import re
import sqlite3
import sys
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

HOME = Path.home()
CMD_RE = re.compile(r"<command-name>\s*(/[^\s<]+)\s*</command-name>")
BUILTIN = {"/compact", "/clear", "/model", "/mcp", "/help", "/login", "/logout",
           "/config", "/status", "/resume", "/init", "/review"}
MEMORY_MGRS = {"engram": "Engram", "mem_": "memória (prefixo mem_)",
               "codex_memory": "Codex memory", "claude_mem": "Claude memory"}
MEMORY_OPS = {"save", "search", "judge", "judge_many", "update", "session_summary",
              "context", "get_observation", "doctor", "session_start", "session_end",
              "current_project", "suggest_topic_key", "review", "pin", "unpin",
              "consolidate", "capture_passive", "session_finalize", "compare"}
MEMORY_FILES = {"AGENTS.md": "AGENTS.md/CLAUDE.md", "CLAUDE.md": "AGENTS.md/CLAUDE.md",
                ".engram/": "Engram (arquivos .engram/)", "memory.md": "memory.md"}
MCP_PREFIX = ("engram", "linear", "figma", "datadog", "claude_in_chrome")
SHELLISH = ("bash", "shell", "execute", "Bash")
WRAPPERS = ("cd ", "export ", "source ", ". ", "pushd ", "popd ", "set -", "alias ")
NOISE = {"echo", "pwd", "true", "printf", "for", "if", "while", "until", "do"}
SUBCMD = {"git", "gh", "pnpm", "npm", "npx", "go", "make", "docker", "kubectl",
          "python3", "python", "node", "bun", "uv"}


def memory_owner(tool: str) -> tuple[str, str] | None:
    """('engram', 'save') para engram_mem_save / mcp__engram__mem_save."""
    name = tool.split("__")[-1]
    for mgr in MEMORY_MGRS:
        if name.startswith(mgr + "_mem_"):
            op = name.split("mem_", 1)[1]
            return mgr, op
    if name.startswith("mem_"):
        rest = name[4:]
        if rest in MEMORY_OPS:
            return "engram", rest
    return None


def tool_family(cmd: str) -> str | None:
    """Família do comando de shell executado pelo MODELO."""
    cmd = re.sub(r"^\s*(nvm|pyenv|conda|env)\s+", "", cmd)
    for part in re.split(r"\s*(?:&&|\|\||;|\n|\|)\s*", cmd):
        part = part.strip()
        if not part or part.lower().startswith(WRAPPERS):
            continue
        words = part.split()
        if words[0] in NOISE:
            continue
        fam = words[0].split("/")[-1]
        if fam in SUBCMD and len(words) > 1 and not words[1].startswith("-"):
            return f"{fam} {words[1]}"
        return fam
    return None


def week_of(day: str) -> str:
    d = dt.date.fromisoformat(day)
    return (d - dt.timedelta(days=d.weekday())).isoformat()


class Usage:
    def __init__(self) -> None:
        self.sessions: set[tuple[str, str]] = set()
        self.day = Counter()
        self.month = Counter()
        self.harness = Counter()
        self.model = Counter()
        self.model_week: Counter = Counter()      # (model, semana) -> n
        self.model_day: dict[str, Counter] = defaultdict(Counter)   # model -> dia -> n
        self.skill = Counter()
        self.plugin = Counter()
        self.memory_mgr = Counter()               # (harness, mgr) -> n
        self.memory_op = Counter()                # (mgr, op) -> n
        self.mcp = Counter()
        self.model_cmd = Counter()
        self.user_cmd = Counter()
        self.lines: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])
        self.extra: dict[str, str] = {}
        self.notes: list[str] = []

    def session(self, h: str, sid: str) -> None:
        self.sessions.add((h, sid))

    def call(self, h: str, ts: str, tool: str, skill: str | None = None,
             model: str | None = None, cmd: str | None = None) -> None:
        d = ts[:10]
        self.day[d] += 1
        self.month[d[:7]] += 1
        self.harness[h] += 1
        if model:
            m = canonical_model(model)
            self.model[m] += 1
            self.model_week[(m, week_of(d))] += 1
            self.model_day[m][d] += 1
        if skill:
            self.skill[(h, skill or "sem nome")] += 1
            if ":" in skill:
                self.plugin[skill.split(":")[0]] += 1
        if tool in SHELLISH and cmd:
            fam = tool_family(cmd)
            if fam:
                self.model_cmd[(h, fam)] += 1
        # ferramenta de leitura de memória (read/grep em CLAUDE.md, AGENTS.md, .engram/)
        if tool in ("read", "Read", "grep", "Grep", "glob", "Glob"):
            for marker, mgr in MEMORY_FILES.items():
                if marker in str(cmd or ""):
                    self.memory_mgr[(h, mgr)] += 1
                    break
        owner = memory_owner(tool)
        if owner:
            mgr, op = owner
            self.memory_mgr[(h, mgr)] += 1
            self.memory_op[(mgr, op)] += 1
            return
        if tool.startswith("mcp__"):
            srv = tool.split("__")[1]
            self.mcp[(h, "mcp:uuid" if len(srv) > 24 else srv)] += 1
        else:
            for srv in MCP_PREFIX:
                if tool.startswith(srv + "_"):
                    self.mcp[(h, srv)] += 1
                    break

    def command(self, h: str, cmd: str, user: bool) -> None:
        c = cmd if cmd.startswith("/") else "/" + cmd
        if user:
            if c in BUILTIN:
                c += " (builtin)"
            self.user_cmd[(h, c)] += 1


def canonical_model(model: str) -> str:
    m = model.split("|")[0].split("#")[0]
    parts = m.split("-")
    return "-".join(parts[:-1]) if len(parts[-1]) == 8 and parts[-1].isdigit() else m


# --- adapters --------------------------------------------------------------

def scan_claude(u: Usage, since: str, until: str) -> None:
    files = glob.glob(str(HOME / ".claude/projects/**/*.jsonl"), recursive=True)
    if not files:
        u.notes.append("Claude Code: nenhum transcript encontrado")
        return
    seen: set[tuple] = set()
    for path in files:
        try:
            fh = open(path, encoding="utf-8", errors="ignore")
        except OSError as exc:
            u.notes.append(f"Claude Code: {path} ilegível ({exc})")
            continue
        with fh:
            for line in fh:
                try:
                    row = json.loads(line)
                except ValueError:
                    continue
                ts = (row.get("timestamp") or "")[:19]
                if len(ts) < 10 or not since <= ts[:10] <= until:
                    continue
                msg = row.get("message") or {}
                sid = row.get("sessionId") or path
                u.session("claude-code", sid)
                content = msg.get("content")
                if row.get("type") == "user":
                    texts = [content] if isinstance(content, str) else [
                        b.get("text", "") for b in content or []
                        if isinstance(b, dict) and b.get("type") == "text"]
                    for t in texts:
                        for c in CMD_RE.findall(t):
                            u.command("claude-code", c, True)
                if row.get("type") != "assistant" or not isinstance(content, list):
                    continue
                mid = msg.get("id")
                model = msg.get("model")
                if mid and ("m", sid, mid) in seen:
                    model = None
                elif mid:
                    seen.add(("m", sid, mid))
                for b in content:
                    if not (isinstance(b, dict) and b.get("type") == "tool_use"):
                        continue
                    key = (sid, b.get("id"))
                    if key in seen:
                        continue
                    seen.add(key)
                    inp = b.get("input") or {}
                    name = b.get("name") or "?"
                    skill = str(inp.get("skill") or inp.get("name") or "") if name == "Skill" else None
                    if name in ("Task", "Agent") and ":" in str(inp.get("subagent_type") or ""):
                        u.plugin[str(inp["subagent_type"]).split(":")[0]] += 1
                    u.call("claude-code", ts, name, skill, model,
                           str(inp.get("command") or inp.get("file_path") or inp.get("path") or ""))


def scan_opencode(u: Usage, since: str, until: str) -> None:
    db = HOME / ".local/share/opencode/opencode.db"
    if not db.exists():
        u.notes.append("OpenCode: opencode.db ausente")
        return
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    lo, hi = _ms(since), _ms(until, end=True)
    try:
        old = {r[0] for r in con.execute("select id from session")}
        new = {r[0] for r in con.execute("select id from session_v2 where time_created between ? and ?", (lo, hi))}
    except sqlite3.Error as exc:
        u.notes.append(f"OpenCode: schema inesperado ({exc})")
        return
    if old & new:
        u.notes.append(f"OpenCode: {len(old & new)} ids existem nas duas bases (mesma sessão migrada); "
                       f"usando só session_v2.")
    for sid in new:
        u.session("opencode", sid)
    for (raw,) in con.execute("select data from session_message where type='user' "
                              "and time_created between ? and ?", (lo, hi)):
        text = (json.loads(raw).get("text") or "") if raw else ""
        m = re.match(r"^\s*(/[A-Za-z][\w-]*(?::[\w-]+)?)(?:\s|$)", text)
        if m:
            u.command("opencode", m.group(1), True)
    for sid, created, raw in con.execute(
            "select session_id, time_created, data from session_message "
            "where type='assistant' and time_created between ? and ?", (lo, hi)):
        data = json.loads(raw)
        ts = dt.datetime.fromtimestamp(created / 1000).strftime("%Y-%m-%dT%H:%M:%S")
        model = (data.get("model") or {}).get("id")
        for b in data.get("content") or []:
            if isinstance(b, dict) and b.get("type") == "tool":
                inp = (b.get("state") or {}).get("input") or {}
                name = b.get("name") or "?"
                skill = (inp.get("name") or "").strip() if name == "skill" else None
                if name == "task" and ":" in str(inp.get("subagent_type") or ""):
                    u.plugin[str(inp["subagent_type"]).split(":")[0]] += 1
                u.call("opencode", ts, name, skill, model,
                       str(inp.get("command") or inp.get("cmd") or inp.get("filePath") or inp.get("path") or ""))


def scan_cursor(u: Usage, since: str, until: str) -> None:
    db = HOME / ".cursor/ai-tracking/ai-code-tracking.db"
    if not db.exists():
        return
    try:
        rows = con_rows(db)
    except sqlite3.Error as exc:
        u.notes.append(f"Cursor: {exc}")
        return
    for scored, comp, tab, human in rows:
        d = dt.datetime.fromtimestamp((scored or 0) / 1000).strftime("%Y-%m-%d")
        if since <= d <= until:
            v = u.lines[d[:7]]
            v[0] += comp or 0
            v[1] += tab or 0
            v[2] += human or 0


def scan_declared(u: Usage, path: str, since: str, until: str) -> None:
    """Harnesses do harnesses.json: {name,type,path,table|glob,ts,tool,model,session}."""
    cfg = Path(path).expanduser()
    if not cfg.exists():
        return
    try:
        specs = json.loads(cfg.read_text()).get("harnesses", [])
    except (OSError, ValueError) as exc:
        u.notes.append(f"harnesses.json inválido ({exc})")
        return
    for spec in specs:
        name = spec.get("name", "?")
        target = Path(str(spec.get("path", "")).replace("$HOME", str(HOME))).expanduser()
        if spec.get("type", "none") == "none" or not target.exists():
            u.extra[name] = spec.get("note") or f"sem registro em {target}"
            continue
        try:
            if spec["type"] == "sqlite":
                cols = [c for c in ("ts", "tool", "model", "session") if spec.get(c)]
                sql = f"select {', '.join(spec[c] for c in cols)} from {spec['table']}"
                for row in sqlite3.connect(f"file:{target}?mode=ro", uri=True).execute(sql):
                    rec = dict(zip(cols, row))
                    ts = str(rec.get("ts") or "")[:19]
                    if since <= ts[:10] <= until:
                        u.session(name, str(rec.get("session") or ts))
                        u.call(name, ts, str(rec.get("tool") or "?"), None, rec.get("model"))
            else:
                for f in glob.glob(str(target)):
                    for line in open(f, encoding="utf-8", errors="ignore"):
                        rec = json.loads(line)
                        ts = str(rec.get(spec.get("ts", "ts")) or "")[:19]
                        if since <= ts[:10] <= until:
                            u.session(name, str(rec.get(spec.get("session", "id")) or ts))
                            u.call(name, ts, str(rec.get(spec.get("tool", "tool")) or "?"),
                                   None, rec.get(spec.get("model")))
            u.extra.setdefault(name, "medido")
        except (sqlite3.Error, OSError, ValueError, KeyError) as exc:
            u.extra[name] = f"erro: {exc}"


def con_rows(db: Path):
    return sqlite3.connect(f"file:{db}?mode=ro", uri=True).execute(
        "select scoredAt, composerLinesAdded, tabLinesAdded, humanLinesAdded from scored_commits")


def _ms(date: str, end: bool = False) -> int:
    d = dt.datetime.strptime(date + (" 23:59:59" if end else " 00:00:00"), "%Y-%m-%d %H:%M:%S")
    return int(d.timestamp() * 1000)


# --- relatório -------------------------------------------------------------

def build(u: Usage, since: str, until: str) -> dict:
    # semana sem uso não entra: a série parte da primeira à última semana ATIVA do modelo
    # eixo comum: só o intervalo em que os top modelos existem, para comparar lado a lado
    top = [m for m, _ in u.model.most_common(5)]
    series, weeks = {}, []
    for m in top:
        days = sorted(u.model_day[m])
        if not days:
            continue
        span = sorted({week_of(d) for d in days})
        weeks = sorted(set(weeks) | set(span))
        series[m] = span
    if series:
        all_weeks = sorted(set(weeks))
        series = {m: [u.model_week.get((m, w), 0) for w in all_weeks] for m in series}
        weeks = all_weeks
    return {
        "window": {"since": since, "until": until},
        "totals": {"calls": sum(u.harness.values()), "sessions": len(u.sessions),
                   "harnesses": dict(u.harness)},
        "month": dict(sorted(u.month.items())),
        "days": u.day.most_common(8),
        "models": [{"model": m, "calls": n} for m, n in u.model.most_common(12)],
        "model_weeks": {"weeks": weeks, "series": series},
        "skills": [{"harness": h, "skill": s, "calls": n} for (h, s), n in u.skill.most_common(12)],
        "plugins": dict(u.plugin.most_common(8)),
        "memory_managers": [{"manager": MEMORY_MGRS.get(m, m), "harness": h, "calls": n}
                            for (h, m), n in u.memory_mgr.most_common()],
        "memory_ops": [{"manager": MEMORY_MGRS.get(m, m), "op": o, "calls": n}
                       for (m, o), n in u.memory_op.most_common(12)],
        "mcp": [{"harness": h, "server": s, "calls": n} for (h, s), n in u.mcp.most_common(12)],
        "model_commands": [{"harness": h, "command": c, "calls": n}
                           for (h, c), n in u.model_cmd.most_common(15)],
        "user_commands": [{"harness": h, "command": c, "calls": n}
                          for (h, c), n in u.user_cmd.most_common(12)],
        "cursor_lines": {m: v for m, v in sorted(u.lines.items())},
        "extra_harnesses": u.extra,
        "notes": u.notes,
    }


def bars(pairs, width=520) -> str:
    if not pairs:
        return '<p class="empty">sem dados</p>'
    top = max(v for _, v in pairs) or 1
    return "".join(
        f'<div class="row"><span class="lbl">{html.escape(str(label))}</span>'
        f'<span class="bar" style="width:{int(width * value / top)}px"></span>'
        f'<span class="val">{value:,}</span></div>' for label, value in pairs)


def sparkline(series: dict[str, list[int]], weeks: list[str]) -> str:
    if not weeks:
        return '<p class="empty">sem dados semanais</p>'
    peak = max((max(v) for v in series.values() if v), default=1) or 1
    rows = []
    for name, values in series.items():
        pts = " ".join(
            f"{10 + i * (640 / max(1, len(values) - 1)):.1f},{80 - 70 * v / peak:.1f}"
            for i, v in enumerate(values))
        rows.append(
            f'<div class="spark"><svg viewBox="0 0 660 90" preserveAspectRatio="none">'
            f'<polyline points="{pts}" fill="none" stroke="#4a7cde" stroke-width="2.5"/></svg>'
            f'<div class="spark-lbl">{html.escape(name)} '
            f'<span class="val">pico {max(values):,}/semana</span></div></div>')
    axis = "".join(f'<span>{w[5:]}</span>' for w in weeks[::max(1, len(weeks) // 8)])
    return "".join(rows) + f'<div class="axis">{axis}</div>'


def default_out(override: str | None) -> Path:
    """Destino do HTML.

    Ordem: --html/--out-dir > $AI_USAGE_OUT > `.ai-usage/` no cwd > tempdir.

    O default deixa o arquivo DENTRO do diretório da sessão (cwd): o harness só
    abre/previewa caminhos das pastas da sessão, e o tempdir fica fora delas.
    A pasta `.ai-usage/` é ignorada pelo git.
    """
    name = f"uso-ia-{dt.date.today().isoformat()}.html"
    if override:
        base = Path(override).expanduser()
        if base.is_dir():
            return base / name
        base.parent.mkdir(parents=True, exist_ok=True)
        return base
    env = os.environ.get("AI_USAGE_OUT")
    if env:
        base = Path(env).expanduser()
        base.mkdir(parents=True, exist_ok=True)
        return base / name
    if os.access(Path.cwd(), os.W_OK):
        base = Path.cwd() / ".ai-usage"
        base.mkdir(exist_ok=True)
        return base / name
    base = Path(tempfile.gettempdir()) / "ai-usage-report"
    base.mkdir(parents=True, exist_ok=True)
    return base / name


def render_html(r: dict) -> str:
    t = r["totals"]
    mem = r["memory_managers"]
    mem_names = sorted({m["manager"] for m in mem})
    cur = r["cursor_lines"]
    cur_txt = " · ".join(f"{m}: {v[0]:,} agente / {v[1]:,} tab / {v[2]:,} humano"
                         for m, v in cur.items()) or "sem dados"
    return f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Uso de IA — {r['window']['since']} a {r['window']['until']}</title>
<style>
:root {{ color-scheme: light dark; }}
body {{ font: 15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        margin:0 auto; max-width:1000px; padding:32px 24px; }}
h1 {{ font-size:22px; margin:0 0 4px; }} .sub {{ color:#666; margin-bottom:24px; }}
h2 {{ font-size:14px; text-transform:uppercase; letter-spacing:.06em; color:#666;
      margin:32px 0 10px; border-bottom:1px solid #ddd; padding-bottom:6px; }}
.kpis {{ display:flex; gap:24px; flex-wrap:wrap; }}
.kpi b {{ display:block; font-size:26px; }}
.row {{ display:flex; align-items:center; gap:10px; margin:3px 0; }}
.lbl {{ width:260px; text-align:right; color:#444; font-size:13px;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }}
.bar {{ height:14px; background:#4a7cde; border-radius:3px; }}
.val {{ font-variant-numeric:tabular-nums; color:#666; font-size:13px; }}
table {{ border-collapse:collapse; width:100%; font-size:14px; }}
td,th {{ text-align:left; padding:6px 8px; border-bottom:1px solid #eee; }}
td:last-child,th:last-child {{ text-align:right; font-variant-numeric:tabular-nums; }}
.spark svg {{ width:100%; height:70px; display:block; }}
.spark-lbl {{ font-size:13px; color:#444; }}
.axis {{ display:flex; justify-content:space-between; color:#999; font-size:11px; margin-top:6px; }}
.empty {{ color:#999; font-size:13px; }} ul {{ padding-left:20px; }}
.foot {{ margin-top:36px; color:#888; font-size:12px; }}
</style></head><body>
<h1>Uso de IA — {r['window']['since']} a {r['window']['until']}</h1>
<div class="sub">Registros locais da máquina · sem telemetria externa</div>
<div class="kpis">
  <div class="kpi"><b>{t['calls']:,}</b>chamadas de ferramenta</div>
  <div class="kpi"><b>{t['sessions']:,}</b>sessões</div>
  <div class="kpi"><b>{len(t['harnesses'])}</b>harnesses</div>
</div>
<h2>Harnesses</h2>{bars(sorted(t['harnesses'].items(), key=lambda x: -x[1]))}
<h2>Chamadas por mês</h2>{bars(list(r['month'].items()))}
<h2>Dias de pico</h2>{bars([(d[5:], n) for d, n in r['days']])}
<h2>Skills mais usadas</h2>{bars([(s['skill'] + ' · ' + s['harness'], s['calls']) for s in r['skills']])}
<h2>Comandos executados pelo modelo</h2>{bars([(c['command'], c['calls']) for c in r['model_commands']])}
<h2>Comandos digitados pelo usuário</h2>{bars([(c['command'], c['calls']) for c in r['user_commands']])}
<h2>Top 5 modelos — uso por semana</h2>{sparkline(r['model_weeks']['series'], r['model_weeks']['weeks'])}
<h2>Modelos</h2>
<table><tr><th>Modelo</th><th>Chamadas</th></tr>
{''.join(f"<tr><td>{html.escape(m['model'])}</td><td>{m['calls']:,}</td></tr>" for m in r['models'])}
</table>
<h2>Gerenciador de memória</h2>
<p>Detectados: <b>{html.escape(', '.join(mem_names)) or 'nenhum'}</b></p>
<table><tr><th>Gerenciador</th><th>Harness</th><th>Chamadas</th></tr>
{''.join(f"<tr><td>{html.escape(m['manager'])}</td><td>{html.escape(m['harness'])}</td><td>{m['calls']:,}</td></tr>" for m in mem)}
</table>
{''.join(f"<div class='row'><span class='lbl'>{html.escape(o['op'])}</span>"
         f"<span class='val'>{o['calls']:,}</span></div>" for o in r['memory_ops']) or ''}
<h2>Servidores MCP</h2>{bars([(m['server'] + ' · ' + m['harness'], m['calls']) for m in r['mcp']])}
<h2>Notas e limitações</h2>
<ul>{''.join(f"<li>{html.escape(n)}</li>" for n in r['notes'])}
{''.join(f"<li>{html.escape(k)}: {html.escape(str(v))}</li>" for k, v in r['extra_harnesses'].items())}
<li>Cursor (linhas, não chamadas): {html.escape(cur_txt)}</li></ul>
<div class="foot">ai_usage.py · {dt.datetime.now().strftime('%Y-%m-%d %H:%M')}</div>
</body></html>"""


def main() -> int:
    ap = argparse.ArgumentParser(description="Uso de agentes de IA a partir dos registros locais.")
    ap.add_argument("--out-dir", help="diretório do HTML quando --html não é dado")
    ap.add_argument("--since")
    ap.add_argument("--until")
    ap.add_argument("--months", type=int)
    ap.add_argument("--harness", choices=["claude-code", "opencode", "cursor"])
    ap.add_argument("--harnesses", default=str(Path(__file__).with_name("harnesses.json")))
    ap.add_argument("--html")
    ap.add_argument("--json")
    a = ap.parse_args()

    today = dt.date.today()
    until = a.until or today.isoformat()
    since = a.since
    if not since and a.months:
        first = today.replace(day=1)
        for _ in range(a.months - 1):
            first = (first - dt.timedelta(days=1)).replace(day=1)
        since = first.isoformat()
    since = since or "2026-07-01"

    u = Usage()
    if a.harness in (None, "claude-code"):
        scan_claude(u, since, until)
    if a.harness in (None, "opencode"):
        scan_opencode(u, since, until)
    if a.harness in (None, "cursor"):
        scan_cursor(u, since, until)
    if not a.harness:
        scan_declared(u, a.harnesses, since, until)

    report = build(u, since, until)
    out = default_out(a.html or a.out_dir)
    out.write_text(render_html(report), encoding="utf-8")
    if a.json:
        Path(a.json).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    # caminho na última linha: é o que se lê no chat para abrir/previewar
    print(f"html: {out}" + (f" · json: {a.json}" if a.json else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
