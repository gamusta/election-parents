# Fil rouge — élection des représentants de parents d'élèves

Projet d'apprentissage AWS serverless + IaC (cdktn → Terraform). Objectif : savoir reconstruire et diagnostiquer l'infrastructure.

## Prérequis
- [mise](https://mise.jdx.dev) : installe Node, pnpm et Terraform aux versions de `mise.toml`
- AWS CLI v2, profil `fil-rouge` connecté via `aws login` (utilisateur IAM, jamais root)

## Démarrage
```sh
mise trust && mise install   # outils épinglés + AWS_PROFILE / AWS_REGION
aws login --profile fil-rouge
aws sts get-caller-identity  # doit afficher :user/mg-dev
pnpm install
pnpm lint && pnpm test
```

## Structure
| Dossier | Rôle |
|---|---|
| `apps/api` | Handlers Lambda (Hono + Zod) |
| `apps/web` | Front (S3 privé + CloudFront OAC) |
| `packages/contracts` | Schémas Zod partagés (contrat HTTP) |
| `infra/` | Stacks cdktn : bootstrap, data, network, app |
| `docs/` | `plan.md`, `diagnostic.md`, `adr/` |

## Déploiement
Ordre : bootstrap (poste, une fois) → data → network → app. Destruction dans l'ordre inverse.
Toujours relire le plan avant `apply`. Voir `docs/adr/0003-decoupage-stacks.md`.

## Règles
Voir `AGENTS.md` (répartition humain / IA, vote secret, un handler = une Lambda = un rôle).
