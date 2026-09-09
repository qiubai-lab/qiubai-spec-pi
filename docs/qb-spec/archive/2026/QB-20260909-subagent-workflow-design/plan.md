---
id: QB-20260909-subagent-workflow-design
type: design
tier: strict
status: archived
created: 2026-09-09
updated: 2026-09-09
supersedes: []
---

# Plan: qiubai-spec subagent workflow design

Spec: `docs/qb-spec/specs/QB-20260909-subagent-workflow-design-subagent-workflow-design.md`

## Implementation Tasks

- [x] **TASK-001** [REQ-001, REQ-002, AC-001] 检查现有 `skills/`、`extensions/`、`src/` 与 `qb_spec_*` 权限边界，列出不可委派的语义与 lifecycle 决策。
- [x] **TASK-002** [REQ-003, REQ-004, REQ-008, AC-002] 对照当前 Pi SDK 和官方 subagent extension 示例，形成独立 session、最小工具集、资源加载和项目 profile trust 设计。
- [x] **TASK-003** [REQ-005, REQ-006, REQ-009, REQ-010, AC-003, AC-005, AC-006] 定义 dispatch/result、证据、输出截断、错误分类、取消和 backend 等价契约。
- [x] **TASK-004** [REQ-007, REQ-011, AC-004, AC-007] 定义首期只读角色、顺序/并行规则及 writer/implementer 的后续 change 边界。
- [x] **TASK-005** [REQ-012, AC-008, AC-009] 定义 inline fallback 和覆盖 shaping/review、plan review、test evidence、doc audit 的兼容验收。
- [x] **TASK-006** [depends: TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-008, TASK-009, TASK-010, TASK-011, TASK-012, TASK-013, TASK-014] [REQ-001, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016, REQ-017, REQ-018, AC-001, AC-007, AC-009, AC-010, AC-011, AC-012, AC-013, AC-014, AC-015] 取得用户对推荐 Option C、固定轻量任务范围、sequential delegation topology、成本阈值、Pi-native backend、session-scoped model picker 与安全缺口处理及“本 change 仅完成技术调研与设计”的明确批准。
- [x] **TASK-007** [depends: TASK-006] [REQ-001, REQ-002, REQ-012, AC-001, AC-009] 将 spec 和 plan 转为 approved/active，执行设计验收并记录证据；本 change 不修改 runtime。
- [x] **TASK-008** [REQ-001, REQ-002, REQ-005, REQ-013, AC-001, AC-010] 将 Superpowers 的 fresh implementer、双维 task review、修复复审、whole-branch review 和 fresh verification 模型落盘为参考，并记录 qiubai-spec 的采用、调整和排除项。
- [x] **TASK-009** [REQ-001, REQ-007, REQ-014, AC-004, AC-011] 比较纯并行、纯串行和主 pipeline + 阶段内 fan-out/fan-in，形成初步 topology 调研。
- [x] **TASK-010** [depends: TASK-009] [REQ-003, REQ-004, REQ-007, REQ-011, REQ-014, REQ-015, AC-002, AC-004, AC-007, AC-011, AC-012] 根据用户提出的成本与上下文隔离目标，将推荐方案收窄为单 pipeline、一次一个固定轻量任务、显式 economy model、无编辑且无并行的代理。
- [x] **TASK-011** [depends: TASK-010] [REQ-015, REQ-016, AC-012, AC-013] 建立各 task kind 的相对成本区间、端到端成本公式、初始 dispatch thresholds，并与主流 specialist/implementer/parallel subagent 模式比较优劣。
- [x] **TASK-012** [depends: TASK-010] [REQ-003, REQ-004, REQ-005, REQ-006, REQ-009, REQ-010, REQ-017, AC-002, AC-003, AC-005, AC-006, AC-014] 对 Pi 0.85.1 SDK、extension/TUI 接口和官方 subagent 示例做可行性调研，运行不调用模型的资源隔离、tool allowlist 和 economy model availability spike，并记录路径/命令安全缺口。
- [x] **TASK-013** [depends: TASK-012] [REQ-015, REQ-018, AC-012, AC-015] 设计 `/qb-subagent-model` 的 TUI picker、显式参数、reset、session entry 持久化、无 UI 行为和精确模型校验；模型来源与 Pi `/model` 同源且不改变主模型。
- [x] **TASK-014** [depends: TASK-013] [REQ-011, REQ-014, REQ-015, REQ-018, AC-007, AC-011, AC-012, AC-015] 在后续实现 change 前确认 model persistence、无选择时行为、首期 task-kind allowlist 和自动 activation policy；实现 plan 再定稿 runner、artifact、budget、capability 与 command-collision 契约。

## Architecture Gate

- Boundary decision：通过。workflow 语义和 next-action 留在 `skills/`；runtime adapter 仅做机械 dispatch；现有 `qb_spec_*` 继续独占生命周期 mutation；主 agent保留授权解释与验收充分性。
- Placement：未来实现采用 `extensions/` 薄注册、`src/subagent/` 机械执行、package-owned task profiles 的分离；不得把 workflow routing 条件写入 adapter。
- Model separation：dispatch request/result DTO 不复用 qb-spec spec/plan frontmatter model；task profile 和 session model override 是配置，不是 lifecycle 文档。
- Tradeoff：当前不引入 reviewer/planner/writer/implementer、项目级 profiles、通用 Bash、parallel 或 chain；牺牲通用性换取低成本、低污染和小实现面。

