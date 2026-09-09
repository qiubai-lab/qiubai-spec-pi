---
id: QB-20260909-lightweight-subagent-proxy
type: feature
tier: strict
status: archived
created: 2026-09-09
updated: 2026-09-09
supersedes: []
---

# Lightweight Subagent Proxy

## Summary

Implement the approved lightweight sequential delegation design from `QB-20260909-subagent-workflow-design` as a Pi-native extension capability. The first release adds one session-scoped model-selection command and one constrained dispatch tool for `context_digest`, `doc_fact_scan`, and `test_report`.

## Scope

### In Scope

- `/qb-subagent-model`, explicit `provider/model-id`, `status`, and `reset`.
- Session-entry reconstruction across reload/resume without project/global settings writes.
- A single `qb_subagent_dispatch` tool with fixed task kinds and bounded structured results.
- In-memory child `AgentSession` using an explicit zero-default resource loader and package-owned task prompts.
- Symlink-safe project path guards and child custom read/search/list tools.
- A shell-free verification runner using executable/argv/cwd validation, timeout, cancellation, bounded parent output, and mode-0600 temporary artifacts.
- Usage/model/timing reporting and fail-closed errors.
- Extension, unit, isolation, path, command, cancellation, output, and session-state tests.

### Out Of Scope

- Planning, review authority, architecture decisions, editing, lifecycle tools, acceptance decisions, or context promotion.
- `diff_summary`, model-backed `trace_scan`, arbitrary prompts, arbitrary tools, Bash strings, project-owned agent profiles, parallelism, chains, retries across models, or recursive delegation.
- Global/project persistence and automatic model selection.
- Subprocess backend.

## Requirements

- **REQ-001 — Fixed surface:** register exactly one additional tool, `qb_subagent_dispatch`, accepting one task at a time and only `context_digest`, `doc_fact_scan`, or `test_report`; no tasks array, arbitrary role/prompt/tool list, parallel, or chain fields.
- **REQ-002 — Session model command:** `/qb-subagent-model` must list/select only the parent session's scoped models when non-empty, otherwise authenticated models from `modelRegistry.getAvailable()`; selection uses exact `provider/model-id`, status reports source/availability, and reset disables delegation without changing the main model.
- **REQ-003 — Session persistence:** model selection is stored only as a non-context custom session entry and rebuilt from the latest valid entry on session start/reload/resume; no filesystem settings are written.
- **REQ-004 — No silent fallback:** missing, reset, unavailable, unauthenticated, or unsupported child model returns a distinct error and leaves the existing inline workflow available; it never inherits the main model or chooses another model.
- **REQ-005 — Resource isolation:** each dispatch creates one `SessionManager.inMemory()` child with extensions, skills, prompts, themes, context files, and agent files disabled; the child cannot access dispatch or `qb_spec_*` mutation tools.
- **REQ-006 — Path isolation:** every task path and every child file operation must remain beneath the real project root, reject absolute paths, parent traversal, symlinks, aliases, non-files where files are required, and paths outside the dispatch allowlist.
- **REQ-007 — Task capabilities:** `context_digest` and `doc_fact_scan` receive only custom path-safe read/grep/find/ls operations; `test_report` additionally receives only the dedicated verification runner. No child receives built-in Bash, edit, or write.
- **REQ-008 — Verification runner:** commands are structured executable + argv, shell-free, project-relative cwd, and must match a package-defined executable/argument policy plus a verification command explicitly supplied by the main agent with `authorizationDeclared: true` attesting it came from the approved plan/project verification entry; the attestation is not independent evidence. Stdout/stderr, exit code, timeout, cancellation, and exact argv/cwd are recorded.
- **REQ-009 — Structured evidence:** child output must parse as the task-specific JSON result schema; invalid output, unknown task, capability violation, child/model error, command failure, timeout, and abort have distinct machine-readable codes. A child `completed` status does not attest acceptance.
- **REQ-010 — Bounded artifacts:** parent-visible text/details remain below 50KB and 2000 lines. Oversize logs/tool traces are written under a mode-0600 session temporary directory, with path, SHA-256, byte count, and truncation marker returned; cleanup occurs on parent session shutdown.
- **REQ-011 — Sequential lifecycle:** one extension instance runs at most one child; a second dispatch while active returns `busy`. Abort/timeout propagates to the child and runner, child sessions are always disposed, and failure never starts another child or advances qb-spec lifecycle.
- **REQ-012 — Budgets:** each task profile has fixed prompt, max input paths, per-file/read limits, timeout, max turns, and output limits; a single same-model schema-repair turn is permitted only when budget remains, with no model escalation.
- **REQ-013 — Visibility and accounting:** updates and final result expose stage, task kind, selected model, elapsed time, aggregate input/output/cache tokens, estimated cost, artifact metadata, and failure code without copying complete child messages into the parent context.
- **REQ-014 — Existing behavior:** disabling or failing delegation preserves all existing eleven skills, two prompt templates, and five lifecycle tools; no existing lifecycle authorization, verification, archive, or recovery semantics change.
- **REQ-015 — Activation ownership:** skills may invoke dispatch only after an explicit model selection and when their existing workflow node identifies a high-volume fixed task; the proxy validates mechanics but never chooses the workflow next action.

