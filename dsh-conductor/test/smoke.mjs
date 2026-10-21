import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The role store lives under DSH_HOME. Point it at a fresh directory so this
// test never reads or writes the developer's real roles.json.
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-conductor-test-'))
const { apply } = await import('../index.js')

const registered = new Map()
const disposed = []
const sent = []
let seq = 0

const llm = {
  listProviders: () => [
    { id: 'deepseek-official', name: 'DeepSeek' },
    { id: 'opencode', name: 'OpenCode Zen' },
  ],
  listModels: async (provider) =>
    provider === 'opencode'
      ? [{ id: 'claude-haiku-4-5' }, { id: 'gpt-5.4-mini' }]
      : [{ id: 'deepseek-chat' }],
  resolveCallConfig: async (route) => {
    if (route.provider === 'missing') throw new Error('UNKNOWN_MODEL')
    return route
  },
}

const sessions = {
  get: () => ({
    seq: 10,
    ownEvents: () => [
      { type: 'assistant/message', seq: 3, data: { usage: { inputTokens: 1200, outputTokens: 300 }, message: { content: [{ type: 'text', text: 'report' }] } } },
      { type: 'turn/end', seq: 4, data: { reason: { kind: 'completed' } } },
      { type: 'user/message', seq: 10, data: { message: { content: [{ type: 'text', text: 'Fix it' }] } } },
      { type: 'assistant/message', seq: 11, data: { message: { content: [{ type: 'text', text: 'fixed it' }] } } },
      { type: 'turn/end', seq: 12, data: { reason: { kind: 'completed' } } },
    ],
  }),
}

const systemPrompt = {
  getSectionOrder: () => 100,
  section: () => () => {},
}

const ctx = {
  logger: { info() {}, warn() {} },
  tools: {
    register(definition) {
      registered.set(definition.name, definition)
      return () => registered.delete(definition.name)
    },
  },
  subagents: {
    getProvider: () => ({ name: 'spawn' }),
    resolveMaxDepth: () => 1,
    startActivation: async (spec) => {
      seq += 1
      const id = `child-${seq}`
      const result = new Promise((resolve) => {
        setTimeout(() => {
          if (/fail/i.test(spec.label)) {
            resolve({ output: [], stopReason: 'error', diagnostic: 'boom' })
          } else {
            resolve({
              output: [{ type: 'text', text: `report for ${spec.label}` }],
              structured: { ok: true },
              stopReason: 'completed',
            })
          }
        }, 5)
      })
      return { childId: id, result, dispose: async () => disposed.push(id) }
    },
    sendMessage: async (_sender, target, content) => {
      sent.push({ target, text: content[0].text })
      return 'msg-1'
    },
  },
  get(name) {
    if (name === 'llm') return llm
    if (name === 'sessions') return sessions
    if (name === 'systemPrompt') return systemPrompt
    return undefined
  },
  effect(fn) {
    return fn()
  },
}

apply(ctx, {
  maxConcurrent: 2,
  executors: { coder: { provider: 'opencode', model: 'claude-haiku-4-5', description: 'cheap' } },
})

const exec = { agent: { id: 'parent-1' }, signal: new AbortController().signal }

const dispatch = await registered.get('dispatch_tasks').execute(
  {
    tasks: [
      { role: 'Coder', task: 'Implement A', acceptance: ['works'], executor: 'coder' },
      { role: 'Coder', task: 'Fail B', inherit: true },
    ],
    wait_seconds: 0,
  },
  exec,
)
console.log('--- dispatch ---')
console.log(dispatch)
if (!dispatch.includes('T1') || !dispatch.includes('T2')) throw new Error('dispatch ids missing')

const waited = await registered.get('wait_tasks').execute({ timeout_seconds: 5 }, exec)
console.log('--- wait ---')
console.log(waited)
if (!waited.includes('completed')) throw new Error('wait did not observe completion')

const full = await registered.get('task_result').execute({ task_id: 't1' }, exec)
console.log('--- result ---')
console.log(full)
if (!full.includes('Structured result')) throw new Error('structured result missing')

const list = await registered.get('list_executors').execute({}, exec)
console.log('--- executors ---')
console.log(list)
if (!list.includes('opencode')) throw new Error('provider listing missing')

const follow = await registered.get('task_followup').execute(
  { task_id: 'T1', message: 'Fix it', timeout_seconds: 2 },
  exec,
)
console.log('--- followup ---')
console.log(follow)
if (!follow.includes('Follow-up delivered')) throw new Error('follow-up acknowledgement missing')
if (sent.length !== 1) throw new Error('message not sent')

const cancelled = await registered.get('cancel_task').execute({ task_id: 'T2' }, exec)
console.log('--- cancel ---')
console.log(cancelled)
if (!cancelled.includes('already')) throw new Error('terminal task should not cancel')

console.log('\nSMOKE OK; disposed children:', disposed.join(','))
