# ADR-0001 — cdktn en TypeScript, moteur Terraform

- Statut : accepté
- Date : 2026-10-07
- Bloc : setup

## Contexte
L'infra doit être écrite en TypeScript (même langage que l'app). CDKTF a été archivé par HashiCorp en décembre 2025 ; cdktn (CDK Terrain) est le fork communautaire, qui cible Terraform ou OpenTofu.

## Options
| Option | Pour | Contre |
|---|---|---|
| cdktn + Terraform | Majoritaire chez les clients, doc et exemples AWS | Licence BSL |
| cdktn + OpenTofu | Open source (MPL), cible de premier rang de cdktn | Moins répandu en mission |
| HCL pur | Standard, aucune couche d'abstraction | Pas de TypeScript |

## Décision
cdktn + Terraform. Le JSON synthétisé est relu à chaque bloc (le plan reste la source de vérité).

## Conséquences
- Passer à OpenTofu = changer de binaire (state et providers compatibles).
- Risque : fork communautaire d'un projet abandonné par l'éditeur. Remise en cause si cdktn n'est plus maintenu.
- Versions de Terraform, cdktn et providers épinglées (`mise.toml`, `package.json`, `.terraform.lock.hcl`).
