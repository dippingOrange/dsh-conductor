# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's **Security → Advisories →
Report a vulnerability** flow for this repository. Do not open a public issue for a vulnerability.

Include the affected version/commit, a minimal reproduction, and the impact you observed.

## Threat model

Conductor is a local DSH plugin:

- The Host exposes `/conductor/*` on the same origin as the DSH Web UI. It has no authentication of
  its own and relies on the Web UI's access boundary. **Do not expose the DSH Web port to an
  untrusted network.**
- The endpoints can read task reports and cancel/follow up tasks for any live DSH session. Treat
  the DSH Web UI itself as the trust boundary.
- Provider credentials stay in DSH's credential store. Conductor never reads or stores API keys;
  `$DSH_HOME/conductor/roles.json` contains provider/model choices, names, and descriptions only.
- Executors are real DSH agents and inherit the session's workspace and permission scope. Review the
  permission preset you run DSH with before delegating destructive work.

## Supported versions

The latest commit on `main` and the most recent tagged release receive security fixes.
