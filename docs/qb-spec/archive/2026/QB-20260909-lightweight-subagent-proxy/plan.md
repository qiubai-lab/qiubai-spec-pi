---
id: QB-20260909-lightweight-subagent-proxy
type: feature
tier: strict
status: archived
created: 2026-09-09
updated: 2026-09-09
supersedes: []
---

# Lightweight Subagent Proxy Implementation Plan

## Implementation Tasks

- [x] **TASK-001** [REQ-001, REQ-009, AC-001, AC-006] Define task-kind request/result DTOs, error codes, TypeBox schemas, bounded result projection, and injectable backend interfaces in `src/subagent/`.
- [x] **TASK-002** [depends: TASK-001] [REQ-006, REQ-007, AC-003, AC-004] Add tests first, then implement realpath/symlink-safe allowlist resolution and custom read/grep/find/ls tools; do not reuse cwd-only built-ins.
- [x] **TASK-003** [depends: TASK-001, TASK-002] [REQ-008, REQ-010, AC-005, AC-007] Add tests first, then implement the shell-free verification runner, argument policy, output artifact writer, hashing, permissions, timeout, abort, and cleanup manager.
- [x] **TASK-004** [depends: TASK-001, TASK-002, TASK-003] [REQ-005, REQ-007, REQ-009, REQ-011, REQ-012, REQ-013, AC-003, AC-006, AC-008, AC-009, AC-010] Add package-owned profiles and an injectable Pi SDK backend using `DefaultResourceLoader`, `SessionManager.inMemory()`, explicit custom tools, structured-output parsing, one repair attempt, usage aggregation, cancellation, and unconditional disposal.
- [x] **TASK-005** [depends: TASK-001] [REQ-002, REQ-003, REQ-004, AC-002] Add command state and tests for model list precedence, exact selection, custom session entries, restoration, status/reset, non-TUI behavior, auth/capability validation, and parent-model invariance.
- [x] **TASK-006** [depends: TASK-003, TASK-004, TASK-005] [REQ-001, REQ-004, REQ-009, REQ-010, REQ-011, REQ-013, AC-001, AC-006, AC-007, AC-008, AC-010] Register `qb_subagent_dispatch` and `/qb-subagent-model` through a thin extension layer; implement busy guard, stage updates, bounded render/result behavior, and session-shutdown cleanup.
- [x] **TASK-007** [depends: TASK-006] [REQ-014, REQ-015, AC-011] Update only the relevant workflow skill guidance to allow the three fixed tasks after explicit model selection; preserve `workflow-routing.md` unchanged as the sole next-action source.
- [x] **TASK-008** [depends: TASK-004, TASK-006] [REQ-012, REQ-013, REQ-015, AC-009, AC-010, AC-012] Add deterministic inline/delegated benchmark fixtures and conservative thresholds: do not delegate below 4k estimated source tokens, for one-file/one-command mechanical work, or when parent re-read is expected to exceed 50% of source bytes.
- [x] **TASK-009** [depends: TASK-007, TASK-008] [REQ-001, REQ-014, AC-001, AC-011] Update README/package contents and Directory Map for the new public command, tool, `src/subagent/`, and task-profile ownership.
- [x] **TASK-010** [depends: TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006, TASK-007, TASK-008, TASK-009] [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007, AC-008, AC-009, AC-010, AC-011, AC-012] Execute strict verification, temporarily load the extension in Pi, compare benchmark fixtures, inspect the package tarball, and record evidence before archival.

## Engineering Contracts

- Public dispatch accepts `taskKind`, `taskId`, optional `changeId`, project-relative `paths`, a bounded `instruction`, and for `test_report` one structured `{ executable, args, cwd, authorizationDeclared: true }`; it accepts no caller-defined prompt/tools/model.
- Default limits: 32 paths, 256 KiB per read, 2 MiB total tool bytes, 3 child turns plus at most one schema-repair turn, 120 seconds for read tasks, 10 minutes for verification, and 48 KiB parent JSON/text projection.
- Verification execution requires caller attestation that the exact argv is already selected by the approved plan/project entry; this is not independent evidence. Allowed verification executables: `npm`, `npx`, `node`, `pnpm`, `yarn`, `bun`, `deno`, `python`, `python3`, `pytest`, `cargo`, `go`, `make`, `just`, `gradle`, `gradlew`, `mvn`, and `mvnw`; reject path separators in executable, environment-assignment prefixes, shell control tokens, response-file args, and cwd outside the real project root. Arguments are passed literally with `shell: false`.
- Temporary root is created with `mkdtemp` under OS temp, directory mode 0700 and files mode 0600. Parent returns artifact metadata only. The owning extension state removes all temporary roots on `session_shutdown`.
- Model capability gate requires authenticated availability, context window at least 16k, and a supported model API. Structured JSON failure receives one explicit repair prompt on the same model; a second failure returns `invalid_result`.
- Dispatch admission is disabled without a valid session selection. The extension does not automatically invoke itself; relevant skills instruct the main model when use is eligible.

