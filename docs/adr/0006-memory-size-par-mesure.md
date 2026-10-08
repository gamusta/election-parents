# ADR-0006 — `memorySize` choisi par mesure, 1024 Mo pour `health`

- Statut : accepté
- Date : 2026-10-09
- Bloc : 2

## Contexte
Lambda attribue le CPU en proportion de `memorySize` ; la documentation indique ~1 vCPU à 1 769 Mo. `health` n'utilise que ~90-97 Mo de RAM, mais sa latence et son coût dépendent du CPU. Mesure : `?cpuWork=100000` (`pbkdf2Sync`, mono-thread), 10 appels warm par taille, ARM64, eu-west-1.

| Mo | cpuMs min | cpuMs min/max | billed (médiane) | billed × Mo | ≈ $ / million d'appels (calcul seul) |
|---|---|---|---|---|---|
| 128 | 157 | 157 / 268 | 305 | 39 000 | 0,51 |
| 256 | 82 | 82 / 152 | 147 | 37 600 | 0,49 |
| 1024 | 21,5 | 21,5 / 32 | 35 | 35 800 | 0,47 |
| 1769 | 21,4 | 21,4 / 21,9 | 25 | 44 200 | 0,58 |
| 3008 | 17,3 | 17,3 / 17,6 | 21 | 63 200 | 0,82 |

Constats : jusqu'à 1024 Mo, plus de mémoire = plus rapide **et** moins cher ; au-delà, chaque gain de quelques ms se paie de 23 à 76 % de coût en plus. À 128 Mo, `maxMemoryUsed` atteint 75 % de la limite.

## Options
| Option | Pour | Contre |
|---|---|---|
| 128 Mo (défaut AWS) | — | le plus lent, pas le moins cher, proche de la limite mémoire |
| 256 Mo (valeur initiale) | 2× plus rapide que 128 au même prix | latence instable (bridage) |
| 1024 Mo | coût minimal mesuré, 9× plus rapide que 128 | — |
| 1769 / 3008 Mo | latence minimale et stable | +23 % / +76 % de coût |

## Décision
`health` passe à 1024 Mo. Toute nouvelle fonction part de 1024 Mo, puis sa valeur est fixée par mesure (à la main ou AWS Lambda Power Tuning), consignée ici ou dans un ADR dédié.

## Conséquences
- La valeur est dans le code (pas de variable d'environnement au synth) : le code reste la seule source de vérité.
- Le résultat vaut pour un travail CPU mono-thread ; une fonction surtout en attente d'I/O (DynamoDB, KMS) se mesurera différemment.
- Remise en cause : changement de runtime ou d'architecture, nouveau profil de charge, ou évolution de la tarification Lambda.
