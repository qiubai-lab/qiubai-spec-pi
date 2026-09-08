# Change Types And Workflow Tiers

Choose type and tier independently. Type shapes the content; tier controls persistence, gates, traceability, and verification cost.

## Change Type

### Feature

Use when introducing user-visible or system behavior from a product need.

Capture:

1. Goal and affected users
2. Scope and non-goals
3. Assumptions and constraints
4. Requirements and relevant primary, alternate, error, and recovery scenarios; allocate `REQ-*` when the tier requires it
5. Behavior Delta, normally `ADDED` plus any changed existing behavior
6. Observable acceptance linked to requirements; allocate `AC-*` when the tier requires it
7. Open questions and recommended approach

Keep requirements about what and why. Put implementation decisions in the plan.

### Bugfix

Use for defects and regressions where preserving existing behavior matters.

Capture:

1. Observed behavior and reproducible conditions
2. Expected behavior
3. Root cause, or `unknown` until diagnosis establishes evidence
4. Invariants that must remain unchanged; allocate `REQ-*` when the tier requires it
5. Behavior Delta, usually `MODIFIED`
6. Regression acceptance covering the failure and protected neighboring behavior; allocate `AC-*` when the tier requires it
7. Residual uncertainty and the focused verification path

Do not present an unverified root-cause hypothesis as fact.

### Design

Use when feasibility, architecture, migration, performance, compliance, or another technical constraint must shape the requirement.

Capture:

1. Technical drivers and measurable non-functional constraints
2. Current architecture and hard compatibility boundaries
3. Feasible design options and recommendation
4. Requirements derived from the selected design, with `REQ-*` IDs when the tier requires them
5. Behavior Delta, including compatibility and migration effects
6. Acceptance for observable behavior and measurable technical outcomes, with `AC-*` IDs when required
7. Risks, rollback needs, and unresolved decisions

Use for architecture-first, feasibility, migration, NFR-driven, behavior-neutral tooling, documentation, or workflow changes. Do not let design silently invent product behavior; surface such choices for user approval.

## Workflow Tier

### Quick

Use for low-risk, easy-to-revert work with little coordination.

- Prefer an inline Goal / Scope / Acceptance / affected files / focused verification note.
- Do not allocate change or trace IDs unless the change is persisted.
- Do not require a separate plan or independent spec review.
- Escalate the tier, not the type, when risk or coordination grows.

### Standard

Use when an ordinary change needs meaningful implementation coordination, design choices, or durable acceptance tracking beyond a brief inline note. File count alone is not a reason to escalate.

- Default to one change document containing requirements, implementation steps, and verification evidence; split a plan only for complex coordination, substantial independently maintained planning, or an explicit request.
- Use stable `REQ-*` and `AC-*` IDs.
- Use ordinary task checkboxes and an AC-to-check mapping; do not require `TASK-*` or `VER-*` IDs.
- Run the lightweight quality check inside shaping, then proceed directly to planning.

### Strict

Use for material security or authorization behavior changes, destructive/data-compatibility migrations, significant public-contract changes, high-impact core rules, deployment or isolation changes with substantial failure consequences, difficult recovery, broad uncertain refactors, or explicitly audited work. Inspect actual behavior and blast radius; merely editing a file or documentation mentioning these topics is not enough.

- Persist the change and run independent `reviewing-spec-quality` before planning.
- Use full `REQ-*`, `AC-*`, `TASK-*`, and `VER-*` traceability.
- Require risk-specific architecture, test, rollback, compatibility, and verification gates as applicable.

Choose type first, then tier. Examples: `bugfix + quick`, `feature + standard`, `design + strict`.

## Risk-Based Selection

Consider changed behavior, affected consumers/data, reversibility, uncertainty and coordination. Choose the lightest tier that preserves necessary evidence. Five files mechanically renaming a private symbol may be quick; one line changing an authorization decision may be strict. Public API documentation correction is not automatically strict. A benign additive schema change may be standard when compatibility and recovery are clear; a destructive migration requires strict protection.

Persistence alone does not escalate a quick change. Small local structural fixes within known boundaries remain quick when risk is low. Reassess if implementation exposes material new risk, not merely because another file was touched.

## Common Quality Rules

- Mark unresolved ambiguity as `[NEEDS CLARIFICATION: <specific gap>]` instead of guessing.
- State assumptions separately from approved requirements.
- Include non-functional requirements only when relevant, but make them measurable when included.
- For standard and strict, each `AC-*` references at least one `REQ-*`; each `REQ-*` has acceptance coverage or an explicit reason why it does not.
- Existing executable sources such as OpenAPI, schemas, design tokens, tests, linters, or formatters remain canonical; reference rather than duplicate them.
