---
id: QB-20260908-pi-minimum-workflow
type: feature
tier: strict
status: archived
created: 2026-09-08
updated: 2026-09-08
supersedes: []
---

# Pi-native Minimum qiubai-spec Workflow — Implementation Plan

## Plan Status

本计划对应 `docs/qb-spec/specs/QB-20260908-pi-minimum-workflow.md`。用户已接受完整打包 11 个 workflow skills，确认 `/qiubai-spec` 与 `/qiubai-init` 均采用 Pi Prompt Templates、不使用 `registerCommand`，采纳 init 三模式，并已明确批准实施。spec 与 plan 已推进至 `active`；TASK-001 至 TASK-012 已完成。

## Design Decision

采用 Pi package 的原生三层资源模型：

```text
/qiubai-spec, /qiubai-init
        ↓ prompt templates（入口意图与参数）
Pi Agent Skills（语义、授权、集中路由）
        ↓
Pi built-ins + qb_spec_* tools（实现与机械文档操作）
```

- prompt templates 只负责启动意图，不复制完整 workflow。
- skills 负责 type/tier、需求、审查、计划、条件 gate、验证、context 与授权判断。
- 现有 TypeScript tools 继续只负责可机械判断的 inspect、transition、archive、doctor。
- 不使用 `registerCommand`，避免 extension command 优先级绕过 prompt/skill expansion。
- 生产 skills 是经审阅后独立落入 `skills/` 的运行时资源，不通过 import、symlink 或动态读取依赖冻结 `upstream/`。

## Planned Production Shape

```text
qiubai-spec-pi/
├── extensions/
│   └── index.ts
├── src/
├── skills/
│   ├── shaping-requirements/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── reviewing-spec-quality/SKILL.md
│   ├── writing-qb-plans/SKILL.md
│   ├── checking-architecture-boundaries/SKILL.md
│   ├── protecting-critical-behavior/SKILL.md
│   ├── verifying-before-completion/SKILL.md
│   ├── closing-qb-change/SKILL.md
│   ├── updating-directory-map/
│   │   ├── SKILL.md
│   │   └── assets/DIRECTORY_MAP.md
│   ├── maintaining-project-context/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── initializing-qb-spec/SKILL.md
│   └── establishing-project-foundations/
│       ├── SKILL.md
│       └── references/
├── prompts/
│   ├── qiubai-spec.md
│   └── qiubai-init.md
├── references/
├── tests/
└── package.json
```

完整文件集以经过链接检查的迁移结果为准；不得为了减少文件数将不相关职责合并，也不得保留运行时不可达的 references。

## Implementation Tasks

### TASK-001 [REQ-001, REQ-002, AC-001, AC-002] — Inventory and freeze the workflow contract

- 从冻结 v0.6.0 基线列出 11 个 skills、references、assets 和全部相对链接。
- 建立迁移矩阵：原路径、生产路径、Pi 适配项、保留语义、删除的 Python/跨平台特定内容。
- 明确 `workflow-routing.md` 的节点和边，形成可由测试读取的 expected skill-name 集合。
- 记录原 `change-tool.md` 中应改为四个 `qb_spec_*` tools 的调用点；不在生产文件中引用 frozen Python CLI。

### TASK-002 [depends: TASK-001] [REQ-001, REQ-002, REQ-005, AC-001, AC-002, AC-005] — Migrate core shaping and routing skills

- 独立迁移 `shaping-requirements` 及其 change type/tier、clarification、lifecycle、workflow routing references。
- 保留 quick inline、standard combined、strict split plan、稳定 trace IDs、Behavior Delta 和批准规则。
- 将机械 change-tool guidance 改为调用已注册的 `qb_spec_inspect`、`qb_spec_transition`、`qb_spec_archive`、`qb_spec_doctor`；语义正文继续使用 Pi 内建 read/edit/write 能力。
- 确认生产文本不要求知道 package 绝对路径，不读取 `upstream/`。

### TASK-003 [depends: TASK-002] [REQ-002, REQ-005, REQ-007, AC-002, AC-005] — Migrate planning, review, architecture, and protection gates

- 迁移 `reviewing-spec-quality` 与 `writing-qb-plans`，保持 standard embedded review 与 strict independent review 的差异。
- 迁移 `checking-architecture-boundaries` 与 `protecting-critical-behavior`，保持条件触发而非固定仪式阶段。
- 迁移 foundations references 中被这些 skills 或 verification 实际引用的 code-locality/refactoring/executable-check 规则。
- 检查所有 references 都按需加载，不在 skill descriptions 或 prompt 中展开完整正文。

### TASK-004 [depends: TASK-002, TASK-003] [REQ-002, REQ-004, REQ-005, AC-004, AC-005] — Migrate initialization, foundations, context, and Directory Map skills

- 迁移 `initializing-qb-spec`，保留 managed block、入口冲突 fail-closed 和显式授权规则。
- 迁移 `establishing-project-foundations` 及其适用 references，支持 create/adopt/refactor，但不让普通开发自动修改 Agent 入口。
- 迁移 `maintaining-project-context` 与 durable preference reference。
- 迁移 `updating-directory-map` 及其 asset，保持结构 trigger 和固定章节约束。
- 验证 `/qiubai-init` 三种模式各有唯一入口 skill，且无模式不产生写入授权。

