# Mocks d'entretien archi (EN) — journal

Format : cas, relances, challenge ; note sur 4 axes (modélisation, garanties de livraison, opérabilité, communication) ; corrections d'anglais.

---

## Mock #1 — J1 (sam. 10/10) — Payroll payment run : contextes et agrégats

**Juste** : partir du métier et du flux ; Employee → Beneficiary côté Payment ; un agrégat par Transfer.

**Manquait**
- Contextes : HR, **Payroll** (calcule le net, publie `PayrollValidated`), Payment (PaymentRun, Transfer, Beneficiary), Treasury éventuel. **La banque est un système externe** → Anti-Corruption Layer.
- Pourquoi un agrégat par Transfer : agrégat = frontière de transaction ; « jamais payé deux fois » est un invariant par bulletin (`payslipId` → `transferId`) ; retours bancaires concurrents → éviter la contention sur un run de 2 000 lignes. Le débit de la banque relève de l'infra, pas de la frontière d'agrégat.
- Règles du run (règle de Vernon) : invariant immédiat → un seul agrégat (`PaymentRun` réserve les fonds avant l'envoi) ; le reste à terme via domain events (complétude par compteur/projection sur `TransferSettled`).

**Note** : modélisation 2/4 · garanties n/a · opérabilité n/a · communication 2/4 (justification 1/4).

**Anglais**
| Écrit | Pro |
|---|---|
| first I check with the Busines ou PO les "parties prenanate" | First, I'd check with the business or the PO who the stakeholders are. |
| Not mean the same this so there a boundaryfor HR | It doesn't mean the same thing, so there's a boundary between HR and Payment. |
| yes bank is context of ours | The bank is an external system; we protect ourselves with an anti-corruption layer. |
| We dont control the bank load capacity, so on call at once, except the a guaranty in api… | We don't control the bank's capacity, so we send one call at a time, unless the API guarantees how many concurrent calls we can make. |
| Payement | Payment |

Phrases : *My reasoning is…* · *The trade-off is…* · *This invariant must hold immediately, so it lives inside the aggregate.* · *This one can be eventually consistent.*

**À retravailler** : 1) toujours le *pourquoi* en 2-3 phrases ; 2) système externe vs bounded context, ACL ; 3) invariant immédiat vs cohérence à terme.
