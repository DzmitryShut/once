import type { On, TurnStepInput } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const SESSION = { model: 'claude-opus-5-5', effort: 'xhigh' } as const

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
  test('effort for one prompt, every request of its turn, then back', async ($, on) => {
    const { sent, entered } = engine(on)
    await submit($, '$low fix the test')
    expect(entered).toEqual(['fix the test'])
    await step($, 't1', 0)
    await step($, 't1', 1)
    await complete($, 't1')
    await submit($, 'next one')
    await step($, 't2', 0)
    expect(sent.map(s => [s.model, s.effort])).toEqual([
      ['claude-opus-5-5', 'low'],
      ['claude-opus-5-5', 'low'],
      ['claude-opus-5-5', 'xhigh'],
    ])
  })

  test('every level, any case', async ($, on) => {
    const { sent } = engine(on)
    const levels = ['low', 'MEDIUM', 'High', 'xhigh', 'max']
    for (const [i, level] of levels.entries()) {
      await submit($, `$${level} go`)
      await step($, `t${i}`)
      await complete($, `t${i}`)
    }
    expect(sent.map(s => s.effort)).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
  })

  test('text that is not an effort passes untouched, models included', async ($, on) => {
    const { sent, entered } = engine(on)
    const texts = ['$HOME is wrong', '$max', '$haiku go', '$opus:max go', '$low:haiku go', 'cost is $5 now', '$constructor go']
    for (const text of texts) {
      await submit($, text)
    }
    await step($, 't1')
    expect(entered).toEqual(texts)
    expect(sent).toEqual([{ ...SESSION, agentId: undefined }])
  })

  test('subagents keep their own effort', async ($, on) => {
    const { sent } = engine(on)
    await submit($, '$low go')
    await step($, 't1', 0)
    await step($, 'a1', 0, 'agent-1')
    expect(sent.map(s => s.effort)).toEqual(['low', 'xhigh'])
  })

  test('a prompt typed over a turn that just ends waits for the next turn', async ($, on) => {
    const { sent } = engine(on)
    await submit($, 'first')
    await step($, 't1')
    await submit($, '$max second', 't1')
    await complete($, 't1')
    await step($, 't2')
    expect(sent.map(s => s.effort)).toEqual(['xhigh', 'max'])
  })

  test('a turn aborted before any request drops the override', async ($, on) => {
    const { sent } = engine(on)
    await submit($, '$low go')
    await complete($, 't1')
    await submit($, 'again')
    await step($, 't2')
    expect(sent.map(s => s.effort)).toEqual(['xhigh'])
  })
})
