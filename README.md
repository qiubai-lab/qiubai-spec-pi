# qiubai-spec-pi

独立的 Pi package，用 TypeScript 提供 qb-spec 文档检查、生命周期更新、归档和诊断工具。实现基于仓库内冻结的 `qiubai-spec` v0.6.0 开发基线，但生产扩展不读取或执行该基线，也不需要 Python。

## 安装与卸载

克隆本仓库后，在仓库根目录执行：

```bash
pi install .
```

package manifest 只声明一个 Pi extension，不声明 skills、prompts 或 themes。验证时也可以临时加载：

```bash
pi -e . -p "列出当前会话可用的 qb_spec 工具"
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

`verificationConfirmed` 只是调用方声明，不是验收证据。工具不会覆盖已有目标，也不会自动恢复 pending/partial archive。

### `qb_spec_doctor`

只读检查 metadata、重复 ID、strict plan、分离文档状态、trace ID、lock、pending journal 和 partial archive。结果使用 `offset`/`limit` 分页；doctor 不删除、修复或迁移任何文件。

## 文档根与路径安全

默认文档根是项目内 `docs/qb-spec`。可以传入项目内相对 `docsRoot`；绝对路径、项目外路径、符号链接和 junction/alias 路径会失败关闭。工具只支持快照定义的简单 frontmatter 标量，同时保留 BOM、LF/CRLF、未知字段和正文。

## 恢复限制

多文件归档不是文件系统级原子事务，也不承诺断电持久性。失败时可能同时保留已校验的 archive 副本、部分 active 来源和 `.qb-pending.json`。此状态必须人工诊断；不要直接删除 lock/pending、覆盖 archive 或重复强制执行。

锁和 mutation queue 只协调合作的 Pi 文件工具，不能阻止恶意或不合作的外部进程。不要在同一 tool batch 中让 `edit`/`write` 与 qb-spec 写工具修改同一 change。

Windows 对 symlink 权限、rename 和已打开文件删除的语义可能不同；未在 Windows runner 验证前，不宣称完全跨平台。

## 非目标

本插件不负责：

- 需求塑形和 type/tier 决策
- 规格语义审查
- 判断用户是否批准
- 判断 AC 是否真正满足
- 生成验证证据
- 更新 Directory Map
- 提升长期 context
- 自动恢复、force archive 或 legacy 批量迁移

## qiubai-spec v0.6.0 开发基线

`upstream/qiubai-spec-v0.6.0/` 保存迁移时的完整只读基线，包括 skills、references、Python 工具、测试和三平台 manifests，用于后续行为对齐与差分审查。

边界如下：

- `extensions/` 与 `src/` 是生产实现。
- `upstream/qiubai-spec-v0.6.0/` 只用于开发和契约验证，不由 Pi package manifest 加载，也不进入 npm tarball。
- 基线升级必须显式评审行为差异，更新 `references/`、fixtures、实现和测试；不得在运行时动态同步上游规则。
- 历史实施规格保存在 `docs/history/`。

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
