# Diagnostic — une fiche par panne

Critère : « je sais expliquer la panne ».
Chaque fiche répond à 4 questions : qu'est-ce que je vois ? qui dit non ? où je regarde ? comment je répare ?

---

## Setup — `aws login` fait, mais la CLI utilise toujours les clés longues
- **Je vois :** `aws configure list` affiche `TYPE = shared-credentials-file`.
- **Qui dit non / qui gagne :** la chaîne de credentials de la CLI : `~/.aws/credentials` passe avant la session `aws login`.
- **Je regarde :** `aws configure list --profile <p>` (colonne TYPE).
- **Je répare :** retirer le profil de `~/.aws/credentials`, relancer `aws login`.

## Setup — `aws login` ne propose que le root
- **Je vois :** la page de connexion ne propose que le compte root.
- **Qui dit non / qui gagne :** la session console déjà ouverte dans le navigateur.
- **Je regarde :** le compte affiché en haut de la console.
- **Je répare :** se déconnecter de la console, relancer `aws login`, choisir « IAM user » (Account ID + `mg-dev`).

## Setup — `ERR_PNPM_IGNORED_BUILDS` à l'installation
- **Je vois :** pnpm échoue en listant des paquets dont les scripts d'installation sont ignorés.
- **Qui dit non :** pnpm, qui bloque par défaut les scripts d'install (protection supply-chain).
- **Je regarde :** la liste des paquets dans le message d'erreur.
- **Je répare :** `pnpm approve-builds`, liste blanche commitée dans `pnpm-workspace.yaml`.

## Bloc 1 — `.terraform.lock.hcl` jamais commité
- **Je vois :** le lock file n'apparaît pas dans `git status`.
- **Qui dit non :** le `.gitignore`, qui exclut tout le dossier de synth `cdktf.out/`.
- **Je regarde :** `git check-ignore -v <fichier>` (donne la règle et la ligne).
- **Je répare :** ouvrir l'exclusion niveau par niveau (`**/cdktf.out/*`, `!**/cdktf.out/stacks/`…) et dé-ignorer `stacks/*/.terraform.lock.hcl`.

## Bloc 1 — deux plan/apply en même temps sur la même stack
- **Je vois :** `Error acquiring the state lock`.
- **Qui dit non :** S3, avec un **412 PreconditionFailed** : l'écriture conditionnelle de `<clé>.tflock` échoue car l'objet existe déjà (verrou détenu).
- **Je regarde :** `Lock Info` dans l'erreur (ID, Who, Operation, Created) ; `aws s3 ls s3://<bucket>/<stage>/` (présence du `.tflock`).
- **Je répare :** détenteur vivant → attendre qu'il finisse ; détenteur mort (Ctrl-C, runner annulé) → vérifier qu'il ne tourne plus, puis `terraform force-unlock <ID>`. Jamais de force-unlock « pour voir ».

## Bloc 1 — modification dans la console (drift)
- **Je vois :** un plan `~ update in-place` alors que je n'ai pas touché au code. Ici : `limit_amount = "35.0" -> "50"`, **plus** des attributs que je n'avais pas modifiés (`filter_expression`, `metrics`, `billing_view_arn`).
- **Qui dit non / qui gagne :** personne ne refuse : Terraform relit AWS au plan, constate l'écart avec le code, et propose de ramener AWS au code. À gauche de `->` = réalité AWS ; à droite = le code.
- **Je regarde :** le plan (valeurs à gauche de `->`) ; la valeur réelle via la CLI (`aws budgets describe-budget …`).
- **Je répare :** décider qui a raison. Le code → `deploy`, puis re-`diff` (doit afficher `No changes`, sinon diff perpétuel). La console → reporter la valeur dans le code.
- **Piège :** la console peut réécrire des attributs non touchés (ici : `cost_types` converti en `filter_expression`). Aligner le code sur le format que la console produit.

## Bloc 1 — plan OK, apply refusé (`400 InvalidParameterException`)
- **Je vois :** `Metrics cannot be used alongside Cost Filters and/or Cost Types` à l'apply, alors que le plan était propre.
- **Qui dit non :** l'API AWS Budgets (400). Le plan ne connaît pas les règles métier de l'API.
- **Je regarde :** le message d'erreur de l'API ; l'état réel (`aws budgets describe-budget …`) : `cost_types` toujours présent.
- **Je répare :** retirer un attribut *Optional + Computed* du code ne le supprime pas côté AWS. Recréer la ressource : `terraform apply -replace=<adresse>` (plan en `-/+`).
- **À retenir :** `~` = même ressource modifiée ; `-/+` = détruite puis recréée (attribut immuable ou `-replace`) → danger pour tout ce qui porte des données.
## Bloc 2 — `REPORT` sans `initDurationMs` alors que la réponse dit `coldStart: true`
- **Je vois :** une réponse `coldStart: true` et une ligne `platform.report` sans `initDurationMs`.
- **Qui dit non / qui gagne :** personne : je compare deux invocations différentes (la ligne `REPORT` lue appartient à une autre requête, warm).
- **Je regarde :** le `requestId` de la ligne `platform.report` et celui des logs applicatifs de la même invocation (`aws logs tail … --format short`).
- **Je répare :** toujours apparier logs et `REPORT` par `requestId`, jamais par l'heure. Un vrai cold start a un `platform.initStart` juste avant son `platform.start`.

