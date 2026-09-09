# qiubai-spec-pi

独立的 Pi package，提供 qiubai-spec 的 11 个渐进披露 workflow skills、两个常用 Prompt Template 入口、安全文档 lifecycle tools，以及可选的轻量只读 subagent proxy。

实现基于仓库内冻结的 `qiubai-spec` v0.6.0 开发基线。生产 package 自带独立 skills/references，不读取或执行 `upstream/`，也不需要 Python。

## 环境与仓库

- GitHub：<https://github.com/qiubai-lab/qiubai-spec-pi.git>
- Node.js：`>=22.19.0`
- 首个已验证 Pi 版本：`@earendil-works/pi-coding-agent` 0.85.1
- Pi runtime 必须导出 `withFileMutationQueue`
- 无 Python 运行时依赖
- 当前未发布到 npm registry；请使用 GitHub 或本地路径安装

可先检查本地环境：

```bash
node --version
pi --version
```

## 安装

### 推荐：从 GitHub 安装到当前用户

该方式对所有项目生效：

```bash
pi install https://github.com/qiubai-lab/qiubai-spec-pi.git
```

安装完成后重新启动 Pi；若 Pi 已经运行，也可以执行 `/reload` 重新加载 extensions、skills 和 prompts。

### 只为当前项目安装

在目标项目根目录执行：

```bash
pi install https://github.com/qiubai-lab/qiubai-spec-pi.git -l
```

该命令写入项目的 `.pi/settings.json`。Pi 只会在项目受信任后加载项目级 package；团队共享该设置前应确认所有成员都信任此仓库和本插件。

### 固定 tag 或 commit

生产或团队重复安装建议固定经过验证的 tag/commit：

```bash
pi install git:github.com/qiubai-lab/qiubai-spec-pi@<tag-or-commit>
```

固定 ref 不会被普通 package update 自动移动到新版本。升级时应明确安装新的 ref：

```bash
pi install git:github.com/qiubai-lab/qiubai-spec-pi@<new-tag-or-commit>
```

### 从本地 clone 安装

适合开发和审查源码：

```bash
git clone https://github.com/qiubai-lab/qiubai-spec-pi.git
cd qiubai-spec-pi
npm ci
pi install .
```

本地路径安装只是让 Pi 指向当前目录，不会复制仓库。修改或拉取代码后，重新启动 Pi 或执行 `/reload`。

### 临时加载，不写入设置

在本仓库根目录执行：

```bash
pi -e .
```

适合首次审查和 smoke test；退出后不会保留为已安装 package。

## 验证安装

先检查 package 记录：

```bash
pi list
```

启动 Pi 后输入 `/`，应能看到：

```text
/qiubai-spec
/qiubai-init
/qb-subagent-model
```

`/qb-subagent-model` 是 extension command；另外会注册模型可调用的 `qb_subagent_dispatch` tool。未显式选择 subagent 模型时 delegation 保持禁用，现有 inline workflow 不变。

启用 Pi skill commands 时，还可以看到 11 个 `/skill:<name>` 命令。若 skill commands 被隐藏，可在 `/settings` 中启用，或在 settings 中设置：

```json
{
  "enableSkillCommands": true
}
```

Prompt Templates 和 skills 正常加载后，以下命令只应解释初始化模式，不修改项目：

```text
/qiubai-init
```

## 更新

### 更新所有已安装 packages

```bash
pi update --extensions
```

### 只更新本插件

使用 `pi list` 中记录的 source；GitHub 安装通常可以执行：

```bash
pi update --extension https://github.com/qiubai-lab/qiubai-spec-pi.git
```

也可以使用：

```bash
pi update https://github.com/qiubai-lab/qiubai-spec-pi.git
```

`pi update` 不带参数时默认只更新 Pi 本身，不更新 packages。若要同时更新 Pi 和 packages：

```bash
pi update --all
```

更新后重新启动 Pi 或执行 `/reload`。更新前建议保持项目工作树可恢复，并阅读目标版本的变更说明；如果安装的是固定 tag/commit，必须通过 `pi install ...@<new-ref>` 显式移动版本。

对于本地 clone 安装，由用户自行更新 checkout：

```bash
git -C /path/to/qiubai-spec-pi pull --ff-only
npm --prefix /path/to/qiubai-spec-pi ci
```

