---
name: writing-qb-plans
description: Add tier-appropriate implementation steps and acceptance checks after requirements are shaped. Standard uses the same change document by default; strict uses a separate plan. Skip independent planning for straightforward quick work.
---

# Writing Plans

## Responsibility

将已明确的范围转成可执行步骤与验收映射。复用已有 spec、决定和批准，不重新塑形需求或维护另一套分级。

## Tier And Artifact

分级只以 [change types and tiers](../shaping-requirements/references/change-types-and-tiers.md) 为准；发现实际新风险才调整。文件数、结构调整或风险关键词本身不构成升级。

- quick：直接实施；确有价值时用简短 inline 步骤和验证说明，不要求标题模板。跨会话或用户要求可落盘，不因此升级。
- standard：在 `docs/qb-spec/specs/<change-id>-<topic>.md` 追加实施步骤和 AC-to-check 表。需求、计划和证据共享一个 lifecycle；不另写一遍目标与范围。
- standard 只有复杂协作、需独立维护的长计划或用户明确要求时才拆分到 `docs/qb-spec/plans/<change-id>-<topic>.md`，引用相同 ID。已有独立 plan 继续有效，不自动合并。
- strict：独立规格审查通过后写单独 plan，保留完整追踪和实际风险所需的兼容、恢复、隔离等措施；不生成无关的空章节。

## Workflow

1. 读取当前 scope、acceptance、type/tier、相关约束与已存在计划；已有足够步骤时直接复用。
2. 列出实际需要的变更位置、设计取舍和有意义的实施步骤。简单步骤不拆成仪式性任务。
3. 将验收映射到最直接的检查：quick 用简短说明，standard 用 `AC-*`，strict 用 `AC-*` → `VER-*`。
4. 架构、行为保护和目录变更只提供条件信号，顺序以 [workflow routing](../shaping-requirements/references/workflow-routing.md) 为准；这些检查在当前任务内完成，不逐个对用户宣告交接。
5. 按已有批准实施。明确请求或会话中的批准已覆盖范围时记录来源，不重复询问；新产品行为或实质范围变化才澄清。

## Planning Rules

- 先确定如何验证，再实施；优先相关测试与便宜的高信号检查，不机械列满 test/lint/typecheck/build。
- 静态、行为或构建检查按实际影响选择。同一状态下仍适用的证据复用，只重跑受后续修改影响的检查。
- UI 小改聚焦受影响状态；skill 改动校验变更 skill，最终各执行一次插件与仓库要求的跨平台检查。安装、发布或 cachebuster 不属于验证。
- 已引用的工程/UI 约束进入对应步骤和检查，不全量加载风格文档。
- 合并文档的需求和验收只保留一份；独立 plan 用 ID 回连，不复制完整正文。
- 风险恢复措施与任务相称；源码移动可按步骤恢复，数据/部署回退不得假设 Git 足够。

## Strict Traceability

仅 strict 或明确要求完整追踪的协作/审计场景使用：

- `TASK-001 [depends: TASK-000] [REQ-001, AC-001] <action and scope>`。
- 独立文件或无共享可变依赖的步骤才可标 `[P]`；标记不授权启动额外 agent。
- `VER-001 [AC-001] <command or focused check>`。
- ID 追加而不重排。风险相关的 API、数据、领域、部署、恢复和依赖内容按需写入。

## Lifecycle And Reporting

需要机械更新 status/updated 时使用 lifecycle 中的共享工具入口；实施步骤和验收正文仍由 agent 编辑。独立 plan 按其自身状态更新，不自动复制 spec 正文。

沿用 [lifecycle](../shaping-requirements/references/lifecycle-and-traceability.md)，计划本身不构成批准。实施时更新当前文档状态；最终验证后整体归档合并文档，独立计划存在时才归档该文件。

内部保留范围、步骤和验收映射。默认只向用户报告有实际价值的决定、验证安排或阻塞项，必要时链接文档；不逐项打印 tier、空依赖和“不适用”字段。
