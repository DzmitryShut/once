import type { Register } from 'claude-code'

// `$opus fix it`, `$max fix it`, `$opus:max fix it`: the prefix is stripped and
// the main agent's model requests for that one prompt use the override. The
// session's own model and effort are never touched, so the next prompt runs
// on them as before.

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
type Effort = (typeof EFFORTS)[number]

const MODELS: Record<string, string> = {
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5',
  fable: 'claude-fable-5-1',
}

type Override = { model?: string; effort?: Effort }

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

  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta) return next(e)
    const parsed = parse(e.text)
    if (!parsed) return next(e)
    pending = { override: parsed.override, during: e.turnId }
    const entered = await next({ ...e, text: parsed.text })
    if (entered.drop !== undefined) pending = undefined
    return entered
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e)
    if (pending) {
      active = { override: pending.override, turnId: e.turnId }
      pending = undefined
    }
    if (active?.turnId !== e.turnId) return yield* next(e)
    const { model, effort } = active.override
    return yield* next({ ...e, model: model ?? e.model, effort: effort ?? e.effort })
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
