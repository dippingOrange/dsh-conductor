# Changelog

All notable changes to this project are documented here. The project follows
[Semantic Versioning](https://semver.org/).

## [2.0.1] - 2026-10-27

### Fixed

- The `conductor` preset now injects the scoped `tools` and `systemPrompt` services before
  registering the Conductor tools and prompt section, so its composition is valid and the preset
  appears in the mode picker.
- Give the preset a unique order (5) and a display name instead of colliding with Minimal mode.

## [2.0.0] - 2026-10-27

### Changed

- Conductor is now session-scoped through a `conductor` agent preset. The Host half owns the task
  board, roles, HTTP API, and lifecycle; the new `@dippingorange/dsh-conductor/preset` plugin
  registers the tools and prompt section only inside that preset.
- `ptc` keeps its native `subagent` / `subagent_fork` tools; the global preset override that disabled
  them is removed. Sessions that need Conductor choose the `conductor` preset.
- Task cards are capped in height and scroll internally; running task duration is computed from the
  device clock and refreshed every second.

### Breaking

- Existing `ptc` sessions keep their old revision and no longer receive Conductor tools after the
  plugin reload. New work that needs Conductor must select the `conductor` preset.

## [1.0.13] - 2026-10-22

### Changed

- Disabled the native `subagent` / `subagent_fork` spawn tools in the `ptc` preset while keeping
  `list_agents` for diagnostics. Conductor's `dispatch_tasks`, follow-ups, and the
  `maxActiveSubagents: 5` safety cap are unchanged.
- The publisher system prompt now explicitly forbids native subagents and requires all delegation
  to go through `dispatch_tasks` with a configured executor role.

## [1.0.12] - 2026-10-22

### Changed

- Publisher task guidance now prefers file paths over large pasted context: pass repository detail
  through `files` and a short `context` summary, and put durable detail in a file the executor can
  read. The `context` schema, `dispatch_tasks` description, and system prompt say this explicitly.

## [1.0.11] - 2026-10-22

### Fixed

- Executor completions now reach the publisher as a model-facing subagent notice (`delivery:
  'parent'`). Previously the plugin collected the result itself (`delivery: 'caller'`), so a
  publisher that replied to the user immediately could miss the completion entirely. The system
  prompt and `dispatch_tasks` description now tell the lead not to claim completion early and to
  relay the notice when it arrives.

## [1.0.10] - 2026-10-22

### Changed

- Tightened the executor prompt: executors execute and report facts; they must not return whole
  files, full diffs, or generated artifacts, and must not give recommendations, priorities, or
  next-step suggestions. The lead owns decisions. Reports keep the key facts (status, changed
  paths, verification, acceptance, blockers) and may close with a concise conclusion.

## [1.0.9] - 2026-10-22

### Fixed

- `task_followup` now marks a terminal task as `running`/reworking and starts a watcher that
  returns it to `completed` when the child becomes inactive. The board finally shows an active
  rework instead of leaving it in the completed column.
- Executors that stop with `max-tokens` or complete without a closing report now produce a visible
  task error instead of an empty preview with `error: null`. The prompt also tells executors to
  write large SVGs/HTML/code to files and keep the final report short.

### Added

- `GET /conductor/export` and `POST /conductor/import` for snapshotting and restoring terminal
  tasks after a plugin reload. Restored tasks keep their reports, child ids, follow-up count, and
  context stats; active tasks are skipped.
- A rework badge in the task card.

## [1.0.8] - 2026-10-22

### Fixed

- `dispatch_tasks` now rejects `inherit: true` under the default roles-only policy. The publisher
  can no longer route a task onto its own provider/model unless the user explicitly enables ad-hoc
  routes.
- Role changes are appended to `$DSH_HOME/conductor/role-audit.jsonl` with the changed executor
  fields, lead, policy, timestamp, and source; `GET /conductor/roles/audit` exposes the recent
  entries. This makes future provider/model changes traceable.

### Changed

- Added a global `maxActiveSubagents: 5` cap in the bundle patch, covering Conductor tasks and any
  native subagent the publisher opens. Conductor itself still runs at most four children at once.

## [1.0.7] - 2026-10-21

### Changed

- Lowered the default executor compaction threshold to **40%** of the model context window, based
  on the observed DeepSeek quality drop after roughly 40%. The threshold is now editable per
  executor role, so non-DeepSeek roles can keep a higher value.

## [1.0.6] - 2026-10-21

### Added

- Per-executor context accounting: the last task's context usage percentage and the number of
  turns since the last compaction, shown in the roles editor and task cards.
- Automatic context compaction after a task settles when the last request used at least 60% of the
  executor's model context window. The executor's session is resumed, compacted with the Host
  compaction service, and released; new tasks still start from a fresh child, preserving isolation.
- Green unread dots on the left **Tasks** icon and the **Executors & publisher** tab after a
  compaction; opening the corresponding view clears them.
- `contextCompactionPercent`, `contextWindowTokens`, `contextWindowMax`, and `compactionTimeoutMs`
  config keys. The bundle enables the host compaction backend so `/compact` is available.

## [1.0.5] - 2026-10-21

### Changed

- Published on npm as `@dippingorange/dsh-conductor` and `@dippingorange/dsh-conductor-ui`.
- Added `engines.dsh`, `publishConfig`, and a per-package MIT `LICENSE` for registry consumers.
- Installation docs now use the npm package names; the local checkout remains supported for
  development.

## [1.0.4] - 2026-10-21

### Changed

- The session selector and task cards now show the session title instead of the raw session id;
  the full id remains available as a tooltip.

## [1.0.3] - 2026-10-21

### Changed

- The executor-added confirmation now appears next to the **Add executor** button, and adding a role
  immediately confirms that it still needs to be saved.

## [1.0.2] - 2026-10-21

### Changed

- Replaced the inline composer dock with a right-sidebar task-board tab opened from a composer
  toolbar icon. The activity and usage rows now keep their own line instead of sharing it with a
  large board card.

### Fixed

- The session dock now resolves the current session through `useSession` when the slot does not
  provide a direct `sessionId` prop.
- `/conductor/*` routes now wait for the Web server before registering, so the task-board API
  survives a Harness restart.

## [1.0.1] - 2026-10-21

### Changed

- Moved the session task dock from above the composer to the composer's ambient dock,
  after the activity and usage rows. The input box and its parameters now sit above the
  board, and the board inherits the composer column's width for alignment.

## [1.0.0] - 2026-10-21

### Added

- Host plugin with `dispatch_tasks`, `wait_tasks`, `task_result`, `task_followup`, `cancel_task`,
  and `list_executors`.
- Real DSH child agents per task, with caller-delivery result collection and slot release.
- Persistent executor roles and publisher selection at `$DSH_HOME/conductor/roles.json`.
- Roles-only routing by default, with an opt-in ad-hoc provider/model policy.
- Web task board: per-session dock, full-page board, and an Executors & publisher editor.
- Same-origin `/conductor/*` HTTP bridge for board data, reports, roles, routes, and actions.
- Host smoke test and repository checks.
