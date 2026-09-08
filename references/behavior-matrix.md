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
| pending/partial archive | recovery required | recovery required | recovery required | report only; never repair |
| caller approval/verification | not evaluated | explicit attestation for promotion | explicit attestation required | not evaluated |

The tools never judge requirement meaning, acceptance sufficiency, user authorization, Directory Map applicability, or long-term context promotion.
