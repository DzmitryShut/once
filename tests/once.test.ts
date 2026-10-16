import type { On, TurnStepInput } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'
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