### TASK-005 [depends: TASK-002, TASK-003, TASK-004] [REQ-002, REQ-005, AC-005] — Migrate completion and exception-close workflow

- 迁移 `verifying-before-completion`，将普通成功关闭改为在证据充分后调用 `qb_spec_archive`。
- 迁移 `closing-qb-change` 作为 legacy、冲突、恢复和用户显式关闭路径。
- 将 Python availability/fallback 规则替换为 Pi-native tool guidance；工具失败进入 `qb_spec_doctor` 诊断，不自动 force/resume。
- 保留 verification attestation、Directory Map、blocking clarification 和 context promotion 边界。

### TASK-006 [depends: TASK-002] [REQ-003, REQ-005, REQ-007, AC-003] — Add `/qiubai-spec` prompt template

- 新建 `prompts/qiubai-spec.md`，包含 description 与必填 `<开发请求>` argument hint。
- 使用 `$@` 保留完整请求，不把多词参数拆成多套语义。
- 提示 Agent 加载 shaping skill、遵守集中路由、复用但不伪造授权，并优先使用 qb_spec tools 处理机械动作。
- 不复制 type/tier 表、完整 lifecycle 或 verification checklist。

### TASK-007 [depends: TASK-004] [REQ-004, REQ-005, REQ-007, AC-004] — Add `/qiubai-init` prompt template

- 新建 `prompts/qiubai-init.md`，argument hint 为 `[entry|bootstrap|adopt] [说明]`。
- 在模板中解析并保留全部参数，同时把模式解释与最终决定交给对应 skill。
- 无参数、未知模式或冲突时只要求检查和聚焦确认，不授予文件修改。
- 明确 `entry`、`bootstrap`、`adopt` 的授权差异，尤其禁止 adopt 隐式修改 Agent 入口。

### TASK-008 [depends: TASK-005, TASK-006, TASK-007] [REQ-001, REQ-006, REQ-007, AC-001, AC-006] — Wire Pi package resources

- 更新 `package.json` 的 `files`，加入 `skills` 与 `prompts`。
- 更新 `pi` manifest，显式声明一个 extension、skills 路径和 prompts 路径。
- 不修改 `extensions/index.ts` 注册 slash commands；保持只注册四个 tools。
- 更新 README 的安装后资源、两个入口、原生 `/skill:<name>` 诊断方式、授权边界和 progressive disclosure 说明。
- 更新 `references/behavior-matrix.md` 与 snapshot contract，使其区分机械工具矩阵和 workflow 覆盖矩阵。

### TASK-009 [depends: TASK-008] [REQ-001, REQ-002, REQ-003, REQ-004, REQ-006, REQ-007, REQ-008, AC-001, AC-002, AC-003, AC-004, AC-006] — Add deterministic resource contract tests

- 新增 skill inventory/frontmatter 测试，验证恰好 11 个预期 skill、唯一名称和非空 description。
- 新增 Markdown link walker，解析生产 skills/prompts 中的相对链接，拒绝断链、绝对开发路径、symlink、路径逃逸和 `upstream/` runtime references。
- 新增 routing graph 测试，验证集中路由命名的 skills 都存在且没有第二事实源声明。
- 新增 prompt metadata/expansion 测试，覆盖多词参数、无参数和 init 三种模式。
- 静态断言两个 prompt 不包含 true attestation，不宣称批准或验收通过。
- 调整现有 manifest/snapshot tests；保留四工具 schema 和行为断言。

### TASK-010 [depends: TASK-009] [REQ-008, AC-006, AC-007, AC-008] — Run real Pi discovery and workflow smoke tests

- 在临时、不含 `upstream/` 的 package 副本中加载 Pi。
- 使用 `pi.getCommands()`、RPC `get_commands` 或等价受支持接口确认两个入口来源为 prompt、11 个 workflow 命令来源为 skill。
- 确认四个 tools 可用且不存在同名 extension commands。
- 对 `/qiubai-spec <fixture request>` 做展开/受控 smoke，检查首步路由和授权文案；不依赖模型输出作为唯一证据。
- 对无参数 `/qiubai-init` 做无写入 smoke，对临时项目操作前后 tree hash，确认未选择模式时 fail-closed。

### TASK-011 [depends: TASK-010] [REQ-005, REQ-008, AC-005, AC-007, AC-008] — Perform workflow and authorization review

- 独立审查 request 到 archive 的 quick、standard、strict 路径。
- 审查 `/qiubai-init` 三模式是否存在授权扩大、入口冲突覆盖或 context 自动提升。
- 审查所有调用 `qb_spec_transition`/`qb_spec_archive` 的说明，确认 attestation 只能在 Agent 已完成对应判断后提供。
- 发现悬空路由、直接归档、隐式批准或无模式写入时停止交付并修复，不以文档测试通过替代语义审查。

### TASK-012 [depends: TASK-011] [REQ-008, AC-007] — Complete package verification

