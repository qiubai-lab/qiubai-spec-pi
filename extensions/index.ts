import * as CodingAgent from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type Static } from "typebox";
import { archiveChange } from "../src/archive.ts";
import { doctor } from "../src/doctor.ts";
import { asQbError, qbError } from "../src/errors.ts";
import { inspectChange } from "../src/inspect.ts";
import { recoverChange } from "../src/recovery.ts";
import { boundDoctorResult, boundedText } from "../src/result.ts";
import { transitionChange } from "../src/transition.ts";
import type { MutationQueue, ServiceDependencies } from "../src/types.ts";

const common = {
  docsRoot: Type.Optional(Type.String({ description: "Project-relative qb-spec document root; defaults to docs/qb-spec" })),
};

const inspectSchema = Type.Object({
  ...common,
  changeId: Type.Optional(Type.String({ description: "QB-YYYYMMDD-topic; omitted only when exactly one active change exists" })),
}, { additionalProperties: false });

const transitionSchema = Type.Object({
  ...common,
  changeId: Type.String({ description: "Stable QB-YYYYMMDD-topic change id" }),
  document: StringEnum(["spec", "plan"] as const, { description: "Update exactly one persisted document" }),
  status: StringEnum(["draft", "approved", "active"] as const),
  authorizationDeclared: Type.Boolean({ description: "Caller attests that existing user authorization covers this promotion; not independent evidence" }),
  date: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  dryRun: Type.Optional(Type.Boolean()),
}, { additionalProperties: false });

const archiveSchema = Type.Object({
  ...common,
  changeId: Type.String({ description: "Stable QB-YYYYMMDD-topic change id" }),
  verificationConfirmed: Type.Boolean({ description: "Caller attests acceptance evidence is sufficient; not independent evidence" }),
  date: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  dryRun: Type.Optional(Type.Boolean()),
}, { additionalProperties: false });

const recoverSchema = Type.Object({
  ...common,
  changeId: Type.String({ description: "Stable QB-YYYYMMDD-topic change id" }),
  action: StringEnum(["complete", "restore"] as const, { description: "User-selected recovery action already reported safe by qb_spec_doctor" }),
  expectedJournalSha256: Type.String({ pattern: "^[a-f0-9]{64}$", description: "Exact journal SHA-256 reported by qb_spec_doctor" }),
  authorizationDeclared: Type.Boolean({ description: "Caller attests the user selected this recovery action; not independent evidence" }),
  dryRun: Type.Optional(Type.Boolean()),
}, { additionalProperties: false });

const doctorSchema = Type.Object({
  ...common,
  changeId: Type.Optional(Type.String({ description: "Optional change id filter" })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
}, { additionalProperties: false });

type InspectInput = Static<typeof inspectSchema>;
type TransitionInput = Static<typeof transitionSchema>;
type ArchiveInput = Static<typeof archiveSchema>;
type RecoverInput = Static<typeof recoverSchema>;
type DoctorInput = Static<typeof doctorSchema>;

async function toolOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw asQbError(error);
  }
}

