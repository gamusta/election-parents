# ADR-0002 — Credentials locaux via `aws login`, pas de clés longues

- Statut : accepté
- Date : 2026-10-07
- Bloc : setup

## Contexte
Compte AWS sur le Free plan avec 200 $ de crédits. Rejoindre AWS Organizations fait passer le compte en plan payant et fait expirer les crédits immédiatement. Or IAM Identity Center (accès aux comptes) exige Organizations.

## Options
| Option | Pour | Contre |
|---|---|---|
| Clés IAM longues | Simple | Secret permanent sur disque, aucune expiration |
| IAM Identity Center | Bonne pratique, multi-comptes | Exige Organizations → perte des crédits |
| `aws login` (utilisateur IAM `mg-dev`) | Credentials temporaires renouvelés automatiquement, aucun secret durable | Compatibilité à vérifier avec le provider Terraform |

## Décision
`aws login` avec l'utilisateur IAM `mg-dev` (jamais le root). Clé longue désactivée, supprimée après validation Terraform.

## Conséquences
- `AWS_PROFILE` et `AWS_REGION` chargés par `mise.toml` (`[env]`).
- Si le provider Terraform ne lit pas la session : repli via `credential_process`.
- La CI n'utilise aucune clé : OIDC GitHub → rôle IAM (bloc 1).
- Remise en cause : passage en plan payant + multi-comptes (staging/prod) → Identity Center.
