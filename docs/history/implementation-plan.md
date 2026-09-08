---
id: QB-20260908-qiubai-spec-pi-tools
type: design
tier: strict
status: archived
created: 2026-09-08
updated: 2026-09-08
supersedes: []
---

# Independent qiubai-spec Pi Tools — Implementation Plan

## Plan Status

本计划对应 `docs/qb-spec/specs/QB-20260908-qiubai-spec-pi-tools.md`。用户已批准实施；TASK-001 至 TASK-011 均已完成，验证证据记录在同 ID spec。

## Design Decision

采用独立子包方案：新建 `plugins/qiubai-spec-pi/`，由自己的 `package.json` 声明 Pi extension；验证阶段不修改根 `package.json`、根 README、marketplace 或 `plugins/qiubai-spec/`。TypeScript 实现以 qiubai-spec v0.6.0 为只读契约快照，不在运行时依赖其 Python 工具。

工具层与核心层分离：

```text
Pi tool adapters
    ↓ strict schemas / compact results
qb-spec application services
    ↓ inspect / transition / archive / doctor
filesystem safety layer
    ↓ path containment / queues / lock / hashes / journal
Node.js fs
```

Pi adapter 不包含生命周期规则；核心层不依赖 TUI；文件层不判断授权或验证语义。

## Planned Files

```text
plugins/qiubai-spec-pi/
├── package.json
├── README.md
├── extensions/index.ts
├── src/
│   ├── constants.ts
│   ├── types.ts
│   ├── paths.ts
│   ├── frontmatter.ts
│   ├── discovery.ts
│   ├── locking.ts
│   ├── journal.ts
│   ├── lifecycle.ts
│   ├── inspect.ts
│   ├── transition.ts
│   ├── archive.ts
│   ├── doctor.ts
│   ├── result.ts
│   └── tools/
│       ├── inspect-tool.ts
│       ├── transition-tool.ts
│       ├── archive-tool.ts
│       └── doctor-tool.ts
├── tests/
│   ├── fixtures/
│   ├── helpers/
│   ├── frontmatter.test.ts
│   ├── discovery.test.ts
│   ├── transition.test.ts
│   ├── archive.test.ts
│   ├── doctor.test.ts
│   ├── concurrency.test.ts
│   ├── extension.test.ts
│   └── snapshot-contract.test.ts
└── references/
    ├── snapshot-v0.6.0.md
    └── behavior-matrix.md
```

实际拆分可在不改变职责边界的情况下合并小文件；不得为了匹配树形示意制造无意义转发层。

## Implementation Tasks

### TASK-001 [REQ-001, REQ-002, AC-001, AC-002] — Establish the isolated package

- 创建独立 package manifest、extension 入口、测试入口和 README 骨架。
- 声明 Pi/typebox 相关 peer dependencies，运行时依赖保持最小。
- 加入自动测试断言，禁止 package discovery 越出 `plugins/qiubai-spec-pi/`。
- 不触碰根 Pi manifest 和原 qiubai-spec 文件。

### TASK-002 [depends: TASK-001] [REQ-002, REQ-009, AC-002, AC-009] — Freeze the behavioral snapshot contract

- 从 v0.6.0 lifecycle、change-tool reference、Python CLI 和现有测试提取行为矩阵，显式包含 persisted quick、合并 standard、历史 split-standard 和 strict。
- 在新插件内建立独立 fixtures 和 snapshot metadata，不复制无关 skill 正文。
- 增加 drift 检查；在原插件存在时报告关键规则变化，在独立 package 环境中跳过外部比较但继续运行 golden tests。
- 差分测试只允许在开发测试中执行原 Python CLI，生产 extension 不得包含该路径或 spawn 行为。

### TASK-003 [depends: TASK-001] [REQ-003, REQ-009, AC-003, AC-009] — Implement path, frontmatter, and discovery primitives

- 实现项目根和 docs root 真实路径约束、链接拒绝、change ID 校验和安全遍历。
- 实现有限 frontmatter parser/patcher，保留 BOM、换行、未知字段和正文。
- 实现 specs/plans/archive inventory 与唯一定位，区分 active、already archived、partial 和 conflict。
- 对目录规模设置有界遍历和诊断输出限制。

### TASK-004 [depends: TASK-003] [REQ-003, REQ-007, AC-003, AC-007] — Implement inspection service and tool

- 定义拒绝额外字段的 `qb_spec_inspect` schema、核心 service、结构化 details 和紧凑 renderer/fallback 文本；字符串枚举使用 `StringEnum`。
- 支持显式 change ID；“唯一 active change 自动选择”仅在无歧义时开放。
- 错误通过带稳定 `[QB_<CODE>]` 前缀的异常文本标记，不返回伪 success 或承诺自定义 error details。

### TASK-005 [depends: TASK-003] [REQ-004, REQ-008, REQ-009, REQ-010, AC-004, AC-008, AC-010] — Implement constrained transition