## Acceptance Criteria

- **AC-001** [REQ-001, REQ-014]: extension registration tests show the existing five tools plus only `qb_subagent_dispatch`, whose schema accepts each of the three fixed task kinds and rejects arbitrary roles, tasks arrays, chains, parallel options, and extra properties.
- **AC-002** [REQ-002, REQ-003, REQ-004]: command tests cover picker source precedence, explicit selection, status, reset, latest-entry restoration, unavailable/auth failure, no-UI behavior, and unchanged parent model.
- **AC-003** [REQ-005, REQ-007]: an SDK factory contract test proves the child uses in-memory session state, no discovered resources/agent files, and only task-specific custom tool names; dispatch and mutation tools are absent.
- **AC-004** [REQ-006]: path tests reject absolute, `..`, symlink file/directory, alias, outside-allowlist, and type mismatch cases while allowing declared in-project files/directories.
- **AC-005** [REQ-008]: runner tests execute an attested allowed argv without shell interpretation and reject missing attestation, shell strings, metacharacter injection, unknown executable, disallowed args/cwd, timeout, and abort; exact evidence and non-zero exit status are preserved.
- **AC-006** [REQ-009]: contract tests parse valid results for all three task kinds and return distinct codes for unknown task, invalid schema, capability violation, model/backend failure, command failure, timeout, abort, and busy.
- **AC-007** [REQ-010, REQ-013]: large-output tests keep content/details within Pi limits and return an existing mode-0600 artifact with correct SHA-256/byte count; session shutdown removes its owning temporary directory.
- **AC-008** [REQ-011]: concurrent-dispatch and abort tests prove only one child runs, the second returns busy, cancellation reaches child/runner, and disposal executes on success and every failure path.
- **AC-009** [REQ-012]: profile tests prove fixed task prompts and budgets, enforce path/read/turn/output limits, permit at most one same-model schema repair, and never change model.
- **AC-010** [REQ-013]: result fixtures aggregate model, selection source, timings, turns, token/cache/cost usage, task evidence, and artifact metadata without retaining full child messages.
- **AC-011** [REQ-014, REQ-015]: existing tests plus workflow-resource tests pass, and skill changes mention only eligibility/use of the fixed proxy while preserving `workflow-routing.md` as the sole next-action source.
- **AC-012** [REQ-015]: inline/delegated fixtures record cost, total tokens, main-context bytes, latency, and completeness for each task kind; automatic delegation remains conservative when the approved threshold is not met.

## Behavior Delta

### ADDED

- Session command `/qb-subagent-model` for explicit lightweight child model selection.
- Read-only `qb_subagent_dispatch` tool for three fixed, sequential task kinds.
- Package-owned task profiles and isolated temporary evidence artifacts.

### MODIFIED

- Relevant workflow skills may use the proxy for eligible high-volume mechanical work after model selection; centralized routing and semantic decisions remain unchanged.

### REMOVED

- None.

## Risks And Mitigations

- **Repository escape:** custom tools canonicalize the project root and reject links/aliases for every operation.
- **Command injection:** no shell command string; executable and argv are independently allowlisted and spawned with `shell: false`.
- **Prompt injection:** no repo-owned profiles or inherited context; prompts explicitly treat repository content as untrusted data.
- **Credential/backend mismatch:** selected model is revalidated before every run; unsupported child runtime fails closed and reports inline fallback eligibility.
- **Cost/context regression:** fixed budgets and benchmark evidence gate automatic skill use.
- **Artifact leakage:** mode-0600 temporary directory, bounded metadata, and shutdown cleanup.

## Rollback

Remove the command, dispatch registration, task profiles, and skill delegation hints. Existing lifecycle services and inline workflow remain untouched, so rollback requires no data migration; historical session custom entries are inert when the extension no longer handles them.

## Assumptions

- The target Pi compatibility baseline remains 0.85.1.
- Project code execution by an explicitly supplied verification command is intentional; the runner protects invocation shape and scope, not the behavior of trusted project test code.
- The main agent remains responsible for deciding whether command evidence is sufficient.

## Open Questions

None. Engineering constants may be tuned only within the fixed safety and authority boundaries above and must be recorded in the plan/tests.