## Bloc 2 — cold start à ~860 ms dont seulement ~180 ms d'INIT
- **Je vois :** `initDurationMs` ≈ 180, mais `durationMs` ≈ 680 au 1er appel, contre ~3 ms en warm ; l'access log Hono indique 3 ms.
- **Qui dit non / qui gagne :** la pénalité de 1re invocation : chargement paresseux des classes Fetch (`Request`/`Response`) et compilation V8 de l'adaptateur, exécutés pendant l'invocation, donc avec le CPU bridé (256 Mo ≈ 1/7 de vCPU).
- **Je regarde :** `platform.report` (init vs duration) ; `sinceInitMs` ≈ temps entre `platform.start` et la route : le coût est avant la route, dans l'adaptateur.
- **Je répare :** priming en portée module (top-level await : `handler()` sur un event synthétique `GET /__prime` → 404). Mesuré : init 179 → 185 ms, duration 678 → 8 ms, facturé 858 → 194 ms.
- **À retenir :** cold start = création de la micro-VM (invisible, non facturée) + INIT (CPU plus généreux, facturée depuis août 2025) + 1re invocation (CPU bridé). Le priming fait passer le travail paresseux sur le CPU de l'INIT : gain en latence et en coût, même en on-demand. Juger la latence perçue (`init + duration`, et curl), pas `initDurationMs` seul.

## Bloc 2 — appel warm lent après une pause
- **Je vois :** 2-3 ms en rafale, 17-31 ms après 50 s ou 2 min sans appel, même `instanceId`, pas d'INIT.
- **Qui dit non / qui gagne :** le freeze/thaw : l'environnement a été suspendu, ce qui avait été chargé en cache refroidit.
- **Je regarde :** `durationMs` des `platform.report` en fonction de l'écart entre appels.
- **Je répare :** rien (comportement normal). Au-delà de ~20-30 min sans trafic, l'environnement est recyclé : nouvel `instanceId`, nouveau cold start.

## Bloc 2 — 125 ms côté client pour 3 ms côté Lambda
- **Je vois :** `curl` `time_total` ≈ 125 ms en warm ; `durationMs` ≈ 3 ms. Au cold : 521 ms côté client, 193 ms côté Lambda.
- **Qui dit non / qui gagne :** le réseau (Marseille → eu-west-1), le TLS (nouvelle connexion à chaque curl), API Gateway ; au cold, en plus, la création de la micro-VM avant `initStart`.
- **Je regarde :** `curl -w "dns=%{time_namelookup} tcp=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}"`.
- **Je répare :** rien à réparer : savoir répartir la latence entre réseau, plateforme et code avant d'optimiser le code.

