# qiubai-spec v0.6.0 snapshot

This package was implemented against the frozen `upstream/qiubai-spec-v0.6.0/` snapshot dated 2026-09-08.

The production extension does not read or execute that plugin. This document records the mechanical contract copied into independent TypeScript tests:

- change id: `QB-YYYYMMDD-topic`
- types: `feature`, `bugfix`, `design`
- tiers: `quick`, `standard`, `strict`
- lifecycle states: `draft`, `approved`, `active`, `archived`, `superseded`
- ordinary transitions: `draft → approved → active`; same-state date refresh is allowed
- active specs live below `docs/qb-spec/specs/`
- optional or strict plans live below `docs/qb-spec/plans/`
- archives live below `docs/qb-spec/archive/YYYY/<change-id>/`
- strict changes require a separate plan; historical split-standard changes remain split
- each document transitions independently; every source document must be active before archive
- archive copies and verifies all payloads before deleting sources and retains a pending journal on interruption
- authorization and verification flags are caller attestations, not proof

Development-only snapshot tests validate the vendored baseline contract. Baseline upgrades require explicit review; golden fixtures remain the standalone runtime contract.
