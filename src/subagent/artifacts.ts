import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ArtifactMetadata } from "./schema.ts";

export class ArtifactStore {
  private root: string | undefined;

  get rootPath(): string | undefined {
    return this.root;
  }

  private async ensureRoot(): Promise<string> {
    if (!this.root) {
      this.root = await mkdtemp(join(tmpdir(), "qb-subagent-"));
      await chmod(this.root, 0o700);
    }
    return this.root;
  }

  async write(label: string, content: string | Buffer): Promise<ArtifactMetadata> {
    const root = await this.ensureRoot();
    const safeLabel = label.replace(/[^a-zA-Z0-9_.-]+/g, "_").slice(0, 80) || "artifact";
    const path = join(root, `${safeLabel}-${randomUUID()}.log`);
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    await writeFile(path, bytes, { mode: 0o600, flag: "wx" });
    return {
      path,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    };
  }

  async cleanup(): Promise<void> {
    const root = this.root;
    this.root = undefined;
    if (root) await rm(root, { recursive: true, force: true });
  }
}
