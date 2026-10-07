# AGENTS.md — Fil rouge : élection des représentants de parents d'élèves

## Contexte
Projet d'apprentissage AWS serverless + IaC. Objectif : « savoir reconstruire et diagnostiquer l'infra », pas une app de production.
Une école crée une élection et invite des parents (magic link usage unique) ; chaque parent vote une fois, vote secret ; dépouillement automatique à la clôture (plus forte moyenne).

## Répartition des rôles (IMPORTANT)
- L'IA écrit le **code applicatif** (`apps/`, `packages/`), les tests et la doc.
- `infra/` est l'exercice du développeur : **ne pas modifier `infra/`** sauf demande explicite.
- **Ne jamais lancer** `terraform apply|destroy`, `cdktn deploy|destroy`, ni aucune commande AWS qui crée, modifie ou supprime une ressource. Lecture seule autorisée (`plan`, `synth`, `describe`, `get`, `list`).
- Ne jamais écrire de secret, ID de compte ou ARN en dur.

## Stack
- Node 24 (runtime Lambda `nodejs24.x`), TypeScript strict, ESM. Lambdas **ARM64**, bundling esbuild. Le poste de dev est un Mac Intel : signaler toute dépendance avec binaire natif.
- Backend : Hono + Zod. Front : minimal, shadcn/ui.
- AWS (eu-west-1) : API Gateway REST + Lambda authorizer REQUEST, DynamoDB single-table, Step Functions, EventBridge Scheduler, S3 (presigned URLs), KMS, Cognito, CloudFront.
- IaC : cdktn (TypeScript → Terraform). Versions d'outils épinglées dans `mise.toml`.
- Lint/format : Biome. Tests : Vitest.

## Structure
```
apps/api          Handlers Lambda (Hono) — un dossier par handler
apps/web          Front (S3 privé + CloudFront OAC)
packages/shared   Schémas Zod et types partagés api ↔ web
infra/            Stacks cdktn : bootstrap / data / network / app
docs/             plan.md, diagnostic.md, adr/
```

## Conventions
- **Un handler = une Lambda = un rôle IAM.** Un handler n'accède qu'aux ressources de son propre rôle.
- Toute entrée externe est validée par un schéma Zod de `packages/shared`.
- Configuration par variables d'environnement (noms de table, ARN de clé…), jamais en dur.
- Noms de ressources préfixés par `stage`.
- Erreurs : distinguer erreur applicative (4xx explicite) et erreur plateforme ; ne jamais renvoyer de stack trace.
- Logs JSON structurés.

## Règles métier non négociables
- **Vote secret** : le bulletin (`BALLOT#uuid`) n'a aucun lien avec l'électeur — ni clé, ni attribut, ni log, ni horodatage précis, ni ordre exploitable.
- **Un seul vote** : `TransactWriteItems` = `PARTICIPATION#voter` (condition `attribute_not_exists`) + `BALLOT#uuid`. Idempotence via `ClientRequestToken`.
- Invitation : token aléatoire, seul son hash est stocké, consommé par écriture conditionnelle.
- Ne jamais logger de token, JWT, bulletin en clair ou PII.

## Commandes
- `mise install` (toujours en premier) · `pnpm install` · `pnpm lint` · `pnpm test`
- Tests : un test par règle métier ci-dessus au minimum.
