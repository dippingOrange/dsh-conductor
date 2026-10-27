/**
 * Session-scoped Conductor preset plugin.
 *
 * The Host half owns the task board, roles, HTTP API, and task lifecycle. This
 * preset plugin registers the model-facing tools and prompt section in the
 * calling agent's scope, so Conductor is only visible to sessions using the
 * `conductor` preset. Sessions on `ptc` keep their native subagent tools.
 */

export const name = 'conductor-preset'

export const inject = ['conductor', 'tools', 'systemPrompt']

export function apply(ctx) {
  const runtime = ctx.conductor
  if (runtime === undefined) return
  runtime.registerTools(ctx)
  runtime.registerPrompt(ctx)
}
