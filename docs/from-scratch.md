# "From scratch" checklist — personal

Filled in at each init: `apps/web` (D1), `packages/school` + handler (D4),
ECS worker (D5), backend service against the clock (D6).
For each step: what I did, how long it took, and why.

## Summary

Legend: `done` · `later` (deferred) · `n/a` (not applicable).

| Step                         | Target | Web   | School | ECS | D6 |
| ---------------------------- | ------ | ----- | ------ | --- | -- |
| Decide (ADR, README)         |        | done  |        |     |    |
| Reproducible tooling         |        | done  |        |     |    |
| Quality from the first file  |        | done  |        |     |    |
| Walking skeleton + CI        |        | done  |        |     |    |
| Infra (IaC, `stage`, budget) |        | n/a   |        |     |    |
| Boundaries                   |        | done  |        |     |    |
| Configuration (env, secrets) |        | done  |        |     |    |
| Operability                  |        | later |        |     |    |
| Conventions                  |        | done  |        |     |    |
| Accepted debt ("Not yet")    |        | done  |        |     |    |
| **Total time**               |        |       |        |     |    |

## `apps/web` (D1)

Target: 1 h 20 (plan, D1 afternoon).

### Decide (ADR, README)

- No ADR: the front end is local only, no structural choice to record yet.
- `apps/web/README.md`: run, test, `VITE_API_URL`, native binaries,
  "Not yet".
- Why: anyone (me in 3 months) can run it without reading the code.

### Reproducible tooling

- Node and pnpm pinned by `mise.toml`, shared with the rest of the monorepo.
- pnpm workspace: `@election/web` uses `@election/contracts`
  (`workspace:*`).
- `pnpm install --frozen-lockfile`: the lockfile is the only source of truth.
- Why: same versions on the Intel Mac and in CI, no "works on my machine".

### Quality from the first file

- Biome instead of the template's ESLint: one tool for the whole repo.
- Strict tsconfig: `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`.
- `typecheck` script (`tsc -b`), picked up by the root `pnpm typecheck`.
- Vitest + jsdom + Testing Library, tests colocated with components.
- Why: tightening rules later costs a sweep of fixes; on day one it is free.

### Walking skeleton + CI

- `/elections/$id` route → `getElection` → deployed API → Zod parse → page.
- Three states handled: loading, error, not found (404 → `null`).
- `.github/workflows/ci.yml`: install, lint, typecheck, test, web build.
- Triggers: `pull_request`, `push` on `main`, `workflow_dispatch`.
- `main` ruleset: PR required, `ci` check required, no force push.
- Why: prove the whole chain works before adding features.

### Infra (IaC, `stage`, budget)

- n/a: nothing for the front end: no hosting, it runs locally.
- API side: CORS allows one exact origin (`CORS_ORIGIN`), never `*`.

### Boundaries

- `src/routes/`: routing only (params, query, states).
- `src/features/`: presentational components, data as props.
- `src/api/`: the only place that calls `fetch`.
- `src/lib/config.ts`: the only place that reads `import.meta.env`.
- HTTP contract shared with the API via `@election/contracts` (Zod).
- Why: tests mock `src/api` only; the contract breaks at compile time,
  not in production.

### Configuration (env, secrets)

- `VITE_API_URL` in `.env.local` (git-ignored), `.env.example` committed.
- Fail fast: missing variable → error at startup.
- No secret in the front end: everything `VITE_*` lands in the bundle.

### Operability

- Later: no error tracking, no front-end logs. API logs (CloudWatch) suffice
  for now.

### Conventions

- File-based routing, per-route code splitting (`autoCodeSplitting`).
- `routeTree.gen.ts` committed (CI typecheck needs it), ignored by Biome.
- PascalCase component files; casing must match imports exactly.
- Code, comments, docs and commits in English.

### Accepted debt ("Not yet")

- shadcn/ui, TanStack Form, Zustand, auth, deployment (S3 + CloudFront).
- Listed in `apps/web/README.md`, added when a screen needs it.

### What the AI review fixed

- `ElectionPage.tsx` vs `Electionpage` casing: invisible on macOS,
  breaks on Linux CI (TS1149).
- First `ci.yml` invalid (`branch` instead of `branches`, empty `jobs`):
  GitHub created a failed run on a non-`main` push.
- Outdated actions: `actions/checkout@v7`, `jdx/mise-action@v5`.
- `workflow_dispatch` only shows up once the file is on the default branch.
- Rulesets not enforced on a private repo (Free plan) → repo made public,
  history scanned for secrets first.

## `packages/school` + handler (D4)

## ECS worker (D5)

## Backend service against the clock (D6)

## Lessons

- An invalid workflow file still triggers a (failed) run: lint YAML before
  pushing (`actionlint`).
- macOS is case-insensitive, Linux CI is not: CI catches what the Mac hides.
- Commit generated files the type checker depends on.

## D7 simulation debriefs

### a) Payment service

### b) Webhooks / external integration

### Live coding
