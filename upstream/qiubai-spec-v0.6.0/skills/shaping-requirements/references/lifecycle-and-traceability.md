# Lifecycle And Traceability

Read this reference when creating or updating a persisted qb-spec change.

## Change Identity

Use a stable change ID in the form `QB-YYYYMMDD-<topic-slug>`. Before assigning it, search active specs and archives for a collision. Once referenced by another artifact, never rename or reuse the ID.

Persist active artifacts at:

- Spec: `docs/qb-spec/specs/<change-id>-<topic-slug>.md`
- Separate plan, only when needed: `docs/qb-spec/plans/<change-id>-<topic-slug>.md`
- Archive: `docs/qb-spec/archive/YYYY/<change-id>/`

Quick-tier work may remain inline. If persisted, it follows the same identity and lifecycle rules.

Standard defaults to a single spec at the existing spec path: append implementation steps and an AC-to-check/evidence table there. It has one lifecycle and one set of requirements. Strict retains a separate plan; existing split standard documents remain valid and are not merged automatically. Archive a combined document as `spec.md` with all its sections; create `plan.md` only when a separate plan actually exists. Do not treat an absent standard plan as a missing artifact.

## Required Frontmatter

For mechanical metadata updates or archiving, prefer the shared [change tool](../../closing-qb-change/references/change-tool.md). Python absence/incompatibility permits native-tool fallback; execution errors require diagnosis, not automatic fallback. Semantic edits and approval/evidence decisions remain with the agent.

```yaml
---
id: QB-YYYYMMDD-topic
type: feature | bugfix | design
tier: quick | standard | strict
status: draft | approved | active | archived | superseded
created: YYYY-MM-DD
updated: YYYY-MM-DD
supersedes: []
---
```

- Create a new artifact as `draft`.
- Move to `approved` only after explicit user approval of the shaped requirement.
- Reuse explicit authorization already present in the request or conversation when it covers the shaped scope; record that source and proceed without asking the user to approve the same work again. Drafting a document alone is not approval. Ask only when a material scope/behavior choice remains unapproved, not for routine implementation details.
- Move to `active` when approved implementation actually begins.
- Record blockers in a `Blockers` section or execution report; do not overload lifecycle status with transient execution state.
- Record successful verification as evidence, then let `verifying-before-completion` archive an ordinary conflict-free change in the same completion step.
- Use `superseded` when a later approved change explicitly replaces the artifact; keep history intact.

When touching an artifact created under the earlier lifecycle, map `implementing` to `active`; preserve `blocked` as a blocker note and `verified` as verification evidence. Do not bulk migrate unrelated legacy files.

Do not silently add lifecycle metadata to every legacy file. When an older spec is actively revised, add the minimum metadata needed without rewriting unrelated content.

## Stable Trace IDs

IDs are scoped to one change and remain stable once allocated:

- `REQ-001`: requirement or invariant
- `AC-001`: observable acceptance criterion; reference one or more `REQ-*`
- `TASK-001`: implementation task; reference the `REQ-*` or `AC-*` it advances
- `VER-001`: verification action or evidence; reference the `AC-*` it covers

- quick inline: no IDs required.
- persisted quick: stable change ID; add `REQ-*` / `AC-*` only when useful for handoff or audit.
- standard: require `REQ-*` and `AC-*`; tasks and verification remain readable checkboxes or AC mappings without extra IDs.
- strict or explicitly multi-agent/audited work: require all four ID types.

Append new IDs. Never renumber surviving entries after removing or splitting another entry. Do not introduce `TASK-*` or `VER-*` merely because the schema supports them.

## Behavior Delta

Persisted behavior-changing specs include `## Behavior Delta` with only applicable subsections:

```markdown
### ADDED
- REQ-001: <new observable behavior>

### MODIFIED
- REQ-004: <new behavior and the prior behavior being replaced>

### REMOVED
- REQ-007: <behavior no longer supported and relevant compatibility impact>
```

Every delta entry must use a `REQ-*` ID and receive acceptance coverage. Delta describes behavior, not file edits. Behavior-neutral design/tooling/docs work records why Delta is not applicable; quick inline work may omit it.

Archiving preserves the delta as history. It does not automatically merge the delta into `docs/qb-spec/context/`; durable facts are promoted only through `maintaining-project-context` after explicit user approval.
