import { findUniqueActiveChangeId, locateChange } from "./discovery.ts";
import { resolveProjectPaths } from "./paths.ts";
import type { InspectOptions, InspectResult } from "./types.ts";

export async function inspectChange(options: InspectOptions): Promise<InspectResult> {
  const paths = await resolveProjectPaths(options.projectRoot, options.docsRoot);
  const changeId = options.changeId ?? await findUniqueActiveChangeId(paths);
  const located = await locateChange(paths, changeId);
  return {
    status: located.state,
    changeId,
    docsRoot: paths.docs,
    syncNeeded: located.syncNeeded,
    documents: located.documents.map((document) => ({
      kind: document.kind,
      path: document.path,
      type: document.type,
      tier: document.tier,
      status: document.status,
      created: document.created,
      updated: document.updated,
    })),
  };
}
