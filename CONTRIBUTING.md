# Contributing

Thanks for considering a contribution. Conductor is a small, dependency-free pair of DSH bundles;
please keep changes focused and easy to review.

## Development setup

- Node.js 20+.
- DeepSeek Harness `0.2.1-rc.2` or newer for manual testing.
- No package installation or build step is required for the plugin code itself.

```sh
npm run check
npm test
```

`npm test` runs the Host plugin against a fake `ctx`; it does not call a real model.

## Manual testing

1. Install the bundles from your checkout (Plugin Manager → install bundle, or `dsh plugin install`).
2. Configure at least one provider in Settings → Models.
3. Add one executor role in **Tasks → Executors & publisher**.
4. Dispatch a trivial task and confirm the report returns to the lead.

## Code guidelines

- `dsh-conductor/index.js` is plain ESM. It must not import `@deepseek-ai/*` packages; reach harness
  capabilities through `ctx`.
- `dsh-conductor-ui/client.js` is a plain browser bundle. It may `require('react')` only; do not
  import Harness Client packages. Use `--dsw-alias-*` theme tokens for styling.
- Keep user-visible strings in the locale dictionaries (`zh` and `en`).
- Do not commit provider keys, credentials, `roles.json`, session logs, or machine-specific paths.
- Update both READMEs when behavior or installation changes, and add an entry to `CHANGELOG.md`.

## Pull requests

- Describe the user-visible change and the verification you ran.
- Include a test when the Host logic changes in a way the smoke test can cover.
- Keep unrelated refactors out of the same PR.
