export const SNAPSHOT = {
  plugin: "qiubai-spec",
  version: "0.6.0",
  piVersion: "0.85.1",
  minNode: "22.19.0",
} as const;

export const CHANGE_ID_PATTERN = /^QB-\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CHANGE_TYPES = ["feature", "bugfix", "design"] as const;
export const TIERS = ["quick", "standard", "strict"] as const;
export const STATUSES = [
  "draft",
  "approved",
  "active",
  "archived",
  "superseded",
] as const;
export const TRANSITION_STATUSES = ["draft", "approved", "active"] as const;
export const DOCUMENT_KINDS = ["spec", "plan"] as const;
export const DEFAULT_DOCS_ROOT = "docs/qb-spec";
export const LOCK_FILE = ".qb-change.lock";
export const PENDING_FILE = ".qb-pending.json";
export const MAX_SCAN_ENTRIES = 20_000;
export const MAX_RESULT_BYTES = 50 * 1024;
export const MAX_RESULT_LINES = 2_000;
export const MAX_DOCTOR_LIMIT = 200;
