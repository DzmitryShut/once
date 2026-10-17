<div align="center">

# once

**Pick the effort or the model for one Claude Code prompt.**<br>
The next prompt is back on your usual settings.

[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![claude code mod](https://img.shields.io/badge/claude%20code-mod-orange)](#install)

![once in a Claude Code session](assets/demo.png)

</div>

```
$low   rename fetchAll to loadAll          routine: think less
$max   find the race in the order book     hard: think more
$haiku:low what does git reset --soft do?  quick question: answer now, stay in the session
```

## Install

```
/plugin install once --marketplace DzmitryShut/once
```

Answer `y` to add the marketplace, then pick a scope. From a shell: `claude plugin install once --marketplace DzmitryShut/once`. In the desktop app: **+** next to the prompt, **Plugins**, **Add marketplace**.

## Use

Start a prompt with `$` and a spec. The prefix is cut before the model sees the text.

| You type | Model | Effort |
| --- | --- | --- |
| `$low` `$medium` `$high` `$xhigh` `$max` | yours | that level |
| `$opus` `$sonnet` `$haiku` `$fable` | that model | yours |
| `$haiku:low`, `$max:opus` | that model | that level |
| `$claude-sonnet-5-5:low` | that exact id | that level |

Anything that isn't a spec goes through as typed, so `$HOME is wrong` and `costs $5` are safe.

### A quick question without leaving the session

You are deep in a long task and want to check one thing. `$haiku:low` answers it on the fastest model with almost no thinking, and your session, its model and its effort stay as they were. No `/model`, no second window, no switching back.

In a session under 100k tokens this is also the cheapest prompt you can send: **$0.004** against **$0.032** on Opus. In a bigger one the first `$haiku` is slower and costs more, because Haiku has to write the conversation into its own cache. A second one within the hour costs **$0.018**. The mod warns you before a switch that costs real money.

### Effort is free, a model is not

The prompt cache belongs to a model. Changing the effort keeps it, changing the model drops it.

| Prompt | Session of 30-40k tokens | Session of 160-175k tokens |
| --- | ---: | ---: |
| no prefix, stays on Opus | $0.032 | $0.085 |
| `$low` | $0.022 | $0.079 |
| `$max` | $0.061 | $0.111 |
| `$haiku` | $0.004 | $0.160 |
| `$sonnet` | $0.091 | $0.631 |

Measured on an Opus 5.5 session at `xhigh`, one file read per prompt, Claude Code's own cost estimates at API prices ([full results](bench/results.md), [script](bench/cache.mjs)).

What that means in practice:

- **`$low` and `$max` per prompt.** Nothing extra to pay. `medium` cost 27% less than `xhigh` on a review question and `low` 42% less, but only `xhigh` found the real bug.
- **`$haiku` under 100k tokens.** Cheaper from the first prompt.
- **`$haiku` in a big session** pays off from the second prompt within the hour, or on a prompt with five or more model requests.
- **`$sonnet`** buys speed, not savings.

When the last request carried more than 100k tokens and a prompt changes the model, a toast shows the price first: *Haiku writes ~150k tokens to its cache: ~$0.15. Opus would read: ~$0.03.* The prompt is never held back.

## How it works

`once` never touches your session settings. It swaps `model` and `effort` on the model requests of the one turn your prompt starts, tool calls included, and stops when the turn ends. Subagents keep their own models. Interrupt a turn before it reaches the model and the override is dropped.

## Develop

```
claude --plugin-dir /path/to/once
claude plugin validate .
claude plugin test .
node bench/cache.mjs [--model opus] [--effort xhigh] [--pad 95000]
```

All of it is [`hooks/register.ts`](hooks/register.ts): model aliases in `MODELS`, cache prices in `RATES`. The benchmark runs a real session, about $2.70 at API prices with `--pad`.

## License

[MIT](LICENSE)
