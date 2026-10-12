# ADR-0018 — Front sur S3 + CloudFront, API sous `/api`, déploiement par la CI

- Statut : proposé
- Date : 2026-10-12
- Bloc : J2

## Contexte
Le front tournait en local seulement (CloudFront hors périmètre) et l'infra était déployée depuis le poste. Objectifs : servir le front en HTTPS, supprimer CORS en production, et déployer web + infra depuis `main` sans clé longue. Le rôle CI actuel (`plan`) est en lecture seule.

## Options
| Option | Pour | Contre |
|---|---|---|
| A. S3 public (website hosting) | Simple | Bucket public, pas de HTTPS natif, pas de cache maîtrisé |
| B. S3 privé + CloudFront (OAC), front seul | HTTPS, cache, bucket privé | Deux origines : CORS reste nécessaire |
| C. B + `/api/*` → API Gateway dans la même distribution | Même origine : plus de CORS en prod ; un seul domaine | Behavior `/api` à régler (pas de cache, en-tête `Host`, réécriture du chemin) |

| CI | Pour | Contre |
|---|---|---|
| Contenu web seul | Rôle étroit | Infra encore déployée à la main |
| Web + infra (`cdktn deploy`) | Déploiement reproductible depuis `main` | Rôle large : à borner (préfixe `stage`, permissions boundary, environment GitHub avec approbation) |

## Décision
Option C, CloudFront dans la stack `app` (même cycle de vie que l'API). La CI déploie `data` + `app` puis le contenu web, avec un rôle OIDC `deploy` distinct du rôle `plan`, limité à `main` et à un environment GitHub protégé.

Rôle `<stage>-github-ci-deploy` (stack `bootstrap`, déployée depuis le poste) :
- Confiance : OIDC GitHub, `sub` = `repo:<repo>:environment:<stage>` uniquement. L'environment exige une approbation manuelle et n'accepte que `main`.
- Hors IAM : `PowerUserAccess`.
- IAM : uniquement les rôles sous le path `/app/` (rôles d'exécution des Lambdas) ; `iam:PassRole` limité à `lambda.amazonaws.com` ; pas d'`AttachRolePolicy` (les Lambdas n'ont que des politiques inline). Le rôle `deploy` est hors `/app/` : il ne peut modifier ni lui-même, ni `ci-plan`, ni `apigw-cloudwatch`.

## Conséquences
- Facile : une seule URL ; `VITE_API_URL=/api` ; CORS gardé seulement pour le dev local.
- Infra et contenu séparés : Terraform crée bucket et distribution, la CI fait `s3 sync` + invalidation de `index.html`.
- Rôles Lambda renommés `<stage>-<handler>-exec` : `create_before_destroy` (hérité de `ApiGatewayDeployment`) remplace un rôle en créant le nouveau avant de supprimer l'ancien, donc les deux noms doivent coexister.
- Escalade résiduelle : avec `PutRolePolicy` + `UpdateAssumeRolePolicy` sur `/app/`, la CI peut se fabriquer un rôle admin. À fermer par une permissions boundary imposée à la création des rôles `/app/`.
- À surveiller : `assets/*` immutables, `index.html` non caché ; propagation CloudFront lente (minutes).
- Remise en cause : domaine personnalisé (Route 53 + ACM en us-east-1), ou auth (Cognito) sur les routes admin.
