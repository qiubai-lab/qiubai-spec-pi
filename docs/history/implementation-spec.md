---
id: QB-20260908-qiubai-spec-pi-tools
type: design
tier: strict
status: archived
created: 2026-09-08
updated: 2026-09-08
supersedes: []
---

# Independent qiubai-spec Pi Tools

## Approval State

用户已明确要求为审阅准备 spec/plan，并确认以下方向：使用 TypeScript 重写文档处理工具；新能力作为独立 Pi 插件；不修改现有 `plugins/qiubai-spec/`；只把其当前内容作为实现与验证快照。本文和对应 plan 仍为 `draft`，审阅不构成实施批准。

## Goal

在 `plugins/qiubai-spec-pi/` 建立可单独安装的 Pi package，以结构化 Pi tools 完成 qb-spec change 的检查、有限生命周期更新、归档和诊断，减少 Agent 拼接脚本路径、探测 Python、解析命令输出及重复定位文档的机械步骤，同时保持现有 qiubai-spec v0.6.0 的安全边界和语义授权规则。

## Scope

- 新建独立目录 `plugins/qiubai-spec-pi/`，拥有自己的 `package.json`、TypeScript extension、实现、测试和说明。
- 通过 `pi install ./plugins/qiubai-spec-pi` 本地独立安装，只注册该 package 声明的 Pi extension。
- 实现 `qb_spec_inspect`、`qb_spec_transition`、`qb_spec_archive`、`qb_spec_doctor` 四个结构化工具。
- 使用 Node.js 内置文件、路径和加密能力重写当前 Python 工具的适用行为；运行时不调用 Python，也不读取原插件实现。
- 以 `plugins/qiubai-spec/` 当前 v0.6.0 内容及其 14 项 Python 测试所表达的行为作为开发期快照基准，建立独立 fixtures、契约测试和可选差分测试。
- 保留 qb-spec 对授权、验证、长期 context 和异常恢复的现有边界；工具只执行可机械判断的操作。

## Non-goals

- 不修改 `plugins/qiubai-spec/` 下任何 manifest、skill、reference、script、test 或 asset。
- 不修改根 `package.json` 以自动加载新 extension；验证阶段不把新插件加入根 Pi 聚合包。
- 不恢复历史 Pi plugin selector，不提供其他插件的 list/enable/disable。
- 不重新实现需求塑形、type/tier 选择、工作流路由、规格语义审查、测试设计或验收判断。
- 不自动把 change 状态标记为 approved/verified，不从对话推断授权，不自动写长期 context。
- 不提供自动修复 pending/partial archive、force archive、覆盖目标、批量迁移 legacy 文档或远程 Git 子目录安装。
- 不发布 npm 包、不拆分独立 Git 仓库；远程独立分发在验证通过后另行决策。

## Assumptions And Constraints

- 当前行为快照版本为 qiubai-spec `0.6.0`；后续原插件变化只触发 drift 报告，不自动改变本插件行为。
- 首个兼容基线为 `@earendil-works/pi-coding-agent` 0.85.1 和 Node.js `>=22.19.0`；manifest 中 Pi peer dependencies 仍按官方约定使用 `"*"`，运行时在注册写工具前检查所需 mutation queue API，缺失时给出明确不兼容错误。
- 运行时依赖优先限制为 Node 内置模块和 Pi peer dependencies；不引入 YAML 解析器来扩大 frontmatter 语法。
- 文档根默认是项目内 `docs/qb-spec`；允许显式提供项目内相对路径，但解析后的真实路径不得越出项目根。
- 工具结果在 TUI、RPC、JSON 和 print 模式下均保持结构化可用；TUI 增强不是第一版验收前提。
- 多文件归档只提供带锁、journal、内容校验和失败保留现场的可恢复流程，不宣称文件系统级原子事务或断电持久性。

## Requirements

### REQ-001 — Independent package and installation isolation

新插件必须位于 `plugins/qiubai-spec-pi/` 并拥有独立 Pi package manifest。通过该子目录安装时只发现新插件声明的 extension，不加载根包的 `./plugins/*/skills`，也不把 `.codex-plugin`、`.claude-plugin` 或 `.kimi-plugin` 内容作为 Pi 资源。

### REQ-002 — Read-only snapshot boundary

