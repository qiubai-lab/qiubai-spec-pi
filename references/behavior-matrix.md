# Mechanical behavior matrix

| Case | Inspect | Transition | Archive | Doctor |
| --- | --- | --- | --- | --- |
| persisted quick | one spec | spec only | `spec.md` | no plan requirement |
| combined standard | one spec | spec only | `spec.md` | REQ/AC mechanical checks |
| historical split-standard | spec + optional plan | one selected document | preserve `spec.md` + `plan.md` | lifecycle drift is a warning |
| strict | spec + required plan | one selected document | requires both active; preserve both | REQ/AC/TASK/VER checks |
| archived | report idempotently | immutable | report idempotently | archive shape/status checks |
| duplicate active id | fail closed | fail closed | fail closed | error finding |
| active/archive conflict | fail closed | fail closed | fail closed | error finding |
| linked or escaping path | fail closed | fail closed | fail closed | error finding |
| pending/partial archive | recovery required | recovery required | recovery required | classify safe actions and journal hash; never choose or mutate |
| caller approval/verification | not evaluated | explicit attestation for promotion | explicit attestation required | not evaluated |

The tools never judge requirement meaning, acceptance sufficiency, user authorization, Directory Map applicability, or long-term context promotion.

## Workflow coverage

| Entry/state | Skill owner | Mechanical support |
| --- | --- | --- |
| `/qiubai-spec <request>` | `shaping-requirements` + centralized routing | inspect existing changes as needed |
| strict or materially ambiguous spec | `reviewing-spec-quality` | doctor may report mechanical metadata/trace defects only |
| shaped standard/strict | `writing-qb-plans` | transition each persisted document after authorization |
| architecture signal | `checking-architecture-boundaries` | none; semantic decision remains with the agent |
| critical behavior signal | `protecting-critical-behavior` | none; tests use normal Pi capabilities |
| implemented change | `updating-directory-map` when triggered, then `verifying-before-completion` | doctor/inspect, then archive after evidence is judged sufficient |
| conflict/recovery/manual close | `closing-qb-change` | doctor classifies; recover executes only a user-selected safe complete/restore; no force/overwrite |
| durable context candidate | `maintaining-project-context` after explicit approval | none |
| `/qiubai-init entry` | `initializing-qb-spec` | normal precise file editing after entry authorization |
| `/qiubai-init bootstrap|adopt` | `establishing-project-foundations` and centralized routing | normal Pi implementation tools |

`skills/shaping-requirements/references/workflow-routing.md` is the only source of default next-action order. Prompt templates start the appropriate workflow but do not prove approval or verification.