## Bloc 2 — CI rouge après l'ajout de la stack app (à diagnostiquer)
- **Je vois :** l'étape `cdktn diff dev-bootstrap` échoue sur `apps/api/dist/manifest.json not found`, alors que bootstrap n'a pas changé.
- **Qui dit non :** _à compléter_
- **Je regarde :** _à compléter_
- **Je répare :** _à compléter_
## Bloc 2 — 15 requêtes parallèles : 10 × 200, 5 × 500
- **Je vois :** `500 {"message":"Internal server error"}` sur 5 requêtes ; aucun log ni `REPORT` côté Lambda pour ces 5 requêtes.
- **Qui dit non :** Lambda, en throttling (429 `TooManyRequestsException`) : la concurrence du compte est de **10** (`ConcurrentExecutions`), partagée par toutes les fonctions. API Gateway reçoit ce 429 sur l'appel `Invoke` et renvoie au client un 500 générique (échec d'intégration).
- **Je regarde :** `aws lambda get-account-settings --query AccountLimit` ; métrique `AWS/Lambda Throttles` ; access logs API Gateway (`integrationStatus` = 429). Aucun log Lambda = la requête n'est jamais arrivée dans la fonction.
- **Je répare :** limiter à l'entrée de l'API : throttling du stage (`throttlingBurstLimit` ≤ concurrence Lambda, et `throttlingRateLimit` × durée d'une requête ≤ concurrence Lambda). API Gateway répond alors un vrai `429 Too Many Requests` sans appeler Lambda. Demander une augmentation du quota (Service Quotas) : prérequis de la reserved et de la provisioned concurrency.
- **À retenir :** concurrence ≈ requêtes/s × durée (loi de Little). Le client ne peut pas distinguer un 500 de throttling d'un 500 de bug : seuls les logs et métriques le peuvent.

## Bloc 2 — « je pensais avoir déployé » (config absente sur AWS)
- **Je vois :** `LAB_MODE=1` présent dans `main`, absent de `get-function-configuration` ; le comportement du lab ne change pas.
- **Qui dit non :** le verrou S3 du state. Un `deploy` interrompu par Ctrl-C a laissé `dev/app.tfstate.tflock` ; le deploy suivant a échoué (`Error acquiring the state lock`, 412) sans que je le remarque.
- **Je regarde :** `aws lambda get-function-configuration --query '[LastModified, CodeSha256, Environment]'` comparé à `apps/api/dist/manifest.json` et à l'heure du commit ; `cdktn diff dev-app` ; `aws s3 ls s3://<bucket>/dev/`.
- **Je répare :** vérifier que le détenteur du verrou ne tourne plus, `terraform force-unlock <ID>`, redéployer, puis `diff` → `No changes`.
- **À retenir :** un déploiement n'est fait que si le plan suivant est vide. Jamais de Ctrl-C pendant un apply.

## Bloc 2 — verrou orphelin après expiration des credentials
- **Je vois :** `Error acquiring the state lock` au deploy suivant, alors qu'aucun autre deploy ne tourne.
- **Qui dit non :** S3 (412). Le deploy précédent avait posé le verrou, puis attendu l'« approve » ; la session `aws login` a expiré pendant l'attente, le deploy a échoué sans pouvoir supprimer le `.tflock`.
- **Je regarde :** `ps aux | grep -E "cdktn|terraform"` (aucun process vivant) ; `Lock Info` (ID, Who, Created) ; `aws s3 ls s3://<bucket>/dev/`.
- **Je répare :** `cd infra/cdktf.out/stacks/dev-app && terraform force-unlock <ID>`, puis `cdktn diff` pour vérifier qu'aucun changement n'est parti à moitié.
- **À retenir :** un deploy en attente de confirmation détient le verrou. Rafraîchir la session avant une opération longue ; lire le plan avec `diff`, appliquer ensuite.

## Bloc 2 — mesures de durée très dispersées à petite mémoire
- **Je vois :** même calcul (`cpuWork=100000`), même environnement : 157 à 268 ms à 128 Mo ; 21,4 à 21,9 ms à 1769 Mo.
- **Qui dit non / qui gagne :** le bridage CPU (quota cgroup) : à petite mémoire, la fonction tourne à pleine vitesse par tranches, puis est suspendue jusqu'à la période suivante. La durée dépend de l'endroit où le calcul tombe dans ces périodes.
- **Je regarde :** min / médiane / max sur 10 appels warm ; le **min** reflète la capacité CPU, la médiane le bridage.
- **Je répare :** comparer des tailles sur le min et la médiane de plusieurs séries, jamais sur un appel isolé. Si la latence doit être stable, monter en mémoire.

## Bloc 2 — choix de `memorySize` : la règle « Mo / 1769 » ne suffit pas
- **Je vois :** la règle prévoyait un calcul 2 fois plus rapide à chaque doublement jusqu'à 1769 Mo. Mesuré : plafond déjà atteint vers 1024 Mo, et 3008 Mo plus rapide que 1769 malgré un calcul mono-thread.
- **Qui dit non / qui gagne :** l'allocation CPU réelle n'est pas linéaire ; au-delà de 1769 Mo, le 2e vCPU absorbe probablement le travail de fond de V8 (GC, JIT) (hypothèse non profilée).
- **Je regarde :** `billedDurationMs × memorySize` (coût relatif) pour chaque taille ; voir ADR-0006.
- **Je répare :** mesurer chaque fonction avant de fixer `memorySize` (à la main ou avec AWS Lambda Power Tuning). Pour `health` : 1024 Mo.

## Setup — script collé dans zsh : `number expected`, `sleep: invalid time interval`
- **Je vois :** une fonction shell copiée-collée échoue sur des mots de ses commentaires.
- **Qui dit non :** zsh : en mode interactif, `#` n'est pas un commentaire par défaut ; `(…)` est lu comme un *glob qualifier*.
- **Je regarde :** les mots d'erreur correspondent au texte après `#`.
- **Je répare :** `setopt interactivecomments` dans `~/.zshrc`.
