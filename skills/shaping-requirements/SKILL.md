---
name: shaping-requirements
description: Use as the default entrypoint when a maintainable software request needs requirement clarification, independent change-type and workflow-tier selection, scope shaping, lifecycle metadata, behavior deltas, or deterministic workflow routing before implementation.
---

# Shaping Requirements

## Responsibility

把请求塑形成可批准、可追踪、可验证的 change spec，并路由到后续 skill。这里负责 what / why / scope，不展开计划、架构、测试或最终验证细则。

## Workflow

1. 读取当前请求、相关代码和按需项目 context。
2. 分别选择 change `type`（feature / bugfix / design）和 workflow `tier`（quick / standard / strict），不要用同一个标签同时表达变更性质与风险。
3. 只有关键不确定性无法从现有信息安全解决时才逐项澄清。
4. 明确目标、范围、非目标、假设、需求和可观察验收。
5. 按 tier 决定是否落盘以及使用哪一级 trace IDs；行为变化按需写 Behavior Delta。
6. 给出有实际差异的方案比较与推荐；quick 不制造虚假选项。
7. 对 standard 在当前步骤内完成轻量质量检查；strict 或真正存在高影响歧义时才进入独立审查。
8. 保存 spec，并从集中式 next-action 表确定下一步。

新建项目、明确请求基线评估/采用，或确需建立/重定目标边界与工程策略且缺少方案时，才按集中路由使用 `establishing-project-foundations`。在已知边界内修正依赖或局部结构直接做聚焦架构检查，不重建 Foundation Decision。已有方案复用；纯重构记录受保护行为，实际契约变化另写 Delta。skill 自动发现不授权改写 Agent 入口或持久化新偏好。

## Conditional References

- 需要提问或比较方案时，读取 [references/clarification-protocol.md](references/clarification-protocol.md)。
- 选择 type、tier 和对应字段时，读取 [references/change-types-and-tiers.md](references/change-types-and-tiers.md)。
- 创建、更新或关闭持久化 spec 时，读取 [references/lifecycle-and-traceability.md](references/lifecycle-and-traceability.md)。
- 决定下一步或其他 skill 出现路由冲突时，读取 [references/workflow-routing.md](references/workflow-routing.md)；它是流程顺序的唯一事实源。

只读取当前阶段需要的 reference，不为普通请求预加载全部细则。

## Persistence

- quick 默认使用简短 inline spec；只有跨会话、需要审计或用户要求时落盘。
- standard 和 strict 默认写入 `docs/qb-spec/specs/<change-id>-<topic>.md`。
- standard 在同一文档补充实施步骤与验证证据；仅复杂协作、需独立维护的长计划或用户要求时拆 plan。复用已明确授权的范围，不因落盘重新要求批准。
- legacy spec 继续有效；只有被当前 change 实际修改时才补最小 lifecycle 字段，不批量迁移。

## Existing Project Context

只读取当前范围需要且已经存在的内容：

- UI 视觉或交互：`docs/qb-spec/context/UI_STYLE_SPEC.md`
- 前后端实现：`docs/qb-spec/context/ENGINEERING_STYLE_SPEC.md`
- 产品、领域、架构或跨任务验收：对应的 `docs/qb-spec/context/*_SPEC.md`
- 结构定位：`docs/qb-spec/DIRECTORY_MAP.md`

文件不存在时跳过。适用规则进入 Constraints 或 requirement，不复制无关章节。用户当前明确指令可以形成局部例外，但不会静默改写长期规格。

## Embedded Standard Quality Check

standard 在 shaping 结束前检查：目标与非目标清楚、`REQ-*` 与 `AC-*` 闭合、Delta 与需求一致、关键场景和相关 NFR 没有阻塞缺口。通过后直接进入 planning，不输出独立 review 阶段。

只有检查发现会改变范围或验收的歧义、用户明确要求，或 tier 为 strict 时，才使用 `reviewing-spec-quality`。不得仅因 spec 已落盘就增加一次独立审查。

## Routing

所有 next action 遵守 [references/workflow-routing.md](references/workflow-routing.md)。其他 skill 只报告自己的结果和触发信号，不另建一套默认顺序。

Behavior Delta 和归档本身不授权更新长期 context。新增或推断的长期事实仍需用户明确批准；普通成功关闭由 `verifying-before-completion` 内部完成。

## Completion Contract

内部保留范围、type/tier、验收与适用的 Delta、质量结论和未决项；落盘时包含 ID、lifecycle 与路径。不要求逐项向用户打印。quick 可用一句范围与验证说明；默认只汇报有意义的决定或阻塞项，按集中路由继续执行。

## Red Flags

- 把未经验证的 root cause、假设或实现偏好写成需求事实
- 把 feature / bugfix / design 与 quick / standard / strict 混成一套分类
- 为 quick 强制创建完整文档链或 trace IDs
- standard / strict 的需求没有稳定 ID，或 AC 无法回连 REQ
- MODIFIED / REMOVED 没有说明原行为或兼容影响
- 未经用户批准推进 `approved` 状态或更新长期 context
- 在多个 skill 中复制或改写默认流程顺序
