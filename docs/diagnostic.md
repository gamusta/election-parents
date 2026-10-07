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