## Verification

- [x] **VER-001** [AC-001] 逐项审查 delegation matrix，确认 approval、attestation、acceptance sufficiency、transition/archive/recovery、context promotion 均无 subagent 最终决定权。
- [x] **VER-002** [AC-002] 审查每个固定 task kind 均映射到最小 capability set，且设计明确禁用 dispatch、mutation tools、通用 Bash 和默认项目 profiles。
- [x] **VER-003** [AC-003] 审查 handoff/result schema 包含 evidence、exit code、artifact、truncation、usage 和 touched paths，并明确 50KB/2000 行上限。
- [x] **VER-004** [AC-004] 检查 public contract 不接受 tasks array、chain、并发参数或嵌套 dispatch；任一时刻只运行一个 child session。
- [x] **VER-005** [AC-005] 走查 unknown task kind、越权、schema error、command failure、timeout、abort 的不同失败状态，确认失败后不启动新 child 或推进 stage。
- [x] **VER-006** [AC-006] 确认首期仅支持 SDK backend；未来 backend 需通过同一 contract fixture 后才能加入。
- [x] **VER-007** [AC-007] 检查首期 scope 只包含固定轻量 task kinds，不存在 reviewer/planner/writer/implementer 或任意文件写能力。
- [x] **VER-008** [AC-008] 确认本 design change 的 git diff 仅包含 qb-spec 设计制品；无需运行 runtime tests。后续实现必须执行仓库规定的 `npm ci`、`npm run typecheck`、`npm test`、`npm pack --dry-run --json` 和 Pi 临时加载。
- [x] **VER-009** [AC-009] 逐条走查 context digest、diff summary、test report、doc fact scan 和 trace scan，确认 subagent 只返回摘要/证据，唯一 next action 仍由 `workflow-routing.md` 和主 agent解析。
- [x] **VER-010** [AC-010] 对照调研记录走查 Superpowers reference flow、Adopt、Adapt、Do Not Adopt 和 hypotheses，确认未引入第二套 routing、外部运行时依赖或实现范围。
- [x] **VER-011** [AC-011] 用固定轻量任务、开放式规划、代码编辑和单次短读取四类样例走查 dispatch eligibility，确认仅第一类在隔离收益超过启动成本时委派，且不存在并行/fan-in。
- [x] **VER-012** [AC-012] 对同一 context/log summarization fixture 比较 economy child 与主 agent inline 的完整 token、费用、耗时和主上下文增量，并模拟 economy model 不可用时 fail closed + inline fallback。
- [x] **VER-013** [AC-013] 分别对五个 task kinds 建立 inline/delegated fixture；核对默认阈值能拒绝短读取和纯机械扫描，并以结果完整性不下降为前提计算实际节省区间。
- [x] **VER-014** [AC-014] 在后续实现 change 中验证 in-memory resource/tool isolation、结构化终止、TUI/JSON rendering、usage、abort/timeout、realpath/symlink path guard 和 command allowlist；本调研 change 只保留已执行的无模型 spike 证据。
- [x] **VER-015** [AC-015] 在后续实现 change 中覆盖 scopedModels/getAvailable 列表、TUI 选择、显式 provider/model、query/reset、appendEntry reload/resume 重建、无 UI 用法、不可用模型拒绝及主模型不变。

## Verification Evidence

- User approval on 2026-09-09 resolved session-only persistence, disabled-without-selection behavior, the three-task MVP, and threshold-driven automatic skill use.
- Design review confirmed the main agent retains requirements, planning, architecture, acceptance, lifecycle, recovery and context-promotion authority; the child has no dispatch, write, Bash or lifecycle tools.
- The implementation change `QB-20260909-lightweight-subagent-proxy` completed and was archived after 75 automated tests, typecheck, package inspection, Pi temporary loading, live `doc_fact_scan` and `test_report` smoke runs, unsupported-model failure validation, and deterministic benchmark fixtures.
- The SDK-only in-memory backend, zero-resource loader, path-safe custom tools, attested shell-free runner, one-child coordinator, session picker, output artifacts and inline fallback satisfy the deferred feasibility and safety checks in VER-012 through VER-015.
- Actual savings remain task/model/repository dependent. The implementation therefore keeps no-selection disabled and conservative admission gates rather than claiming universal benefit.

## Completion Gate

- [x] 用户于 2026-09-09 明确采纳推荐设计、首期范围和默认行为。
- [x] VER-001 至 VER-015 有实际评审/实现证据且无 blocker。
- [x] spec 与 plan 均处于 active，且仅在验收充分后由 `verifying-before-completion` 归档。
- [x] Runtime 实现已通过独立 feature change `QB-20260909-lightweight-subagent-proxy` 完成并归档，未扩展本设计 change 的 runtime 范围。
