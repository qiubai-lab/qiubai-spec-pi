/// <reference types="node" />

import type { Stats } from "node:fs";
import type {
  CHANGE_TYPES,
  DOCUMENT_KINDS,
  STATUSES,
  TIERS,
  TRANSITION_STATUSES,
} from "./constants.ts";

export type ChangeType = (typeof CHANGE_TYPES)[number];
export type Tier = (typeof TIERS)[number];
export type Status = (typeof STATUSES)[number];
export type TransitionStatus = (typeof TRANSITION_STATUSES)[number];
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export type Category = "specs" | "plans" | "archive";

export interface ParsedDocument {
  path: string;
  category: Category;
  kind: DocumentKind;
  raw: Buffer;
  text: string;
  bom: boolean;
  lines: string[];
  fields: Record<string, string>;
  positions: Record<string, number>;
  id: string;
  type: ChangeType;
  tier: Tier;
  status: Status;
  created: string;
  updated: string;
  stat: Stats;
}

export interface LocatedChange {
  state: "active" | "already_archived";
  changeId: string;
  documents: ParsedDocument[];
  syncNeeded: boolean;
}

export interface InspectOptions {
  projectRoot: string;
  docsRoot?: string;
  changeId?: string;
}

export interface InspectResult {
  status: "active" | "already_archived";
  changeId: string;
  docsRoot: string;
  syncNeeded: boolean;
  documents: Array<{
    kind: DocumentKind;
    path: string;
    type: ChangeType;
    tier: Tier;
    status: Status;
    created: string;
    updated: string;
  }>;
}

export interface TransitionOptions {
  projectRoot: string;
  docsRoot?: string;
  changeId: string;
  document: DocumentKind;
  status: TransitionStatus;
  authorizationDeclared: boolean;
  date?: string;
  dryRun?: boolean;
  signal?: AbortSignal;
}

export interface TransitionResult {
  status: "updated" | "dry_run";
  changeId: string;
  document: DocumentKind;
  path: string;
  previousStatus: Status;
  newStatus: TransitionStatus;
  authorizationNote: "caller-attested; not independent evidence";
}

export interface ArchiveOptions {
  projectRoot: string;
  docsRoot?: string;
  changeId: string;
  verificationConfirmed: boolean;
  date?: string;
  dryRun?: boolean;
  signal?: AbortSignal;
}

export interface ArchiveResult {
  status: "archived" | "already_archived" | "dry_run";
  changeId: string;
  path: string;
  files: string[];
  verificationNote: "caller-attested; not independent evidence";
}

export type RecoveryAction = "complete" | "restore";
export type RecoveryState =
  | "safe_to_complete"
  | "safe_to_restore"
  | "choice_required"
  | "ambiguous";
export type RecoveryFileState = "matching" | "missing" | "changed";

export interface RecoveryFileAnalysis {
  kind: DocumentKind;
  source: string;
  target: string;
  sourceState: RecoveryFileState;
  targetState: RecoveryFileState;
}

export interface RecoveryAnalysis {
  changeId: string;
  state: RecoveryState;
  journalPath: string;
  journalSha256: string;
  targetDirectory: string;
  allowedActions: RecoveryAction[];
  files: RecoveryFileAnalysis[];
  issues: string[];
}

export interface RecoverOptions {
  projectRoot: string;
  docsRoot?: string;
  changeId: string;
  action: RecoveryAction;
  expectedJournalSha256: string;
  authorizationDeclared: boolean;
  dryRun?: boolean;
  signal?: AbortSignal;
}

export interface RecoverResult {
  status:
    | "completed"
    | "restored"
    | "already_completed"
    | "already_restored"
    | "dry_run";
  changeId: string;
  action: RecoveryAction;
  path: string;
  journalSha256: string | null;
  files: string[];
  authorizationNote: "caller-attested; not independent evidence";
}

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  path?: string;
  changeId?: string;
  recovery?: Pick<
    RecoveryAnalysis,
    "state" | "journalSha256" | "allowedActions"
  >;
}

export interface DoctorOptions {
  projectRoot: string;
  docsRoot?: string;
  changeId?: string;
  offset?: number;
  limit?: number;
}

export interface DoctorResult {
  status: "ok" | "findings";
  docsRoot: string;
  total: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  findings: Diagnostic[];
}

export type MutationQueue = <T>(
  path: string,
  operation: () => Promise<T>,
) => Promise<T>;

export type FaultInjector = (
  phase: string,
  path?: string,
) => void | Promise<void>;

export interface ServiceDependencies {
  withFileMutationQueue: MutationQueue;
  fault?: FaultInjector;
}
