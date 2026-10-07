# Diagnostic — une ligne par panne

Format : symptôme → qui refuse / qui gagne → où regarder → correction.
Critère : « je sais expliquer la panne ».

| Bloc | Symptôme | Qui refuse / qui gagne | Où regarder | Correction |
|---|---|---|---|---|
| Setup | `aws login` fait, mais la CLI utilise toujours les clés longues | La chaîne de credentials : `~/.aws/credentials` passe avant la session login | `aws configure list --profile <p>` (colonne TYPE) | Retirer le profil de `~/.aws/credentials`, relancer `aws login` |
| Setup | `aws login` ne propose que le root | La session console du navigateur (root connecté) | Compte affiché sur la page de login | Se déconnecter de la console, se reconnecter en IAM user (Account ID + user) |
