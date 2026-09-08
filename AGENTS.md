# Repository Guidelines

## Scope

This repository is the standalone Pi implementation of qiubai-spec mechanical document tools.

- Production extension code lives in `extensions/` and `src/`.
- Tests live in `tests/`.
- Contract documentation lives in `references/`.
- `upstream/qiubai-spec-v0.6.0/` is a frozen development baseline. Production code must not import, execute, or read it.
- `docs/history/` contains historical implementation records, not current runtime rules.

## Contract boundaries

- Preserve qiubai-spec lifecycle, document-shape, path-safety, authorization-attestation, verification-attestation, and recovery semantics.
- Keep semantic decisions outside tools: tools do not decide requirements, approval, acceptance sufficiency, Directory Map updates, or context promotion.
- Update the frozen baseline only as an explicit baseline-upgrade change. Review and record drift before changing production behavior.
- Mutating tools must use Pi's `withFileMutationQueue`, the qb-spec root lock, and source stability checks.
- Keep tool output bounded to Pi's 50KB/2000-line limits.

## Verification

Before completion run:

```bash
npm ci
npm run typecheck
npm test
npm pack --dry-run --json
```

Confirm the package tarball excludes `tests/`, `docs/`, and `upstream/`, and temporarily load the extension with Pi when tool registration changes.