实现和测试不得修改 `plugins/qiubai-spec/`。运行时不得导入、执行或读取原 Python CLI；开发期测试可以只读使用原插件 v0.6.0 作为契约来源，并必须将运行时所需 fixtures 和规则保存在新插件内部。

### REQ-003 — Deterministic discovery and inspection

`qb_spec_inspect` 必须按稳定 change ID 在 specs、plans 和 archive 中唯一定位文档，解析受支持的 frontmatter，返回路径、type、tier、status、文档组合及异常状态。重复 ID、非法 ID、缺失字段、越界路径、链接路径和不完整归档必须失败或以明确诊断返回，不得猜测目标。

### REQ-004 — Constrained lifecycle transitions

`qb_spec_transition` 只允许快照规定的 `draft → approved → active` 及同状态日期刷新；archived 只能通过 archive 产生，superseded 和 legacy 迁移不由普通 transition 处理。状态提升必须要求调用方提供显式授权声明；工具只记录该声明，不宣称验证授权真实性。为保持 v0.6.0 快照语义，每次调用只更新调用方明确指定的 `spec` 或 `plan`；strict 和历史 split-standard 的两个文档只要各自处于合法 lifecycle 状态，即使差异超过一个阶段（例如 `spec: active / plan: draft`）也属于可继续同步的 snapshot-compatible 状态，inspect/doctor 必须报告各自状态和待同步提示而非判为损坏。type/tier/ID 不一致、未知状态或 active 来源与 archived 来源冲突仍是非法组合；archive 要求所有实际来源文档均为 active。

### REQ-005 — Safe archive behavior

`qb_spec_archive` 必须要求调用方显式声明验收已确认，并在操作前检查唯一来源、active 状态、strict plan、目标不存在、无残留 lock/pending 及源内容稳定。归档必须排他创建目标，写入 journal，生成 archived 内容，写入并校验全部目标后再删除来源，最后清理 journal；任何失败不得覆盖目标或静默丢失仍可保留的来源。

### REQ-006 — Diagnostics without implicit recovery

`qb_spec_doctor` 必须只读报告重复 ID、非法/不一致 metadata、strict 缺 plan、archive 目标冲突、残留 lock、`.qb-pending.json`、部分移动和可机械识别的 REQ/AC/TASK/VER 断链。第一版不得自动删除 lock/pending、恢复来源、补写语义内容或强制完成归档。

### REQ-007 — Structured Pi tool contract

四个工具必须使用拒绝额外字段的严格 TypeBox schema；字符串枚举使用 Pi 兼容的 `StringEnum`。成功结果提供稳定 details 和精简文本；失败通过带稳定 `[QB_<CODE>]` 前缀的异常文本标记为 tool failure，不承诺 Pi 为 thrown error 保留自定义 details。工具参数不得要求调用方提供插件安装绝对路径或 Python 命令。doctor 使用 `offset`/`limit` 分页并返回 `total`、`nextOffset`；文本和 details 均遵守明确的不高于 Pi 50KB/2000 行上限。

### REQ-008 — Mutation concurrency and integrity

所有写操作必须参与 Pi 的文件 mutation queue，并在插件内部使用 qb-spec 文档根排他锁和源哈希检查。目标路径先解析、去重并按规范化绝对路径排序，再依次取得覆盖完整 read-modify-write/delete 窗口的队列，随后取得文档根锁；archive 的来源、目标文件和 pending journal 都纳入该集合。测试必须使用 Pi 导出的真实 queue helper 与内置 edit/write 对同一文件竞争。取消信号在进入首次持久化写入前生效；进入带 journal 的归档提交段后不得因取消主动留下新的半完成状态，但仍保留真实 I/O 失败现场。锁只能约束合作写入者，文档必须明确该限制。

### REQ-009 — Portability and dependency discipline

实现应使用 `node:fs/promises`、`node:path`、`node:crypto` 等内置模块，保持 UTF-8 BOM、正文、未知 frontmatter 字段和现有换行风格。路径、排他创建、rename/unlink 和符号链接行为必须在 Linux 上验证，并为 Windows 差异提供可执行测试或明确记录的环境缺口。

### REQ-010 — Semantic authority remains outside the tools

工具不得决定 requirement 是否正确、AC 是否真正满足、用户是否批准、验证是否充分、Directory Map 是否应该更新或长期 context 是否应该提升。`authorizationDeclared`、`verificationConfirmed` 等字段只表示调用方承担判断责任，工具结果不得把这些声明描述成独立证据。

