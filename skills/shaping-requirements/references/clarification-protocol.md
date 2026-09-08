# Clarification Protocol

Read this reference only when a material uncertainty prevents a reliable spec or changes the recommended path.

## Conversation Rules

1. Ask about outcome and reason before implementation preference.
2. Ask at most one question per assistant message and resolve one decision point at a time.
3. Options are allowed when they all answer that same decision.
4. Resolve uncertainties in this order unless context requires otherwise: outcome, scope, constraints, acceptance, implementation preference.
5. Do not ask when the repository, existing context, or a safe in-scope assumption already resolves the issue.
6. Record non-blocking assumptions explicitly; use `[NEEDS CLARIFICATION: ...]` only for unresolved material gaps.

## Approach Comparison

When more than one materially different path is viable, compare 2 to 3 options by cost, complexity, risk, and maintenance, then recommend one. For quick-tier work, compress the comparison to a short rationale and do not manufacture alternatives with no meaningful tradeoff.
