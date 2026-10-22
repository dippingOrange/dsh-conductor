# Changelog

All notable changes to this project are documented here. The project follows
[Semantic Versioning](https://semver.org/).

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