- 执行 `npm ci`。
- 执行 `npm run typecheck`。
- 执行 `npm test`。
- 执行 `npm pack --dry-run --json`，程序化确认包含全部 skills/prompts 且排除 `tests/`、`docs/`、`upstream/`。
- 临时加载 extension/resources，记录真实 Pi 版本和 smoke 结果。
- 检查 `git diff --check`、生产文件链接、发布文件清单及工作树状态。

## Implementation Completion

- TASK-001 至 TASK-005：11 个 skills、集中路由、Pi-native change-tool guidance 和全部实际引用的 references/assets 已迁移到生产 `skills/`；原平台 agents 与 Python scripts 未进入生产资源。
- TASK-006、TASK-007：`/qiubai-spec` 与 `/qiubai-init` Prompt Templates 已完成，包含参数、无参数行为和授权边界。
- TASK-008：manifest、npm files、README、snapshot 和 behavior matrix 已更新；extension 仍只注册四个 tools。
- TASK-009：Pi loader、frontmatter、链接、routing graph、实际 prompt expansion 和 attestation 静态测试已加入，总测试数由 41 增至 45。
- TASK-010：真实 Pi RPC discovery 已确认两个 prompt 与 11 个 skills。
- TASK-011：已审查普通/异常关闭、init 三模式、context promotion 和 tool attestation 边界，未发现阻塞项。
- TASK-012：`npm ci`、typecheck、45 项测试、pack dry-run 和 diff check 已完成；详细结果记录在对应 spec。

## Verification Plan

### VER-001 [AC-001]

运行 manifest、production-boundary 和 isolated-copy tests；枚举打包后的 extension、skill、prompt 文件，确认不需要 `upstream/` 或 Python。

### VER-002 [AC-002]

运行 skill validator、Markdown link walker 和 routing graph tests；对集中路由中的 skill 名称与 package inventory 做集合比较，并检查唯一事实源声明。

### VER-003 [AC-003]

对 `qiubai-spec.md` 执行模板参数展开测试，输入包含空格、中文和引号的请求；断言请求完整保留、首步 shaping、集中路由、授权边界和验证后归档约束。

### VER-004 [AC-004]

对 `qiubai-init.md` 执行无参数、未知模式、entry、bootstrap、adopt 五类展开测试；静态与受控 fixture 测试确认未明确模式不授权写入，adopt 不隐式授权 Agent 入口。

### VER-005 [AC-005]

按 quick、standard、strict 和 init/exception/context 分支人工加结构化矩阵审查；每条 route 必须有 package 内承接者，每个语义决定必须留在 skill/Agent 层。

### VER-006 [AC-006]

运行 fake extension API test 和真实 Pi command discovery；断言 prompts、skills、extension tools 的 source/provenance 与数量，确认无同名 extension command 覆盖。

### VER-007 [AC-007]

运行仓库标准四项验证，并解析 pack JSON 检查发布白名单；现有 41 项或其后继机械测试全部通过。

### VER-008 [AC-008]

在临时 fixture 项目运行 standard 主入口 smoke 和无参数 init smoke；保存操作前后哈希及展开文本，模型输出只作为辅助观察。

## Acceptance Matrix

| Acceptance | Primary verification | Supporting evidence |
| --- | --- | --- |
| AC-001 | VER-001 | VER-006, VER-007 |
| AC-002 | VER-002 | VER-005 |
| AC-003 | VER-003 | VER-005, VER-008 |
| AC-004 | VER-004 | VER-005, VER-008 |
| AC-005 | VER-005 | VER-002 |
| AC-006 | VER-006 | VER-001 |
| AC-007 | VER-007 | VER-001, VER-006 |
| AC-008 | VER-008 | VER-003, VER-004 |

## Implementation Order And Parallelism

- TASK-001 是所有迁移工作的共同前置。
- TASK-003 与 TASK-004 可在 TASK-002 稳定后并行审阅，但同一生产 skill/reference 文件保持单 writer。
- TASK-006 与 TASK-007 可分别在其依赖 skill contract 稳定后并行。
- TASK-008 只在全部运行时资源路径稳定后进行，避免 manifest 指向半成品。
- TASK-009 至 TASK-012 串行完成；真实 Pi smoke 和授权审查未通过前不将 spec/plan 提升为完成状态。

## Rollback And Stop Conditions

- 生产 skill 或 prompt 出现 `upstream/`、Python CLI、开发机绝对路径或断链引用时停止打包。
- 任一路径把 prompt invocation、文档创建或 attestation 当作批准/验证证据时停止交付。
- `/qiubai-init` 无参数或 adopt 模式能够隐式修改 Agent 入口时停止交付。
- 集中路由引用未打包 skill、出现第二默认顺序事实源或普通成功路径强制额外 closing 阶段时停止交付。
- 现有 transition/archive 安全测试回归时优先恢复工具行为，不为迁移 workflow 放宽机械契约。
- 回滚时移除 manifest 中 skills/prompts 声明和新增生产资源，恢复 README/references；不得修改或清理用户项目中的 qb-spec 文档。
