# Changelog

All notable changes to this project are documented here. The project follows
[Semantic Versioning](https://semver.org/).

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
