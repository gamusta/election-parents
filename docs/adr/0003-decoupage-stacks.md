# ADR-0003 — Quatre stacks : bootstrap / data / network / app

- Statut : accepté
- Date : 2026-10-07
- Bloc : setup

## Contexte
Les ressources n'ont pas le même cycle de vie : le state et le budget existent avant tout ; les données doivent survivre ; le NAT coûte à l'heure ; l'app change à chaque déploiement.

## Décision
| Stack | Contenu | Cycle de vie | Déployée par |
|---|---|---|---|
| bootstrap | Bucket de state, budget | Créée une fois, state local puis migré | Poste, hors CI |
| data | DynamoDB, KMS, S3 | Persistante | CI |
| network | VPC, NAT, endpoints | Détruite chaque soir | CI |
| app | Lambdas, API GW, Cognito, Step Functions, CloudFront | Redéployée souvent | CI |

State S3 avec verrouillage natif (`use_lockfile`), une clé par stack et par env, `stage` en préfixe des noms.

## Conséquences
- Ordre de déploiement : data → network → app ; destruction dans l'ordre inverse, bootstrap en dernier.
- Un output de data consommé par app ne doit pas changer sans coordination (panne du bloc 4).
- Rayon d'impact réduit : un `destroy` de app ne touche pas aux données.