然后重新启动 Pi 或执行 `/reload`。

## 卸载

先使用 `pi list` 获取安装时记录的准确 source，然后按相同 scope 删除。

用户级 GitHub 安装：

```bash
pi remove https://github.com/qiubai-lab/qiubai-spec-pi.git
```

项目级安装需要在项目根目录添加 `-l`：

```bash
pi remove https://github.com/qiubai-lab/qiubai-spec-pi.git -l
```

本地路径安装：

```bash
pi remove /absolute/path/to/qiubai-spec-pi
```

`pi uninstall` 是 `pi remove` 的别名。卸载只移除 Pi settings 中的 package source，不删除：

- 本地 clone
- 目标项目的 `docs/qb-spec/`
- 已创建的 `AGENTS.md` managed block
- change archive、pending journal 或其他项目文档

如需清理这些项目文件，应先检查版本控制和 recovery 状态，不要把卸载当作数据恢复操作。

## 快速开始

1. 进入准备开发的项目并启动 Pi。
2. 已有项目首次采用时执行 `/qiubai-init adopt <范围>`；只设置 Agent 入口时使用 `/qiubai-init entry`；明确创建新项目时才使用 `/qiubai-init bootstrap <说明>`。
3. 使用 `/qiubai-spec <开发请求>` 启动普通开发流程。
4. 审阅 Agent 给出的 scope、type/tier、acceptance 和需要确认的决定。调用入口或创建 spec 本身不等于批准。
5. Agent 按集中式 routing 实施和验证，并在证据充分后调用机械工具归档。
6. 若出现 pending/partial archive，先让 Agent 调用 `qb_spec_doctor`；只有用户明确选择 doctor 报告的安全动作后，才调用 `qb_spec_recover`。

Pi extension 以当前用户权限运行。`qb_spec_transition` 会替换源文档，`qb_spec_archive` 会在校验归档副本后删除 active 来源，`qb_spec_recover` 可能完成来源删除或撤销已知归档副本。首次使用应在临时项目或已纳入版本控制的项目中验证。

## 常用入口

### `/qiubai-spec <开发请求>`

普通开发的统一入口。Prompt Template 要求 Agent 从 `shaping-requirements` 开始，按集中式 workflow routing 完成 type/tier 选择、需求、计划、条件检查、实施、验证和安全关闭。

```text
/qiubai-spec 修复登录失败后重试次数没有清零的问题
```

调用入口本身不是需求批准。没有提供实际请求时只会请求补充，不应修改文件。

### `/qiubai-init [entry|bootstrap|adopt] [补充说明]`

显式初始化入口：

- `entry`：只设置或刷新 Agent context-routing 入口。
- `bootstrap`：为明确的新项目创建范围建立必要工程基线、context、Directory Map 和入口。
- `adopt`：让已有项目按获批范围渐进采用 qb-spec，不隐式修改 Agent 入口。

```text
/qiubai-init entry
/qiubai-init bootstrap 创建一个 Node.js API 服务
/qiubai-init adopt 只评估并补必要文档
```

无 mode、未知 mode 或授权范围含糊时必须先解释并澄清，不执行持久化修改。

两个入口都是 Pi Prompt Templates，不是 extension commands。高级或诊断使用者仍可通过 Pi 原生 `/skill:<name>` 显式加载单个 workflow skill。

## Workflow Skills

package 提供以下 11 个按需加载的 skills：

- `shaping-requirements`
- `reviewing-spec-quality`
- `writing-qb-plans`
- `checking-architecture-boundaries`
- `protecting-critical-behavior`
- `verifying-before-completion`
- `closing-qb-change`
- `updating-directory-map`
- `maintaining-project-context`
- `initializing-qb-spec`
- `establishing-project-foundations`

`skills/shaping-requirements/references/workflow-routing.md` 是 next-action 顺序的唯一事实源。Pi 启动时只加载 skill name/description；完整说明和 references 由 Agent 按需读取。

## Lightweight Subagent

首期只支持顺序、单任务、无编辑的 `context_digest`、`doc_fact_scan` 和 `test_report`。它不承担规划、审查结论、架构决策、验收充分性或 lifecycle 操作。

```text
/qb-subagent-model                       # TUI 选择当前 session 的 child model
/qb-subagent-model provider/model-id     # 精确选择
/qb-subagent-model status
/qb-subagent-model reset                 # 禁用 delegation
```