## Behavior Delta

### ADDED

- REQ-001、REQ-002：新增与原 qiubai-spec 隔离的 Pi-only TypeScript package 和快照边界。
- REQ-003、REQ-007：新增结构化 change 检查与 Pi tool contract。
- REQ-004：新增有限、显式授权的生命周期更新工具。
- REQ-005：新增无 Python 运行时依赖的安全归档工具。
- REQ-006：新增只读 doctor 诊断。
- REQ-008、REQ-009：新增 Pi mutation queue、内部锁、哈希和跨平台文件完整性约束。

### MODIFIED

不修改现有 qiubai-spec 行为。对只安装 `qiubai-spec-pi` 的 Pi 会话，原先需要 Agent 定位并调用 Python CLI 的机械操作可改用结构化工具；需求、批准、验证与 context 规则保持在工具外部。

## Acceptance Criteria

### AC-001 [REQ-001]

从 `plugins/qiubai-spec-pi` 本地安装或以临时 extension 加载时，Pi 只发现该 package 声明的四个工具；测试确认根 `plugins/*/skills` 和三个非 Pi manifest 未被新 package 暴露。仓库根安装行为保持不变。

### AC-002 [REQ-002]

实现 diff 不包含 `plugins/qiubai-spec/` 下的修改；运行时源码不导入、spawn 或读取原 Python CLI。独立 fixtures 在没有原插件目录和 Python 的测试环境中通过核心测试；开发期 snapshot drift 检查能报告基准变化。

### AC-003 [REQ-003]

inspection 测试覆盖 persisted quick、合并 standard、历史 split-standard、strict spec+plan、已归档、非法 ID、重复 ID、缺字段、任意各自合法的逐文档状态差异，以及 type/tier/ID 不一致、未知状态、active/archive 冲突等非法组合，并覆盖路径逃逸、目录/文件链接和 partial archive；每种情况必须返回确定结果或 actionable failure，不误要求 quick/standard 拥有独立 plan，也不自动合并历史文档。

### AC-004 [REQ-004]

transition 测试覆盖 persisted quick、合并 standard、历史 split-standard 和 strict；覆盖逐文档指定、各文档独立合法转换、任意 snapshot-compatible 待同步组合、拒绝单文档跳级/回退/archived 修改、缺少授权声明、同状态刷新、正文/未知字段/BOM/CRLF 保留以及操作期间源变化。

### AC-005 [REQ-005]

archive 测试覆盖 persisted quick、standard 合并文档、历史 split-standard 和 strict 双文档成功路径，不自动改变或合并历史文档形态；同时覆盖未确认验证、非 active、目标已存在、锁冲突、写入失败、校验失败、删除中断、源并发变化、重复调用、残留 journal，以及提交前取消和提交段取消；失败时不覆盖既有目标，并保留可诊断现场。

### AC-006 [REQ-006]

doctor fixtures 覆盖 persisted quick、合并 standard、历史 split-standard 和 strict，能发现 metadata、trace、逐文档待同步、lock、pending 和部分移动问题且不误报缺 plan；分页可无重复、无遗漏地访问全部 findings，运行 doctor 前后项目 fixture 的完整内容哈希一致。

### AC-007 [REQ-007]

TypeScript 类型检查和 tool schema 测试通过；使用 fake Pi API 的 extension 测试验证四个工具注册、成功 details、分页/截断及无需 Python/插件绝对路径。真实 Pi 临时加载及 JSON/RPC smoke test 验证成功结果与带稳定错误码的实际失败结果；缺少所需 Pi API 时注册阶段给出明确不兼容错误。

### AC-008 [REQ-008]

并发测试证明同一 change 的 transition/archive 被串行化，源在队列等待期间发生变化会重新检查或失败；使用真实 Pi queue helper 验证与内置 edit/write 对同一目标的竞争，检查路径去重、排序、队列后根锁的统一获取顺序及完整 mutation window。不同 change 可以被文档根锁短暂串行化，但不得互相覆盖。提交前取消必须无写入；归档提交段收到取消时必须安全完成或按真实 I/O 失败规则保留 journal。

### AC-009 [REQ-009]

