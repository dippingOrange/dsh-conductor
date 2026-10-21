# Changelog

All notable changes to this project are documented here. The project follows
[Semantic Versioning](https://semver.org/).

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