候选模型来自 Pi `/model` 同源的 scoped/已认证可用目录；选择只写入当前 Pi session 的非上下文 entry，不改变主模型，也不写全局或项目 settings。模型缺失或不可用时不会自动继承、升级或替换，而是让主 Agent 继续 inline。

`qb_subagent_dispatch` 只接受固定 task schema 和项目内相对路径。child 使用 in-memory session、package-owned prompt、受限 custom read/search tools；`test_report` 使用结构化 executable/argv、`shell: false` 的专用 runner，并要求调用方声明该精确命令已由 approved plan/项目验证入口选定。该声明不是独立授权或验收证据。路径遍历、绝对路径、symlink/alias、任意 Bash、写工具、dispatch/lifecycle tools 均被拒绝。完整长日志写入 mode-0600 临时 artifact，并在 parent session shutdown 时清理。

### `qb_subagent_dispatch`

仅供 Agent 在相关 skill 明确识别到高容量机械任务后调用。结果包含模型、耗时、usage、摘要、evidence 和 artifact metadata，但 `completed` 不等于通过验收。短读取、单个机械命令和预计低于约 4k source tokens 的工作保持 inline。

## Lifecycle Tools

### `qb_spec_inspect`

只读定位 change，报告 spec/plan/archive 路径、type、tier、status 以及是否需要同步分离文档状态。省略 change ID 时只在项目恰好存在一个 active change 时自动选择。

### `qb_spec_transition`

只更新明确指定的一个 `spec` 或 `plan`：

- `draft → approved`
- `approved → active`
- 同状态刷新 `updated`

状态提升要求 `authorizationDeclared: true`。该字段只是调用方声明，并不是用户授权的独立证明。历史 split-standard 和 strict 的两个文档需要分别调用。

### `qb_spec_archive`

要求 `verificationConfirmed: true`，且所有实际来源文档均为 active。工具使用：

- Pi per-file mutation queues
- qb-spec 文档根排他锁
- 排他 archive 目标创建
- 源/目标 SHA-256
- `.qb-pending.json` journal
- 全部目标写入校验后删除来源

`verificationConfirmed` 只是调用方声明，不是验收证据。验收充分性由 `verifying-before-completion` 根据实际 evidence 判断。工具不会覆盖已有目标，也不会自行选择恢复动作。

### `qb_spec_recover`

只在 `qb_spec_doctor` 已报告动作机械安全、用户明确选择 `complete` 或 `restore`，且调用方提供完全匹配的 journal SHA-256 时执行恢复。工具在 mutation queues 和根锁内重新分析现场，不支持 force、overwrite、自动 action 或缺失来源重建。

`authorizationDeclared` 只是调用方对用户选择的 attestation，不是独立授权证明。`complete` 保留已校验 archive 并删除尚存的匹配来源；`restore` 仅在所有原来源仍完整时删除已知归档副本和 journal。

### `qb_spec_doctor`

只读检查 metadata、重复 ID、strict plan、分离文档状态、trace ID、lock、pending journal 和 partial archive，并将 journal 现场分类为 `safe_to_complete`、`safe_to_restore`、`choice_required` 或 `ambiguous`。结果使用 `offset`/`limit` 分页；doctor 只报告允许动作和 journal hash，不替用户选择，也不修改文件。

## 职责边界

- Skills/Agent 决定需求语义、type/tier、规格质量、计划、架构和测试 gate、批准是否覆盖当前范围、验收证据是否充分、Directory Map 是否更新及长期 context 是否提升。
- Tools 只执行可机械判断的 inspect、transition、archive、recovery analysis/recovery mutation、doctor，以及受限的 lightweight evidence collection。
- `/qiubai-spec` 或 `/qiubai-init` 的调用、文档创建、`authorizationDeclared`、`verificationConfirmed` 和 recovery allowed action 都不是独立批准、验证或用户选择证据。
- Behavior Delta 与归档只产生长期 context 候选；新事实和推断偏好仍需明确批准。

## 文档根与路径安全

默认文档根是项目内 `docs/qb-spec`。可以传入项目内相对 `docsRoot`；绝对路径、项目外路径、符号链接和 junction/alias 路径会失败关闭。工具只支持快照定义的简单 frontmatter 标量，同时保留 BOM、LF/CRLF、未知字段和正文。

