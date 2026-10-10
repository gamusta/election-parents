# Prompts de session — prépa PayFit (une session = une demi-journée)

Le prompt de démarrage ci-dessous ne sert qu'à J1. Ensuite, la clôture génère le suivant, complet et prêt à coller.

## Démarrage

```
On démarre J[N] [matin|après-midi] : [titre du jour dans docs/plan.md]. Test PayFit : jeu. 15/10.

Résumé de la session précédente :
[coller le résumé de clôture]

Lis d'abord : AGENTS.md, docs/plan.md (section J[N]), docs/mock.md (points à retravailler), docs/diagnostic.md (fiches ouvertes). Fais `git pull` et relis les commits non vus.

Déroulé : demi-journée en rotation (docs/plan.md, « Demi-journée type » et ligne J[N] [M|A] de la grille), jamais plus d'1 h 20 sur un sujet :
1. [matin] 🎙 Mock archi en anglais (40 min) : tu es l'architecte PayFit ; relances, challenge ; tu restes en anglais ; corrections et note à la fin → docs/mock.md.
2. 🧠 Domaine (DDD/TDD/BDD/CQRS) : example mapping + .feature avant chaque agrégat, red → green → refactor. Je code ; tu donnes l'étape, les points de vigilance, puis une revue précise. Pas de code complet sauf demande.
3. ☁️ Infra (cdktn + AWS) : je code ; déployer → observer → casser → diagnostiquer → corriger. Chaque panne → fiche docs/diagnostic.md (tu rédiges, je relis). Chaque décision → ADR (format MADR existant).
4. ⚛️ React / TanStack : tu génères le squelette, je pratique le concept du jour ; best practices en 3 lignes.
5. [après-midi] 🎙 Test cumulatif (40 min) sur tout ce qui a été vu depuis J1 : design en anglais, 5 questions, 1 debug ; note + 3 points → docs/mock.md.
6. ⚡ Atelier réflexes (20 min) : 5 gestes du thème du jour, que je pratique ; consignés dans docs/reflexes.md. Seulement ce que les tops font et que les devs moyens ignorent.
Si une piste déborde, on coupe et on la reprend à la demi-journée suivante.

Règles : questions de clarification d'abord ; explications brèves, analogies pour les concepts nouveaux ; attends mon retour avant l'étape suivante. Jamais de commande AWS mutante, jamais de modification d'infra/ sans demande.
```

## Clôture

```
Fin de session. Donne-moi un résumé de clôture (20 lignes max) :
- Fait (livrables, commits, état des stacks déployées/détruites)
- Pannes vues et comprises (1 ligne chacune, format diagnostic.md)
- ADR écrits ou à écrire
- Mock / test : note et 3 points à retravailler
- Réflexes acquis (titres seulement)
- Reste à faire / bonus non faits
- Questions non résolues

Puis génère le prompt de démarrage de la session suivante (selon docs/plan.md), complet et prêt à coller, avec ce résumé intégré.
```
