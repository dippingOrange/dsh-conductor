# Conductor for DeepSeek Harness

Multi-model task dispatch for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): keep the
flagship model on decomposition, review, and integration, and route implementation work to
user-configured executor roles. Each task runs as a real DSH child agent with the full toolset,
so it can read code, edit files, run tests, and report back.

The project ships two DSH bundles:

- **`dsh-conductor`** — Host plugin: `dispatch_tasks`, `wait_tasks`, `task_result`, `task_followup`,
  `cancel_task`, `list_executors`; role persistence; same-origin HTTP bridge for the UI.
- **`dsh-conductor-ui`** — Web UI: a composer-toolbar launcher, a right-sidebar task-board tab, a
  full native task-board page, and an **Executors & publisher** editor.

## Why

Manually copying work between a strong planning model and cheaper execution models is slow and
error-prone. Conductor keeps the lead in the conversation while executors do the work, and it lets
the **user** — not the model — decide which model each role uses.

- Roles-only routing by default: the flagship may only dispatch to configured roles; it cannot
  invent provider/model routes.
- The publisher (flagship) is chosen explicitly and can be applied as DSH's default model for new
  sessions.
- Results are collected by the lead (`wait_tasks`), reviewed against acceptance criteria, and
  corrected through `task_followup` — the executor keeps its prior conversation.
- The full task board lives in the DSH Web UI as a native panel (no iframe, no separate server).

## Features

- Dispatch one or many tasks, with role, context, constraints, acceptance criteria, and a required
  return format.
- Fixed executor roles: `id + name + provider + model + description`, editable in the Web UI.
- Persistent roles at `$DSH_HOME/conductor/roles.json` (no API keys in this file).
- Strict roles-only routing: `inherit: true` and ad-hoc provider/model routes are rejected unless the
  user explicitly enables ad-hoc routes. Role changes are audited to
  `$DSH_HOME/conductor/role-audit.jsonl` and exposed by `GET /conductor/roles/audit`.
- A global cap of 5 live subagent activations, covering Conductor tasks and native subagents.
- A per-session right-sidebar board opened from the composer toolbar, plus a global full-page board
  with active/done/failed columns.
- Per-executor context accounting: usage percentage, turns since the last compaction, and automatic
  compaction at 40% of the model context window after a task settles. New tasks still start fresh,
  so task isolation is preserved. Each role can override the threshold.
- Green unread badges on the Tasks icon and the Executors tab after a compaction.
- Follow-ups are shown as **reworking/running** in the board and return to completed when the child
  is inactive.
- Board snapshot/restore: `GET /conductor/export` and `POST /conductor/import` preserve terminal
  tasks and reports across a plugin reload.
- Executor failures such as `max-tokens` or an empty closing report are surfaced as task errors.
- Cancel, follow up, and inspect full reports from the UI or from the model's tools.
- No build step, no npm runtime dependencies; the UI uses only the browser React module table.

## Requirements

- DeepSeek Harness (tested with `0.2.1-rc.2`).
- At least one model provider configured in **Settings → Models**, with credentials stored by DSH.
- A DSH profile that can install local bundles (the default Desktop profile can).

## Install

Install both bundles from npm, using DSH's Plugin Manager
(**Settings → Plugins → install bundle**) or the CLI:

```sh
dsh plugin install @dippingorange/dsh-conductor
dsh plugin install @dippingorange/dsh-conductor-ui
```

For local development, install the checkout instead:

```sh
git clone https://github.com/dippingOrange/dsh-conductor.git
dsh plugin install /path/to/dsh-conductor/dsh-conductor
dsh plugin install /path/to/dsh-conductor/dsh-conductor-ui
```

Refresh the Web UI once after installing. Both plugins can be enabled or disabled independently.

## Context budget and compaction

Executor tasks remain isolated: every `dispatch_tasks` call starts a new child, so a new task never
inherits another task's context. The only reused context is `task_followup`.