## 恢复限制

多文件归档和恢复不是文件系统级原子事务，也不承诺断电持久性。失败时可能同时保留已校验的 archive 副本、部分 active 来源和 `.qb-pending.json`。先用 `qb_spec_doctor` 取得 recovery state、allowed actions 和 journal hash；只有用户明确选择且现场仍匹配时才调用 `qb_spec_recover`。`ambiguous` 状态必须人工审查；不要直接删除 lock/pending、覆盖 archive 或强制执行。

首期恢复不处理 legacy metadata normalization，也不会从 archived payload 猜测重建已经删除的原始来源。

锁和 mutation queue 只协调合作的 Pi 文件工具，不能阻止恶意或不合作的外部进程。不要在同一 tool batch 中让 `edit`/`write` 与 qb-spec 写工具修改同一 change。

Windows 对 symlink 权限、rename 和已打开文件删除的语义可能不同；未在 Windows runner 验证前，不宣称完全跨平台。

## 常见问题

### 看不到 `/qiubai-spec` 或 `/qiubai-init`

1. 运行 `pi list`，确认 package 已记录在预期的用户或项目 scope。
2. 项目级安装时确认当前项目已受信任。
3. 在 Pi 中执行 `/reload`，或完全退出后重新启动。
4. 运行 `pi config`，确认该 package 的 prompts、skills 和 extension 没有被过滤或禁用。
5. 本地路径安装时确认原目录仍存在，且 `package.json` 中声明了 `./prompts`、`./skills` 和 `./extensions/index.ts`。

### `/skill:<name>` 没有显示

Skill 自动发现仍然有效，但 slash skill commands 可以单独关闭。在 `/settings` 中开启 skill commands，或设置 `"enableSkillCommands": true`。普通用户可以继续使用 `/qiubai-spec`，无需逐个调用 skill。

### 出现 `QB_INCOMPATIBLE_PI`

当前 Pi runtime 缺少插件写工具需要的 `withFileMutationQueue`。升级 Pi 后重新启动：

```bash
pi update --self
```

不要通过删除兼容性检查或改用直接文件写入绕过该错误。

### 出现 `QB_LOCKED`、`QB_RECOVERY_REQUIRED` 或 `QB_RECOVERY_AMBIGUOUS`

不要直接删除 `.qb-change.lock`、`.qb-pending.json` 或 archive 目录。先让 Agent 调用 `qb_spec_doctor`：

- 有安全 action 和 journal hash：由用户选择后调用 `qb_spec_recover`。
- `ambiguous`：保留现场，检查版本控制、source、archive 和 journal 后人工处理。
- 残留 lock：先确认没有仍在运行的合作写操作，再决定后续处理。

### 更新命令没有移动版本

如果 source 固定到 tag 或 commit，这是预期行为。使用新的 ref 重新执行：

```bash
pi install git:github.com/qiubai-lab/qiubai-spec-pi@<new-tag-or-commit>
```

如果是本地路径安装，`pi update` 不会替你修改本地 Git checkout；需要自行 `git pull` 并 `/reload`。

## qiubai-spec v0.6.0 开发基线

`upstream/qiubai-spec-v0.6.0/` 保存迁移时的完整只读基线，包括原 skills、references、Python 工具、测试和三平台 manifests，只用于后续行为对齐与差分审查。

边界如下：

- `extensions/`、`src/`、`skills/` 和 `prompts/` 是生产实现。
- `upstream/qiubai-spec-v0.6.0/` 不由 Pi package manifest 加载，也不进入 npm tarball。
- 生产 skills 是 package 内的独立运行时规则，不通过链接或动态读取依赖冻结基线。
- 基线升级必须显式评审行为差异，更新生产 skills、references、fixtures、实现和测试。
- 历史实施规格保存在 `docs/history/`；当前 change 文档位于 `docs/qb-spec/`。

机械契约见：

- `references/snapshot-v0.6.0.md`
- `references/behavior-matrix.md`

## 开发验证

```bash
npm ci
npm run typecheck
npm test
npm pack --dry-run --json
```

确认 tarball 包含生产 skills/prompts，并排除 `tests/`、`docs/` 和 `upstream/`。资源注册变化还应使用真实 Pi 临时加载验证。