export function registerQbSpecTools(pi: ExtensionAPI, queue?: MutationQueue): void {
  const mutationQueue = queue ?? CodingAgent.withFileMutationQueue;
  if (typeof mutationQueue !== "function") {
    throw qbError("QB_INCOMPATIBLE_PI", "Pi does not export withFileMutationQueue; qiubai-spec-pi requires Pi 0.85.1-compatible mutation queues");
  }
  const dependencies: ServiceDependencies = { withFileMutationQueue: mutationQueue };

  pi.registerTool({
    name: "qb_spec_inspect",
    label: "Inspect qb-spec Change",
    description: "Safely locate one persisted qb-spec change and report its documents and lifecycle state. Read-only; output is bounded to 50KB/2000 lines.",
    promptSnippet: "Inspect persisted qb-spec change state without editing files",
    promptGuidelines: ["Use qb_spec_inspect instead of shell commands to locate a persisted qb-spec change."],
    parameters: inspectSchema,
    async execute(_id, params: InspectInput, _signal, _update, ctx) {
      const result = await toolOperation(() => inspectChange({ projectRoot: ctx.cwd, ...params }));
      const lines = [
        `${result.changeId}: ${result.status}${result.syncNeeded ? " (document synchronization needed)" : ""}`,
        ...result.documents.map((document) => `${document.kind}: ${document.status} ${document.path}`),
      ];
      return { content: [{ type: "text", text: boundedText(lines) }], details: result };
    },
  });

  pi.registerTool({
    name: "qb_spec_transition",
    label: "Transition qb-spec Change",
    description: "Update status/updated metadata for exactly one qb-spec spec or plan using safe lifecycle rules and Pi's mutation queue. Authorization is caller-attested, not independent evidence.",
    promptSnippet: "Safely update one persisted qb-spec document lifecycle state",
    promptGuidelines: [
      "Use qb_spec_transition only after confirming existing user authorization; authorizationDeclared is an attestation, not proof.",
      "Do not call qb_spec_transition in parallel with edit or write for the same qb-spec document.",
    ],
    parameters: transitionSchema,
    async execute(_id, params: TransitionInput, signal, _update, ctx) {
      const result = await toolOperation(() => transitionChange({ projectRoot: ctx.cwd, ...params, ...(signal ? { signal } : {}) }, dependencies));
      return {
        content: [{ type: "text", text: `${result.status}: ${result.document} ${result.previousStatus} -> ${result.newStatus}\nAuthorization is caller-attested; not independent evidence.` }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "qb_spec_archive",
    label: "Archive qb-spec Change",
    description: "Safely archive an active persisted qb-spec change with exclusive paths, hashes, and a recovery journal. Verification is caller-attested, not independent evidence.",
    promptSnippet: "Safely archive a verified persisted qb-spec change",
    promptGuidelines: [
      "Use qb_spec_archive only after acceptance evidence has been checked; verificationConfirmed is an attestation, not proof.",
      "Do not call qb_spec_archive in parallel with edit, write, or qb_spec_transition for the same change.",
    ],
    parameters: archiveSchema,
    async execute(_id, params: ArchiveInput, signal, _update, ctx) {
      const result = await toolOperation(() => archiveChange({ projectRoot: ctx.cwd, ...params, ...(signal ? { signal } : {}) }, dependencies));
      return {
        content: [{ type: "text", text: `${result.status}: ${result.path}\nVerification is caller-attested; not independent evidence.` }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "qb_spec_recover",
    label: "Recover qb-spec Archive",
    description: "Complete or restore a pending archive only when the selected action is mechanically safe and the expected journal hash still matches. Authorization is caller-attested; no force or overwrite.",
    promptSnippet: "Safely execute a user-selected recovery action for a diagnosed pending archive",
    promptGuidelines: [
      "Call qb_spec_doctor before qb_spec_recover and use only an allowed recovery action with its exact journal SHA-256.",
      "Use qb_spec_recover only after the user selects complete or restore; authorizationDeclared is an attestation, not proof.",
      "Do not call qb_spec_recover in parallel with edit, write, qb_spec_transition, or qb_spec_archive for the same change.",
    ],
    parameters: recoverSchema,
    async execute(_id, params: RecoverInput, signal, _update, ctx) {
      const result = await toolOperation(() => recoverChange({ projectRoot: ctx.cwd, ...params, ...(signal ? { signal } : {}) }, dependencies));
      return {
        content: [{ type: "text", text: `${result.status}: ${result.action} ${result.path}\nAuthorization is caller-attested; not independent evidence.` }],
        details: result,
      };
    },
  });

  pi.registerTool({
    name: "qb_spec_doctor",
    label: "Diagnose qb-spec Documents",
    description: "Read-only diagnosis for qb-spec metadata, lifecycle, trace links, locks, pending journals, and partial archives. Paginated and bounded to 50KB/2000 lines.",
    promptSnippet: "Diagnose persisted qb-spec document and archive problems without modifying files",
    promptGuidelines: ["Use qb_spec_doctor to diagnose qb-spec file problems; it never repairs or removes recovery artifacts."],
    parameters: doctorSchema,
    async execute(_id, params: DoctorInput, _signal, _update, ctx) {
      const result = boundDoctorResult(await toolOperation(() => doctor({ projectRoot: ctx.cwd, ...params })));
      const lines = result.findings.length === 0
        ? ["qb-spec doctor: no mechanical findings"]
        : [
            `qb-spec doctor: ${result.total} finding(s), showing ${result.offset}-${result.offset + result.findings.length}`,
            ...result.findings.map((finding) => `${finding.severity} ${finding.code}: ${finding.message}${finding.path ? ` (${finding.path})` : ""}${finding.recovery ? ` [state=${finding.recovery.state} actions=${finding.recovery.allowedActions.join(",") || "none"} journalSha256=${finding.recovery.journalSha256}]` : ""}`),
          ];
      return { content: [{ type: "text", text: boundedText(lines) }], details: result };
    },
  });
}

export default function qiubaiSpecPi(pi: ExtensionAPI): void {
  registerQbSpecTools(pi);
}
