# qiubai-spec v0.6.0 snapshot

This package was implemented against the frozen `upstream/qiubai-spec-v0.6.0/` snapshot dated 2026-09-08.

The production extension, workflow skills, and prompt templates do not read or execute that plugin. Production skills are independently packaged Pi resources adapted from the reviewed snapshot; this document records the lifecycle contract copied into independent tests:

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
- the Pi adaptation classifies pending journals read-only and can complete or restore only a user-selected action proven safe by matching source/target hashes; ambiguous states remain manual
- authorization, verification, and recovery-selection flags are caller attestations, not proof

The package also exposes the snapshot's eleven workflow responsibilities through Pi-native skills, with `shaping-requirements/references/workflow-routing.md` as the only default next-action source. `/qiubai-spec` starts ordinary shaping and `/qiubai-init` explicitly selects entry, bootstrap, or adopt behavior; neither command proves approval or verification.

Development-only snapshot tests validate the vendored baseline contract. Baseline upgrades require explicit review; production skills, prompt contracts, and golden mechanical fixtures remain the standalone runtime contract.
