# platform-workflows

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/licorsy/platform-workflows/badge)](https://securityscorecards.dev/viewer/?uri=github.com/licorsy/platform-workflows)

Platform-level CI/CD and workflow automation for licorsy repos.

Branch taxonomy: `develop` -> `staging` -> `main` (see [git-governance](https://github.com/licorsy/git-governance)).

License: MIT.

## Reusable workflows

**Availability.** `uses: ...@v1` resolves to whatever the floating `v1` tag points at, which
is **not** automatically the tip of `main` — it moves only when a promotion explicitly cuts a
release and re-points it. As of 2026-08-07 `v1` is at `v1.3.0` and carries all five reusable
workflows documented below, including `governance-compliance.yml` and `release-integrity.yml`;
`release-integrity.yml` itself now checks this on a schedule and would report if `v1` ever fell
behind `main` again.

Call these at **job level** (`jobs.<id>.uses: ...`) — they are `workflow_call` reusable
workflows, not composite actions, so they cannot be invoked as a step inside another job.

### `ci-docs.yml`

Runs [docs-governance](https://github.com/licorsy/docs-governance) against the caller repo.

```yaml
jobs:
  ci-docs:
    uses: licorsy/platform-workflows/.github/workflows/ci-docs.yml@v1
    with:
      base-sha: ${{ github.event.pull_request.base.sha }}
```

Callers only need this job if they use `.docgov.config.js`. Don't gate it with
`if: hashFiles(...)` — `hashFiles()` is not a recognized function in a job-level `if:`
condition (only inside steps, after checkout), and using it there breaks the entire
caller workflow's parsing. If you need a conditional call, gate on something evaluable
at job level instead (e.g. a repo variable or `github.event` field).

### `ci-security.yml`

Two jobs: `dependency-review` (gated to PRs targeting `staging`/`main`) and `secret-scanning`
via [gitleaks](https://github.com/gitleaks/gitleaks-action).

`GITLEAKS_LICENSE` is **optional and organization-level**: `gitleaks-action` runs without it,
with reduced functionality, so no caller is blocked by its absence. For an organization-owned
repo it's worth getting a free key at [gitleaks.io](https://gitleaks.io) and setting it once as
an org-level `GITLEAKS_LICENSE` secret — personal-account repos don't need one at all. Pass it
through with `secrets: inherit` so every caller picks it up without repeating the key per repo.
This is the description other repos' `pr-checks.yml`/`ci-security.yml` comments point back to.

```yaml
jobs:
  ci-security:
    uses: licorsy/platform-workflows/.github/workflows/ci-security.yml@v1
    secrets: inherit
```

### `governance-compliance.yml`

Checks that the caller carries the six artifacts that define "compliant" in
[licorsy/.github](https://github.com/licorsy/.github)'s `docs/org-governance-adoption.md`:
`AGENTS.md`, `CLAUDE.md`, `.pre-commit-config.yaml`, `.github/workflows/pr-checks.yml`,
`.docgov.config.js`, and `.claude/settings.json`. That document is the source of truth for
the list; this workflow is a mechanical reading of it, not a second definition.

```yaml
jobs:
  governance-compliance:
    uses: licorsy/platform-workflows/.github/workflows/governance-compliance.yml@v1
```

**Advisory by default** — it reports missing artifacts in the job summary and passes. A
repository can legitimately be mid-adoption, and a hard failure would make this the thing
that blocks work rather than the thing that reports on it. Once a repository is expected to
stay compliant, pass `strict: true` to fail instead:

```yaml
jobs:
  governance-compliance:
    uses: licorsy/platform-workflows/.github/workflows/governance-compliance.yml@v1
    with:
      strict: true
```

It is a **presence** check, not a content check, and deliberately so. What each file must
*say* is already enforced where it lives — `pre-commit` and `docgov` run against the caller's
own config — and re-checking it here would fork those rules by workflow. What nothing else
catches is a repository that simply never received one of the files, which is what happened
before `init-governance.sh` learned to write `.claude/settings.json`.

### `release-integrity.yml`

Answers one question: **does what consumers receive match what is on `main`?** For a
Claude Code plugin that isn't obvious — `init-governance.sh` copies from the installed
plugin cache, and the cache resolves tags, so work merged to `main` without a release
keeps serving the previous version silently and indefinitely.

```yaml
on:
  schedule: [{ cron: '<minute> <hour> * * *' }]  # pick your own offset — see below
  workflow_dispatch: {}

jobs:
  release-integrity:
    uses: licorsy/platform-workflows/.github/workflows/release-integrity.yml@v1
```

Each caller should use its own cron offset rather than copying this repo's own
(`17 6 * * *`, used by `release-integrity-self.yml`) — every repo running the same slot means
they'd all compete for runner capacity and land in the same drift-detection window instead of
spreading it across the day.

Inputs: `major-tag` (default `v1`), `version-file` (default `.claude-plugin/plugin.json`; set
empty to compare only the floating tag against `main`), and `changelog-file` (default
`CHANGELOG.md`; set empty to skip the fourth check below — a missing file is already a no-op,
not a failure, since no repository calling this workflow carries one yet).

It catches four failure modes, each of which has happened or nearly happened somewhere in
this organization:

1. `main` moved and nobody tagged — the original incident, in this repository, seven commits
   past `v1.1.0`.
2. Tagged, but the floating tag wasn't moved — semver tag right, consumers stale.
3. `git tag -f v1 v1.4.0` points the floating tag at the **tag object** rather than the
   commit. `git rev-list -n1 v1` still resolves correctly, so it looks fine.
4. Sha-only, and therefore invisible to the three above: a tag lands on a commit whose
   `CHANGELOG.md` `[Unreleased]` section is not empty — correct about *where* it points, wrong
   about *what* it claims to contain. Only checked once modes 1–3 already found nothing wrong.

**Scheduled, not on push to `main`** — tagging happens *after* the merge, so a
push-triggered run would fail every release by construction and train everyone to
ignore it.

Note on mode 3: it has to be read off the tag's immediate target via `git cat-file tag`.
`^{}` peels recursively and always lands on a commit, so a check written against it can
never fire — which is exactly what the first version of this check did, and what testing
caught.

### `release.yml`

Reusable semantic-release workflow (Node 20 + `semantic-release-action@v4`) for repos with a
`package.json`-based release setup. Scaffolded here; not yet wired into any caller.

```yaml
jobs:
  release:
    uses: licorsy/platform-workflows/.github/workflows/release.yml@v1
```

Do not pass `GITHUB_TOKEN` through `secrets:` here. It is a reserved name that a
called workflow receives automatically, and naming it explicitly — on either side
of the call — makes the workflow file invalid. An invalid workflow file is not a
quiet failure: GitHub emits a red startup-failure run on every push to every
branch until it is corrected.

## Versioning

Tags follow the same convention as `git-governance`/`docs-governance`: a semver tag (e.g.
`v1.0.0`) plus a floating major tag (`v1`) that moves forward with each release. Pin `uses:`
references to the floating `v1` tag.