Linux 上 Node 测试覆盖中文路径、BOM、LF/CRLF、symlink 和排他目标创建；Windows 可用时运行对应 suite。不可用平台或文件系统语义无法验证时，在交付中列出缺口和最小复验命令。

### AC-010 [REQ-010]

源码与行为测试确认工具不会自动生成批准、验收通过或长期 context 更新；缺少显式声明时 transition/archive 失败，成功与错误文本均明确“声明不是证明”。

### AC-011 [REQ-001, REQ-007, REQ-009]

新 package README 说明本地独立安装、卸载、信任边界、四个工具、Node/Pi 要求、非目标、快照版本和限制。根 README、根 package manifest、三个 marketplace 和原 qiubai-spec manifest 在验证阶段不需要修改。

## Verification Evidence

- **AC-001、AC-002、AC-011：** 独立 `plugins/qiubai-spec-pi/package.json` 只声明 `extensions/index.ts`；`npm pack --dry-run --json` 仅包含 17 个新插件运行时文件。生产源码搜索未发现 Python、原 CLI 或原插件运行时依赖；`plugins/qiubai-spec/`、根 `package.json`、根 README 和三个 marketplace 均无 diff。
- **AC-003、AC-004、AC-006：** Node fixture suite 覆盖 persisted quick、合并 standard、历史 split-standard、strict、逐文档状态、重复 ID、非法 metadata、active/archive 冲突、跨年份重复 archive、错误 archive 目录、目录/文件 symlink、trace、lock、pending、partial archive 和完整分页。
- **AC-005、AC-008：** archive/fault/concurrency suite 覆盖排他目标、journal/hash、复制/校验/删除失败、源变化、取消时点、同 change 双 archive、built-in edit/write 竞争、不同 change、真实 Pi mutation queue、路径去重排序及 queue 后根锁。
- **AC-007、AC-010：** 四个严格 TypeBox/StringEnum schema、稳定错误码、bounded success details 和 caller-attested 文案测试通过；真实 Pi smoke 已观察到 inspect 成功结果和 `QB_INVALID_CHANGE_ID` 错误路径。
- **AC-009：** `npm --prefix plugins/qiubai-spec-pi run typecheck` 通过；`npm --prefix plugins/qiubai-spec-pi test` 为 41/41 通过，覆盖 Unicode、BOM、LF/CRLF、symlink、排他创建和 UTF-8 50KB/2000 行边界。Linux 已验证；Windows runner 未提供，保留平台缺口。
- 原 Python 快照测试 `python3 plugins/qiubai-spec/skills/closing-qb-change/scripts/test_qb_change.py` 为 14/14 通过；TypeScript LSP primary diagnostics 无错误，`git diff --check` 通过。
- 独立 reviewer 首轮发现 archive doctor、并发、截断和分页证据缺口；修复后结论为 PASS，剩余三个 P2（archive 目录结构、active archived 状态、inspect 目录 symlink）也已补齐并由新增测试验证。

## Risks And Recovery

- TypeScript 重写可能与 Python 快照产生细微语义偏差；通过共享行为矩阵、golden fixtures 和开发期差分测试控制，不能仅比较命令名称。
- Pi extension 具有完整系统权限；安装文档必须明确它会移动和删除 change 源文件，并建议先在测试项目验证。
- Pi tool 与内置 edit/write 的并发仍受合作调用限制；mutation queue、内部锁和源哈希用于失败关闭，不保证抵御恶意进程。
- Windows 对 symlink、排他打开、rename 和删除中的文件有不同语义；无实测时不得宣称完全跨平台。
- 若实现或验证失败，删除或卸载 `plugins/qiubai-spec-pi` 即可回退；原 `plugins/qiubai-spec` 和根 Pi package 不受影响。任何 partial archive fixture 或真实现场不得由卸载动作自动清理。

## Review Questions

请审阅时重点确认：

1. 第一版保持四个工具，将快速定位与完整诊断成本分离。
2. 验证范围采用本地子目录安装；npm/远程独立分发留到验证之后。
3. 第一版只检测、不自动恢复 pending/partial archive，避免恢复策略扩大破坏面。
4. transition 保持 v0.6.0 的逐文档语义，不引入跨文件伪原子更新；strict/split-standard 的第二个文档需要单独调用，两个文档的任意各自合法状态组合均可继续同步，但 archive 仍要求全部 active。
