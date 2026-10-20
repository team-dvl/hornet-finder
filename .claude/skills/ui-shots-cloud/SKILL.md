---
name: ui-shots-cloud
description: Run ./ui-shots.sh (Playwright phone screenshots, WebKit + Chromium) from a Claude Code web session, choose the right device and step filters, read its FAIL/WARN output and stop it cleanly. Use when a UI change must be checked on phone screens, before a release, or when asked to "tente un ui-shots".
---

# ui-shots from a cloud session

## What it does and does not test

`ui-shots.sh` drives a real browser against **`https://$HOST`, the dev server** (the app served by the dev worktree, normally `devel`), signed in as the dev test admin. The scripts (`ui-shots.sh`, `frontend/scripts/phone-shots.cjs`) come from your checkout, **the application under test does not**.

Checked in a session (2026-10-16): the dev server served a `DEFAULT_GEOLOCATION` (50.5034 / 4.8728) different from the checkout's (50.491064 / 4.884473), so the shots showed `devel`, not the branch. Consequences:
- On a feature branch that is not deployed on dev, `ui-shots` photographs the old UI. A green run says nothing about the branch's frontend, and it never tests the branch's backend.
- It is meaningful (a) after the change is merged into `devel` and the dev server has picked it up (the dev frontend is a volume-mounted Vite server), and (b) for the release gate in `CLAUDE.md`.
- Say this to the developer before presenting a run as validation. A local Vite served through request interception was proposed in that session and **never implemented or tested**; do not claim it exists.

For a branch, fall back on what the container can do: `cd frontend && npm ci && npm run build && npm run lint` (compare lint with `origin/devel`), and read the diff against the Mobile UX rules of `CLAUDE.md`.

## Before launching

1. The script needs, in the cloud environment: `APP_ENV` (must be `dev`), `HOST`, `KC_HOSTNAME`, `KC_TEST_CLIENT_ID`, `KC_TEST_CLIENT_SECRET`, `KC_TEST_USER_PASSWORD`, `KC_TEST_TOTP_SECRET`. It lists the missing ones and stops: report them to the developer, do not retry or invent values. Never print them.
2. It starts `dockerd` itself in a web session and routes through the session HTTPS proxy. Playwright image: `mcr.microsoft.com/playwright:v<PW_VERSION>-noble` (`PW_VERSION` is set at the top of `ui-shots.sh`). If the proxy blocks a host, the script reports it as a blocked host: relay it.
3. It creates fixtures (2 traps, a nest, a hornet, an apiary) on the dev server and deletes them on exit through a `trap`. Never run it against prod (it refuses unless `APP_ENV=dev`).

## Choosing the run

- Default (no `-d`): `ip14` (WebKit) + `pixel7` (Chromium). Add `-d w320` / `se` for narrow layouts, `-d galaxy` for Android-specific ones.
- Full default run: about 17 minutes (one measurement, ±20 % is plausible; `stats` is the longest part). Use filters while iterating:
  - `-s <text>` plays only steps whose label contains it; `-x <text>` plays all but those; both repeatable. The sign-in always runs.
  - Labels (from `phone-shots.cjs`): `home-anon`, `login`, `menu`, `profile`, `map`, `add-menu`, `position-sheet`, `clusters`, `overlap`, `traps-*`/`trap-*`, `catch-form`, `action-form`, `nests-*`/`nest-sheet`, `hornet-sheet`, `add-*`, `apiar*`, `stats`, `tag-object-link`, `page-scrolled`, `account-console`, `admin-menu`.
  - A step may rely on the page the previous one left open: a step that FAILs alone needs its predecessor (`-s apiary-sheet -s apiaries-list`).
- Release gate: the **unfiltered** default run, every `FAIL` and overflow `WARN` fixed. A filtered run does not count (`release.sh` does not enforce it).

## Running

Run it in the background and poll the log; do not block 17 minutes in the foreground:

```bash
./ui-shots.sh [-d ...] [-s ...] > "$SCRATCH/ui-shots.log" 2>&1   # run_in_background
grep -E '^(FAIL|WARN|==)' "$SCRATCH/ui-shots.log"
```

Done when the log has a line starting `Screenshots in`; the summary line reads `N overflow warning(s), M failed step(s)`; exit code 1 means a step failed. Screenshots land in `ui-shots/` (git-ignored); look at the ones of the screens you changed.

## Stopping early

Kill the Playwright container, then confirm the script exited (its `trap` deletes the fixtures):

```bash
docker ps -q --filter ancestor=mcr.microsoft.com/playwright:v<PW_VERSION>-noble | xargs -r docker kill
sleep 5; pgrep -af ui-shots.sh || echo "script gone"
```

Fixture ids are printed on the `Fixtures:` line; if the script died abruptly, check them with a `GET` (404 means already deleted) rather than assuming.

## Reporting

Give the device list, the filters used, the duration, the exact FAIL/WARN lines, and — first — whether the run could test the branch at all (see above).
