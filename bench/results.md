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
