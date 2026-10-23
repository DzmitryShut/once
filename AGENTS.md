# AGENTS.md

once is a Claude Code mod: a `$low` … `$max` prefix sets the effort for one prompt. All logic is in `hooks/register.ts`.

## Check

- `claude plugin validate --strict .` must pass. Its `hooks:` and `calls:` lines must match the README's "What it touches".
- `claude plugin test .` runs `tests/once.test.ts` without spending tokens.
- Try it live: `claude --plugin-dir .`, then `$low say hi`. This spends real usage.
- `node bench/cache.mjs` runs a real session and spends real tokens; run it only when asked. Its results go to `bench/results.md` with the date and Claude Code version.

## Rules

- Bump `version` in `.claude-plugin/plugin.json` for every release, or installed copies will not update.
- Keep the plugin name `once`: a renamed plugin is a new plugin for every install.
- README numbers come from `bench/results.md` only.
- `assets/social.png` is rendered from `assets/src/social.html` (1280x640, under 1 MB), `assets/icon.png` from `assets/src/icon.html` (512x512).