- 实现状态转换表、授权声明必填和逐文档 `document: spec | plan` schema；persisted quick/合并 standard 只有 spec，历史 split-standard/strict 可分别更新 spec 与 plan。
- 两个文档只要各自状态合法，即使处于 `active/draft` 等非相邻组合也按快照语义报告待同步；单个文档仍禁止非法跳级/回退，archive 前要求全部 actual documents 为 active。type/tier/ID 不一致、未知状态及 active/archive 来源冲突另行判为非法组合。
- 为单一目标文件取得覆盖完整 read-modify-write 的真实 Pi mutation queue，随后使用内部文档根锁。
- 在写前后检查源哈希，采用同目录临时文件、内容核验和安全替换更新 metadata。
- 失败时保留原始正文，不把授权声明写成独立证据。

### TASK-006 [depends: TASK-005] [REQ-005, REQ-008, REQ-009, REQ-010, AC-005, AC-008, AC-009, AC-010] — Implement safe archive

- 实现 verification declaration、active/strict/冲突前置检查，并覆盖 persisted quick、合并 standard、历史 split-standard 和 strict。
- 在任何读取后写入前，解析来源、目标文件和 pending 路径，按规范化绝对路径去重排序，依次取得真实 Pi mutation queues，再取得文档根锁并重新检查全部前置条件。
- 排他创建归档目录和 `.qb-pending.json`，记录来源、目标及哈希。
- 生成 archived payload，使用排他文件创建写入并校验全部目标。
- 删除来源前再次确认源未变化；按可诊断顺序删除，最后移除 pending。
- AbortSignal 只在首次持久化写入前取消；进入 journal 保护的提交段后继续到安全完成，真实 I/O 失败仍保留现场。
- 注入受控故障点以测试复制、校验、删除和取消时点；不得实现 force/resume。

### TASK-007 [depends: TASK-003] [REQ-006, REQ-007, AC-006, AC-007] — Implement read-only doctor

- 汇总 inventory、metadata、trace、逐文档待同步、lock、pending 和 partial archive diagnostics，并覆盖四种文档形态。
- 机械追踪只检查 ID 定义/引用存在性及 tier 必需类型，不评价需求或证据质量。
- schema 提供 `offset`/`limit`；每页返回 `total`、`nextOffset` 和有界 findings，文本/details 均不超过明确上限。
- 测试分页无重复、无遗漏，且执行前后 fixture tree 哈希一致。

### TASK-008 [depends: TASK-004, TASK-005, TASK-006, TASK-007] [REQ-007, REQ-010, AC-007, AC-010] — Register and render Pi tools

- 在 extension 中注册四个拒绝额外字段的严格 TypeBox tools，字符串枚举统一使用 `StringEnum`。
- 记录已测 Pi 0.85.1；注册写工具前 feature-check `withFileMutationQueue`，缺失时输出明确不兼容错误，manifest peer range 保持 `"*"`。
- 提供清楚的 description、prompt guidance、参数兼容边界、成功 rendering 和稳定错误码文本。
- 所有模式返回可读成功文本和结构化 success details；JSON/RPC smoke test 验证真实 thrown error 结果，仅 TUI 可用时使用增强显示。
- 确认插件不注册 skill、provider、自动 hook、默认 system prompt 或隐式工作流路由。

### TASK-009 [depends: TASK-005, TASK-006] [REQ-008, AC-008] — Verify concurrency behavior

- 使用 Pi 导出的真实 queue helper 覆盖同一文件、同一 docs root、不同 change、源变化，以及与内置 edit/write 对同一目标竞争的场景。
- 检查目标路径解析、去重、排序、全部 queues 后取得根锁的统一顺序、完整 mutation window、锁释放、失败现场和无死锁。
- 增加等待队列时取消、首次持久化写入前取消和 archive 提交段取消测试。
- 文档说明不同 change 可能被根锁短暂串行化，以及不合作外部进程的剩余限制。

### TASK-010 [depends: TASK-002, TASK-008, TASK-009] [REQ-001, REQ-002, REQ-007, REQ-009, AC-001, AC-002, AC-007, AC-009, AC-011] — Complete documentation and package validation

- 完成安装、卸载、工具、信任、快照、限制和故障诊断说明。
- 运行独立 package 测试、类型检查、真实 Pi 临时加载和本地子目录安装 smoke test。
- 验证根包和原 qiubai-spec 无修改、原 Python 14 项测试仍通过。
- 按仓库要求检查 JSON、目录唯一性和 `git diff --check`；新插件是 Pi-only，不新增三平台 manifest 或 marketplace 条目。

### TASK-011 [depends: TASK-010] [REQ-001, REQ-005, REQ-010, AC-001, AC-005, AC-010, AC-011] — Perform destructive-operation review

- 独立审查路径边界、链接、锁、journal、哈希、失败顺序和 tool authorization wording。
- 使用临时仓库完成至少一次 transition 与 archive 端到端演练。
- 未满足安全 acceptance 时保持 change active，不安装到常用 Pi 配置、不归档本 change。

## Implementation Completion

