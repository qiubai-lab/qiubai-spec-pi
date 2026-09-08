# Upstream development baseline

`qiubai-spec-v0.6.0/` is a frozen copy of `plugins/qiubai-spec/` migrated from the `personal-skills` repository for development alignment.

- Contract version: `0.6.0`
- Snapshot date: `2026-09-08`
- Source repository HEAD at migration: `892ab2a3c4c68464557fa40953c3d0ea7ff0da2d`
- Last source commit touching `plugins/qiubai-spec/`: `c77bd900e3edef5e9a58dbfc33468f342d7ac2d4`
- Runtime status: development-only; excluded from the Pi package manifest and npm tarball

Do not edit the frozen directory as part of ordinary implementation work. For a baseline upgrade, import the new version into a new versioned directory, review behavior drift, update the package contract and tests, then remove an obsolete baseline only through an explicit migration change.
