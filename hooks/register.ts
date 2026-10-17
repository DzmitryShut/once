import type { Register } from 'claude-code'

// `$low fix it`, `$max fix it`: the prefix is stripped and the main agent's
// model requests for that one prompt use that effort. The session's own
// effort is never touched, so the next prompt runs on it as before. Effort
// keeps the prompt cache, so a switch costs nothing extra.

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
type Effort = (typeof EFFORTS)[number]

const PREFIX = /^\$(\w+)\s+(\S[\s\S]*)$/

const isEffort = (s: string): s is Effort => (EFFORTS as readonly string[]).includes(s)

function parse(text: string): { effort: Effort; text: string } | undefined {
  const [, spec, rest] = PREFIX.exec(text) ?? []
  const effort = spec?.toLowerCase()
  if (!effort || !rest || !isEffort(effort)) return undefined
  return { effort, text: rest }
}

export const register: Register = on => {
  // Armed by a prompt, bound to the main loop's turn at its next model request.
  let pending: { effort: Effort; during?: string } | undefined
  let active: { effort: Effort; turnId: string } | undefined

  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta) return next(e)
    const parsed = parse(e.text)
    if (!parsed) return next(e)
    pending = { effort: parsed.effort, during: e.turnId }
    const entered = await next({ ...e, text: parsed.text })
    if (entered.drop !== undefined) pending = undefined
    return entered
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e)
    if (pending) {
      active = { effort: pending.effort, turnId: e.turnId }
      pending = undefined
    }
    if (active?.turnId !== e.turnId) return yield* next(e)
    return yield* next({ ...e, effort: active.effort })
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
