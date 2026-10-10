# ADR-0005 — API code layout: hexagonal-lite, one Hono app per Lambda

- Status: superseded by ADR-0008
- Date: 2026-10-07
- Block: api

## Context
One handler = one Lambda = one IAM role (AGENTS.md). Business rules (secret ballot, tally) must be testable without AWS. The "one vote" rule relies on a DynamoDB transaction, so it cannot be fully infrastructure-agnostic. Hono recommends `app.route()` over controllers and keeping handlers inline for type inference.

## Options
| Option | Pros | Cons |
|---|---|---|
| A. Flat `lib/` folder | Fast to start | Turns into a junk drawer; no dependency direction |
| B. Full hexagonal (interfaces, DI container, use-case classes) | Strict isolation | Ceremony out of proportion; DI container adds cold-start cost |
| C. Hexagonal-lite: pure `domain/`, function-type `ports/`, `adapters/`, manual wiring in handlers | Testable domain, explicit boundaries, tree-shaken bundles | Dependency rule is a convention until enforced by tooling |

## Decision
Option C.

```
src/
  handlers/<name>/index.ts   driving adapter: Hono app + handle(); wiring only
  http/                      shared HTTP concerns (createApp, middlewares)
  domain/                    pure TS, no aws-sdk / hono imports
  ports/                     function types (e.g. RecordVote)
  adapters/<service>/        implement ports (DynamoDB, KMS, Scheduler)
  config.ts                  env vars parsed by Zod at cold start
```

Dependencies point inward only: `handlers` → `domain`, `ports`, `adapters`, `http`; `adapters` → `ports`; `domain` → nothing. Folders are created with the first real use case, not ahead of time.

## Consequences
- `domain` is unit-tested without mocks; adapters are tested against DynamoDB Local; handlers keep HTTP contract tests.
- Each bundle only contains what its handler imports, matching its IAM role.
- Risk: the dependency rule drifts. Enforce with `dependency-cruiser` once `domain/` exists.
- Revisit if several handlers end up sharing one Lambda (then use `app.route()` per feature).
