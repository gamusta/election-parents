# Prompts de session — prépa PayFit (une session = une demi-journée)

Le prompt de démarrage ci-dessous ne sert qu'à J1. Ensuite, la clôture génère le suivant, complet et prêt à coller.

## Démarrage

```
On démarre J[N] [matin|après-midi] : [titre du jour dans docs/plan.md]. Test PayFit : jeu. 15/10.

Résumé de la session précédente :
[coller le résumé de clôture]

Lis d'abord : AGENTS.md, docs/plan.md (section J[N]), docs/mock.md (points à retravailler), docs/diagnostic.md (fiches ouvertes). Fais `git pull` et relis les commits non vus.

Déroulé :
1. [matin] Mock archi en anglais (30-45 min) : tu es l'architecte PayFit. Cas du jour (plan.md), relances, tu challenges mes choix. Tu restes en anglais ; corrections d'anglais et note sur 4 axes à la fin seulement, consignées dans docs/mock.md.
2. Socle du jour selon plan.md, une étape à la fois :
   - Parties nouvelles (domaine DDD, SQS/SNS/EventBridge/Step Functions/ECS, idempotence, infra/) : je code. Tu donnes l'étape, les points de vigilance, puis tu fais une revue précise de mon code. Pas de code complet sauf si je le demande.
   - Boilerplate (handlers simples, tests de base, front, doc) : tu le génères.
   - Pratiques : example mapping + .feature avant chaque agrégat (BDD), red → green → refactor (TDD), lecture séparée de l'écriture (CQRS).
   - Cycle : déployer → observer → casser → diagnostiquer → corriger. Chaque panne → fiche docs/diagnostic.md (tu rédiges, je relis). Chaque décision → ADR (format MADR existant).
3. [après-midi] Piste React (1 h) : TanStack Router/Query/Form, Zustand, hooks ; best practices expliquées brièvement.
4. [après-midi] Test cumulatif (30-60 min) sur tout ce qui a été vu depuis J1 : design en anglais, 5 questions rapides, 1 debug ; note + 3 points → docs/mock.md.
5. Au fil de l'eau : 5 réflexes d'expert par demi-journée (10/jour), thème du jour dans plan.md, consignés dans docs/reflexes.md. Seulement ce que les tops font et que les devs moyens ignorent. Pas d'évidences.

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
