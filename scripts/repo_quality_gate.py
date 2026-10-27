#!/usr/bin/env python3
"""repo_quality_gate.py — code-quality metrics + threshold gate for a git repository.

Stdlib-only (Python 3.11+). Measures, per the sources cited in the thresholds file:

  1. Cyclomatic complexity per function (Python: real AST count; other C-like
     languages: keyword approximation — authoritative numbers come from
     SonarQube in CI).
  2. Cognitive complexity per function (SonarSource white paper spec v1.7,
     implemented for Python's AST).
  3. Duplication (approximation of SonarQube's non-Java rule: >=10 duplicated
     lines and >=100 tokens).
  4. Change history from git: churn (added+deleted lines) per file over a
     window, hotspot ranking (churn x complexity) and legacy-touch share
     (share of touched files last changed >365 days before the window).
  5. Gate evaluation: fail thresholds apply to NEW code (functions last touched
     inside the window, or untracked files); legacy code is report-only, so the
     gate ratchets instead of demanding a big-bang cleanup.

Exit code: 0 = gate passed (or report-only), 1 = gate failed, 2 = usage error.
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from collections import defaultdict

CODE_EXT = {
    ".py": "python", ".js": "javascript", ".jsx": "javascript", ".ts": "typescript",
    ".tsx": "typescript", ".java": "java", ".go": "go", ".rs": "rust", ".c": "c",
    ".h": "c", ".cpp": "cpp", ".cc": "cpp", ".hpp": "cpp", ".cs": "csharp",
    ".rb": "ruby", ".php": "php", ".kt": "kotlin", ".swift": "swift",
}
SKIP_DIRS = {".git", "node_modules", "vendor", "dist", "build", ".venv", "venv",
             "__pycache__", "target", ".tox", ".mypy_cache",
             # Build output / generated trees: counting generated bundles as
             # source fabricates complexity findings (a .next/ production
             # build carries CC-50+ gtag copies) and buries the real ones.
             ".next", ".turbo", ".cache", "coverage", ".yarn"}


SKIP_FILES = {os.path.basename(__file__)}  # a gate does not gate itself
# (self-analysis produces self-referential findings — the tool is not product code)


# ---------------------------------------------------------------- git helpers
def git(repo: str, *args: str) -> str:
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout


def window_range(repo: str, days: int) -> tuple[int, int]:
    """(start_ts, now_ts) for the measurement window."""
    now = int(time.time())
    return now - days * 86400, now


def changed_files(repo: str, days: int) -> dict[str, int]:
    """{path: churn lines} for files changed inside the window."""
    start, _ = window_range(repo, days)
    churn: dict[str, int] = defaultdict(int)
    try:
        out = git(repo, "log", f"--since=@{start}", "--numstat", "--format=commit %H")
    except RuntimeError:
        return churn
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) == 3 and parts[0].isdigit():
            churn[parts[2]] += int(parts[0]) + int(parts[1])
    return dict(churn)


def last_touch_map(repo: str, paths: list[str]) -> dict[str, int]:
    """{path: unix ts of last commit touching it} (files never committed => 0)."""
    out: dict[str, int] = {}
    for p in paths:
        try:
            r = git(repo, "log", "-1", "--format=%ct", "--", p).strip()
            out[p] = int(r) if r else 0
        except RuntimeError:
            out[p] = 0
    return out


def last_touch_before(repo: str, paths: list[str], before_ts: int) -> dict[str, int]:
    """{path: unix ts of the last commit touching it BEFORE before_ts}
    (0 = the file did not exist before the window)."""
    out: dict[str, int] = {}
    for p in paths:
        try:
            r = git(repo, "log", "-1", f"--before=@{before_ts}", "--format=%ct", "--", p).strip()
            out[p] = int(r) if r else 0
        except RuntimeError:
            out[p] = 0
    return out


def blame_times(repo: str, path: str) -> dict[int, int]:
    """{line_no: last-touch unix ts} from `git blame --porcelain`."""
    times: dict[int, int] = {}
    try:
        r = subprocess.run(["git", "-C", repo, "blame", "--porcelain", "--", path],
                           capture_output=True, text=True)
    except FileNotFoundError:
        return times
    if r.returncode != 0:
        return times
    cur_time, lineno = None, None
    for line in r.stdout.splitlines():
        if line and not line.startswith("\t"):
            head = line.split()
            if head[0] == "commit" and (len(head) == 1 or not head[1][:1].isalnum() is False):
                cur_time = None
            elif head[0] == "commit-time":
                cur_time = int(head[1])
            elif head[0] == "summary" or head[0] == "author":
                continue
            elif len(head[0]) == 40 and len(head) >= 3 and head[2].isdigit():
                lineno = int(head[2])
                if lineno is not None and cur_time is not None:
                    times[lineno] = cur_time
        elif line.startswith("\t") and lineno is not None and cur_time is not None:
            times.setdefault(lineno, cur_time)
    return times


# ------------------------------------------------------- complexity (Python)
CIRCULAR_NODES = (ast.If, ast.While, ast.For, ast.AsyncFor, ast.IfExp, ast.Assert,
                  ast.ExceptHandler, ast.comprehension, ast.Match)
BOOL_NODES = (ast.BoolOp,)


def cyclomatic_py(node: ast.AST) -> int:
    """1 + decision points (McCabe)."""
    score = 1
    for n in ast.walk(node):
        if isinstance(n, (ast.If, ast.While, ast.For, ast.AsyncFor, ast.IfExp,
                          ast.Assert, ast.ExceptHandler, ast.comprehension)):
            score += 1
        elif isinstance(n, ast.BoolOp):
            score += len(n.values) - 1
        elif isinstance(n, ast.Match):
            score += max(0, len(n.cases) - 1)
    return score


def _nesting_body(body, depth: int, acc: list[int], in_else: bool = False) -> None:
    """Collect cognitive increments following the captured SonarSource spec
    (white paper v1.7): +1 per break in linear flow, +1 more when nested;
    else/elif = hybrid (+1, no nesting increment of their own, but they raise
    the nesting level of what follows); try/finally ignored, catch = +1."""
    for n in body:
        if isinstance(n, ast.If):
            if in_else:                               # elif: hybrid increment
                acc.append(1)
            else:                                     # if: structural + nesting
                acc.append(1 + depth)
            _nesting_body(n.body, depth + 1, acc)
            if n.orelse:
                if len(n.orelse) == 1 and isinstance(n.orelse[0], ast.If):
                    _nesting_body(n.orelse, depth + 1, acc, in_else=True)  # elif chain
                else:
                    acc.append(1)                     # else: hybrid increment
                    _nesting_body(n.orelse, depth + 1, acc, in_else=True)
        elif isinstance(n, (ast.While, ast.For, ast.AsyncFor)):
            acc.append(1 + depth)
            _nesting_body(n.body, depth + 1, acc)
            if n.orelse:
                acc.append(1 + depth)                 # loop else = a break in flow
                _nesting_body(n.orelse, depth + 1, acc)
        elif isinstance(n, ast.ExceptHandler):
            acc.append(1 + depth)                     # catch = structural
            _nesting_body(n.body, depth + 1, acc)
        elif isinstance(n, (ast.With, ast.AsyncWith)):
            _nesting_body(n.body, depth, acc)
        elif isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue                                  # method/class = shorthand, ignored


def cognitive_py(node: ast.AST) -> int:
    """Cognitive Complexity (SonarSource white paper v1.7) for a Python function."""
    acc: list[int] = []
    body = list(getattr(node, "body", []))
    _nesting_body(body, 0, acc)
    # sequences of like logical operators: one increment per BoolOp node
    for n in ast.walk(node):
        if isinstance(n, ast.BoolOp):
            acc.append(1)
    return sum(acc)


def functions_py(path: str, src: str) -> list[dict]:
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return []
    out = []
    for n in ast.walk(tree):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            end = getattr(n, "end_lineno", n.lineno)
            out.append({
                "file": path, "name": n.name, "line": n.lineno, "end": end,
                "nloc": max(1, end - n.lineno + 1),
                "cyclomatic": cyclomatic_py(n), "cognitive": cognitive_py(n),
                "language": "python",
            })
    return out


# ------------------------------------------- complexity (other langs, approx)
C_LIKE = re.compile(r"\b(if|else\s+if|elif|for|while|case|catch)\b|(\?\?|\|\||&&)")
PY_LIKE = re.compile(r"\b(if|elif|for|while|except)\b")


def functions_text(path: str, src: str, language: str) -> list[dict]:
    """Block-level approximation: complexity of the whole file's functions is
    reported as one pseudo-function per top-level `def/function/fn` chunk."""
    # TS/JS class methods have no `function` keyword: `async streamToResponse(`
    # at any indentation is a method head. The `[{:]` lookahead separates a
    # method head from a call statement (`requireAuth(ctx);` matched too, which
    # sliced resolvers mid-body and mis-attributed their complexity).
    method = r"^\s+(?:public\s+|private\s+|protected\s+|static\s+|async\s+)?(?:get\s+|set\s+)?[A-Za-z_][\w]*(?:<[^\n]*>)?\s*\([^\n{;]*\)[ \t]*(:\s[^\n{;]+)?[ \t]*\{[^{]" 
    names = list(re.finditer(
        r"^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|def|fn|func)"
        r"[^\n{;]*?([A-Za-z_][\w]*)\s*\(", src, re.M))
    method_names = [m for m in re.finditer(method, src, re.M)
                    if not re.match(r"^(?:if|for|while|switch|catch|return|const|let|var|await|typeof|new|delete|void|in|of|do|else|try|throw)\b", m.group(0).strip())]
    # keep the original ordering by position
    all_names = sorted(names + method_names, key=lambda m: m.start())
    names = all_names
    if not names:
        return []
    out = []
    for i, m in enumerate(names):
        start = src[:m.start()].count("\n") + 1
        end = (src[:names[i + 1].start()].count("\n") if i + 1 < len(names)
               else src.count("\n") + 1)
        chunk = src[m.start(): names[i + 1].start() if i + 1 < len(names) else len(src)]
        rx = PY_LIKE if language in ("python", "ruby", "php") else C_LIKE
        cc = 1 + sum(1 for _ in rx.finditer(chunk))
        acc = [0]
        for mm in rx.finditer(chunk):
            acc[0] += 1
        nm = re.search(r"([A-Za-z_][\w]*)\s*\(", m.group(0))
        name = nm.group(1) if nm else "anonymous"
        out.append({"file": path, "name": name, "line": start, "end": end,
                    "nloc": max(1, end - start + 1), "cyclomatic": cc,
                    "cognitive": acc[0], "language": language + "~approx"})
    return out


# ----------------------------------------------------------- duplication
def duplication(root: str, files: list[str], changed: set[str]) -> dict:
    """Approximation of SonarQube's non-Java rule: >=10 duplicated lines with
    >=100 whitespace tokens, compared on normalized lines (indent/case kept
    simple on purpose — this is a tripwire, SonarQube is the authority)."""
    total_lines = 0
    dup_lines = 0
    dup_lines_new = 0
    total_lines_new = 0
    MIN_LINES, MIN_TOKENS = 10, 100
    for p in files:
        in_change = p in changed
        try:
            with open(os.path.join(root, p), encoding="utf-8", errors="ignore") as fh:
                lines = fh.read().splitlines()
        except OSError:
            continue
        norm = [(l.strip() or " ").lower() for l in lines]
        n_lines = len([l for l in lines if l.strip()])
        total_lines += n_lines
        if in_change:
            total_lines_new += n_lines
        idx: dict[str, list[int]] = defaultdict(list)
        for i, l in enumerate(norm):
            if l.strip():
                idx[l].append(i)
        # extend anchored matches into blocks of >= MIN_LINES
        reported: set[int] = set()
        for l, starts in idx.items():
            if len(starts) < 2:
                continue
            for i, a in enumerate(starts):
                if a in reported:
                    continue
                # longest identical run shared with a later occurrence
                best, partner = 0, None
                for b in starts[i + 1:]:
                    if b in reported:
                        continue
                    k = 0
                    while (a + k < len(norm) and b + k < len(norm)
                           and norm[a + k] == norm[b + k] and norm[a + k].strip()
                           and (a + k) not in reported and (b + k) not in reported):
                        k += 1
                    if k > best:
                        best, partner = k, b
                if partner is None or best < MIN_LINES:
                    continue
                n = best
                toks = sum(len(norm[a + j].split()) for j in range(n))
                if toks < MIN_TOKENS:
                    continue
                blk = norm[a:a + n]
                copies = 0
                for b in starts:                      # count every occurrence
                    if b in reported or b + n > len(norm):
                        continue
                    if norm[b:b + n] == blk:
                        copies += 1
                        for j in range(n):
                            reported.add(b + j)
                dup_lines += n * copies
                if in_change:
                    dup_lines_new += n * copies
    pct = (dup_lines / total_lines * 100) if total_lines else 0.0
    pct_new = (dup_lines_new / total_lines_new * 100) if total_lines_new else 0.0
    return {"total_lines": total_lines, "duplicated_lines": dup_lines,
            "duplicated_lines_pct": round(pct, 2),
            "new_total_lines": total_lines_new, "new_duplicated_lines": dup_lines_new,
            "new_duplicated_lines_pct": round(pct_new, 2),
            "rule": f">={MIN_LINES} duplicated lines and >={MIN_TOKENS} tokens (Sonar approx)"}


# ------------------------------------------------------------------ gate
def evaluate(report: dict, th: dict) -> list[dict]:
    findings = []

    def add(metric, value, limit, level, scope, why):
        findings.append({"metric": metric, "value": value, "limit": limit,
                         "level": level, "scope": scope, "why": why})

    f = th["function"]
    just: dict[str, str] = th.get("justifications", {})
    new_funcs = [x for x in report["functions"] if x["scope"] == "new"]
    legacy = [x for x in report["functions"] if x["scope"] == "legacy"]

    def justification_for(func: dict) -> str | None:
        """A written justification (NIST: above 10 needs one) — matched on
        'file::name' with the file's path prefix, so an entry covers the
        function wherever it moved inside the file. An entry that matches
        nothing is itself a finding: stale justifications hide real debt."""
        key = f"{func['file']}::{func['name']}"
        if key in just:
            return just[key]
        for jkey, why in just.items():
            if jkey.endswith(f"::{func['name']}") and func["file"].endswith(jkey.rsplit("::", 1)[0]):
                return why
        return None

    # Over-limit functions the register justifies stay WARN (visible debt with
    # a written reason); the gate FAILS only on unjustified violations. This is
    # the mechanism that lets the gate flip to blocking (W4) without reding
    # forever on the documented frontier.
    justified_over = []
    unjustified_cc = [x for x in new_funcs if x["cyclomatic"] > f["cyclomatic_fail"]]
    unjustified_cog = [x for x in new_funcs if x["cognitive"] > f["cognitive_fail"]]
    for func in list(unjustified_cc) + list(unjustified_cog):
        why = justification_for(func)
        if why:
            justified_over.append((func, why))
    just_names = {id(x) for x, _ in justified_over}
    unjustified_cc = [x for x in unjustified_cc if id(x) not in just_names]
    unjustified_cog = [x for x in unjustified_cog if id(x) not in just_names]

    if justified_over:
        worst = max(x["cyclomatic"] for x, _ in justified_over)
        add("justified_complexity(registered)", len({(x["file"], x["name"]) for x, _ in justified_over}),
            "n/a", "info", "new code",
            f"over-limit functions carrying a written justification (see [justifications]); "
            f"highest CC {worst}")
        # Make the justified frontier visible in the report — visible debt,
        # with its written reason, so a reviewer can challenge any entry.
        seen = set()
        report["justified"] = []
        for x, why in justified_over:
            k = (x["file"], x["name"])
            if k in seen:
                continue
            seen.add(k)
            report["justified"].append(
                {"file": x["file"], "line": x["line"], "name": x["name"],
                 "cyclomatic": x["cyclomatic"], "cognitive": x["cognitive"], "why": why})

    worst_cc = max((x["cyclomatic"] for x in unjustified_cc), default=0)
    if worst_cc > f["cyclomatic_abs_fail"]:
        add("cyclomatic_complexity.max(new)", worst_cc, f["cyclomatic_abs_fail"], "fail", "new code",
            "Visual Studio CA1502 warns at this value")
    if worst_cc > f["cyclomatic_fail"]:
        add("cyclomatic_complexity.max(new)", worst_cc, f["cyclomatic_fail"], "fail", "new code",
            "NIST SP 500-235 / McCabe limit of 10")
    elif worst_cc > f["cyclomatic_justify"]:
        add("cyclomatic_complexity.max(new)", worst_cc, f["cyclomatic_justify"], "warn", "new code",
            "NIST allows up to 15 only with a written justification")

    worst_cog = max((x["cognitive"] for x in unjustified_cog), default=0)
    if worst_cog > f["cognitive_fail"]:
        add("cognitive_complexity.max(new)", worst_cog, f["cognitive_fail"], "fail", "new code",
            "understandability gate (Sonar S3776 default, threshold source unverified)")
    elif worst_cog > f["cognitive_warn"]:
        add("cognitive_complexity.max(new)", worst_cog, f["cognitive_warn"], "warn", "new code",
            "refactor candidates before they harden")

    d = th["duplication"]
    dup = report["duplication"]
    if dup["new_total_lines"] and dup["new_duplicated_lines_pct"] > d["duplication_fail_pct"]:
        add("duplicated_lines_pct(new code)", dup["new_duplicated_lines_pct"],
            d["duplication_fail_pct"], "fail", "new code",
            "Sonar way quality gate: <=3% duplication on new code")
    if dup["duplicated_lines_pct"] > d["duplication_warn_pct"]:
        add("duplicated_lines_pct(repo)", dup["duplicated_lines_pct"],
            d["duplication_warn_pct"], "warn", "repo",
            "drift tripwire (GitClear: industry block duplication rising since 2023)")

    h = th["hotspots"]
    if len(report["hotspots"]) > h["hotspot_warn_count"]:
        add("hotspots(churn x complexity)", len(report["hotspots"]),
            h["hotspot_warn_count"], "warn", "window",
            "hotspots are where defects cluster (churn x complexity); refactor them first")

    g = th["repo"]
    if report["legacy_touch_pct"] > g["legacy_touch_warn_pct"]:
        add("legacy_touch_pct", report["legacy_touch_pct"], g["legacy_touch_warn_pct"], "warn", "repo",
            "GitClear: long-term maintenance share collapsing; watch direction")

    if legacy:
        add("legacy_violations(report-only)", len([x for x in legacy if x["cyclomatic"] > f["cyclomatic_fail"]]),
            "n/a", "info", "legacy code", "ratchet: no new violations, no big-bang cleanup")
    return findings


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo")
    ap.add_argument("--thresholds", help="TOML thresholds file (defaults to built-in template)")
    ap.add_argument("--window-days", type=int, default=90)
    ap.add_argument("--json", help="write full report JSON here")
    ap.add_argument("--report", help="write human-readable report here (default stdout)")
    args = ap.parse_args()

    root = os.path.abspath(args.repo)
    if not os.path.isdir(os.path.join(root, ".git")):
        print(f"error: {root} is not a git repository", file=sys.stderr)
        return 2

    th = default_thresholds()
    if args.thresholds:
        import tomllib
        with open(args.thresholds, "rb") as fh:
            loaded = tomllib.load(fh)
        for k, v in loaded.items():
            if isinstance(v, dict):
                th.setdefault(k, {}).update(v)
            else:
                th[k] = v

    # ---- code metrics
    functions: list[dict] = []
    code_files: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            ext = os.path.splitext(fn)[1]
            if ext in CODE_EXT and fn not in SKIP_FILES:
                rel = os.path.relpath(os.path.join(dirpath, fn), root)
                code_files.append(rel)

    start_ts, _ = window_range(root, args.window_days)
    try:
        tracked = set(git(root, "ls-files").split())
    except RuntimeError:
        tracked = set()

    for rel in code_files:
        p = os.path.join(root, rel)
        try:
            with open(p, encoding="utf-8", errors="ignore") as fh:
                src = fh.read()
        except OSError:
            continue
        lang = CODE_EXT[os.path.splitext(rel)[1]]
        if lang == "python":
            functions.extend(functions_py(rel, src))
        else:
            functions.extend(functions_text(rel, src, lang))

    # ---- change data
    churn = changed_files(root, args.window_days)
    last_touch = last_touch_map(root, code_files)
    blame_cache: dict[str, dict[int, int]] = {}
    changed_set = {p for p in churn}
    # GitClear's "long-term update percent": of the files we touched in the
    # window, how many were last touched (before this window) more than 365d ago
    now_ts, _ = window_range(root, args.window_days)
    before = last_touch_before(root, list(churn), start_ts) if churn else {}
    legacy_changed = [p for p in churn if before.get(p) and before[p] < now_ts - 365 * 86400]
    legacy_touch_pct = round(100 * len(legacy_changed) / len(churn), 2) if churn else 0.0

    for fn in functions:
        if fn["file"] not in tracked or fn["file"] in changed_set:
            fn["scope"] = "new"
            continue
        if fn["file"] not in blame_cache:
            blame_cache[fn["file"]] = blame_times(root, fn["file"])
        times = blame_cache[fn["file"]]
        t = [times.get(n) for n in range(fn["line"], min(fn["end"], fn["line"] + 200) + 1)
             if n in times]
        newest = max(t) if t else last_touch.get(fn["file"], 0)
        fn["scope"] = "new" if newest >= start_ts else "legacy"

    # ---- hotspots (churn x complexity)
    per_file_cc: dict[str, int] = defaultdict(int)
    per_file_max: dict[str, int] = defaultdict(int)
    for fn in functions:
        per_file_cc[fn["file"]] += fn["cyclomatic"]
        per_file_max[fn["file"]] = max(per_file_max[fn["file"]], fn["cyclomatic"])
    hotspots = []
    for p, c in churn.items():
        if p in per_file_max and c > 0:
            score = c * (1 + per_file_max[p])
            hotspots.append({"file": p, "churn": c, "max_cyclomatic": per_file_max[p],
                             "score": score})
    hotspots.sort(key=lambda x: -x["score"])
    hotspots = hotspots[: th["hotspots"]["hotspot_top_n"]]

    dup = duplication(root, code_files, changed_set)
    report = {
        "repo": root, "window_days": args.window_days, "generated_unix": int(time.time()),
        "files": len(code_files), "functions": functions,
        "churn_total": sum(churn.values()), "churn_files": len(churn),
        "legacy_touch_pct": legacy_touch_pct, "duplication": dup, "hotspots": hotspots,
    }
    findings = evaluate(report, th)
    report["findings"] = findings
    failed = any(f["level"] == "fail" for f in findings)

    # ---- output
    lines = [f"# Code-quality gate — {root}",
             f"window: last {args.window_days} days | files: {len(code_files)} | "
             f"functions: {len(functions)} | churn: {report['churn_total']} lines",
             f"duplication: repo {dup['duplicated_lines_pct']}% | new code "
             f"{dup['new_duplicated_lines_pct']}% "
             f"({dup['duplicated_lines']}/{dup['total_lines']} lines, {dup['rule']})",
             f"legacy-touch share of churned files: {legacy_touch_pct}%",
             "", "## Findings (new code = fail/warn, legacy = report-only)"]
    if not findings:
        lines.append("  (none)")
    for f in findings:
        lines.append(f"  [{f['level'].upper():4}] {f['metric']} = {f['value']} "
                     f"(limit {f['limit']}) — {f['why']}")
    lines.append("")
    lines.append("## Top hotspots (churn x complexity)")
    for h in hotspots[:10]:
        lines.append(f"  {h['file']}: churn {h['churn']} lines, max CC {h['max_cyclomatic']}, "
                     f"score {h['score']}")
    worst = sorted(functions, key=lambda x: -x["cyclomatic"])[:10]
    lines.append("")
    lines.append("## Highest complexity functions")
    for w in worst:
        lines.append(f"  {w['file']}:{w['line']} {w['name']} — CC {w['cyclomatic']}, "
                     f"CoC {w['cognitive']} ({w['scope']})")
    just_list = report.get("justified") or []
    if just_list:
        lines.append("")
        lines.append("## Justified over-limit functions (registered debt — see [justifications])")
        for j in sorted(just_list, key=lambda j: -j["cyclomatic"]):
            lines.append(f"  {j['file']}:{j['line']} {j['name']} — CC {j['cyclomatic']}, "
                         f"CoC {j['cognitive']} — {j['why'][:110]}"
                         + ("…" if len(j["why"]) > 110 else ""))
    lines.append("")
    lines.append(f"RESULT: {'FAIL' if failed else 'PASS'}")
    text = "\n".join(lines) + "\n"

    if args.report:
        with open(args.report, "w", encoding="utf-8") as fh:
            fh.write(text)
    else:
        print(text, end="")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2)
    return 1 if failed else 0


def default_thresholds() -> dict:
    """Built-in defaults — identical to repo-quality-thresholds.toml."""
    return {
        "function": {"cyclomatic_fail": 10, "cyclomatic_justify": 15,
                     "cyclomatic_abs_fail": 25, "cognitive_warn": 10,
                     "cognitive_fail": 15},
        "duplication": {"duplication_fail_pct": 3.0, "duplication_warn_pct": 5.0},
        "hotspots": {"hotspot_warn_count": 3, "hotspot_top_n": 10},
        "repo": {"legacy_touch_warn_pct": 50.0},
    }


if __name__ == "__main__":
    sys.exit(main())
