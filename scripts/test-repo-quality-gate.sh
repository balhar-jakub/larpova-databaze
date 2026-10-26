#!/usr/bin/env bash
# W1 acceptance test (SPEC): proves the gate fails NEW violations and passes
# identical LEGACY code. Two throwaway repos in a temp dir:
#   qg-new: bad function + duplicated block committed NOW      -> exit 1
#   qg-old: identical files committed 200+ days ago            -> exit 0
# Any other outcome is a bug in the gate (or in this test), not a pass.
set -u
GATE="$(cd "$(dirname "$0")/.." && pwd)/scripts/repo_quality_gate.py"
THRESHOLDS="$(cd "$(dirname "$0")/.." && pwd)/scripts/repo-quality-thresholds.toml"

TMP="$(mktemp -d /tmp/qg-fixture.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

BAD_FN="$(cat <<'PY'
def deeply_nested_rules(a, b, c):
    # CC = 12 (11 branches + 1) -> over the NIST limit 10
    if a > 0:
        if b > 0:
            if c > 0:
                if a + b > 10:
                    if b + c > 10:
                        if a + c > 10:
                            if a - b > 0:
                                if b - c > 0:
                                    if c - a > 0:
                                        if a * b > 100:
                                            if b * c > 100:
                                                return 1
    return 0
PY
)"
DUP_A="$(python3 - <<'PY'
# 12 near-identical lines duplicated in a second file (Sonar approx rule:
# >=10 duplicated lines and >=100 tokens) -> new-code duplication > 3%.
lines = []
for i in range(14):
    lines.append(f"def shared_helper_number_{i}(alpha_value, beta_value, gamma_value, delta_value):")
    lines.append(f"    total_value = alpha_value + beta_value * gamma_value - delta_value")
    lines.append(f"    if total_value > 100 and alpha_value < 50 and beta_value < 60:")
    lines.append(f"        return total_value * 2 - 3 + alpha_value")
    lines.append(f"    return total_value")
print("\n".join(lines))
PY
)"

make_fixture() {  # $1 = dir
  mkdir -p "$1/src"
  printf '%s\n' "$BAD_FN" > "$1/src/bad.py"
  printf '%s\n' "$DUP_A" > "$1/src/dup_a.py"
  printf '%s\n' "$DUP_A" | sed 's/def /def x_/' > "$1/src/dup_b.py"
  git -C "$1" init -q
  git -C "$1" -c user.name=fixture -c user.email=f@x commit -q --allow-empty -m init
  git -C "$1" add -A
  git -C "$1" -c user.name=fixture -c user.email=f@x commit -q -m fixture
}

# --- NEW code: committed now -> gate must FAIL (exit 1)
NEW="$TMP/qg-new"; make_fixture "$NEW"
python3 "$GATE" "$NEW" --thresholds "$THRESHOLDS" --window-days 90 \
  --json "$TMP/new.json" --report "$TMP/new.md"
NEW_RC=$?
echo "qg-new exit=$NEW_RC (expected 1)"
[ "$NEW_RC" -eq 1 ] || { echo "FAIL: new-code fixture must exit 1"; exit 1; }

grep -q '"findings"' "$TMP/new.json" || { echo "FAIL: JSON has no findings key"; exit 1; }
python3 - "$TMP/new.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
for k in ("functions", "findings", "duplication", "hotspots", "legacy_touch_pct"):
    assert k in d, f"JSON missing key: {k}"
fails = [f for f in d["findings"] if f["level"] == "fail"]
assert fails, "fixture produced no FAIL findings"
print("new.json: fail findings:", len(fails), "| schema keys OK")
PY

# --- LEGACY code: identical files, committed 200+ days ago -> gate must PASS (exit 0)
OLD="$TMP/qg-old"; make_fixture "$OLD"
OLD_TS=$(( $(date +%s) - 210*86400 ))
GIT_DIR="$OLD/.git" git -C "$OLD" \
  -c user.name=fixture -c user.email=f@x \
  commit -q --amend --no-edit --date="@$OLD_TS" --reset-author=no 2>/dev/null \
  || true
# amend only moves the top commit; rewrite BOTH commits' timestamps:
for ref in $(git -C "$OLD" rev-list --all); do :; done
git -C "$OLD" filter-branch -f --env-filter "
  export GIT_AUTHOR_DATE='$OLD_TS +0000'
  export GIT_COMMITTER_DATE='$OLD_TS +0000'
" -- --all >/dev/null 2>&1
python3 "$GATE" "$OLD" --thresholds "$THRESHOLDS" --window-days 90 \
  --json "$TMP/old.json" --report "$TMP/old.md"
OLD_RC=$?
echo "qg-old exit=$OLD_RC (expected 0)"
[ "$OLD_RC" -eq 0 ] || { echo "FAIL: legacy fixture must exit 0"; exit 1; }

echo
echo "W1 ACCEPTANCE: PASS (new=1, old=0, JSON schema OK)"
