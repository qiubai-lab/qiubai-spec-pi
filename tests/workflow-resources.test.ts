import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  DefaultResourceLoader,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(packageRoot, "skills");
const promptsRoot = join(packageRoot, "prompts");
const expectedSkills = [
  "checking-architecture-boundaries",
  "closing-qb-change",
  "establishing-project-foundations",
  "initializing-qb-spec",
  "maintaining-project-context",
  "protecting-critical-behavior",
  "reviewing-spec-quality",
  "shaping-requirements",
  "updating-directory-map",
  "verifying-before-completion",
  "writing-qb-plans",
];

async function filesBelow(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    const stats = await lstat(path);
    assert.equal(stats.isSymbolicLink(), false, `linked production resource: ${path}`);
    if (entry.isDirectory()) result.push(...(await filesBelow(path)));
    else result.push(path);
  }
  return result;
}

async function loadResources() {
  const agentDir = await mkdtemp("/tmp/qb-pi-agent-");
  const settings = SettingsManager.inMemory({}, { projectTrusted: true });
  const loader = new DefaultResourceLoader({
    cwd: packageRoot,
    agentDir,
    settingsManager: settings,
    additionalSkillPaths: [skillsRoot],
    additionalPromptTemplatePaths: [promptsRoot],
    noExtensions: true,
    noContextFiles: true,
    noThemes: true,
  });
  await loader.reload();
  return { loader, cleanup: () => rm(agentDir, { recursive: true, force: true }) };
}

async function promptExpander(): Promise<{
  expandPromptTemplate: (text: string, templates: unknown[]) => string;
}> {
  const modulePath = join(
    packageRoot,
    "node_modules/@earendil-works/pi-coding-agent/dist/core/prompt-templates.js",
  );
  // Pi does not export the low-level expander, so the contract test loads the exact installed runtime artifact.
  return import(pathToFileURL(modulePath).href) as Promise<{
    expandPromptTemplate: (text: string, templates: unknown[]) => string;
  }>;
}

test("Pi discovers exactly eleven workflow skills and two prompt templates", async (t) => {
  const { loader, cleanup } = await loadResources();
  t.after(cleanup);
  const skillResult = loader.getSkills();
  const promptResult = loader.getPrompts();
  assert.deepEqual(skillResult.diagnostics, []);
  assert.deepEqual(promptResult.diagnostics, []);
  assert.deepEqual(
    skillResult.skills.map((skill) => skill.name).sort(),
    expectedSkills,
  );
  assert.deepEqual(
    promptResult.prompts.map((prompt) => prompt.name).sort(),
    ["qiubai-init", "qiubai-spec"],
  );
  for (const skill of skillResult.skills) {
    assert.equal(skill.description.trim().length > 0, true);
    assert.equal(skill.sourceInfo?.scope, "temporary");
  }
  for (const prompt of promptResult.prompts) {
    assert.equal(prompt.description.trim().length > 0, true);
    assert.equal(prompt.sourceInfo?.scope, "temporary");
  }
});

test("production workflow resources have safe, complete relative links", async () => {
  const roots = [skillsRoot, promptsRoot];
  for (const root of roots) {
    for (const path of await filesBelow(root)) {
      const content = await readFile(path, "utf8");
      assert.doesNotMatch(content, /upstream[\\/]qiubai-spec|qb_change\.py|<plugin>/i, relative(packageRoot, path));
      if (!path.endsWith(".md")) continue;
      for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = match[1]!.trim();
        if (/^(?:https?:|#|mailto:)/i.test(target)) continue;
        const withoutAnchor = target.split("#", 1)[0]!;
        if (!withoutAnchor) continue;
        const resolved = resolve(dirname(path), decodeURIComponent(withoutAnchor));
        const packagePrefix = packageRoot.endsWith(sep) ? packageRoot : `${packageRoot}${sep}`;
        assert.equal(resolved.startsWith(packagePrefix), true, `escaping link ${target} in ${path}`);
        const stats = await lstat(resolved);
        assert.equal(stats.isSymbolicLink(), false, `linked target ${target} in ${path}`);
      }
    }
  }
});

test("workflow routing names only packaged skills and remains the sole order source", async () => {
  const routingPath = join(skillsRoot, "shaping-requirements/references/workflow-routing.md");
  const routing = await readFile(routingPath, "utf8");
  const mentioned = new Set(
    [...routing.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)+)`/g)]
      .map((match) => match[1]!)
      .filter((name) => expectedSkills.includes(name)),
  );
  assert.deepEqual([...mentioned].sort(), expectedSkills);
  for (const path of await filesBelow(skillsRoot)) {
    if (!path.endsWith(".md") || path === routingPath) continue;
    const content = await readFile(path, "utf8");
    assert.doesNotMatch(content, /^# Workflow Routing$|^This is the single source of truth for qb-spec next-action decisions\.$/im, relative(packageRoot, path));
  }
});

test("prompt templates expand arguments and preserve authorization boundaries", async (t) => {
  const { loader, cleanup } = await loadResources();
  t.after(cleanup);
  const templates = loader.getPrompts().prompts;
  const { expandPromptTemplate } = await promptExpander();

  const request = "修复登录重试回归，并保护相邻行为";
  const spec = expandPromptTemplate(`/qiubai-spec ${request}`, templates);
  assert.match(spec, new RegExp(request));
  assert.match(spec, /shaping-requirements/);
  assert.match(spec, /workflow-routing\.md/);
  assert.match(spec, /不得把调用.*创建文档.*视为批准/s);
  assert.doesNotMatch(spec, /authorizationDeclared\s*:\s*true|verificationConfirmed\s*:\s*true/);

  const emptySpec = expandPromptTemplate("/qiubai-spec", templates);
  assert.match(emptySpec, /未提供开发请求/);
  assert.match(emptySpec, /不创建或修改任何文件/);

  for (const mode of ["entry", "bootstrap", "adopt"] as const) {
    const expanded = expandPromptTemplate(`/qiubai-init ${mode} 仅处理当前范围`, templates);
    assert.match(expanded, new RegExp(`Mode：\`${mode}\``));
    assert.match(expanded, /仅处理当前范围/);
  }
  const emptyInit = expandPromptTemplate("/qiubai-init", templates);
  assert.match(emptyInit, /Mode：`未提供`/);
  assert.match(emptyInit, /不执行任何持久化修改/);
  const unknownInit = expandPromptTemplate("/qiubai-init unknown", templates);
  assert.match(unknownInit, /只接受以下三个 mode/);
  assert.match(unknownInit, /不执行任何持久化修改/);
  assert.doesNotMatch(unknownInit, /authorizationDeclared\s*:\s*true|verificationConfirmed\s*:\s*true/);
});
