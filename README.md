<div align="center">

# once

**Pick the effort for one Claude Code prompt.**<br>
Same model, same prompt cache. The next prompt is back on your usual effort.

[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![claude code mod](https://img.shields.io/badge/claude%20code-mod-orange)](#install)

![once in a Claude Code session](assets/demo.png)

</div>

```
$low   rename fetchAll to loadAll           routine: think less, answer sooner
$high  why does this test flake?            a bit more care
$max   find the race in the order book      hard: think as long as it takes
```

## Install

```
/plugin install once --marketplace DzmitryShut/once
```

Answer `y` to add the marketplace, then pick a scope. In a session that is already open, run `/reload-plugins`. From a shell: `claude plugin install once --marketplace DzmitryShut/once`. In the desktop app: **+** next to the prompt, **Plugins**, **Add marketplace**.

Needs Claude Code 2.1.287 or later, the first version that runs mods.

## Use

Start a prompt with `$` and a level: `$low`, `$medium`, `$high`, `$xhigh` or `$max`, in any case. The prefix is cut before the model sees the text. No `/effort` before the prompt and no `/effort` back after it.

Anything else goes through as typed, so `$HOME is wrong` and `costs $5` are safe.

## Effort is free to switch

The prompt cache belongs to the model, not to the effort. `$low` and `$max` keep reading the session's cache, so the only thing a switch changes is how long the model thinks.

| Prompt | Session of 30-40k tokens | Session of 160-175k tokens |
| --- | ---: | ---: |
| no prefix, `xhigh` | $0.032 | $0.085 |
| `$low` | $0.022 | $0.079 |
| `$max` | $0.061 | $0.111 |

Measured on an Opus 5.5 session at `xhigh`, one file read per prompt, Claude Code's own cost estimates at API prices ([full results](bench/results.md), [script](bench/cache.mjs)).

On a code review question in a fresh session, `medium` cost 27% less than `xhigh` and `low` 42% less, and they answered in 23 s and 15 s against 36 s. Only `xhigh` found the real bug. So: `$low` for routine prompts, `$xhigh` or `$max` where a miss is expensive.

## Another model?

once used to switch the model too. That turned out to be a trap: another model starts with an empty cache and rewrites the whole conversation into its own. In a 160k session one `$haiku` prompt cost $0.160 against $0.085 for staying on Opus.

For a quick question to another model, use [aside](https://github.com/DzmitryShut/aside): `$haiku what does git reset --soft do?` asks a subagent with a fresh context and puts the answer in your chat. Both mods use `$` and work side by side.

## What it touches

- Hooks: `prompt.submit`, `turn.step` and `turn.complete`, as `claude plugin validate` lists them.
- It reads every prompt you send and changes only one that starts with `$` and a level: the prefix is cut before the model sees the text.
- It sets `effort` on the model requests of the one turn that prompt starts, tool calls included, and stops when the turn ends. Interrupt a turn before it reaches the model and the override is dropped.
- Your session settings, model and subagents stay as they are.
- No network calls and no model calls of its own. Nothing is written to disk.

## Update and remove

Third-party marketplaces do not update on their own: run `claude plugin update once@once`, or turn on auto-update for the marketplace in `/plugin` under **Marketplaces**. Remove it with `claude plugin uninstall once@once`.

## Develop

```
claude --plugin-dir /path/to/once
claude plugin validate .
claude plugin test .
node bench/cache.mjs [--model opus] [--effort xhigh] [--pad 95000]
```

All of it is [`hooks/register.ts`](hooks/register.ts). The benchmark runs a real session and spends real tokens, more with `--pad`.

## License

[MIT](LICENSE)
