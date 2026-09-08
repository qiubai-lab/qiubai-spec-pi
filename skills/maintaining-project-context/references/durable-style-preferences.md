# Durable Style Preferences

Use this guidance when a completed frontend, backend, or UI change may have revealed a preference that should remain stable across future tasks.

## Candidate Types

- UI style preferences: visual density, spacing, typography, color, radius, shadow, motion, responsive behavior, and interaction patterns.
- Frontend engineering style: component boundaries, state ownership, naming, styling approach, data fetching, error handling, and test conventions.
- Backend engineering style: service boundaries, DTO usage, validation, error handling, persistence separation, naming, and test conventions.

## Applying Existing Preferences

Persisted preferences are consumed conditionally, not loaded for every task:

- UI visual or interaction work reads the relevant parts of `UI_STYLE_SPEC.md` when that file exists.
- Frontend or backend implementation work reads the relevant parts of `ENGINEERING_STYLE_SPEC.md` when that file exists.
- Unrelated tasks do not load either file, and a missing file is skipped without creating a placeholder.
- Applicable preferences become task constraints and receive a matching verification action.
- An explicit task-specific user instruction may create a local exception, but it does not update the durable preference unless the user separately approves persistence.

## When To Suggest Persistence

Suggest a durable preference only when at least one strong signal exists:

- The user explicitly says the choice should be used in future tasks, by default, uniformly, or across all relevant areas.
- The same correction or choice has appeared in multiple independent components or tasks.
- The change establishes a reusable design-system, frontend, or backend convention.
- Forgetting the choice would be likely to cause repeated rework in future tasks.

Treat repeated evidence as support for a suggestion, not as permission to write the preference.

## When Not To Suggest It

- A one-off size, spacing, wording, or layout adjustment.
- A page-specific exception or temporary experiment.
- A style the user has not yet accepted.
- An implementation choice made only by the agent.
- A preference already captured by docs, code, design tokens, formatter, linter, schema, or another canonical source.
- A possible convention that conflicts with an existing rule and whose intended precedence is unclear.

## Completion-Time Check

Run this check after the requested change and its verification are complete, so it does not interrupt implementation:

1. Review user-directed style and convention changes from the task.
2. Compare them with existing long-lived context and executable configuration.
3. Identify only high-confidence, cross-task candidates.
4. Prefer one highest-value candidate per completion. Closely related observations may be combined only when they form one coherent rule.
5. Present the candidate without editing long-lived context.

The suggestion must state:

- Proposed Rule: the normalized durable preference
- Scope: UI, frontend, backend, or a narrower area
- Basis: the explicit instruction or repeated evidence behind the suggestion
- Canonical Source: the recommended docs path or executable configuration
- Conflict Check: whether an existing rule or source would be affected

If explicit authorization to persist this exact rule and scope already exists, reuse and record it rather than asking again. Otherwise ask one focused approval question. If the user declines, does not answer, or gives an ambiguous response, do not update long-lived context.

## Persistence Rules

Newly inferred preferences require explicit user approval before writing. Repeated evidence alone is not approval; a prior explicit persistence request covering the same rule and scope is sufficient.

When approved:

- Write UI preferences to `docs/qb-spec/context/UI_STYLE_SPEC.md`.
- Write frontend or backend coding conventions to `docs/qb-spec/context/ENGINEERING_STYLE_SPEC.md`.
- Use `docs/qb-spec/context/DECISIONS.md` for a durable but deliberately scoped exception or decision that is not a general convention.
- Prefer executable sources of truth for mechanically enforceable rules: formatter, linter, design tokens, API schema, or test configuration. Docs should record the intent, scope, and canonical source instead of duplicating configuration.
- Update only the affected section and preserve any explicit exceptions.

User approval to persist one candidate does not approve other observed preferences or unrelated edits.
