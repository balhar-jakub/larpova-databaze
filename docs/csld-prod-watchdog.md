# CSLD production watchdog (systemd --user unit)

The production app on the box (`balda@193.150.13.68`,
`/home/balda/larpova-databaze/csld-new`, port **8380**) is supervised by the
`csld-production` systemd --user unit with `Restart=always`. An observational
watchdog that watches the port and appends to a log used to run as the
`csld-prod-watchdog.timer`/`.service` pair, but those unit files were lost and
the last log line was written 2026-09-20 — the watchdog died with the
2026-09-20 reboot and nobody noticed for 42 days.

It now runs as a long-running user unit:

- Unit: `~/.config/systemd/user/csld-prod-watchdog.service` (enabled,
  `WantedBy=default.target`, `Restart=always`, `RestartSec=10`,
  `StartLimitIntervalSec=0` in `[Unit]` — in `[Service]` systemd silently
  ignores it).
- Script: `~/.local/bin/csld-prod-watchdog.sh` — a read-only loop, every 60 s
  checks that the production port (read from `csld-new/.env`, currently 8380)
  is listening, sums the RSS of the listener pid tree, and appends one line to
  `~/logs/csld-prod-watchdog.log`. A DOWN period is debounced 240 s before it
  is reported as `ALERT` (a deploy restart is not an outage). It never
  restarts or kills anything — recovery of the app itself stays with
  `csld-production.service`'s `Restart=always`.
- State: `~/.local/state/csld-watchdog/down-since` exists only while DOWN is
  being debounced/alerted.

## How to check

```sh
ssh balda@193.150.13.68 'systemctl --user status csld-prod-watchdog.service'
ssh balda@193.150.13.68 'tail -20 ~/logs/csld-prod-watchdog.log'
ssh balda@193.150.13.68 'journalctl --user -u csld-prod-watchdog -n 20 --no-pager'
```

A healthy log grows one `ok: port 8380 listening, rss=…MB, pids=[…]` line per
minute; `ALERT:` lines mean the port was down longer than the 240 s debounce.

## The gap this closes

Before: the watchdog was a timer-driven one-shot whose unit files disappeared
(no trace in `~/.config/systemd/user`), so after the 2026-09-20 17:07 reboot
`~/logs/csld-prod-watchdog.log` stopped growing and no alerting existed at
all. Now the watchdog is itself under `Restart=always`, survives reboots via
`default.target.wants`, and its staleness is detectable with the same
`systemctl --user status` / `tail` commands used for the app units.

## 502 clusters vs deploy restarts (audit 2026-11-01, window 18 Oct – 1 Nov)

All three 502 clusters in the nginx access log have matching
`csld-production` restarts in the user journal — no unexplained outage:

- 20 Oct: 6 restarts (09:03, 11:58, 12:51, 13:58, 14:08, 14:17)
- 21 Oct: 4 restarts (08:53, 10:20, 11:15, 17:52)
- 23 Oct: 219 restarts (08:30, 13:23, 13:49, then every minute 13:50–14:26 —
  a restart loop, consistent with the EADDRINUSE class of incident)

Total `Started csld-production.service` lines in the window: **241**.
