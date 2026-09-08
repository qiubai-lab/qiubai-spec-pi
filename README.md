# qiubai-spec-pi

独立的 Pi package，提供 qiubai-spec 的 11 个渐进披露 workflow skills、两个常用 Prompt Template 入口，以及 TypeScript 实现的安全文档检查、生命周期更新、归档和诊断工具。

实现基于仓库内冻结的 `qiubai-spec` v0.6.0 开发基线。生产 package 自带独立 skills/references，不读取或执行 `upstream/`，也不需要 Python。

## 安装与卸载

克隆本仓库后，在仓库根目录执行：

```bash
pi install .
```

临时验证：

```bash
pi -e .
```

卸载时使用 `pi list` 确认 Pi 记录的本地绝对路径，然后执行：

```bash
pi remove /absolute/path/to/qiubai-spec-pi
```

## 环境

- Node.js `>=22.19.0`
- 首个已验证 Pi 版本：`@earendil-works/pi-coding-agent` 0.85.1
- Pi runtime 必须导出 `withFileMutationQueue`
- 无 Python 运行时依赖

Pi extension 以当前用户权限运行。`qb_spec_transition` 会替换源文档，`qb_spec_archive` 在校验归档副本后会删除 active 来源。首次使用应在临时项目或已纳入版本控制的项目中验证。

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

## Tools

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
- Tools 只执行可机械判断的 inspect、transition、archive、recovery analysis/recovery mutation 和 doctor。
- `/qiubai-spec` 或 `/qiubai-init` 的调用、文档创建、`authorizationDeclared`、`verificationConfirmed` 和 recovery allowed action 都不是独立批准、验证或用户选择证据。
- Behavior Delta 与归档只产生长期 context 候选；新事实和推断偏好仍需明确批准。

## 文档根与路径安全

默认文档根是项目内 `docs/qb-spec`。可以传入项目内相对 `docsRoot`；绝对路径、项目外路径、符号链接和 junction/alias 路径会失败关闭。工具只支持快照定义的简单 frontmatter 标量，同时保留 BOM、LF/CRLF、未知字段和正文。

## 恢复限制

多文件归档和恢复不是文件系统级原子事务，也不承诺断电持久性。失败时可能同时保留已校验的 archive 副本、部分 active 来源和 `.qb-pending.json`。先用 `qb_spec_doctor` 取得 recovery state、allowed actions 和 journal hash；只有用户明确选择且现场仍匹配时才调用 `qb_spec_recover`。`ambiguous` 状态必须人工审查；不要直接删除 lock/pending、覆盖 archive 或强制执行。

首期恢复不处理 legacy metadata normalization，也不会从 archived payload 猜测重建已经删除的原始来源。

锁和 mutation queue 只协调合作的 Pi 文件工具，不能阻止恶意或不合作的外部进程。不要在同一 tool batch 中让 `edit`/`write` 与 qb-spec 写工具修改同一 change。

Windows 对 symlink 权限、rename 和已打开文件删除的语义可能不同；未在 Windows runner 验证前，不宣称完全跨平台。

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
