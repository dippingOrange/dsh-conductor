# Changelog

All notable changes to this project are documented here. The project follows
[Semantic Versioning](https://semver.org/).

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
