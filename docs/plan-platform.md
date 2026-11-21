# Plan — prépa entretien platform engineering (3 jours × 7 h)

> **Reprise de session** (après `/clear`) : lire ce fichier en entier, puis `git status`, `git log --oneline -5`, `gh pr list`. La ligne « 👉 Prochaine étape » du journal dit où reprendre.
> Remplace `docs/plan.md` (prépa PayFit, oct. 2026), gardé pour l'historique.

## Objectif
Maîtriser 10 sujets de platform engineering (environnement régulé GxP, 2ᵉ tour). L'app d'élection n'est qu'un support.
Critère : pour chaque sujet, **2 alternatives + 1 limite chiffrée**, justifiées en 2 minutes, en anglais.

| # | Sujet | Maîtrisé = tu sais… |
|---|---|---|
| 1 | Arbitrer les services async AWS (Step Functions, SQS + Lambda, EventBridge, Batch/ECS) ⚠️ faiblesse 1er tour | 2 alternatives + 1 limite chiffrée par choix ; idempotence, DLQ, coût par transition |
| 2 | Golden path / plateforme self-service | template, CI, IaC, secrets, monitoring, catalogue (Backstage) ; « comment mettre à jour 40 repos générés ? » |
| 3 | Multi-comptes AWS ⚠️ | Organizations, OU, SCP, account vending (Control Tower / AFT), rôles cross-account, réseau partagé ; un compte par squad et par env |
| 4 | Bibliothèques IaC partagées | CDK ou Terraform, semver, changements cassants, policy-as-code, ownership |
| 5 | CI/CD partagée à l'échelle | workflows réutilisables versionnés, OIDC, promotion avec approbation, SBOM et signature, canary d'un changement de workflow |
| 6 | Réseau et redondance ⚠️ | multi-AZ vs multi-région, RTO/RPO, actif-passif vs actif-actif, VPC, NAT, endpoints, PrivateLink, ce qui casse en premier |
| 7 | Software factory à agents | sandbox, contexte (MCP), garde-fous (prompt injection, secrets), humain dans la boucle, évaluation, coût, traçabilité GxP |
| 8 | Concevoir pour de nombreuses équipes ⚠️ | multi-tenance, quotas, noisy neighbour, ownership et astreinte, plateforme comme produit, DORA, temps jusqu'au 1er déploiement |
| 9 | API et SDK cœur | expand-and-contract, versions d'API, authN/authZ, rate limiting, OpenTelemetry, masquage des données de santé |
| 10 | Contraintes GxP | piste d'audit, change control, environnement validé, séparation des rôles, rétention des logs, preuve de déploiement en CI |

## Mode de travail (PR par PR)
1. **Code métier et applicatif** (domaine, use cases, adapters, handlers, tests) : l'IA l'écrit, le teste, commite et ouvre la PR, puis résume en quelques lignes ce qui compte pour le sujet cible.
2. **Parties cibles** (`infra/`, CI, ADR à défendre) : l'IA donne **besoin / finalité** et compromis, puis **chaque fichier** (chemin + contenu complet + rôle), la **vérification**, les étapes **déployer → observer → casser** et 2–3 questions. Le développeur écrit ces fichiers et **déploie lui-même**.
3. Il dit « fait » → l'IA relit, commite, ouvre la PR.
4. L'IA ne lance jamais `deploy`, `apply`, `destroy`, ni de commande AWS qui modifie une ressource (lecture seule uniquement).

## Calendrier
### J1 — Arbitrer l'async (#1)
Fiche chiffres (0:45) · clôture Scheduler → Step Functions → Lambdas + 3 pannes (3:00) · variante SQS + Lambda + DLQ (1:30) · mock anglais : 3 cas d'arbitrage (1:15) · notes (0:30).

| PR | Contenu | Sujet | État |
|---|---|---|---|
| 4 | `/api/*` CloudFront → API Gateway | — | ✅ mergée |
| 5 | `Election` enregistre `ElectionOpened` / `ElectionClosed` | domain events | ✅ mergée |
| 6 | `docs/async-cheatsheet.md` + ce plan | #1 chiffres | ✅ mergée |
| 7 | Domaine : `allocateSeats` (plus fort reste), `ElectionResults` | modélisation | PR #7 ouverte |
| 8 | Application : `closeElection`, `tallyVotes`, ports + fakes en mémoire | idempotence par la base | PR #8 ouverte (empilée sur #7) |
| 9 | Adapters DynamoDB + handlers `close-election`, `tally-votes` (appelés par Step Functions, `TaskError.name` = code pour Retry/Catch) | ADR-0017 | PR ouverte (empilée sur #8) |
| 10 | Infra : machine à états Standard (Retry/Catch), Scheduler, IAM, alarme + ADR-0019 | #1, #4 | à faire |
| 11 | Pannes : timeout, double démarrage, erreur sans Catch → `diagnostic.md` | diagnostic | à faire |
| 12 | Variante SQS + Lambda : consumer idempotent, `ReportBatchItemFailures`, DLQ + alarme | #1 | à faire |

### J2 — Construire la plateforme (#4, #5, #2, #10)
Bibliothèque IaC : constructs extraits en package versionné (semver, changesets), changement cassant simulé, policy-as-code (cdk-nag / Checkov) (2:00) · CI partagée : workflow réutilisable `workflow_call` versionné, promotion dev → prod avec approbation, SBOM + attestation de provenance = preuve de déploiement GxP (2:30) · golden path : générateur « nouveau service » + mise à jour de 40 repos (1:30) · mock anglais (1:00).

### J3 — Design et oral (#3, #6, #8, #7, #9, #10)
Multi-comptes + réseau : ADR + schéma Excalidraw (2:30) · #8 plateforme multi-équipes (1:00) · #9 expand-and-contract sur `packages/contracts` (1:00) · #7 setup Claude Code comme cas concret (1:00) · simulation finale 45 min + débrief (1:30).

## Constats utiles
- AWS `dev` (eu-west-1) déjà déployé : DynamoDB `dev-election`, Lambdas `dev-cast-vote` / `dev-voting-read` / `dev-health` (arm64), API Gateway `dev-api`, S3 web + CloudFront (`/api/*` inclus).
- Diff permanent sur `dev-app` : `cors_default_4xx/5xx` (template `application/json` ajouté par défaut par API Gateway) → à déclarer explicitement dans `infra/`, puis fiche `diagnostic.md`.
- Le front publié sur S3 date du 13/10 ; pas de publication automatique (`s3 sync` + invalidation à la main).
- Limites relevées en 2025–2026 : SQS 1 MiB, Lambda async 1 MB, EventBridge 1 MB (Step Functions 256 KiB et SNS 256 KB inchangés).

## Journal
- **2026-11-21** — Reprise. PR 4 et 5 ouvertes. Priorités et mode PR par PR décidés. Fiche async écrite.
- **2026-11-21 (suite)** — PR 4, 5, 6 mergées. PR 7, 8, 9 (code métier, écrit par l'IA) ouvertes et empilées. Décision : l'IA écrit tout le code métier, le développeur se concentre sur les parties cibles.
  👉 **Prochaine étape** : merger 7 → 8 → 9 dans l'ordre, puis PR 10 (infra Step Functions, écrite par le développeur, guidée).