## Architecture Gate

- **Boundary:** `extensions/index.ts` remains registration/UI glue; `src/subagent/` owns mechanical DTO validation, safety adapters, child runtime, artifacts, and state. Skills own semantic eligibility and routing.
- **Authority:** no subagent module imports lifecycle mutation services. Dispatch results carry evidence only and cannot transition or archive changes.
- **Isolation:** child sessions use package prompt constants and custom tools only; no discovered package/project resources.
- **Testability:** model execution, spawning, clock, temp root, and session creation are injected at boundaries so safety behavior is tested without network calls.
- **Critical behavior coverage:** path, command, isolation, cancellation, concurrency, session-state, and bounded-output rules require automated normal/boundary/failure tests before implementation.

## Verification

- [x] **VER-001** [AC-001] Run extension schema/registration tests proving the six-tool surface and strict fixed-task schema.
- [x] **VER-002** [AC-002] Run model-command tests for scoped/available source, selection/status/reset/restoration, unavailable/auth/no-UI cases, and unchanged parent model.
- [x] **VER-003** [AC-003] Run child factory isolation tests proving in-memory session, zero resources/agent files, task-only custom tools, and absence of dispatch/mutation tools.
- [x] **VER-004** [AC-004] Run path guard tests for traversal, absolute paths, links, aliases, allowlist escapes, type mismatch, and valid paths.
- [x] **VER-005** [AC-005] Run runner tests for literal argv execution, policy rejection, non-zero exit, timeout, abort, and exact evidence.
- [x] **VER-006** [AC-006] Run result/error tests for all task schemas and distinct failure codes.
- [x] **VER-007** [AC-007] Run large-output/artifact tests for 50KB/2000-line bounds, mode 0600, hash/size correctness, and shutdown cleanup.
- [x] **VER-008** [AC-008] Run concurrent dispatch/cancellation tests and assert unconditional child disposal.
- [x] **VER-009** [AC-009] Run profile-budget tests for fixed prompts, path/read/turn/output limits, one same-model repair, and no escalation.
- [x] **VER-010** [AC-010] Run usage/result fixture tests proving aggregate accounting and absence of complete child transcripts.
- [x] **VER-011** [AC-011] Run workflow-resource tests and full regression suite; inspect that `workflow-routing.md` remains unchanged and existing lifecycle behavior passes.
- [x] **VER-012** [AC-012] Run benchmark fixtures for all task kinds and record cost/token/context/latency/completeness; confirm negative-benefit fixtures remain inline.
- [x] **VER-013** [AC-001, AC-002, AC-003] Temporarily load the extension in Pi 0.85.1, confirm tool/command registration, set/status/reset an available model, and run one bounded non-mutating smoke dispatch when credentials permit.
- [x] **VER-014** [AC-001, AC-011] Run `npm ci`, `npm run typecheck`, `npm test`, and `npm pack --dry-run --json`; confirm tarball excludes `tests/`, `docs/`, and `upstream/` while including required task profiles.

## Verification Evidence

- `npm ci` completed with 230 audited packages and zero vulnerabilities.
- `npm run typecheck` passed.
- `npm test` passed all 75 tests, including fixed schema, session model state, path/link rejection, shell-free command policy, timeout/abort, single-run verification, artifact permissions/cleanup, zero-resource child construction, schema repair, bounded output, sequential busy/disposal, benchmark and workflow-resource coverage.
- `npm pack --dry-run --json` reported 59 files, included all 13 `src/subagent/` modules, and included no `tests/`, `docs/`, or `upstream/` paths.
- `git diff --check` passed.
- Pi 0.85.1 temporary load with `pi -ne -e .` registered the command: `status` reported inline-disabled and exact selection of `openai-codex/gpt-5.3-codex-spark` succeeded without changing the parent model.
- Live SDK smoke using `openai-codex/gpt-5.3-codex-spark` completed `doc_fact_scan` against `README.md` with cited facts (3 turns, 7,462 tokens, estimated cost 0.019061) and completed `test_report` for attested `node --version` with exact command/cwd/exit/output/artifact evidence (2 turns, 1,998 tokens, estimated cost 0.01081).
- Live unsupported-model smoke converted the catalog-visible but account-unsupported `openai-codex/gpt-5.4-mini` failure to `model_unavailable`; no schema repair or model fallback occurred.
- Deterministic benchmark fixtures cover all three task kinds and reject cost, context, or completeness regressions. They validate the gate, not a universal savings claim; real benefit remains model/repository dependent.

## Completion Gate

- All AC items have direct automated or explicitly blocked environment evidence.
- No child write/shell/lifecycle capability is reachable.
- Directory Map and public usage documentation reflect the shipped surface.
- Full repository verification passes and package contents are safe.
- Archive this implementation change only after evidence is sufficient; then close the predecessor design change when its deferred implementation verification is satisfied.
