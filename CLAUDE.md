# Claude Code guidance for this repo

See `AGENTS.md` for the eve framework rules. This file covers machine-safety and tooling rules.

## Package manager: pnpm 12 (never launch it through Corepack)

- Always use `pnpm` (pinned in `package.json` as `pnpm@12.3.4`). Never use npm or yarn to install.
- Before running any pnpm command in a session, run `readlink "$(which pnpm)"`. If it ends in `corepack/dist/pnpm.js`, the Corepack shim is active. It is known to break with pnpm 12 and can recurse as `pnpm dlx dlx dlx ...`. Do not run `pnpm dlx` in that state. Tell the user, and use the standalone pnpm binary by absolute path or ask them to run `corepack disable`.
- If `pnpm --version` errors or hangs, stop. Do not retry it in a loop or in the background.

## Never create auto-restarting `pnpm dlx` jobs

- Do not write launchd plists (`KeepAlive`), systemd units (`Restart=always`), MCP server entries, cron jobs, or shell scripts that run `pnpm dlx` or `pnpm exec`. Install the dependency and run its binary by absolute path.
- Any supervised script you write must have a restart throttle and a recursion guard (`pgrep -f 'pnpm dlx dlx'`).
- Do not start long-running background processes (`run_in_background`, `&`, `nohup`) that invoke pnpm without first confirming `pnpm --version` works.

## If a runaway process tree appears (`pnpm dlx dlx dlx ...`)

1. Find the root supervisor: `ps -axo pid,ppid,command | grep "[d]lx"` and look for the process whose parent is `1` (launchd) or a service manager.
2. Stop the supervisor first (`launchctl bootout gui/$(id -u)/<label>`), or the tree respawns.
3. Freeze then kill: `pkill -STOP -f "pnpm dlx"; pkill -9 -f "pnpm dlx"`. Repeat until `pgrep -f "pnpm dlx" | wc -l` prints 0 and stays 0 for 15 seconds.
4. Tell the user before continuing other work. See the README troubleshooting section.

## Secrets

- Never print secret values. Read them into files or env vars via `--file` / `-o tsv` redirection rather than inlining them in commands.