- TASK-001 至 TASK-008：独立 package、v0.6.0 快照、路径/frontmatter/discovery、四个 service 与 Pi tools 已完成。
- TASK-009：真实 Pi mutation queue、built-in edit/write 竞争、同/不同 change、锁顺序和取消测试已完成。
- TASK-010：README、独立安装、typecheck、41 项 Node 测试、14 项 Python 快照测试、Pi smoke 和 npm pack 检查已完成。
- TASK-011：独立 reviewer 完成破坏性操作审查；阻塞项与剩余 P2 均修复并复验。

## Verification Plan

### VER-001 [AC-001]

运行 package manifest/discovery 测试，并用临时 Pi 加载 `plugins/qiubai-spec-pi`；确认只注册四个工具，不发现根 skills。

### VER-002 [AC-002]

检查 `git diff -- plugins/qiubai-spec` 为空；对生产源码进行结构化/文本搜索，确认不存在 Python spawn、原 CLI 导入或运行时读取原插件。将新插件复制到不含原插件的临时目录运行核心测试。

### VER-003 [AC-003]

运行 discovery/inspection fixture suite，覆盖 persisted quick、合并 standard、历史 split-standard、strict、archive、重复、非法 metadata、包括 `active/draft` 在内的任意各自合法待同步组合、type/tier/ID/未知状态非法组合、越界、链接和 partial 状态，并断言错误分类与路径。

### VER-004 [AC-004]

运行 transition suite，覆盖四种文档形态、逐文档 schema、各文档独立合法/非法转换、任意各自合法待同步组合、授权声明、格式保留、幂等刷新及源变化；比较操作前后除预期 metadata 外的字节差异。

### VER-005 [AC-005]

运行四种文档形态的 archive fault-injection suite；逐个检查成功归档、提交前/提交段取消和各 I/O 失败点的源、目标、pending、哈希及重复执行结果。

### VER-006 [AC-006]

运行覆盖四种文档形态的 doctor suite，验证分页无重复遗漏，并对每个 fixture 在执行前后计算目录内容哈希，证明只读。

### VER-007 [AC-007]

运行 TypeScript primary diagnostics、typecheck、extension fake-API tests、拒绝额外字段/StringEnum schema tests、分页/截断测试、Pi API feature-check，以及真实 Pi TUI/JSON/RPC extension smoke test。

### VER-008 [AC-008]

运行基于真实 Pi queue helper 的并发 suite，验证同 change 串行、与内置 edit/write 同目标竞争、不同 change 不互相覆盖、路径去重排序、锁冲突失败关闭、等待后重新校验及三个取消时点；代码审查所有 mutation 入口的完整窗口和统一获取顺序。

### VER-009 [AC-009]

Linux 运行完整 Node suite，包含 Unicode/BOM/LF/CRLF/symlink/exclusive-create；Windows runner 可用时运行同一 suite，否则记录缺口及复验命令。

### VER-010 [AC-010]

检查 tool schema、实现和成功/错误文案；测试缺少声明时失败、声明存在时仍只报告 caller-attested，且任何路径都不修改长期 context 或生成 verification evidence。

### VER-011 [AC-011]

人工核对 README 的安装隔离、卸载、权限、工具、快照和限制；执行 JSON 解析、包路径、重复 skill 和 `git diff --check` 检查。

## Acceptance Matrix

| Acceptance | Primary verification | Supporting evidence |
| --- | --- | --- |
| AC-001 | VER-001 | VER-011 |
| AC-002 | VER-002 | VER-011 |
| AC-003 | VER-003 | VER-009 |
| AC-004 | VER-004 | VER-008 |
| AC-005 | VER-005 | VER-008, VER-009 |
| AC-006 | VER-006 | VER-003 |
| AC-007 | VER-007 | VER-001 |
| AC-008 | VER-008 | VER-004, VER-005 |
| AC-009 | VER-009 | VER-003, VER-004, VER-005 |
| AC-010 | VER-010 | VER-004, VER-005 |
| AC-011 | VER-011 | VER-001, VER-002 |

## Implementation Order And Parallelism

- TASK-002 与 TASK-003 可在 TASK-001 后并行，但同一工作树保持一个 writer。
- TASK-004、TASK-005、TASK-007 在 primitives 稳定后可按独立模块推进；TASK-006 在 TASK-005 的格式保持和队列基础完成后实施，不复制实现。
- TASK-008 在四个 service contract 稳定后统一接 Pi，避免 tool schema 反向驱动核心文件逻辑。
- TASK-009、TASK-010 完成后再进入独立破坏性操作审查 TASK-011。

## Rollback And Stop Conditions

- 任一测试出现源文件丢失、覆盖既有 archive、路径越界或无 journal 的部分移动，立即停止功能扩展，只保留失败 fixture 和现场用于修复。
- 无法证明 mutation queue 与内部锁的组合行为时，不交付 transition/archive，可将验证范围缩减为 inspect/doctor，但必须回到用户重新批准范围。
- 无法在无 Python、无原 qiubai-spec 目录的环境运行核心测试时，视为独立性失败。
- 回滚只删除新建的 `plugins/qiubai-spec-pi/`；不得为回滚修改原插件或清理真实项目中的 pending 现场。
