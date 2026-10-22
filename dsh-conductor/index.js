/**
 * Conductor — route implementation work from the main (flagship) model to
 * executor models, and collect their reports.
 *
 * Host-only DeepSeek Harness bundle. It deliberately imports nothing from the
 * harness packages: every tool definition is a plain registry object and every
 * harness capability is reached through `ctx`.
 *
 * How it works: `dispatch_tasks` starts one child Agent per assignment through
 * `ctx.subagents.startActivation` with `delivery: 'caller'`, so the child gets
 * the full tool surface and its own model route while this plugin owns the
 * result. Each child is disposed once it settles, which frees the activation
 * slot; `task_followup` cold-resumes it when the lead needs another round.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const DEFAULT_REPORT_FORMAT = `Use Markdown with exactly these sections:
1. Status — done | partial | blocked
2. Changes — every file changed and why
3. Verification — the commands you ran and what they showed
4. Acceptance criteria — each criterion marked pass or fail, with evidence
5. Risks / follow-ups — anything the lead must decide
Do not paste whole files; the lead can open them.`

const TERMINAL = new Set(['completed', 'failed', 'cancelled'])
const REWORK_POLL_MS = 1500
const REWORK_GRACE_MS = 5000
const REWORK_TIMEOUT_MS = 30 * 60 * 1000

const DEFAULTS = {
  provider: 'spawn',
  maxConcurrent: 4,
  defaultWaitSeconds: 120,
  maxWaitSeconds: 900,
  maxCharsPerResult: 6000,
  contextCompactionPercent: 40,
  contextWindowTokens: 128000,
  contextWindowMax: 0,
  compactionTimeoutMs: 30000,
  allowAdHocRoutes: false,
}

export const name = 'conductor'

export const inject = ['tools', 'subagents']

export function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)
  const boards = new Map()
  const executorStats = new Map()
  let compactionNotice = {
    boardUnread: false,
    rolesUnread: false,
    at: null,
    executor: null,
    executorName: null,
    percentBefore: null,
    percentAfter: null,
  }
  const disposers = []
  const logger = ctx.logger
  let roleState = readRoleState(config, logger)

  const llm = () => ctx.get('llm')

  // ---------------------------------------------------------------- utilities

  function messageOf(error) {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }

  function duration(ms) {
    const total = Math.max(0, Math.round(ms / 1000))
    if (total < 60) return `${total}s`
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return seconds === 0 ? `${minutes}m` : `${minutes}m${seconds}s`
  }

  function truncate(value, maxChars, hint) {
    if (value.length <= maxChars) return value
    return `${value.slice(0, maxChars)}\n…[truncated: ${value.length - maxChars} characters omitted${hint === undefined ? '' : `; ${hint}`}]`
  }

  function asStringList(value) {
    if (!Array.isArray(value)) return []
    return value.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter(Boolean)
  }

  // ------------------------------------------------------------------- boards

  function boardFor(parent) {
    let board = boards.get(parent.id)
    if (board === undefined) {
      board = {
        parent,
        tasks: new Map(),
        queue: [],
        counter: 0,
        pumping: false,
        capacityRetries: 0,
        capacityTimer: undefined,
      }
      boards.set(parent.id, board)
    }
    return board
  }

  function boardTasks(board) {
    return [...board.tasks.values()].sort((a, b) => a.seq - b.seq)
  }

  function resolveTask(board, rawId) {
    const id = typeof rawId === 'string' ? rawId.trim().toUpperCase() : ''
    const task = board.tasks.get(id)
    if (task === undefined) {
      const known = boardTasks(board).map((entry) => entry.id).join(', ')
      throw new Error(`unknown task id "${rawId}"${known === '' ? '' : `; this session has ${known}`}`)
    }
    return task
  }

  // -------------------------------------------------------------------- tools

  function registerTool(definition) {
    const dispose = ctx.effect(() => ctx.tools.register(definition))
    disposers.push(dispose)
  }

  // --------------------------------------------------------------- task cycle

  function createTask(board, spec) {
    board.counter += 1
    const task = {
      id: `T${board.counter}`,
      seq: board.counter,
      board,
      parent: board.parent,
      role: spec.role,
      summary: spec.summary,
      promptText: spec.promptText,
      provider: spec.provider,
      model: spec.model,
      reasoningEffort: spec.reasoningEffort,
      compactionPercent: spec.compactionPercent,
      routeLabel: spec.routeLabel,
      executorName: spec.executorName,
      executorLabel: spec.executorLabel,
      cwd: spec.cwd,
      status: 'queued',
      createdAt: Date.now(),
      startedAt: undefined,
      finishedAt: undefined,
      childId: undefined,
      activation: undefined,
      controller: new AbortController(),
      waiters: new Set(),
      resultText: undefined,
      structured: undefined,
      stopReason: undefined,
      diagnostic: undefined,
      error: undefined,
      followups: [],
      disposed: false,
      finalizing: undefined,
      rework: false,
      reworkTimer: undefined,
      reworkStartedAt: undefined,
      cancelRequested: false,
    }
    board.tasks.set(task.id, task)
    board.queue.push(task)
    return task
  }

  function restoreTask(board, snapshot, index) {
    const id = typeof snapshot.id === 'string' && snapshot.id !== '' ? snapshot.id : `T${index + 1}`
    const seq = Number(id.replace(/^T/i, '')) || index + 1
    const status = TERMINAL.has(snapshot.status) ? snapshot.status : 'failed'
    const followups = Array.isArray(snapshot.followupsList)
      ? snapshot.followupsList
      : Array.from({ length: Number(snapshot.followups) || 0 }, () => ({
          message: '',
          at: snapshot.finishedAt ?? 0,
        }))
    const resultText = typeof snapshot.result === 'string' ? snapshot.result : undefined
    const stats =
      snapshot.stats ??
      {
        percent: snapshot.contextPercent ?? null,
        tokens: snapshot.contextTokens ?? null,
        window: snapshot.contextWindow ?? null,
        turnsSinceCompact: snapshot.turnsSinceCompact ?? 0,
        lastCompactedAt: snapshot.compactedAt ?? null,
        compacted: snapshot.compacted === true,
        compactionPercent: snapshot.compactionPercent ?? undefined,
      }
    const task = {
      id,
      seq,
      board,
      parent: board.parent,
      role: snapshot.role ?? 'restored',
      summary: snapshot.summary ?? '',
      promptText: '',
      provider: snapshot.provider ?? undefined,
      model: snapshot.model ?? undefined,
      reasoningEffort: undefined,
      compactionPercent: stats.compactionPercent ?? snapshot.compactionPercent ?? undefined,
      routeLabel: snapshot.route ?? 'restored',
      executorName: snapshot.executor ?? undefined,
      executorLabel: snapshot.executorName ?? undefined,
      cwd: undefined,
      status,
      createdAt: snapshot.createdAt ?? Date.now(),
      startedAt: snapshot.startedAt ?? undefined,
      finishedAt: snapshot.finishedAt ?? Date.now(),
      childId: snapshot.childId ?? undefined,
      activation: undefined,
      controller: new AbortController(),
      waiters: new Set(),
      resultText,
      structured: undefined,
      stopReason: snapshot.stopReason ?? undefined,
      diagnostic: undefined,
      error: snapshot.error ?? undefined,
      followups,
      disposed: true,
      finalizing: undefined,
      rework: false,
      reworkTimer: undefined,
      reworkStartedAt: undefined,
      cancelRequested: false,
      stats,
    }
    if (task.status === 'failed' && (task.error === undefined || task.error === '')) {
      task.error =
        task.stopReason === 'max-tokens'
          ? 'executor hit its output token limit before producing a closing report; narrow the task or require file writes instead of pasting artifacts'
          : task.stopReason
            ? `executor stopped with ${String(task.stopReason)} before producing a report`
            : 'task failed without a report'
    }
    if (
      task.status === 'completed' &&
      (resultText === undefined || resultText.trim() === '') &&
      task.error === undefined
    ) {
      task.error = 'executor completed without a closing report'
    }
    board.tasks.set(id, task)
    board.counter = Math.max(board.counter, seq)
    return task
  }

  function isActive(task) {
    return task.status === 'starting' || task.status === 'running'
  }

  function finishWaiters(task) {
    for (const notify of [...task.waiters]) notify()
    task.waiters.clear()
  }

  async function disposeTask(task) {
    if (task.disposed) return
    task.disposed = true
    const activation = task.activation
    if (activation === undefined) return
    try {
      await activation.dispose()
    } catch (error) {
      logger?.warn?.(`conductor: disposing ${task.id} failed: ${messageOf(error)}`)
    }
  }

  async function cancelTask(task) {
    const previous = task.status
    if (TERMINAL.has(previous)) return { previous, cancelled: false }
    if (task.reworkTimer !== undefined) {
      clearTimeout(task.reworkTimer)
      task.reworkTimer = undefined
    }
    task.rework = false
    task.cancelRequested = true
    task.controller.abort(new Error('cancelled by lead'))
    await disposeTask(task)
    task.status = 'cancelled'
    task.finishedAt = Date.now()
    finishWaiters(task)
    pump(task.board)
    return { previous, cancelled: true }
  }

  async function deliverFollowup(task, message, signal) {
    if (task.finalizing !== undefined) await task.finalizing
    if (task.childId === undefined) {
      throw new Error(`${task.id} has not started yet (${task.status})`)
    }
    const wasTerminal = TERMINAL.has(task.status)
    await ctx.subagents.sendMessage(
      task.board.parent,
      task.childId,
      [{ type: 'text', text: message }],
      { signal },
    )
    task.followups.push({ message, at: Date.now() })
    if (wasTerminal) {
      if (task.reworkTimer !== undefined) clearTimeout(task.reworkTimer)
      task.status = 'running'
      task.rework = true
      task.reworkStartedAt = Date.now()
      task.finishedAt = undefined
      task.error = undefined
      watchRework(task)
    }
    if (task.executorName !== undefined) {
      const previous = executorStats.get(task.executorName)
      if (previous !== undefined) {
        const next = {
          ...previous,
          turnsSinceCompact: (previous.turnsSinceCompact ?? 0) + 1,
          updatedAt: Date.now(),
        }
        executorStats.set(task.executorName, next)
        task.stats = next
      }
    }
    return task.childId
  }

  function watchRework(task) {
    if (task.reworkTimer !== undefined) return
    const tick = async () => {
      task.reworkTimer = undefined
      if (task.rework !== true) return
      const started = task.reworkStartedAt ?? Date.now()
      if (Date.now() - started > REWORK_TIMEOUT_MS) {
        task.rework = false
        task.status = 'completed'
        task.error = 'rework status could not be confirmed before timeout'
        task.finishedAt = Date.now()
        pump(task.board)
        return
      }
      let live = false
      try {
        live = ctx.get('agents')?.get?.(task.childId) !== undefined
      } catch {
        live = false
      }
      if (task.rework !== true) return
      if (!live) {
        if (Date.now() - started < REWORK_GRACE_MS) {
          task.reworkTimer = setTimeout(() => void tick(), REWORK_POLL_MS)
          task.reworkTimer.unref?.()
          return
        }
        task.rework = false
        task.status = 'completed'
        task.error = undefined
        task.finishedAt = Date.now()
        pump(task.board)
        return
      }
      task.reworkTimer = setTimeout(() => void tick(), REWORK_POLL_MS)
      task.reworkTimer.unref?.()
    }
    task.reworkTimer = setTimeout(() => void tick(), 250)
    task.reworkTimer.unref?.()
  }

  function measureAgent(agent) {
    const session = agent?.session
    if (session === undefined) return null
    let events
    try {
      events = session.snapshotEvents()
    } catch {
      return null
    }
    let usage
    let window
    let lastCompactionIndex = -1
    let lastCompactedAt = null
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index]
      if (event.type === 'request/context' && typeof event.data?.contextWindow === 'number') {
        window = event.data.contextWindow
      }
      if (event.type === 'assistant/message' && event.data?.usage !== undefined) {
        usage = event.data.usage
      }
      if (event.type === 'compaction/end' || event.type === 'compaction/summary') {
        lastCompactionIndex = index
        lastCompactedAt = event.time ?? lastCompactedAt
      }
    }
    let turns = 0
    for (let index = lastCompactionIndex + 1; index < events.length; index += 1) {
      if (events[index].type === 'turn/start') turns += 1
    }
    const tokens = typeof usage?.inputTokens === 'number' ? usage.inputTokens : null
    const observed =
      typeof window === 'number' && window > 0 ? window : config.contextWindowTokens
    const contextWindow =
      config.contextWindowMax > 0 ? Math.min(observed, config.contextWindowMax) : observed
    const percent =
      tokens === null
        ? null
        : Math.max(0, Math.min(100, Math.round((tokens / contextWindow) * 1000) / 10))
    return {
      tokens,
      window: contextWindow,
      percent,
      turnsSinceCompact: turns,
      lastCompactedAt,
    }
  }

  function recordExecutorStats(task, stats) {
    if (task.executorName === undefined) return
    const value = {
      executor: task.executorName,
      name: task.executorLabel ?? task.executorName,
      session: task.board.parent.id,
      taskId: task.id,
      tokens: stats.tokens ?? null,
      window: stats.window ?? config.contextWindowTokens,
      percent: stats.percent ?? null,
      turnsSinceCompact: stats.turnsSinceCompact ?? 0,
      compactionPercent: task.compactionPercent ?? config.contextCompactionPercent,
      lastCompactedAt: stats.lastCompactedAt ?? null,
      compacted: stats.compacted === true,
      updatedAt: Date.now(),
    }
    executorStats.set(task.executorName, value)
    task.stats = value
  }

  function markCompaction(task, before, after) {
    compactionNotice = {
      boardUnread: true,
      rolesUnread: true,
      at: Date.now(),
      executor: task.executorName ?? null,
      executorName: task.executorLabel ?? task.executorName ?? null,
      percentBefore: before.percent ?? null,
      percentAfter: after.percent ?? null,
    }
  }

  async function compactTask(task) {
    if (task.executorName === undefined || task.childId === undefined) return
    const agents = ctx.get('agents')
    let agent = agents?.get?.(task.childId)
    let handle
    try {
      if (agent === undefined && agents !== undefined && typeof agents.resume === 'function') {
        try {
          handle = await agents.resume({
            resumeSessionId: task.childId,
            parentAgent: task.board.parent,
            ...(task.provider === undefined
              ? {}
              : {
                  agentOptions: {
                    provider: task.provider,
                    model: task.model,
                    ...(task.reasoningEffort === undefined
                      ? {}
                      : { reasoningEffort: task.reasoningEffort }),
                  },
                }),
          })
        } catch (error) {
          logger?.warn?.(`conductor: resuming ${task.childId} failed: ${messageOf(error)}`)
          return
        }
        agent = handle.agent
        try {
          await agent.whenIdle?.()
        } catch {
          // A resumed agent may already be idle.
        }
      }
      if (agent === undefined) return

      const before = measureAgent(agent)
      if (before === null) return
      recordExecutorStats(task, before)
      if (before.percent === null || before.percent < (task.compactionPercent ?? config.contextCompactionPercent)) return

      const compaction = ctx.get('compaction') ?? agent.ctx?.get?.('compaction')
      if (compaction === undefined || typeof compaction.compactNow !== 'function') return

      const controller = new AbortController()
      const timer = setTimeout(
        () => controller.abort(new Error('compaction timeout')),
        config.compactionTimeoutMs,
      )
      timer.unref?.()
      let result
      try {
        result = await compaction.compactNow(agent, controller.signal)
      } catch (error) {
        logger?.warn?.(`conductor: compacting ${task.id} failed: ${messageOf(error)}`)
        return
      } finally {
        clearTimeout(timer)
      }
      if (result === null) return

      const saved = typeof result.shadowedTokenCount === 'number' ? result.shadowedTokenCount : 0
      const window = before.window ?? config.contextWindowTokens
      const remaining = Math.max(1, (before.tokens ?? 0) - saved)
      const summaryTokens = Math.max(200, Math.round(saved * 0.1))
      const tokens = Math.min(before.tokens ?? remaining, remaining + summaryTokens)
      const after = {
        tokens,
        window,
        percent: Math.max(0, Math.min(100, Math.round((tokens / window) * 1000) / 10)),
        turnsSinceCompact: 0,
        lastCompactedAt: Date.now(),
        compacted: true,
      }
      recordExecutorStats(task, after)
      markCompaction(task, before, after)
    } finally {
      if (handle !== undefined) {
        try {
          await handle.dispose()
        } catch (error) {
          logger?.warn?.(`conductor: disposing resumed ${task.childId} failed: ${messageOf(error)}`)
        }
      }
    }
  }

  async function finalizeTask(task) {
    try {
      await compactTask(task)
    } catch (error) {
      logger?.warn?.(`conductor: finalizing ${task.id} failed: ${messageOf(error)}`)
    }
    await disposeTask(task)
  }

  function settle(task, result) {
    if (task.status === 'cancelled') {
      void disposeTask(task)
      return
    }
    task.status = task.cancelRequested
      ? 'cancelled'
      : result.stopReason === 'completed'
        ? 'completed'
        : result.stopReason === 'aborted'
          ? 'cancelled'
          : 'failed'
    task.stopReason = result.stopReason
    task.resultText = outputText(result)
    task.structured = result.structured
    task.diagnostic = result.diagnostic
    if (task.status === 'failed' && task.diagnostic !== undefined) task.error = task.diagnostic
    if (task.status === 'failed' && (task.error === undefined || task.error === '')) {
      task.error =
        result.stopReason === 'max-tokens'
          ? 'executor hit its output token limit before producing a closing report; narrow the task or require file writes instead of pasting artifacts'
          : `executor stopped with ${String(result.stopReason)} before producing a report`
    }
    if (
      task.status === 'completed' &&
      (task.resultText === undefined || task.resultText.trim() === '') &&
      result.structured === undefined
    ) {
      task.status = 'failed'
      task.error =
        'executor completed without a closing report; inspect the child session or send a follow-up asking for a short report'
    }
    task.finishedAt = Date.now()
    finishWaiters(task)
    pump(task.board)
    task.finalizing = finalizeTask(task)
    void task.finalizing
  }

  function fail(task, error) {
    if (task.status === 'cancelled') {
      void disposeTask(task)
      return
    }
    task.status = task.cancelRequested ? 'cancelled' : 'failed'
    task.error = messageOf(error)
    task.finishedAt = Date.now()
    finishWaiters(task)
    pump(task.board)
    task.finalizing = finalizeTask(task)
    void task.finalizing
  }

  async function startTask(task) {
    if (task.status !== 'starting') return
    try {
      const provider = ctx.subagents.getProvider(config.provider)
      if (provider === undefined) {
        throw new Error(`subagent provider "${config.provider}" is not registered; cannot dispatch`)
      }
      const maxDepth = ctx.subagents.resolveMaxDepth(undefined)
      const activation = await ctx.subagents.startActivation({
        provider: config.provider,
        label: `${task.id} · ${task.role} · ${task.summary}`.slice(0, 120),
        delivery: 'caller',
        signal: task.controller.signal,
        request: {
          ...(task.cwd === undefined ? {} : { cwd: task.cwd }),
          prompt: [{ type: 'text', text: task.promptText }],
          parent: task.parent,
          ...(task.provider === undefined
            ? {}
            : {
                agentOptions: {
                  provider: task.provider,
                  model: task.model,
                  ...(task.reasoningEffort === undefined
                    ? {}
                    : { reasoningEffort: task.reasoningEffort }),
                },
              }),
          ...(maxDepth === undefined ? {} : { maxDepth }),
        },
      })
      if (task.controller.signal.aborted) {
        await activation.dispose().catch(() => {})
        task.status = 'cancelled'
        task.finishedAt = Date.now()
        finishWaiters(task)
        return
      }
      task.activation = activation
      task.childId = activation.childId
      task.status = 'running'
      task.startedAt = Date.now()
      recordExecutorStats(task, {
        tokens: 0,
        window: null,
        percent: 0,
        turnsSinceCompact: 0,
        lastCompactedAt: null,
      })
      activation.result.then(
        (result) => settle(task, result),
        (error) => fail(task, error),
      )
    } catch (error) {
      const text = messageOf(error)
      if (text.includes('ACTIVATION_LIMIT_REACHED') && task.board.capacityRetries < 8) {
        task.board.capacityRetries += 1
        task.status = 'queued'
        task.startedOnce = false
        task.board.queue.unshift(task)
        schedulePump(task.board, 1500)
      } else {
        task.status = task.cancelRequested ? 'cancelled' : 'failed'
        task.error = text
        task.finishedAt = Date.now()
        finishWaiters(task)
      }
    } finally {
      pump(task.board)
    }
  }

  function pump(board) {
    if (board.pumping) return
    board.pumping = true
    try {
      for (;;) {
        const active = [...board.tasks.values()].filter(isActive).length
        if (active >= config.maxConcurrent) return
        const next = board.queue.find((task) => task.status === 'queued' && task.startedOnce !== true)
        if (next === undefined) return
        next.startedOnce = true
        next.status = 'starting'
        void startTask(next)
      }
    } finally {
      board.pumping = false
    }
  }

  function schedulePump(board, delayMs) {
    if (board.capacityTimer !== undefined) return
    board.capacityTimer = setTimeout(() => {
      board.capacityTimer = undefined
      pump(board)
    }, delayMs)
    board.capacityTimer.unref?.()
  }

  function waitForTask(task, deadline, signal) {
    if (TERMINAL.has(task.status)) return Promise.resolve()
    const remaining = deadline - Date.now()
    if (remaining <= 0) return Promise.resolve()
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer)
        task.waiters.delete(done)
        signal?.removeEventListener('abort', done)
        resolve()
      }
      const timer = setTimeout(done, remaining)
      timer.unref?.()
      task.waiters.add(done)
      signal?.addEventListener('abort', done, { once: true })
    })
  }

  async function waitForTasks(tasks, seconds, signal) {
    const deadline = Date.now() + Math.max(0, seconds) * 1000
    await Promise.all(tasks.map((task) => waitForTask(task, deadline, signal)))
    signal?.throwIfAborted()
  }

  // -------------------------------------------------------------- route setup

  function routeLabelFor(spec) {
    if (spec.provider === undefined) return 'inherited route'
    return spec.executorLabel === undefined
      ? `${spec.provider}/${spec.model}`
      : `${spec.executorLabel} (${spec.provider}/${spec.model})`
  }

  function readTaskSpec(input, index) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error(`tasks[${index}] must be an object`)
    }
    const role = typeof input.role === 'string' ? input.role.trim() : ''
    const assignment = typeof input.task === 'string' ? input.task.trim() : ''
    if (role === '') throw new Error(`tasks[${index}].role is required`)
    if (assignment === '') throw new Error(`tasks[${index}].task is required`)

    const executorName = typeof input.executor === 'string' ? input.executor.trim() : ''
    const inherit = input.inherit === true
    let provider = typeof input.provider === 'string' ? input.provider.trim() : ''
    let model = typeof input.model === 'string' ? input.model.trim() : ''
    let executorLabel = ''
    let reasoningEffort =
      typeof input.reasoning_effort === 'string'
        ? input.reasoning_effort.trim()
        : typeof input.reasoningEffort === 'string'
          ? input.reasoningEffort.trim()
          : ''
    let compactionPercent

    if (executorName !== '') {
      if (provider !== '' || model !== '' || inherit) {
        throw new Error(`tasks[${index}]: use either executor, provider/model, or inherit — not several`)
      }
      const configured = roleState.executors[executorName]
      if (configured === undefined) {
        const names = Object.keys(roleState.executors).join(', ')
        throw new Error(
          `tasks[${index}]: unknown executor role "${executorName}"${names === '' ? '' : `; configured: ${names}`}; call list_executors`,
        )
      }
      provider = configured.provider
      model = configured.model
      executorLabel = configured.name ?? executorName
      if (reasoningEffort === '' && configured.reasoningEffort !== undefined) {
        reasoningEffort = configured.reasoningEffort
      }
      compactionPercent = configured.contextCompactionPercent
    } else if (inherit) {
      if (provider !== '' || model !== '') {
        throw new Error(`tasks[${index}]: inherit cannot be combined with provider/model`)
      }
      if (!roleState.allowAdHocRoutes) {
        throw new Error(
          `tasks[${index}]: inherit is disabled while the route policy is roles-only; choose an executor role from list_executors`,
        )
      }
    } else {
      if (provider === '' || model === '') {
        if (provider !== '' || model !== '') {
          throw new Error(`tasks[${index}]: provider and model must be supplied together`)
        }
        throw new Error(`tasks[${index}]: choose an executor role from list_executors`)
      }
      if (!roleState.allowAdHocRoutes) {
        throw new Error(
          `tasks[${index}]: direct provider/model routes are disabled by the user; choose a configured executor role from list_executors`,
        )
      }
    }

    const cwd = typeof input.cwd === 'string' && input.cwd.trim() !== '' ? input.cwd.trim() : undefined
    const acceptance = asStringList(input.acceptance)
    const constraints = asStringList(input.constraints)
    const files = asStringList(input.files)
    const context = typeof input.context === 'string' ? input.context.trim() : ''
    const returnFormat =
      typeof input.return_format === 'string' && input.return_format.trim() !== ''
        ? input.return_format.trim()
        : undefined

    return {
      role,
      assignment,
      acceptance,
      constraints,
      files,
      context,
      returnFormat,
      provider: provider === '' ? undefined : provider,
      model: model === '' ? undefined : model,
      reasoningEffort: reasoningEffort === '' ? undefined : reasoningEffort,
      compactionPercent,
      executorName: executorName === '' ? undefined : executorName,
      executorLabel: executorLabel === '' ? undefined : executorLabel,
      cwd,
      summary: summarise(role, assignment),
    }
  }

  function summarise(role, assignment) {
    const firstLine = assignment.split(/\r?\n/, 1)[0].trim()
    return (firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine).slice(0, 80)
  }

  function buildPrompt(spec) {
    const lines = []
    lines.push(
      `You are ${spec.role}. You are the executing member of a multi-model engineering team; a lead architect (a stronger model) decomposed the work and will review your report.`,
    )
    lines.push('', '## Assignment', spec.assignment)
    if (spec.context !== '') lines.push('', '## Context', spec.context)
    if (spec.files.length > 0) {
      lines.push('', '## Read first')
      for (const file of spec.files) lines.push(`- ${file}`)
    }
    if (spec.acceptance.length > 0) {
      lines.push('', '## Acceptance criteria')
      spec.acceptance.forEach((criterion, index) => lines.push(`${index + 1}. ${criterion}`))
    }
    if (spec.constraints.length > 0) {
      lines.push('', '## Constraints')
      for (const constraint of spec.constraints) lines.push(`- ${constraint}`)
    }
    lines.push(
      '',
      '## Working rules',
      '- You own this assignment end to end. Do not ask the lead questions; make reasonable assumptions and state them.',
      '- Read before editing. Keep changes scoped to the assignment and never revert unrelated work.',
      '- Run the relevant checks or tests. If a check cannot run, say so and explain why.',
      '- Write large artifacts (SVG, HTML, generated code) to files with tools; never paste a whole artifact into your final response.',
      '- Your final response is a short report. If a tool or check fails, report the failure instead of regenerating the artifact in text.',
      '- You may delegate only if the assignment explicitly asks for it; otherwise do the work yourself.',
      '',
      '## Required final report',
      spec.returnFormat ?? DEFAULT_REPORT_FORMAT,
    )
    return lines.join('\n')
  }

  async function preflight(specs, signal) {
    const runtime = llm()
    if (runtime === undefined) return
    for (const spec of specs) {
      if (spec.provider === undefined) continue
      try {
        await runtime.resolveCallConfig(
          {
            provider: spec.provider,
            model: spec.model,
            ...(spec.reasoningEffort === undefined
              ? {}
              : { reasoningEffort: spec.reasoningEffort }),
          },
          signal,
        )
      } catch (error) {
        throw new Error(
          `route ${spec.provider}/${spec.model} is not usable: ${messageOf(error)}. Call list_executors to see registered routes.`,
        )
      }
    }
  }

  // ------------------------------------------------------------- presentation

  function statusLabel(task) {
    const now = Date.now()
    switch (task.status) {
      case 'queued':
        return 'queued (waiting for a free execution slot)'
      case 'starting':
        return 'starting'
      case 'running':
        return `running · ${duration(now - (task.startedAt ?? now))}`
      case 'completed':
        return `completed · ${duration((task.finishedAt ?? now) - (task.startedAt ?? now))}`
      case 'failed':
        return `failed · ${duration((task.finishedAt ?? now) - (task.startedAt ?? now))}`
      case 'cancelled':
        return 'cancelled'
      default:
        return task.status
    }
  }

  function taskHeadline(task) {
    const parts = [task.id, statusLabel(task), task.role, task.routeLabel]
    return parts.join(' · ')
  }

  function renderTask(task, includeResults, maxChars) {
    const lines = [taskHeadline(task)]
    if (TERMINAL.has(task.status) && includeResults) {
      if (task.resultText !== undefined && task.resultText.trim() !== '') {
        lines.push(truncate(task.resultText, maxChars, `use task_result ${task.id} for the rest`))
      } else if (task.status === 'failed') {
        lines.push(truncate(`Error: ${task.error ?? '(no diagnostic)'}`, maxChars))
      } else if (task.status === 'cancelled') {
        lines.push('Cancelled; no report.')
      } else {
        lines.push('(finished without a closing report)')
      }
      if (task.structured !== undefined) {
        lines.push('Structured result:', JSON.stringify(task.structured, null, 2))
      }
    } else if (task.status === 'failed' && task.error !== undefined) {
      lines.push(truncate(`Error: ${task.error}`, maxChars))
    }
    return lines.join('\n')
  }

  function outputText(result) {
    const blocks = Array.isArray(result?.output) ? result.output : []
    return blocks
      .filter((block) => block !== null && typeof block === 'object' && block.type === 'text')
      .map((block) => (typeof block.text === 'string' ? block.text : ''))
      .join('\n\n')
  }

  // -------------------------------------------------------------------- tools

  registerTool({
    name: 'dispatch_tasks',
    description:
      'Start one or more background execution tasks on executor models and return their task ids immediately. Each task is a self-contained child agent with the same tools and workspace as you, so it can read, edit, and run code. Use this to keep decomposition, architecture, and review here while routing implementation to executor roles. The user owns the role→model mapping: every task must name an `executor` role from `list_executors`. Do not invent provider/model routes or use `inherit` unless the user explicitly enabled ad-hoc routes. Start independent tasks in ONE call, then collect them with `wait_tasks` (or pass `wait_seconds` here to block for the first results). Results remain available for the rest of this session through `wait_tasks` and `task_result`.',
    parameters: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          minItems: 1,
          description: 'Assignments to start, one child agent each.',
          items: {
            type: 'object',
            properties: {
              role: {
                type: 'string',
                description:
                  "Executor persona, e.g. 'Senior TypeScript engineer' or 'Test automation engineer'.",
              },
              task: {
                type: 'string',
                description:
                  'Complete, standalone assignment. Name the relevant paths, the current behavior, and what to build; the executor cannot see this conversation.',
              },
              acceptance: {
                type: 'array',
                items: { type: 'string' },
                description: 'Acceptance criteria the executor must satisfy and report against.',
              },
              context: {
                type: 'string',
                description: 'Background the executor needs to start correctly.',
              },
              constraints: {
                type: 'array',
                items: { type: 'string' },
                description: 'Hard rules: files to avoid, style, commands to run, scope limits.',
              },
              files: {
                type: 'array',
                items: { type: 'string' },
                description: 'Paths the executor should read before starting.',
              },
              return_format: {
                type: 'string',
                description:
                  'Exact required final report structure. Omit for status/changes/verification/acceptance/risks.',
              },
              executor: {
                type: 'string',
                description:
                  'Configured executor role id from `list_executors`. The user fixes which model this role uses.',
              },
              provider: {
                type: 'string',
                description:
                  'Ad-hoc provider route; accepted only when the user enabled ad-hoc routes. Prefer `executor`.',
              },
              model: {
                type: 'string',
                description:
                  'Ad-hoc model id; accepted only when the user enabled ad-hoc routes. Prefer `executor`.',
              },
              inherit: {
                type: 'boolean',
                description:
                  "Use the publisher's own provider/model for the child. Only accepted when the user enabled ad-hoc routes; rejected under roles-only.",
              },
              reasoning_effort: {
                type: 'string',
                description: 'Adapter-owned reasoning effort for the selected route.',
              },
              cwd: {
                type: 'string',
                description:
                  'Working directory for the child. Relative paths resolve against your current directory; omit to inherit it.',
              },
            },
            required: ['role', 'task'],
            additionalProperties: false,
          },
        },
        wait_seconds: {
          type: 'number',
          minimum: 0,
          description:
            'After starting, wait up to this many seconds and include any finished reports. 0 (default) returns immediately.',
        },
      },
      required: ['tasks'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    isConcurrencySafe: () => true,
    timeoutMs: (config.maxWaitSeconds + 60) * 1000,
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('dispatch_tasks requires a calling agent')
      const inputs = Array.isArray(args.tasks) ? args.tasks : []
      if (inputs.length === 0) throw new Error('tasks must contain at least one assignment')
      const specs = inputs.map((input, index) => readTaskSpec(input, index))
      await preflight(specs, exec.signal)

      const board = boardFor(parent)
      for (const spec of specs) {
        spec.promptText = buildPrompt(spec)
        spec.routeLabel = routeLabelFor(spec)
      }
      const tasks = specs.map((spec) => createTask(board, spec))
      pump(board)

      const lines = [
        `Started ${tasks.length} task${tasks.length === 1 ? '' : 's'} (max ${config.maxConcurrent} in parallel):`,
        ...tasks.map((task) => `- ${taskHeadline(task)} — ${task.summary}`),
      ]

      const waitSeconds = clampNumber(args.wait_seconds, 0, 0, config.maxWaitSeconds)
      let timedOut = false
      if (waitSeconds > 0) {
        await waitForTasks(tasks, waitSeconds, exec.signal)
        const pending = tasks.filter((task) => !TERMINAL.has(task.status))
        timedOut = pending.length > 0
        lines.push('', `After ${duration(waitSeconds * 1000)}:`)
        for (const task of tasks) lines.push('', renderTask(task, true, config.maxCharsPerResult))
        if (timedOut) {
          lines.push(
            '',
            `${pending.length} task${pending.length === 1 ? ' is' : 's are'} still running (${pending
              .map((task) => task.id)
              .join(', ')}). Call wait_tasks to continue waiting.`,
          )
        }
      } else {
        lines.push('', 'Call wait_tasks to collect their reports.')
      }
      return lines.join('\n')
    },
  })

  registerTool({
    name: 'wait_tasks',
    description:
      'Wait for execution tasks and return their reports. Omit `task_ids` to wait for every task started in this session. Returns each task status, route, and final report; a timeout returns current statuses without failing. Use `timeout_seconds: 0` for a pure status check.',
    parameters: {
      type: 'object',
      properties: {
        task_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task ids to wait for. Omit to cover every task in this session.',
        },
        timeout_seconds: {
          type: 'number',
          minimum: 0,
          description: `Maximum wait. Defaults to ${config.defaultWaitSeconds}s; values are capped at ${config.maxWaitSeconds}s.`,
        },
        include_results: {
          type: 'boolean',
          description: 'Include final reports for finished tasks. Defaults to true.',
        },
        max_chars_per_result: {
          type: 'number',
          description: 'Per-report character cap. Defaults to the plugin setting.',
        },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    isConcurrencySafe: () => true,
    timeoutMs: (config.maxWaitSeconds + 60) * 1000,
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('wait_tasks requires a calling agent')
      const board = boardFor(parent)
      const ids = asStringList(args.task_ids)
      const tasks = ids.length > 0 ? ids.map((id) => resolveTask(board, id)) : boardTasks(board)
      if (tasks.length === 0) {
        return 'No tasks in this session yet. Use dispatch_tasks to start one.'
      }
      const seconds = clampNumber(
        args.timeout_seconds,
        config.defaultWaitSeconds,
        0,
        config.maxWaitSeconds,
      )
      const includeResults = args.include_results !== false
      const maxChars = clampNumber(
        args.max_chars_per_result,
        config.maxCharsPerResult,
        500,
        100000,
      )
      await waitForTasks(tasks, seconds, exec.signal)
      const pending = tasks.filter((task) => !TERMINAL.has(task.status))
      const header =
        pending.length === 0
          ? `All ${tasks.length} task${tasks.length === 1 ? '' : 's'} finished.`
          : `${tasks.length - pending.length}/${tasks.length} finished; still active: ${pending
              .map((task) => task.id)
              .join(', ')}${seconds > 0 ? ` (waited ${duration(seconds * 1000)})` : ''}.`
      return [
        header,
        ...tasks.flatMap((task) => ['', renderTask(task, includeResults, maxChars)]),
      ].join('\n')
    },
  })

  registerTool({
    name: 'task_result',
    description:
      'Return the complete final report of one finished task, including its structured result if it produced one. Use this when a report was truncated in wait_tasks.',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Task id, e.g. T1.' },
        max_chars: {
          type: 'number',
          description: 'Character cap for the report. Defaults to 30000.',
        },
      },
      required: ['task_id'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('task_result requires a calling agent')
      const task = resolveTask(boardFor(parent), args.task_id)
      if (!TERMINAL.has(task.status)) {
        throw new Error(`${task.id} is ${task.status}; wait for it with wait_tasks`)
      }
      const maxChars = clampNumber(args.max_chars, 30000, 500, 200000)
      const parts = [taskHeadline(task)]
      if (task.resultText !== undefined && task.resultText !== '') {
        parts.push('', truncate(task.resultText, maxChars, 'raise max_chars to read more'))
      } else if (task.error !== undefined) {
        parts.push('', `Error: ${truncate(task.error, maxChars)}`)
      } else {
        parts.push('', '(no closing report)')
      }
      if (task.structured !== undefined) {
        parts.push('', 'Structured result:', JSON.stringify(task.structured, null, 2))
      }
      if (task.followups.length > 0) {
        parts.push('', `Follow-ups: ${task.followups.length}`)
      }
      return parts.join('\n')
    },
  })

  registerTool({
    name: 'task_followup',
    description:
      'Send a follow-up instruction to a task’s executor. The executor keeps its earlier conversation, so this is the cheapest way to request corrections, extra verification, or clarification. A finished executor cold-resumes and its closing message is delivered back to this session as a background subagent notice for the returned child id; a still-running executor receives the message at its next step and its final report updates the task.',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Task id, e.g. T1.' },
        message: {
          type: 'string',
          description:
            'The instruction. State what was wrong or missing and what the new report must contain.',
        },
      },
      required: ['task_id', 'message'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('task_followup requires a calling agent')
      const task = resolveTask(boardFor(parent), args.task_id)
      if (task.childId === undefined) {
        throw new Error(`${task.id} has not started yet (${task.status}); wait for a slot first`)
      }
      const message = typeof args.message === 'string' ? args.message.trim() : ''
      if (message === '') throw new Error('message must be non-empty')
      let childId
      try {
        childId = await deliverFollowup(task, message, exec.signal)
      } catch (error) {
        throw new Error(`could not deliver the follow-up to ${task.id}: ${messageOf(error)}`)
      }
      return [
        `Follow-up delivered to ${task.id} (subagent ${childId}).`,
        task.status === 'running' || task.status === 'starting'
          ? 'It is still working, so the instruction reaches it at its next step; call wait_tasks for its updated report.'
          : 'It will cold-resume, answer in a new turn, and deliver its closing message here as a background subagent notice.',
      ].join(' ')
    },
  })

  registerTool({
    name: 'cancel_task',
    description:
      'Cancel one task and release its execution slot. Use when the assignment is no longer needed or is clearly going the wrong way. Returns the previous status.',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Task id, e.g. T1.' },
      },
      required: ['task_id'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('cancel_task requires a calling agent')
      const task = resolveTask(boardFor(parent), args.task_id)
      const result = await cancelTask(task)
      return result.cancelled
        ? `${task.id} cancelled (was ${result.previous}).`
        : `${task.id} already ${result.previous}; nothing to cancel.`
    },
  })

  registerTool({
    name: 'list_executors',
    description:
      'List the user-configured executor roles and every live provider/model route. Call this before dispatching; pass a role id as `executor`. The role→model mapping is controlled by the user, not by you.',
    parameters: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          description: 'Limit the model listing to one provider route id.',
        },
        include_models: {
          type: 'boolean',
          description: 'List advertised models per provider. Defaults to true.',
        },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const lines = []
      const names = Object.keys(roleState.executors)
      if (names.length > 0) {
        lines.push('Configured executor roles (pass the id as `executor`):')
        for (const name of names) {
          const entry = roleState.executors[name]
          const label = entry.name === undefined ? name : `${entry.name} (${name})`
          const note = entry.description === undefined ? '' : ` — ${entry.description}`
          const stat = executorStats.get(name)
          const threshold = entry.contextCompactionPercent ?? config.contextCompactionPercent
          const statsNote =
            stat === undefined
              ? ` — compact at ${threshold}%`
              : ` — ctx ${stat.percent ?? '?'}% · ${stat.turnsSinceCompact ?? 0} turns since compact · compact at ${stat.compactionPercent ?? threshold}%`
          lines.push(`- ${label} → ${entry.provider}/${entry.model}${note}${statsNote}`)
        }
      } else {
        lines.push(
          'No executor roles are configured. Open the Conductor task board and add one, or enable ad-hoc routes.',
        )
      }
      lines.push(
        '',
        `Route policy: ${
          roleState.allowAdHocRoutes
            ? 'executor roles plus ad-hoc provider/model routes'
            : 'executor roles only (ad-hoc routes disabled by the user)'
        }.`,
        `Context compaction: ${
          ctx.get('compaction') === undefined
            ? 'unavailable (enable the host compaction backend)'
            : 'available'
        }.`,
      )

      const runtime = llm()
      if (runtime === undefined) {
        lines.push('', 'LLM service unavailable; explicit routes cannot be verified.')
        return lines.join('\n')
      }

      let providers = []
      try {
        providers = runtime.listProviders()
      } catch (error) {
        lines.push('', `Could not list providers: ${messageOf(error)}`)
        return lines.join('\n')
      }
      const filter = typeof args.provider === 'string' ? args.provider.trim() : ''
      const selected = filter === '' ? providers : providers.filter((entry) => entry.id === filter)
      lines.push('', 'Live provider routes:')
      if (selected.length === 0) {
        lines.push(
          filter === ''
            ? '(none registered — add one in Settings → Models)'
            : `(no provider "${filter}" registered)`,
        )
        return lines.join('\n')
      }
      for (const provider of selected) {
        lines.push(`- ${provider.id}${provider.name === undefined ? '' : ` — ${provider.name}`}`)
        if (args.include_models === false) continue
        try {
          const models = await runtime.listModels(provider.id)
          if (models.length === 0) continue
          const shown = models.slice(0, 15).map((model) => model.id)
          lines.push(
            `  models: ${shown.join(', ')}${models.length > shown.length ? `, … (${models.length - shown.length} more)` : ''}`,
          )
        } catch (error) {
          lines.push(`  models: unavailable (${messageOf(error)})`)
        }
      }
      return lines.join('\n')
    },
  })

  // ------------------------------------------------------------- HTTP bridge

  function sendJson(res, status, value) {
    const body = JSON.stringify(value)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-length': Buffer.byteLength(body),
    })
    res.end(body)
  }

  async function readJson(req) {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > 2 * 1024 * 1024) throw new Error('request body too large')
      chunks.push(chunk)
    }
    if (size === 0) return {}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  }

  function serializeTask(task) {
    const end = task.finishedAt ?? Date.now()
    const start = task.startedAt ?? task.createdAt
    return {
      id: task.id,
      role: task.role,
      summary: task.summary,
      status: task.status,
      route: task.routeLabel,
      executor: task.executorName ?? null,
      executorName: task.executorLabel ?? task.executorName ?? null,
      provider: task.provider ?? null,
      model: task.model ?? null,
      createdAt: task.createdAt,
      startedAt: task.startedAt ?? null,
      finishedAt: task.finishedAt ?? null,
      elapsedMs: Math.max(0, end - start),
      childId: task.childId ?? null,
      preview: task.resultText === undefined ? null : task.resultText.slice(0, 400),
      resultChars: task.resultText?.length ?? 0,
      error: task.error ?? null,
      stopReason: task.stopReason ?? null,
      followups: task.followups.length,
      rework: task.rework === true,
      reworkStartedAt: task.reworkStartedAt ?? null,
      contextPercent: task.stats?.percent ?? null,
      contextTokens: task.stats?.tokens ?? null,
      contextWindow: task.stats?.window ?? null,
      turnsSinceCompact: task.stats?.turnsSinceCompact ?? null,
      compactedAt: task.stats?.lastCompactedAt ?? null,
      compacted: task.stats?.compacted === true,
    }
  }

  function sessionTitleOf(sessionId) {
    const titleService = ctx.get('sessionTitle')
    const store = ctx.get('sessions')
    if (titleService === undefined || store === undefined) return null
    const session = store.get(sessionId)
    if (session === undefined) return null
    try {
      return titleService.get(session)?.title ?? null
    } catch {
      return null
    }
  }

  function boardView(sessionId) {
    const board = boards.get(sessionId)
    return {
      session: sessionId,
      title: sessionTitleOf(sessionId),
      maxConcurrent: config.maxConcurrent,
      updatedAt: Date.now(),
      executorStats: Object.fromEntries(executorStats),
      notifications: compactionNotice,
      tasks: board === undefined ? [] : boardTasks(board).map(serializeTask),
    }
  }

  function validateRoleState(value) {
    const next = normalizeRoleState(value, { executors: {}, allowAdHocRoutes: false })
    const rawExecutors =
      value !== null &&
      typeof value === 'object' &&
      value.executors !== null &&
      typeof value.executors === 'object' &&
      !Array.isArray(value.executors)
        ? value.executors
        : {}
    if (Object.keys(next.executors).length !== Object.keys(rawExecutors).length) {
      throw new Error('every executor needs a provider and a model')
    }
    const runtime = llm()
    const providerIds = new Set((runtime?.listProviders() ?? []).map((entry) => entry.id))
    if (next.lead !== null && providerIds.size > 0 && !providerIds.has(next.lead.provider)) {
      throw new Error(`lead provider "${next.lead.provider}" is not registered`)
    }
    for (const [id, entry] of Object.entries(next.executors)) {
      if (!/^[A-Za-z0-9._-]{1,40}$/.test(id)) {
        throw new Error(
          `executor id "${id}" must be 1-40 letters, digits, dot, underscore, or hyphen`,
        )
      }
      if (providerIds.size > 0 && !providerIds.has(entry.provider)) {
        throw new Error(`executor "${id}" provider "${entry.provider}" is not registered`)
      }
    }
    return next
  }

  async function handleHttp(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (req.method === 'GET' && url.pathname === '/conductor/roles') {
      const defaultModel = ctx.get('agentDefaultModel')
      let defaultSelection = null
      try {
        defaultSelection = defaultModel?.currentSelection() ?? null
      } catch {
        defaultSelection = null
      }
      return sendJson(res, 200, {
        ...roleState,
        defaultSelection,
        stats: Object.fromEntries(executorStats),
        notifications: compactionNotice,
      })
    }

    if (req.method === 'GET' && url.pathname === '/conductor/notifications') {
      return sendJson(res, 200, compactionNotice)
    }

    if (req.method === 'POST' && url.pathname === '/conductor/notifications/read') {
      let body
      try {
        body = await readJson(req)
      } catch (error) {
        return sendJson(res, 400, { error: messageOf(error) })
      }
      const target = typeof body.target === 'string' ? body.target : 'all'
      if (target === 'board' || target === 'all') {
        compactionNotice = { ...compactionNotice, boardUnread: false }
      }
      if (target === 'roles' || target === 'all') {
        compactionNotice = { ...compactionNotice, rolesUnread: false }
      }
      return sendJson(res, 200, { ok: true, ...compactionNotice })
    }

    if (req.method === 'POST' && url.pathname === '/conductor/roles') {
      let body
      try {
        body = await readJson(req)
      } catch (error) {
        return sendJson(res, 400, { error: messageOf(error) })
      }
      let next
      try {
        next = validateRoleState(body)
        writeRoleState(next)
      } catch (error) {
        return sendJson(res, 400, { error: messageOf(error) })
      }
      const before = roleState
      appendRoleAudit(before, next, 'http', logger)
      roleState = next
      return sendJson(res, 200, { ok: true, ...roleState })
    }

    if (req.method === 'GET' && url.pathname === '/conductor/roles/audit') {
      const rawLimit = Number(url.searchParams.get('limit') ?? 50)
      const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, Math.round(rawLimit))) : 50
      return sendJson(res, 200, { entries: readRoleAudit(limit) })
    }

    if (req.method === 'GET' && url.pathname === '/conductor/routes') {
      const runtime = llm()
      if (runtime === undefined) return sendJson(res, 200, { providers: [] })
      let providers = []
      try {
        providers = runtime.listProviders()
      } catch (error) {
        return sendJson(res, 503, { error: messageOf(error) })
      }
      const routes = []
      for (const provider of providers) {
        let models = []
        try {
          models = await runtime.listModels(provider.id)
        } catch {
          models = []
        }
        routes.push({
          id: provider.id,
          name: provider.name ?? provider.id,
          models: models.map((model) => ({ id: model.id, name: model.name ?? model.id })),
        })
      }
      return sendJson(res, 200, { providers: routes })
    }

    if (req.method === 'POST' && url.pathname === '/conductor/lead/apply') {
      let body
      try {
        body = await readJson(req)
      } catch (error) {
        return sendJson(res, 400, { error: messageOf(error) })
      }
      const provider = typeof body.provider === 'string' ? body.provider.trim() : ''
      const model = typeof body.model === 'string' ? body.model.trim() : ''
      const reasoningEffort =
        typeof body.reasoningEffort === 'string'
          ? body.reasoningEffort.trim()
          : typeof body.reasoning_effort === 'string'
            ? body.reasoning_effort.trim()
            : ''
      if (provider === '' || model === '') {
        return sendJson(res, 400, { error: 'provider and model are required' })
      }
      const runtime = llm()
      if (runtime !== undefined) {
        try {
          await runtime.resolveCallConfig({
            provider,
            model,
            ...(reasoningEffort === '' ? {} : { reasoningEffort }),
          })
        } catch (error) {
          return sendJson(res, 409, { error: messageOf(error) })
        }
      }
      const defaultModel = ctx.get('agentDefaultModel')
      if (defaultModel === undefined) {
        return sendJson(res, 409, { error: 'the default model service is unavailable' })
      }
      try {
        await defaultModel.saveSelection({
          provider,
          model,
          ...(reasoningEffort === '' ? {} : { reasoningEffort }),
        })
      } catch (error) {
        return sendJson(res, 409, { error: messageOf(error) })
      }
      const before = roleState
      roleState = {
        ...roleState,
        lead: { provider, model, ...(reasoningEffort === '' ? {} : { reasoningEffort }) },
      }
      writeRoleState(roleState)
      appendRoleAudit(before, roleState, 'http', logger)
      return sendJson(res, 200, { ok: true, lead: roleState.lead })
    }

    if (req.method === 'GET' && url.pathname === '/conductor/export') {
      const sessions = [...boards.values()].map((board) => ({
        session: board.parent.id,
        title: sessionTitleOf(board.parent.id),
        tasks: boardTasks(board).map((task) => ({
          ...serializeTask(task),
          result: task.resultText ?? null,
          followupsList: task.followups,
          stats: task.stats ?? null,
          compactionPercent: task.compactionPercent ?? null,
        })),
      }))
      return sendJson(res, 200, {
        version: 1,
        exportedAt: Date.now(),
        sessions,
        executorStats: Object.fromEntries(executorStats),
      })
    }

    if (req.method === 'POST' && url.pathname === '/conductor/import') {
      let body
      try {
        body = await readJson(req)
      } catch (error) {
        return sendJson(res, 400, { error: messageOf(error) })
      }
      const agents = ctx.get('agents')
      if (agents === undefined) {
        return sendJson(res, 503, { error: 'agent registry is unavailable' })
      }
      const restored = []
      const skipped = []
      const entries = Array.isArray(body.sessions) ? body.sessions : []
      for (const entry of entries) {
        const parent =
          entry !== null && typeof entry.session === 'string' ? agents.get(entry.session) : undefined
        if (parent === undefined) {
          skipped.push({ session: entry?.session ?? null, reason: 'session-not-live' })
          continue
        }
        const board = boardFor(parent)
        const tasks = Array.isArray(entry.tasks) ? entry.tasks : []
        for (let index = 0; index < tasks.length; index += 1) {
          const snapshot = tasks[index]
          if (
            snapshot === null ||
            typeof snapshot !== 'object' ||
            typeof snapshot.id !== 'string'
          ) {
            skipped.push({ session: parent.id, reason: 'invalid-task' })
            continue
          }
          if (!TERMINAL.has(snapshot.status)) {
            skipped.push({ session: parent.id, task: snapshot.id, reason: 'not-terminal' })
            continue
          }
          if (board.tasks.has(snapshot.id)) {
            skipped.push({ session: parent.id, task: snapshot.id, reason: 'already-present' })
            continue
          }
          const task = restoreTask(board, snapshot, index)
          restored.push({ session: parent.id, task: task.id })
        }
      }
      if (body.executorStats !== null && typeof body.executorStats === 'object') {
        for (const [id, stat] of Object.entries(body.executorStats)) {
          if (stat !== null && typeof stat === 'object') executorStats.set(id, stat)
        }
      }
      return sendJson(res, 200, { ok: true, restored, skipped })
    }

    if (req.method === 'GET' && url.pathname === '/conductor/boards') {
      const sessions = [...boards.values()]
        .map((board) => ({
          session: board.parent.id,
          title: sessionTitleOf(board.parent.id),
          tasks: boardTasks(board).map(serializeTask),
        }))
        .filter((entry) => entry.tasks.length > 0)
        .sort((a, b) => {
          const left = a.tasks[a.tasks.length - 1]?.createdAt ?? 0
          const right = b.tasks[b.tasks.length - 1]?.createdAt ?? 0
          return right - left
        })
      return sendJson(res, 200, {
        updatedAt: Date.now(),
        maxConcurrent: config.maxConcurrent,
        executorStats: Object.fromEntries(executorStats),
        notifications: compactionNotice,
        sessions,
      })
    }

    if (req.method === 'GET' && url.pathname === '/conductor/board') {
      const sessionId = url.searchParams.get('session') ?? ''
      if (sessionId === '') return sendJson(res, 400, { error: 'session is required' })
      return sendJson(res, 200, boardView(sessionId))
    }

    if (req.method === 'GET' && url.pathname === '/conductor/result') {
      const sessionId = url.searchParams.get('session') ?? ''
      const taskId = (url.searchParams.get('task') ?? '').trim().toUpperCase()
      const task = boards.get(sessionId)?.tasks.get(taskId)
      if (task === undefined) return sendJson(res, 404, { error: 'unknown task' })
      return sendJson(res, 200, {
        ok: true,
        task: {
          ...serializeTask(task),
          result: task.resultText === undefined ? null : task.resultText.slice(0, 200000),
          structured: task.structured ?? null,
          followupLog: task.followups.map((entry) => ({
            message: entry.message.slice(0, 2000),
            at: entry.at,
          })),
        },
      })
    }

    if (req.method === 'POST' && url.pathname === '/conductor/action') {
      let body
      try {
        body = await readJson(req)
      } catch (error) {
        return sendJson(res, 400, { error: messageOf(error) })
      }
      const sessionId = typeof body.session === 'string' ? body.session : ''
      const taskId = typeof body.task === 'string' ? body.task.trim().toUpperCase() : ''
      const task = boards.get(sessionId)?.tasks.get(taskId)
      if (task === undefined) return sendJson(res, 404, { error: 'unknown task' })
      try {
        if (body.action === 'cancel') {
          return sendJson(res, 200, { ok: true, ...(await cancelTask(task)) })
        }
        if (body.action === 'followup') {
          const message = typeof body.message === 'string' ? body.message.trim() : ''
          if (message === '') return sendJson(res, 400, { error: 'message is required' })
          const childId = await deliverFollowup(task, message, new AbortController().signal)
          return sendJson(res, 200, { ok: true, childId, status: task.status })
        }
        return sendJson(res, 400, { error: 'unknown action' })
      } catch (error) {
        return sendJson(res, 409, { error: messageOf(error) })
      }
    }

    return sendJson(res, 404, { error: 'not found' })
  }

  ctx.inject(['webServer'], (webCtx) => {
    const server = webCtx.webServer
    webCtx.effect(() =>
      server.register({
        kind: 'prefix',
        path: '/conductor',
        handler: (req, res) => {
          void handleHttp(req, res).catch((error) => {
            logger?.warn?.(`conductor: request failed: ${messageOf(error)}`)
            if (!res.headersSent) sendJson(res, 500, { error: 'internal error' })
            else res.end()
          })
        },
      }),
    )
  })

  // ----------------------------------------------------------- system prompt

  installGuide(ctx, logger)

  // ------------------------------------------------------------------ teardown

  ctx.effect(() => () => shutdown())

  async function shutdown() {
    for (const board of boards.values()) {
      if (board.capacityTimer !== undefined) clearTimeout(board.capacityTimer)
      for (const task of board.tasks.values()) {
        task.cancelRequested = true
        task.controller.abort(new Error('conductor unloaded'))
        await disposeTask(task)
      }
    }
    boards.clear()
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        // Best-effort during unload.
      }
    }
  }
}

// --------------------------------------------------------------------- helpers

function installGuide(ctx, logger) {
  const systemPrompt = ctx.get('systemPrompt')
  if (systemPrompt === undefined) return
  let order
  try {
    order = systemPrompt.getSectionOrder('TOOL_SUBAGENT')
  } catch {
    order = undefined
  }
  if (typeof order !== 'number') return
  try {
    const dispose = systemPrompt.section({
      name: 'tool:conductor',
      order: order + 1,
      text: 'Conductor is available. For substantial implementation work, prefer routing it to executor models with `dispatch_tasks` instead of writing it all in this conversation: you keep decomposition, review, and integration. Assign each task to a user-configured executor role (`executor` from `list_executors`); the user owns the role-to-model mapping, so never invent provider/model routes unless the user enabled ad-hoc routes. Give every task a standalone role, context, acceptance criteria, and return format; send independent tasks together, then `wait_tasks`. Review each report against its criteria and use `task_followup` for corrections.',
    })
    if (typeof dispose === 'function') ctx.effect(() => dispose)
  } catch (error) {
    logger?.warn?.(`conductor: could not add the system prompt section: ${String(error)}`)
  }
}

function resolveConfig(raw) {
  const input = raw !== null && typeof raw === 'object' ? raw : {}
  const executors = {}
  const rawExecutors =
    input.executors !== null && typeof input.executors === 'object' ? input.executors : {}
  for (const [name, value] of Object.entries(rawExecutors)) {
    if (value === null || typeof value !== 'object') continue
    const provider = typeof value.provider === 'string' ? value.provider.trim() : ''
    const model = typeof value.model === 'string' ? value.model.trim() : ''
    if (provider === '' || model === '') continue
    const reasoningEffort =
      typeof value.reasoning_effort === 'string'
        ? value.reasoning_effort.trim()
        : typeof value.reasoningEffort === 'string'
          ? value.reasoningEffort.trim()
          : ''
    const description = typeof value.description === 'string' ? value.description.trim() : ''
    executors[name] = {
      provider,
      model,
      ...(reasoningEffort === '' ? {} : { reasoningEffort }),
      ...(description === '' ? {} : { description }),
    }
  }
  const maxWaitSeconds = clampNumber(input.maxWaitSeconds, DEFAULTS.maxWaitSeconds, 10, 3600)
  return {
    provider: typeof input.provider === 'string' && input.provider.trim() !== ''
      ? input.provider.trim()
      : DEFAULTS.provider,
    maxConcurrent: clampNumber(input.maxConcurrent, DEFAULTS.maxConcurrent, 1, 16),
    defaultWaitSeconds: clampNumber(
      input.defaultWaitSeconds,
      DEFAULTS.defaultWaitSeconds,
      0,
      maxWaitSeconds,
    ),
    maxWaitSeconds,
    maxCharsPerResult: clampNumber(
      input.maxCharsPerResult,
      DEFAULTS.maxCharsPerResult,
      500,
      100000,
    ),
    contextCompactionPercent: clampNumber(
      input.contextCompactionPercent,
      DEFAULTS.contextCompactionPercent,
      10,
      95,
    ),
    contextWindowTokens: clampNumber(
      input.contextWindowTokens,
      DEFAULTS.contextWindowTokens,
      1000,
      2000000,
    ),
    contextWindowMax: clampNumber(
      input.contextWindowMax,
      DEFAULTS.contextWindowMax,
      0,
      2000000,
    ),
    compactionTimeoutMs: clampNumber(
      input.compactionTimeoutMs,
      DEFAULTS.compactionTimeoutMs,
      1000,
      120000,
    ),
    executors,
    allowAdHocRoutes: input.allowAdHocRoutes === true,
  }
}

function clampNumber(value, fallback, min, max) {
  const number = typeof value === 'number' ? value : Number.NaN
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function rolesFilePath() {
  const home =
    typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== ''
      ? process.env.DSH_HOME
      : join(homedir(), '.dsh')
  return join(home, 'conductor', 'roles.json')
}

function roleAuditFilePath() {
  const home =
    typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== ''
      ? process.env.DSH_HOME
      : join(homedir(), '.dsh')
  return join(home, 'conductor', 'role-audit.jsonl')
}

function roleChanges(before, after) {
  const changes = []
  const fields = [
    'provider',
    'model',
    'name',
    'description',
    'reasoningEffort',
    'contextCompactionPercent',
  ]
  const ids = new Set([
    ...Object.keys(before.executors ?? {}),
    ...Object.keys(after.executors ?? {}),
  ])
  for (const id of ids) {
    const left = before.executors?.[id]
    const right = after.executors?.[id]
    if (left === undefined || right === undefined) {
      changes.push({ scope: 'executor', executor: id, field: '*', from: left ?? null, to: right ?? null })
      continue
    }
    for (const field of fields) {
      if (JSON.stringify(left[field]) !== JSON.stringify(right[field])) {
        changes.push({
          scope: 'executor',
          executor: id,
          field,
          from: left[field] ?? null,
          to: right[field] ?? null,
        })
      }
    }
  }
  for (const field of ['provider', 'model', 'reasoningEffort']) {
    if (JSON.stringify(before.lead?.[field]) !== JSON.stringify(after.lead?.[field])) {
      changes.push({
        scope: 'lead',
        field,
        from: before.lead?.[field] ?? null,
        to: after.lead?.[field] ?? null,
      })
    }
  }
  if (before.allowAdHocRoutes !== after.allowAdHocRoutes) {
    changes.push({
      scope: 'policy',
      field: 'allowAdHocRoutes',
      from: before.allowAdHocRoutes ?? null,
      to: after.allowAdHocRoutes ?? null,
    })
  }
  return changes
}

function appendRoleAudit(before, after, source, logger) {
  try {
    const changes = roleChanges(before, after)
    if (changes.length === 0) return
    const file = roleAuditFilePath()
    mkdirSync(dirname(file), { recursive: true })
    const entry = {
      at: Date.now(),
      source,
      lead: after.lead ?? null,
      allowAdHocRoutes: after.allowAdHocRoutes === true,
      changes,
    }
    appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8')
  } catch (error) {
    logger?.warn?.(`conductor: could not append role audit: ${String(error)}`)
  }
}

function readRoleAudit(limit) {
  const file = roleAuditFilePath()
  if (!existsSync(file)) return []
  try {
    const lines = readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean)
    return lines.slice(-limit).map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    }).filter((entry) => entry !== null)
  } catch {
    return []
  }
}

function normalizeRoleState(raw, seed) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const executors = {}
  const executorSource =
    source.executors !== null &&
    typeof source.executors === 'object' &&
    !Array.isArray(source.executors)
      ? source.executors
      : seed.executors
  for (const [id, value] of Object.entries(executorSource)) {
    if (typeof id !== 'string' || id === '') continue
    if (value === null || typeof value !== 'object') continue
    const provider = typeof value.provider === 'string' ? value.provider.trim() : ''
    const model = typeof value.model === 'string' ? value.model.trim() : ''
    if (provider === '' || model === '') continue
    const name = typeof value.name === 'string' ? value.name.trim() : ''
    const description = typeof value.description === 'string' ? value.description.trim() : ''
    const reasoningEffort =
      typeof value.reasoningEffort === 'string'
        ? value.reasoningEffort.trim()
        : typeof value.reasoning_effort === 'string'
          ? value.reasoning_effort.trim()
          : ''
    const rawThreshold = value.contextCompactionPercent
    const thresholdNumber =
      typeof rawThreshold === 'string' && rawThreshold.trim() !== ''
        ? Number(rawThreshold)
        : rawThreshold
    const contextCompactionPercent =
      typeof thresholdNumber === 'number' && Number.isFinite(thresholdNumber)
        ? Math.min(95, Math.max(10, Math.round(thresholdNumber)))
        : undefined
    executors[id] = {
      provider,
      model,
      ...(name === '' ? {} : { name }),
      ...(description === '' ? {} : { description }),
      ...(reasoningEffort === '' ? {} : { reasoningEffort }),
      ...(contextCompactionPercent === undefined ? {} : { contextCompactionPercent }),
    }
  }
  let lead
  if (source.lead !== null && typeof source.lead === 'object') {
    const provider = typeof source.lead.provider === 'string' ? source.lead.provider.trim() : ''
    const model = typeof source.lead.model === 'string' ? source.lead.model.trim() : ''
    const reasoningEffort =
      typeof source.lead.reasoningEffort === 'string'
        ? source.lead.reasoningEffort.trim()
        : typeof source.lead.reasoning_effort === 'string'
          ? source.lead.reasoning_effort.trim()
          : ''
    if (provider !== '' && model !== '') {
      lead = {
        provider,
        model,
        ...(reasoningEffort === '' ? {} : { reasoningEffort }),
      }
    }
  }
  return {
    lead: lead ?? null,
    executors,
    allowAdHocRoutes:
      typeof source.allowAdHocRoutes === 'boolean'
        ? source.allowAdHocRoutes
        : seed.allowAdHocRoutes === true,
  }
}

function readRoleState(seed, logger) {
  const file = rolesFilePath()
  if (existsSync(file)) {
    try {
      return normalizeRoleState(JSON.parse(readFileSync(file, 'utf8')), seed)
    } catch (error) {
      logger?.warn?.(`conductor: could not read ${file}: ${String(error)}`)
    }
  }
  return normalizeRoleState(
    { executors: seed.executors, allowAdHocRoutes: seed.allowAdHocRoutes },
    seed,
  )
}

function writeRoleState(state) {
  const file = rolesFilePath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify({ version: 1, ...state }, null, 2), 'utf8')
}
