# Workflow Routing

This is the single source of truth for qb-spec next-action decisions. Other skills report results and trigger signals; they do not define a competing default sequence.

The bundled qb-spec rules are a local snapshot. Use packaged references and existing project sources; do not fetch, refresh, or import external material to update these rules during execution. Changes to this snapshot belong to an explicitly requested skill-maintenance task.

## Primary Path

| Current state | Condition | Next action |
| --- | --- | --- |
| request | material uncertainty remains | use `shaping-requirements` to shape or ask one focused question |
| shaping | project creation, explicit baseline assessment/adoption, or a change requires establishing/redefining target boundaries or engineering policy, and that design input is missing | obtain only the missing design from `establishing-project-foundations`, then resume current shaping; local corrections within known boundaries use `checking-architecture-boundaries` |
| foundations designed | Foundation Decision exists | resume `shaping-requirements` or update the affected existing spec/plan; mark the design input present, do not restart foundations |
| shaped | quick tier | implement from the inline spec; use an inline plan only when it adds value |
| shaped | standard tier and embedded quality check passes | use `writing-qb-plans` to add implementation steps and verification mapping to the same change document; split a plan only when justified |
| shaped | standard tier but high-impact ambiguity remains | run `reviewing-spec-quality` |
| shaped | strict tier | run `reviewing-spec-quality` |
| reviewed | PASS or PASS WITH NOTES | use `writing-qb-plans` |
| reviewed | clarification or failure | revise through `shaping-requirements`; do not plan |
| planned | architecture-boundary signal | run `checking-architecture-boundaries` before affected implementation |
| planned | critical behavior signal | use `protecting-critical-behavior` before affected implementation |
| planned | no pending conditional gate | implement |
| implemented | structural map update required | run `updating-directory-map` before final completion |
| implemented | all tiers | run `verifying-before-completion` at the existing tier |
| verified | inline quick change | `verifying-before-completion` reports completion; there is nothing to archive |
| verified | persisted change and archive is conflict-free | `verifying-before-completion` verifies and archives in the same completion step |
| verified | archive conflict, recovery, legacy close, or explicit manual close | use `closing-qb-change` |

## Non-Blocking Context Path

A durable product, domain, architecture, acceptance, decision, UI-style, or engineering-style candidate does not change the primary completion path. Complete and archive the current change when safe, then request explicit approval through `maintaining-project-context`. No response or no approval means no long-term context update.

For an explicitly requested new project using `establishing-project-foundations`, necessary adopted engineering context and root Agent entry setup are already within scope. Write that context through `maintaining-project-context` and perform entry setup through `initializing-qb-spec` as implementation tasks, then resume implementation. Explicitly approved baseline changes in an existing project authorize only that context scope; entry setup still requires explicit intent. Reuse existing approval, but do not promote newly inferred preferences under this exception.

## Routing Rules

- Resolve one next action, not a list of ceremonial skill handoffs.
- Conditional architecture and test checks may both apply, but only to the affected scope.
- Do not call independent review for an ordinary standard change whose embedded quality check passed.
- Do not call `closing-qb-change` after every successful verification; it is the exception and recovery path.
- If another skill's local guidance conflicts with this table, this table wins for workflow order.
- Foundation design is a conditional input, not a new lifecycle or mandatory gate for everyday development. Its implementation uses the current tier and plan; initialization returns to its caller and never routes back to shaping.

## Execution And Reporting Cost

- Skill checks are capabilities within the current task, not mandatory separate user-facing phases. Reuse already sufficient decisions and evidence; do not reload all references or repeat handoffs to satisfy labels.
- Output/Completion Contracts define information to retain or reason about, not a template to print at each step. Default user reports contain the result, relevant verification and unresolved items; add artifact links when useful. Omit empty, unchanged and not-applicable fields. Explicit audits may request fuller detail.
- Reuse authorization already covering the task. A new document or phase is not a new permission boundary; material new scope, behavior choices or unapproved persistent preferences still require clarification.