After a task settles (including a follow-up), Conductor reads the child's last request usage and
model context window. If usage is at least **40%** (the default tuned for DeepSeek's observed
quality drop), it resumes the child session, calls the Host
compaction service (the same backend as `/compact`), records the post-compaction usage, and
releases the session. The next follow-up cold-resumes the compacted history. A new task starts from
a fresh child and therefore has no context to compact.

Each executor's latest task reports its context percentage and turns since the last compaction in
**Executors & publisher** and on the task card. A successful compaction sets a green unread dot on
the left **Tasks** icon and on the **Executors & publisher** tab; opening those views clears it.

Config keys:

| Key | Default | Meaning |
|---|---|---|
| `contextCompactionPercent` | `40` | Compact when the last request used this percentage of the window; a role can override it |
| `contextWindowTokens` | `128000` | Fallback when the provider reports no context window |
| `contextWindowMax` | `0` | Optional cap for percentage calculations; `0` uses the reported window |
| `compactionTimeoutMs` | `30000` | Abort a compaction attempt after this long |

The bundle re-enables the host compaction backend (`compaction-basic` / `command-compact`), because
the Web app leaves it to presets by default. That also makes `/compact` available for normal chat.

## Configure

1. **Settings → Models** — add the providers you want to use (OpenAI-compatible relay,
   Anthropic-compatible relay, OpenCode Zen, Command Code, or a self-hosted vLLM/Ollama endpoint).
2. Open the **Tasks** panel from the left sidebar, or click the `▦` button at the left of the
   composer toolbar.
3. Switch to **Executors & publisher**:
   - choose the publisher (flagship) model;
   - add executor roles and fix each role's provider/model;
   - leave **Allow ad-hoc provider/model** off to keep routing roles-only;
   - save.
4. Ask the flagship to dispatch work by role, for example:

   > Split this feature by module. Implement with `coder`, review with `reviewer`, and give every
   > task acceptance criteria and a return format. Collect the reports and check them.

## How it works

```
user ──chat──▶ flagship (publisher)
                 │ dispatch_tasks(role + task + acceptance + return format)
                 ▼
        ┌────────┴────────┐
        │ executor role A │  real DSH child agent (tools, cwd, permissions)
        │ executor role B │  fixed provider/model chosen by the user
        └────────┬────────┘
                 │ report
                 ▼
            flagship reviews and may task_followup
```

- Children are started with `delivery: 'caller'`, so the lead owns result aggregation instead of
  receiving one chat notice per child.
- Completed children free their activation slot; `task_followup` cold-resumes the same session.
- The Web UI talks to the Host over same-origin `/conductor/*` endpoints.

## Security

- The `/conductor/*` endpoints are same-origin and unauthenticated, like the rest of the local DSH
  Web UI. **Do not expose the DSH Web port to an untrusted network.**
- Provider API keys live in DSH's credential store; `roles.json` contains only provider/model
  choices and display names.
- Task reports may contain code and file paths from the workspace; the board is only as private as
  the DSH Web UI it runs in.
- See [SECURITY.md](./SECURITY.md) for reporting vulnerabilities.

## Repository layout

```
dsh-conductor/      Host plugin: tools, role store, HTTP bridge
dsh-conductor-ui/   Client bundle: toolbar launcher, right-sidebar board, full page, roles editor
```

## Development

No build step is required. Node.js 20+ is enough for the checks:

```sh
npm run check   # syntax-check Host and Client bundles
npm test        # Host plugin smoke test with a fake context
```

Guidelines are in [CONTRIBUTING.md](./CONTRIBUTING.md). The detailed Chinese documentation lives in
[`dsh-conductor/README.md`](./dsh-conductor/README.md) and
[`dsh-conductor-ui/README.md`](./dsh-conductor-ui/README.md).

## License

MIT — see [LICENSE](./LICENSE).
