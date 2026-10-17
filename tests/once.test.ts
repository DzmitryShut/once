import type { On, TurnStepInput } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const SESSION = { model: 'claude-sonnet-5-5', effort: 'medium' } as const

// The engine beneath the plugin: records what each model request was sent with.
function engine(on: On) {
  const sent: Pick<TurnStepInput, 'model' | 'effort' | 'agentId'>[] = []
  const entered: string[] = []
  on('prompt.submit', ($, e) => {
    entered.push(e.text)
    return { text: e.text }
  })
  on('turn.step', async function* ($, e) {
    sent.push({ model: e.model, effort: e.effort, agentId: e.agentId })
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('turn.complete', () => ({ text: '' }))
  return { sent, entered }
}

const submit = ($: Engine, text: string, turnId?: string) =>
  $.prompt.submit({ text, turnId, wait: false, origin: { kind: 'composer' } })

async function step($: Engine, turnId: string, index = 0, agentId?: string) {
  const stream = $.turn.step({ turnId, index, messageCount: 1, agentId, ...SESSION })
  for await (const _ of stream);
  return stream.result
}

const complete = ($: Engine, turnId: string, agentId?: string) =>
  $.turn.complete({ turnId, agentId, answer: '', durationMs: 1, isAborted: false, reason: 'answer' })

describe('once', () => {
  test('model and effort for one prompt, then back', async ($, on) => {
    const { sent, entered } = engine(on)
    await submit($, '$opus:max fix the test')
    expect(entered).toEqual(['fix the test'])
    await step($, 't1', 0)
    await step($, 't1', 1)
    await complete($, 't1')
    await submit($, 'next one')
    await step($, 't2', 0)
    expect(sent.map(s => [s.model, s.effort])).toEqual([
      ['claude-opus-5-5', 'max'],
      ['claude-opus-5-5', 'max'],
      ['claude-sonnet-5-5', 'medium'],
    ])
  })

  test('model alone, effort alone, full id', async ($, on) => {
    const { sent } = engine(on)
    await submit($, '$haiku rename it')
    await step($, 't1')
    await complete($, 't1')
    await submit($, '$XHIGH think hard')
    await step($, 't2')
    await complete($, 't2')
    await submit($, '$low:claude-fable-5-1 go')
    await step($, 't3')
    expect(sent.map(s => [s.model, s.effort])).toEqual([
      ['claude-haiku-5-5', 'medium'],
      ['claude-sonnet-5-5', 'xhigh'],
      ['claude-fable-5-1', 'low'],
    ])
  })

  test('text that is not an override passes untouched', async ($, on) => {
    const { sent, entered } = engine(on)
    const texts = ['$HOME is wrong', '$opus', '$opus:sonnet hi', '$max:max hi', 'cost is $5 now', '$constructor go', '$__proto__ go']
    for (const text of texts) {
      await submit($, text)
    }
    await step($, 't1')
    expect(entered).toEqual(texts)
    expect(sent).toEqual([{ ...SESSION, agentId: undefined }])
  })

  test('subagents keep their own model', async ($, on) => {
    const { sent } = engine(on)
    await submit($, '$opus go')
    await step($, 't1', 0)
    await step($, 'a1', 0, 'agent-1')
    expect(sent.map(s => s.model)).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5'])
  })

  test('a prompt typed over a turn that just ends waits for the next turn', async ($, on) => {
    const { sent } = engine(on)
    await submit($, 'first')
    await step($, 't1')
    await submit($, '$opus second', 't1')
    await complete($, 't1')
    await step($, 't2')
    expect(sent.map(s => s.model)).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5'])
  })

  test('a turn aborted before any request drops the override', async ($, on) => {
    const { sent } = engine(on)
    await submit($, '$opus go')
    await complete($, 't1')
    await submit($, 'again')
    await step($, 't2')
    expect(sent.map(s => s.model)).toEqual(['claude-sonnet-5-5'])
  })
})

describe('cost note', () => {
  // A bottom engine that reports `usage.context` tokens per request and
  // collects the toasts the plugin raises.
  function sessionOf(on: On, model: string, context: number) {
    const toasts: string[] = []
    const usage = { context }
    on('ui.toast', (_$, e) => {
      toasts.push(e.text)
      return { value: undefined }
    })
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    on('turn.step', async function* (_$, e) {
      const u = { model: e.model, input_tokens: 10, output_tokens: 5, cache_read_input_tokens: usage.context - 110, cache_creation_input_tokens: 100 }
      return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: u }
    })
    on('turn.complete', () => ({ text: '' }))
    const warm = async ($: Engine) => {
      const stream = $.turn.step({ turnId: 'warm', index: 0, messageCount: 1, model, effort: 'medium' })
      for await (const _ of stream);
      await stream.result
      await complete($, 'warm')
    }
    return { toasts, warm, usage }
  }

  test('warns, without holding the prompt, when a big session switches model', async ($, on) => {
    const { toasts, warm } = sessionOf(on, 'claude-opus-5-5', 150_000)
    await warm($)
    const entered = await submit($, '$haiku go')
    expect(entered.text).toBe('go')
    expect(toasts).toEqual([
      'Haiku will write ~150k tokens of context into its own cache, about $0.15. Opus would read them for about $0.03.',
    ])
  })

  test('no warning on effort alone, without a model change, or on a plain prompt', async ($, on) => {
    const { toasts, warm } = sessionOf(on, 'claude-opus-5-5', 150_000)
    await warm($)
    await submit($, '$max go')
    await submit($, '$opus go')
    await submit($, 'plain prompt')
    expect(toasts).toEqual([])
  })

  test('no warning at 100k tokens or under', async ($, on) => {
    const { toasts, warm } = sessionOf(on, 'claude-opus-5-5', 100_000)
    await warm($)
    await submit($, '$haiku go')
    expect(toasts).toEqual([])
  })

  test('no warning before the first request, or for a model it has no price for', async ($, on) => {
    const { toasts, warm } = sessionOf(on, 'claude-opus-5-5', 150_000)
    await submit($, '$haiku first')
    await warm($)
    await submit($, '$claude-mystery-1 go')
    expect(toasts).toEqual([])
  })

  test('priced from the context of the last request, fable has no read price to compare', async ($, on) => {
    const { toasts, warm } = sessionOf(on, 'claude-fable-5-1', 200_000)
    await warm($)
    await submit($, '$opus go')
    await submit($, '$haiku go')
    expect(toasts).toEqual([
      'Opus will write ~200k tokens of context into its own cache, about $1.60.',
      'Haiku will write ~200k tokens of context into its own cache, about $0.20.',
    ])
  })

  test('a second switch to the same model inside the hour does not warn, after the hour it does', async ($, on) => {
    const clock = mock.clock(on, { now: 0 })
    const { toasts, warm } = sessionOf(on, 'claude-opus-5-5', 150_000)
    await warm($)
    await submit($, '$haiku one')
    await step($, 't1')
    await complete($, 't1')
    expect(toasts).toHaveLength(1)
    await clock.advance(30 * 60_000)
    await submit($, '$haiku two')
    expect(toasts).toHaveLength(1)
    await clock.advance(31 * 60_000)
    await submit($, '$haiku three')
    expect(toasts).toHaveLength(2)
  })
})
