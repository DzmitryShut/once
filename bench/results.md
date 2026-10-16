# Benchmark results

Raw output of [`cache.mjs`](cache.mjs), 2026-10-17, Claude Code 2.1.302 on Windows, Claude subscription (1-hour cache TTL). Costs are Claude Code's own estimates at API prices; on a subscription they come out of your usage limits instead.

Each `$` prompt reads a file, so it makes two model requests. The cache columns show each request separately.

## Small session (30-40k tokens of context)

`node bench/cache.mjs`

| prompt | requests | model | cache write | cache read | output | cost $ | time s |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| setup | 2 | opus-5-5 | 0 + 0 | 26.3k + 27.7k | 227 | 0.015 | 11.8 |
| none | 2 | opus-5-5 | 206 + 2.0k | 27.7k + 27.9k | 138 | 0.032 | 9.7 |
| after none | 1 | opus-5-5 | 116 | 29.9k | 2.3k | 0.053 | 31.2 |
| $haiku | 2 | haiku-5-5 | 14.0k + 2.8k | 16.1k + 30.1k | 926 | 0.004 | 6.2 |
| after $haiku | 2 | opus-5-5 | 5.3k + 1.5k | 30.0k + 35.3k | 564 | 0.078 | 18.8 |
| $sonnet | 2 | sonnet-5-5 | 18.4k + 2.2k | 16.1k + 34.5k | 380 | 0.091 | 4.8 |
| after $sonnet | 2 | opus-5-5 | 2.8k + 264 | 36.8k + 39.5k | 364 | 0.047 | 13.7 |
| $low | 2 | opus-5-5 | 182 + 139 | 39.8k + 40.0k | 181 | 0.022 | 10.1 |
| after $low | 2 | opus-5-5 | 124 + 139 | 40.1k + 40.3k | 203 | 0.022 | 15.4 |
| $max | 2 | opus-5-5 | 146 + 2.8k | 40.4k + 40.5k | 1.1k | 0.061 | 16.2 |
| after $max | 2 | opus-5-5 | 227 + 147 | 43.4k + 43.6k | 237 | 0.025 | 7.5 |

## Large session (160-175k tokens of context)

`node bench/cache.mjs --pad 95000`

| prompt | requests | model | cache write | cache read | output | cost $ | time s |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| setup | 2 | opus-5-5 | 132.8k + 10.8k | 16.1k + 148.9k | 264 | 1.188 | 12.6 |
| none | 2 | opus-5-5 | 189 + 2.0k | 159.7k + 159.9k | 171 | 0.085 | 8.0 |
| after none | 1 | opus-5-5 | 149 | 161.9k | 2.2k | 0.077 | 23.9 |
| $haiku | 2 | haiku-5-5 | 146.1k + 2.6k | 16.1k + 162.2k | 900 | 0.160 | 10.7 |
| after $haiku | 2 | opus-5-5 | 5.1k + 1.4k | 162.1k + 167.2k | 385 | 0.126 | 7.5 |
| $sonnet | 2 | sonnet-5-5 | 150.5k + 2.1k | 16.1k + 166.6k | 258 | 0.631 | 5.5 |
| after $sonnet | 2 | opus-5-5 | 2.5k + 1.5k | 168.7k + 171.2k | 307 | 0.106 | 7.0 |
| $low | 2 | opus-5-5 | 173 + 451 | 172.6k + 172.8k | 265 | 0.079 | 6.5 |
| after $low | 2 | opus-5-5 | 199 + 414 | 173.2k + 173.4k | 259 | 0.079 | 6.1 |
| $max | 2 | opus-5-5 | 147 + 2.4k | 173.9k + 174.0k | 1.1k | 0.111 | 16.6 |
| after $max | 2 | opus-5-5 | 690 + 220 | 176.4k + 177.1k | 243 | 0.083 | 5.7 |

## Repeated `$haiku` in a big session (145-155k tokens)

`node bench/cache.mjs --pad 75000 --scenarios 'none,$haiku,$haiku,$haiku'`

| prompt | requests | model | cache write | cache read | output | cost $ | time s |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| setup | 2 | opus-5-5 | 116.1k + 10.8k | 16.1k + 132.2k | 243 | 1.050 | 10.3 |
| none | 2 | opus-5-5 | 184 + 2.0k | 143.0k + 143.2k | 164 | 0.078 | 5.5 |
| after none | 1 | opus-5-5 | 142 | 145.2k | 889 | 0.048 | 11.1 |
| $haiku | 2 | haiku-5-5 | 129.4k + 2.7k | 16.1k + 145.4k | 858 | 0.142 | 6.8 |
| after $haiku | 2 | opus-5-5 | 3.8k + 553 | 145.4k + 149.1k | 293 | 0.099 | 5.9 |
| $haiku | 2 | haiku-5-5 | 793 + 2.1k | 148.1k + 148.9k | 277 | 0.018 | 3.0 |
| after $haiku | 2 | opus-5-5 | 2.4k + 473 | 149.7k + 152.1k | 373 | 0.091 | 7.7 |
| $haiku | 2 | haiku-5-5 | 601 + 2.1k | 151.1k + 151.7k | 250 | 0.018 | 3.1 |
| after $haiku | 2 | opus-5-5 | 2.4k + 384 | 152.6k + 155.0k | 270 | 0.089 | 9.4 |

## Effort on a fresh session

Each row is its own session, so no answer is in the context yet. The session runs at `xhigh`; the `medium` and `low` rows put `$medium` or `$low` before the task. Numbers are for the task prompt only.

Task A, code review: `Without editing anything, check whether every branch of parse() in hooks/register.ts is covered by a test in tests/once.test.ts. Read and search the files as you need, then list uncovered branches in at most five bullets.`

Task B, reading files: `Use Glob to list the files in this repository (skip .git and .claude-plugin/types), read every source, test and doc file, then give a one-line summary of each.`

| task | effort | requests | thinking | output | cache write | cache read | cost $ | time s |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | xhigh | 2 | 2.5k | 3.0k | 2.3k | 55.7k | 0.089 | 35.9 |
| A | medium | 2 | 1.0k | 1.8k | 2.4k | 55.8k | 0.065 | 23.1 |
| A | low | 2 | 493 | 1.1k | 2.4k | 55.8k | 0.052 | 15.3 |
| B | xhigh | 3 | 303 | 1.9k | 14.6k | 85.5k | 0.173 | 19.0 |
| B | medium | 3 | 69 | 1.5k | 12.5k | 85.5k | 0.146 | 14.6 |
| B | low | 4 | 146 | 1.6k | 12.6k | 125.0k | 0.158 | 17.7 |

In task A, only the `xhigh` answer found that `$constructor go` and `$__proto__ go` picked up Object's built-in properties as model aliases. `medium` and `low` reported every branch covered and listed edge cases. The bug is fixed in `hooks/register.ts`.
