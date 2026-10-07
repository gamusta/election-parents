# ADR-0004 — Node 24, Lambdas ARM64, poste de dev Intel

- Statut : accepté
- Date : 2026-10-07
- Bloc : setup

## Contexte
Le runtime Lambda `nodejs24.x` est supporté ; Node 26 n'arrive sur Lambda qu'en novembre 2026. Les Lambdas ARM64 (Graviton) sont moins chères à performance égale. Le poste de dev est un Mac Intel (x86_64).

## Décision
Node 24 en local (épinglé par mise) et sur Lambda. Lambdas en ARM64, bundling esbuild.

## Conséquences
- Même version majeure en local et sur Lambda : pas d'écart de comportement.
- JavaScript pur : l'architecture du poste est sans impact.
- Risque : dépendance npm avec binaire natif embarquée en x86_64 → crash au chargement sur ARM64. À surveiller au bloc 2 (signalé dans AGENTS.md).
- Outils CLI : préférer mise à Homebrew (Homebrew compile depuis les sources sur Intel).
