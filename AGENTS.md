# AGENTS.md — Fil rouge : élection des représentants de parents d'élèves

## Contexte
Projet d'apprentissage AWS serverless + IaC. Objectif : « savoir reconstruire et diagnostiquer l'infra », pas une app de production.
Une école crée une élection et invite des parents (magic link usage unique) ; chaque parent vote une fois, vote secret ; dépouillement automatique à la clôture (représentation proportionnelle au plus fort reste).

## Répartition des rôles (IMPORTANT)
- **Le développeur code lui-même**, pas à pas, les parties nouvelles : domaine DDD (agrégats, domain events, repositories), SQS/SNS/EventBridge/Streams/Step Functions/ECS, idempotence, et tout `infra/`. L'IA guide : étapes, points de vigilance, revue précise. **Pas de code complet sauf demande explicite.**
- **Init from scratch** (`apps/web`, nouveau package de contexte + son handler, worker ECS) : faite par le développeur, l'IA relit ensuite.
- L'IA génère le boilerplate : handlers simples, tests de base, écrans du front une fois l'init faite, et la doc.
- `infra/` est l'exercice du développeur : **ne pas modifier `infra/`** sauf demande explicite.
- **Ne jamais lancer** `terraform apply|destroy`, `cdktn deploy|destroy`, ni aucune commande AWS qui crée, modifie ou supprime une ressource. Lecture seule autorisée (`plan`, `synth`, `describe`, `get`, `list`).
- Ne jamais écrire de secret, ID de compte ou ARN en dur.

## Stack
- Node 24 (runtime Lambda `nodejs24.x`), TypeScript strict, ESM. Lambdas **ARM64**, bundling esbuild. Le poste de dev est un Mac Intel : signaler toute dépendance avec binaire natif.
- Backend : Hono + Zod.
- AWS (eu-west-1) : API Gateway REST, Lambda, DynamoDB single-table (+ Streams), SQS, SNS, SES, EventBridge (bus, Pipes, Scheduler), Step Functions, ECS Fargate x86_64 + ECR (image `linux/amd64` : poste Mac Intel, pas d'émulation), S3, CloudFront (front + `/api`, ADR-0018), CloudWatch. Hors périmètre actuel : Cognito, authorizer, KMS JWT, VPC sur mesure.
- Front : React + TanStack (Router, Query, Form), Zustand, shadcn/ui.
- Tests : Vitest ; BDD en Gherkin (`*.feature`) via `@amiceli/vitest-cucumber`.
- IaC : cdktn (TypeScript → Terraform). Versions d'outils épinglées dans `mise.toml`.
- Lint/format : Biome. Tests : Vitest.

## Structure
```
apps/api          Handlers Lambda (Hono) — un dossier par handler
apps/web          Front : S3 privé + CloudFront, API sous `/api` (même origine) ; en local, appelle l'API déployée (CORS)
packages/contracts Schémas Zod (contrat HTTP) api ↔ web
packages/kernel   Shared kernel DDD (Result ; DomainEvent et AggregateRoot à venir)
packages/<ctx>    Bounded contexts (voting, plus tard school, reporting) : domain / application / infrastructure
infra/            Stacks cdktn : bootstrap / data / network / app
docs/             plan.md, diagnostic.md, adr/
```

## Conventions
- **Une Lambda = un rôle IAM = un profil de droits** (ADR-0017). Les routes HTTP de mêmes droits partagent une Lambda (ex. `voting-read`) ; `cast-vote` est la seule Lambda qui écrit un bulletin. Tout consumer, worker ou webhook a sa propre Lambda.
- Toute entrée externe est validée par un schéma Zod de `packages/contracts`.
- Configuration par variables d'environnement (noms de table, ARN de clé…), jamais en dur.
- Noms de ressources préfixés par `stage`.
- Erreurs : distinguer erreur applicative (4xx explicite) et erreur plateforme ; ne jamais renvoyer de stack trace.
- Logs JSON structurés.

## Règles métier non négociables
- **Vote secret** : le bulletin (`BALLOT#uuid`) n'a aucun lien avec l'électeur — ni clé, ni attribut, ni log, ni horodatage précis, ni ordre exploitable.
- **Un seul vote** : `TransactWriteItems` = `PARTICIPATION#voter` (condition `attribute_not_exists`) + `BALLOT#uuid`. Idempotence via `ClientRequestToken`.
- Invitation : token aléatoire, seul son hash est stocké, consommé par écriture conditionnelle.
- Ne jamais logger de token, JWT, bulletin en clair ou PII.

## Règles event-driven
- Tout consumer est **idempotent**, garanti par la base (écriture conditionnelle ou clé de dédup), jamais par un check applicatif.
- Livraison supposée **at-least-once et dans le désordre** : transitions d'état monotones, doublons ignorés silencieusement.
- **Jamais de PII, de token ni de donnée de vote dans un message** (SQS, SNS, EventBridge, Streams) : identifiants seulement.
- Aucun événement ne relie un électeur à un bulletin, ni par contenu ni par horodatage. `BallotCast` ne sort pas du contexte Voting.
- Toute file a une DLQ et une alarme ; tout consumer SQS Lambda active `ReportBatchItemFailures`.
- Un événement est versionné (`type`, `version`) ; un consumer ignore les versions inconnues.

## Commandes
- `mise install` (toujours en premier) · `pnpm install` · `pnpm lint` · `pnpm test`
- Tests : un test par règle métier ci-dessus au minimum.
