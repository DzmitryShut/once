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

## What a switch costs

The prompt cache belongs to a model. Changing the model drops it, changing the effort does not. Measured with [`bench/cache.mjs`](bench/cache.mjs): a session on Opus 5.5 at effort `xhigh`, where each `$` prompt reads one file. Costs are Claude Code's own estimates at API prices; on a subscription they come out of your usage limits instead.

| Prompt | Session of 30-40k tokens | Session of 160-175k tokens |
| --- | ---: | ---: |
| no prefix, stays on Opus | $0.032 | $0.085 |
| `$haiku` | $0.004 | $0.160 |
| `$sonnet` | $0.091 | $0.631 |
| `$low` | $0.022 | $0.079 |
| `$max` | $0.061 | $0.111 |
| next prompt after `$haiku` (after a plain one) | $0.078 ($0.053) | $0.126 ($0.077) |

Full output, with tokens and time per request: [`bench/results.md`](bench/results.md).

- **Another model writes the conversation into its own cache.** Its first request in the large session wrote 146k tokens. The second request of the same prompt read them back.
- **`$haiku` saves money only under 100k tokens.** Above that, Haiku bills the whole prompt at its higher rate card, and a cache write costs twice the input price: $1.00 per million tokens, against $0.20 for Opus reading its own cache. Under 100k, Haiku's cache write costs the same $0.20, and the cheap output makes `$haiku` eight times cheaper.
- **`$sonnet` from an Opus session never saves money.** Sonnet's cache write costs $4 per million tokens, twenty times what Opus pays to read. It is faster: 5.5 s against 8.0 s in the large session.
- **Effort is free to change.** `$low` and `$max` requests kept reading the session's cache, with a few hundred tokens written, as on any prompt.
- **Going back is cheap.** The session's own cache lives for an hour on a subscription, so the next prompt writes only the switched prompt's messages, about 5k tokens.

How big are real sessions? Across my 62 Claude Code sessions, the median main-agent request carried 124k tokens of context, the 90th percentile 224k, and 97.7% of input tokens came from the cache. The large column is the usual case for me.

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

To measure the cost of a switch on your own setup (it runs a real session, about $2.70 at API prices with `--pad`, $0.45 without):

```
node bench/cache.mjs [--model opus] [--effort xhigh] [--pad 95000]
```

## License

[MIT](LICENSE)
