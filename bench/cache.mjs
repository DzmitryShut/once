#!/usr/bin/env node
// What does one `$` prompt cost? Runs a `claude -p` session with the mod
// loaded and reads its transcript: tokens, prompt cache, cost and time.
//
//   node bench/cache.mjs [--model opus] [--effort xhigh] [--pad 100000] [--task text] [--json out.json]
//
// One session: a setup prompt, then for each scenario a prompt with that
// prefix (it makes a tool call, so two requests) and a follow-up prompt on
// the session settings. `--pad N` puts about N tokens of generated code into
// the setup prompt, to see how the cost of a switch grows with the context.

import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const args = {}
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1]
const MODEL = args.model ?? 'opus'
const EFFORT = args.effort ?? 'xhigh'
const PAD = Number(args.pad ?? 0)
const SCENARIOS = (args.scenarios ?? 'none,$haiku,$sonnet,$low,$max').split(',')
const REPO = resolve(import.meta.dirname, '..')
const PROJECTS = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'projects')

const SETUP = 'Read hooks/register.ts. In one sentence, what does it do?'
const SWITCHED = args.task ?? 'Read tests/once.test.ts and name one test.'
const FOLLOW_UP = 'In one sentence: what would you change in register.ts?'

// About 20 tokens a line. A fresh salt per run keeps the padding out of any
// cache left by an earlier run.
function padding(tokens) {
  const salt = randomUUID().slice(0, 8)
  const lines = [`// generated padding ${salt}, ignore it`]
  for (let i = 0; lines.length * 20 < tokens; i++)
    lines.push(`export const f${i}_${salt} = (x: number): number => x * ${i % 97} + ${(i * 31) % 1009}`)
  return lines.join('\n')
}

// A clean environment: no parent Claude Code session, no terminal integrations.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !/^(CLAUDE|HERDR)/.test(k) || k === 'CLAUDE_CONFIG_DIR'),
)

function claude(sessionId, prompt, first) {
  const res = spawnSync(
    'claude',
    [
      '-p',
      first ? '--session-id' : '--resume', sessionId,
      '--model', MODEL,
      '--effort', EFFORT,
      '--plugin-dir', REPO,
      '--allowedTools', 'Read', 'Grep', 'Glob',
      '--output-format', 'json',
    ],
    { cwd: REPO, env, input: prompt, encoding: 'utf8', maxBuffer: 64 << 20 },
  )
  if (res.status !== 0) throw new Error(`claude exited ${res.status}: ${res.stderr || res.stdout}`)
  return JSON.parse(res.stdout)
}

function transcript(sessionId) {
  for (const dir of readdirSync(PROJECTS)) {
    const file = join(PROJECTS, dir, `${sessionId}.jsonl`)
    if (existsSync(file)) return file
  }
  throw new Error(`no transcript for ${sessionId}`)
}

// One entry per API response. A response is written as several lines sharing
// message.id; the last one carries the final usage.
function requests(file) {
  const byId = new Map()
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue
    const e = JSON.parse(line)
    const m = e.message
    if (e.type !== 'assistant' || e.isSidechain || !m?.usage || m.model === '<synthetic>') continue
    const u = m.usage
    byId.set(m.id, {
      model: m.model,
      input: u.input_tokens ?? 0,
      write: u.cache_creation_input_tokens ?? 0,
      read: u.cache_read_input_tokens ?? 0,
      output: u.output_tokens ?? 0,
      thinking: u.output_tokens_details?.thinking_tokens ?? 0,
    })
  }
  return [...byId.values()]
}

const id = randomUUID()
const prompts = [{ label: 'setup', text: PAD ? `${padding(PAD)}\n\n${SETUP}` : SETUP }]
for (const s of SCENARIOS) {
  prompts.push({ label: s, text: s === 'none' ? SWITCHED : `${s} ${SWITCHED}` })
  prompts.push({ label: `after ${s}`, text: FOLLOW_UP })
}

const turns = []
let seen = 0
let spent = 0
for (const [i, p] of prompts.entries()) {
  process.stderr.write(`${p.label}\n`)
  const result = claude(id, p.text, i === 0)
  const all = requests(transcript(id))
  // total_cost_usd covers the whole session so far, not just this prompt.
  turns.push({ label: p.label, cost: result.total_cost_usd - spent, ms: result.duration_ms, answer: result.result, requests: all.slice(seen) })
  spent = result.total_cost_usd
  seen = all.length
}

const k = n => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
console.log(`session ${id}: ${MODEL}, effort ${EFFORT}${PAD ? `, ${k(PAD)} tokens of padding` : ''}\n`)
console.log('| prompt | requests | model | cache write | cache read | output | cost $ | time s |')
console.log('| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |')
for (const t of turns) {
  const models = [...new Set(t.requests.map(q => q.model.replace(/^claude-/, '')))].join(', ')
  const sum = f => t.requests.reduce((s, q) => s + q[f], 0)
  console.log(
    `| ${t.label} | ${t.requests.length} | ${models} | ${t.requests.map(q => k(q.write)).join(' + ')} | ${t.requests.map(q => k(q.read)).join(' + ')} | ${k(sum('output'))} | ${t.cost.toFixed(3)} | ${(t.ms / 1000).toFixed(1)} |`,
  )
}
if (args.json) writeFileSync(args.json, JSON.stringify({ session: id, model: MODEL, effort: EFFORT, pad: PAD, turns }, null, 2))
