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