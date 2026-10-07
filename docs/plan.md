# Plan — 8 blocs de 5 h (4 jours × 10 h)

Cycle de chaque bloc : déployer → observer → modifier → casser → diagnostiquer → corriger.
Critère de réussite : « je sais expliquer la panne ». Chaque bloc = socle (~3 h 30) + bonus (~1 h 30) + une modification faite sans l'IA.

Fils rouges :
- docs/diagnostic.md : une ligne par panne (symptôme → qui refuse → où regarder → correction).
- Observabilité d'abord : log, métrique ou historique avant de toucher au code.
- Règle des 15 min sur le code applicatif.
- Blocs 1 à 4 : réflexes de dev (outils, raccourcis, workflow Cursor), 2-3 par session.

| Demi-journée | Bloc |
|---|---|
| J1 matin | 1. Fondations IaC + pipeline minimal |
| J1 après-midi | 2. Lambda + API Gateway |
| J2 matin | 5. Auth + IAM (lourd) |
| J2 après-midi | 3. DynamoDB + mécanique du vote |
| J3 matin | 6. S3 + KMS + invitations (lourd) |
| J3 après-midi | 4. CI/CD en profondeur |
| J4 matin | 8. VPC (lourd), CloudFront en bonus |
| J4 après-midi | 7. Step Functions + clôture du projet |

## J1 matin — Bloc 1 : fondations IaC et pipeline minimal
Critère : je sais lire un plan et expliquer ce que Terraform va faire et pourquoi.
- Socle : budget (alertes 10 $/50 $, filtre crédits) ; stack bootstrap en state local puis migration vers S3 ; lecture du JSON synthétisé ; versions CLI/providers épinglées ; variables, outputs, `stage` ; pipeline GitHub minimal en OIDC (plan seul).
- Pannes : deux apply concurrents (lock) ; modification console puis drift ; changement qui force un remplacement (`-/+`) vs modification (`~`).
- Bonus : import d'une ressource existante, `moved`, `-refresh-only`.
- Autonomie : ajouter un output et expliquer le plan ligne par ligne.

## J1 après-midi — Bloc 2 : Lambda et API Gateway
Critère : je sais distinguer une erreur applicative d'une erreur de plateforme.
- Socle : runtime ARM64, mémoire, timeout, variables d'env, bundling esbuild ; cold vs warm start (Init Duration) ; contrat de l'intégration proxy, déploiement/stage, CORS.
- Pannes : 502 (réponse proxy mal formée) ; 504 (Lambda de 35 s) ; 500 (permission d'invocation absente, execution logs) ; CORS bloqué.
- Bonus : versions et alias, rollback via alias ; provisioned concurrency sur l'alias (si quota).
- Autonomie : ajouter une route et sa permission d'invocation.

## J2 matin — Bloc 5 : auth et IAM
Critère : devant un 401/403/500, je sais dire qui refuse.
- Socle : Cognito (user pool, app client, flux, access vs ID token, refresh, JWKS) ; authorizer REQUEST (validation, contexte, policy, cache) ; un rôle par Lambda ; rôle d'exécution vs resource policy.
- Pannes : token expiré ; mauvais app client ; ID token au lieu de l'access token ; cache de policy (403 sur la 2e route) ; permission d'invocation de l'authorizer absente (500 AuthorizerConfigurationException).
- Bonus : conditions IAM, IAM policy simulator.
- Autonomie : écrire une policy ciblée sans wildcard.

## J2 après-midi — Bloc 3 : DynamoDB et mécanique du vote
Critère : je sais pourquoi une requête est lente, incomplète ou refusée.
- Socle : access patterns → clés avant le code ; single-table, GSIs ; pagination, cohérence de lecture, projections ; KeyCondition vs Filter ; update expressions, conditions.
- Pannes : Limit petit (LastEvaluatedKey) ; filtre sans clé (RCU vs items) ; lecture GSI juste après écriture ; collision d'écriture conditionnelle ; refus via dynamodb:LeadingKeys.
- Vote : TransactWriteItems participation + bulletin ; double vote concurrent ; retry idempotent (ClientRequestToken) vs vrai doublon.
- Bonus : fuite du secret par horodatage ou ordre des items.
- Autonomie : ajouter un GSI pour un nouvel access pattern.

## J3 matin — Bloc 6 : S3, KMS et invitations
Critère : je sais dire si un refus vient de S3, de IAM ou de la key policy KMS.
- Socle : presigned PUT depuis le navigateur (CORS S3, droits du signataire, expiration), versioning ; clé de signature vs chiffrement ; key policy vs IAM ; encryption context ; magic link → JWT signé KMS ; envelope encryption d'un bulletin.
- Pannes : URL expirée ; URL signée par un rôle sans droits ; S3 autorisé mais KMS refusé ; encryption context différent ; lien d'invitation rejoué.
- Bonus : restauration de version, lifecycle, SES sandbox.
- Décision : data key par élection ou par bulletin.
- Autonomie : modifier la key policy pour une nouvelle Lambda.

## J3 après-midi — Bloc 4 : CI/CD en profondeur
Critère : je sais reprendre un déploiement cassé sans repartir de zéro.
- Socle : permissions du job, rôles plan/apply séparés ; artefact immuable (construit / synthétisé / déployé) ; plan enregistré (`-out`) appliqué tel quel ; concurrency des workflows ; ordre data → network → app.
- Pannes : condition OIDC cassée ; deux déploiements simultanés ; output de data modifié alors qu'app le consomme ; apply partiellement réussi.
- Bonus : GitHub Environments avec approbation, préparation staging.
- Autonomie : ajouter une stack au pipeline en respectant l'ordre.

## J4 matin — Bloc 8 : VPC, CloudFront en bonus
Critère : devant un timeout réseau, je sais remonter route → SG → endpoint → permission.
- Socle : subnets, tables de routage, SG, NAT, gateway endpoints, interface endpoints + DNS privé ; Lambdas vote et dépouillement en VPC.
- Pannes : route absente ; SG sortant bloquant ; KMS sans endpoint ni NAT (timeout) ; DNS privé désactivé ; policy d'endpoint restrictive.
- Comparatif : coût NAT vs endpoint d'interface ; cold start en VPC vs hors VPC.
- Bonus CloudFront : S3 privé + OAC, cache et invalidation, routage SPA, ACM us-east-1 ; fichier obsolète servi depuis le cache.
- Autonomie : ajouter un endpoint d'interface et expliquer le plan.
- Le soir : destroy de la stack network.

## J4 après-midi — Bloc 7 : Step Functions et clôture du projet
Critère : je sais ce qui est rejoué après un échec, et donc ce qui doit être idempotent.
- Socle : entrées/sorties des états, JSONata vs JSONPath ; timeouts, Retry/Catch, intégrations AWS directes, concurrence du Map, historique ; Scheduler (rôle cible, fuseau, retry, DLQ) + bouton école ; nom d'exécution = electionId.
- Pannes : échec transitoire puis permanent ; sortie intermédiaire mal formée ; throttling du Map ; double déclenchement ; reprise (redrive).
- Fin (1 h réservée) : relecture de diagnostic.md ; destroy app → network → data → bootstrap ; vérification Cost Explorer le lendemain.
- Bonus : PV PDF + presigned GET.
- Autonomie : ajouter un état avec son Retry.
