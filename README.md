# once

A Claude Code mod that runs a single prompt on another model, another effort level, or both. Your next prompt runs on your usual settings again.

![once in a Claude Code session](assets/demo.png)

## Install

At the prompt of a Claude Code session:

```
/plugin install once --marketplace DzmitryShut/once
```

Answer `y` to add the marketplace, then pick a scope. From a shell:

```
claude plugin install once --marketplace DzmitryShut/once
```

In the desktop app, click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `DzmitryShut/once`, then **Add plugin**.

## Usage

Start a prompt with `$` and a spec:

```
$opus:max find the race in the order book
$opus     review this diff
$max      why does this test flake?
$haiku:low rename fetchAll to loadAll
```

| Spec | Model | Effort |
| --- | --- | --- |
| `$opus` | Opus | unchanged |
| `$max` | unchanged | max |
| `$opus:max` or `$max:opus` | Opus | max |
| `$claude-sonnet-5-5:low` | that exact model id | low |

Models: `opus`, `sonnet`, `haiku`, `fable`, or any full `claude-*` id. Effort: `low`, `medium`, `high`, `xhigh`, `max`. Case does not matter.

The prefix is removed before the prompt reaches the model. Text that doesn't parse as a spec is sent as typed, so `$HOME is wrong` and `costs $5` are left alone.

## How it works

`once` never changes your session's model or effort. It hooks the model requests of the turn your prompt starts and swaps `model` and `effort` on each of them, including every request after a tool call. Once the turn ends, requests go out with the session settings again.

- Only the main agent is affected. Subagents started during that turn keep their own models.
- If you type a `$` prompt while Claude is still working, it applies from the next model request.
- If you interrupt a turn before it reaches the model, the override is dropped.

Switching models mid-conversation skips the prompt cache, so the first request on another model costs more and takes longer than usual.

## Checked

Tested against Claude Code 2.1.300. Live runs with `claude -p --plugin-dir`:

- a session on Sonnet, `$haiku` with a Bash call in the middle: every request of the turn went to `claude-haiku-5-5`; the next prompt went back to `claude-sonnet-5-5`
- the same math question on Opus: `$low` thought for 166 tokens and answered in 8 s, `$max` thought for 322,488 tokens over 41 min

Unit tests:

```
claude plugin test .
```

## Develop

```
claude --plugin-dir /path/to/once
claude plugin validate .
```

The whole mod is [`hooks/register.ts`](hooks/register.ts). Model aliases live in the `MODELS` table at the top.

## License

[MIT](LICENSE)
