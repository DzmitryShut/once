import type { Register } from 'claude-code'

// `$opus fix it`, `$max fix it`, `$opus:max fix it`: the prefix is stripped and
// the main agent's model requests for that one prompt use the override. The
// session's own model and effort are never touched, so the next prompt runs
// on them as before.
//
// Another model starts with an empty prompt cache and writes the whole
// conversation into its own. When the last request carried more than 100k
// tokens, a toast says what that write costs. The prompt is never held back.

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
type Effort = (typeof EFFORTS)[number]

const MODELS: Record<string, string> = {
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5',
  fable: 'claude-fable-5-1',
}

type Override = { model?: string; effort?: Effort }

// Prompt cache prices in dollars per million tokens, for a 1-hour cache.
// Haiku bills a prompt over 100k tokens at a higher rate card. `read` is left
// out where the price is not known to me, and the note then skips the comparison.
type Rate = { write: number; read?: number }
const RATES: Record<string, (context: number) => Rate> = {
  opus: () => ({ write: 8, read: 0.2 }),
  sonnet: () => ({ write: 4, read: 0.2 }),
  haiku: context => (context > 100_000 ? { write: 1, read: 0.05 } : { write: 0.2, read: 0.01 }),
  fable: () => ({ write: 20 }),
}

const BIG_CONTEXT = 100_000
const CACHE_TTL_MS = 60 * 60 * 1000

const familyOf = (model: string) => /opus|sonnet|haiku|fable/.exec(model)?.[0]
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
const tokens = (n: number) => `${Math.round(n / 1000)}k`
const dollars = (n: number) => `$${n.toFixed(2)}`

type Last = { model: string; context: number }

// What switching to `target` costs in a session whose last request ran on
// `last.model` with `last.context` tokens, or undefined when there is nothing to warn about.
function costNote(last: Last, target: string): string | undefined {
  if (last.context <= BIG_CONTEXT || target === last.model) return undefined
  const to = familyOf(target)
  if (!to || !Object.hasOwn(RATES, to)) return undefined
  const write = (last.context / 1e6) * RATES[to]!(last.context).write
  // A toast cuts a long line short and does not break lines, so the note is one short line.
  const note = `${cap(to)} writes ~${tokens(last.context)} tokens to its cache: ~${dollars(write)}`
  const from = familyOf(last.model)
  const read = from && Object.hasOwn(RATES, from) ? RATES[from]!(last.context).read : undefined
  if (read === undefined || from === to) return note
  return `${note}. ${cap(from!)} would read: ~${dollars((last.context / 1e6) * read)}`
}

const PREFIX = /^\$([\w.:-]+)\s+(\S[\s\S]*)$/

const isEffort = (s: string): s is Effort => (EFFORTS as readonly string[]).includes(s)

function parse(text: string): { override: Override; text: string } | undefined {
  const [, spec, rest] = PREFIX.exec(text) ?? []
  if (!spec || !rest) return undefined
  const override: Override = {}
  for (const token of spec.toLowerCase().split(':')) {
    // hasOwn, or `$constructor` would find Object's own properties.
    const alias = Object.hasOwn(MODELS, token) ? MODELS[token] : undefined
    const model = alias ?? (/^claude-[\w.-]+$/.test(token) ? token : undefined)
    if (isEffort(token) && !override.effort) override.effort = token
    else if (model && !override.model) override.model = model
    else return undefined
  }
  return { override, text: rest }
}

export const register: Register = on => {
  // Armed by a prompt, bound to the main loop's turn at its next model request.
  let pending: { override: Override; during?: string } | undefined
  let active: { override: Override; turnId: string } | undefined
  // The session's model and context size as of the last main-agent request.
  let last: Last | undefined
  // When each model last answered a main-agent request: inside the cache's
  // lifetime it still holds the conversation, and a switch to it writes little.
  const ran = new Map<string, number>()

  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta) return next(e)
    const parsed = parse(e.text)
    if (!parsed) return next(e)
    pending = { override: parsed.override, during: e.turnId }
    const entered = await next({ ...e, text: parsed.text })
    if (entered.drop !== undefined) pending = undefined
    else if (last && parsed.override.model) {
      const at = ran.get(parsed.override.model)
      const isWarm = at !== undefined && (await $.clock.now()) - at < CACHE_TTL_MS
      const note = isWarm ? undefined : costNote(last, parsed.override.model)
      if (note) $.ui.toast(note, { timeoutMs: 10_000 })
    }
    return entered
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e)
    if (pending) {
      active = { override: pending.override, turnId: e.turnId }
      pending = undefined
    }
    const o = active?.turnId === e.turnId ? active.override : undefined
    const response = yield* next(o ? { ...e, model: o.model ?? e.model, effort: o.effort ?? e.effort } : e)
    // `e.model` is the session's own, before the override; the usage is the
    // request's, which is how much context the conversation now carries.
    const u = response.usage
    if (u) {
      last = { model: e.model, context: u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens }
      ran.set(o?.model ?? e.model, await $.clock.now())
    }
    return response
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      if (active?.turnId === e.turnId) active = undefined
      // A prompt typed over this turn waits for the next one; any other
      // pending prompt never reached a model request (the turn was aborted).
      if (pending && pending.during !== e.turnId) pending = undefined
    }
    return next(e)
  })
}
