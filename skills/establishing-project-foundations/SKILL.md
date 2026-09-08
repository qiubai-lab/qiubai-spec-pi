---
name: establishing-project-foundations
description: Establish an engineering baseline for project creation, explicit baseline assessment/adoption, or changes requiring new target boundaries or engineering policy. Guide refactoring when requested. Reuse known designs; local fixes within established boundaries use focused checks without a full baseline assessment.
---

# Establishing Project Foundations

## Responsibility

建立可定位、可运行、可验证的项目工程基线。先确定项目适用的约束，再在已授权范围内创建骨架和检查配置。日常开发通过已有 context、架构检查和验证遵守基线，不重复初始化。

本 skill 及随附 references 是已定稿的本地规范快照。执行时使用包内规则和项目已有事实源，不检索、刷新或导入外部资料来更新本规范。

## Modes

- 创建：按项目类型建立最小工程基线。
- 采用：既有项目在明确范围内补齐规范和检查，读取 [adoption-and-exceptions](references/adoption-and-exceptions.md)。
- 重构：用户请求本 skill 指导，或必须建立/重定目标边界时，读取 [refactoring-guidance](references/refactoring-guidance.md)。目标已知的局部调整直接使用已有方案与聚焦架构检查，不要求新 Foundation Decision。
- 局部重命名、提取函数等不触发完整基线评估；仅评估请求只返回方案。

## Workflow

1. 检查目标目录、已有指令、框架约定、运行配置和相关 qb-spec context。确定模式与实施授权；非空目录不当作空项目覆盖。
2. 只读取当前适用的 [baseline-rules](references/baseline-rules.md)；仅需选择布局时读取 [structure-profiles](references/structure-profiles.md)。已有适用决定直接复用，只补会改变架构、交付或兼容性的缺口。
3. 产出 Foundation Decision：项目类型、模块职责与允许依赖、命名约定、验证入口、事实源位置、适用规则与例外。它是当前 spec/plan 的设计输入，不另造 spec、tier 或审批流程。
   创建或调整相关基线时按 [code-locality](references/code-locality.md) 选择简单预警策略；分类增长治理只在实际需要时扩展。日常读取编辑遵循局部定位、按需扩展和局部修改原则。
   重构模式补充问题证据、当前与目标边界、保持不变的行为、迁移步骤及恢复/退出条件；不因目录外观直接套用新项目布局。
4. 依照集中式 [workflow routing](../shaping-requirements/references/workflow-routing.md) 返回当前阶段。尚未 shaping 时先将方案交给 shaping；已有 spec/plan 时补充受影响部分，不递归重启。方案完成标记后不再次路由回来。
5. 实施阶段按 [executable-checks](references/executable-checks.md) 建立或复用真实入口、适用检查和环境说明；目录有实际内容才创建。重构按计划逐步迁移，在受影响实现变动前建立必要行为保护；不重做已有效的工程基线。
6. 按授权将稳定决定交给 `maintaining-project-context`、结构索引交给 `updating-directory-map`；不复制这些 skill 的文档规则。最终交给 `verifying-before-completion` 验证并完成当前 change。

## Authorization And Agent Entry

- 用户明确要求按本 skill 创建新项目，包含建立必要的工程基线 context 和调用 `initializing-qb-spec` 设置根入口路由的授权，无需对同一范围重复确认。加载该 skill 后执行，不复制它的 managed block。
- 自动发现本 skill、普通“开发一个功能”、已有项目采用部分规范，都不构成修改 Agent 入口的授权。已有项目需用户明确要求设置/刷新入口，或直接调用 `initializing-qb-spec`。
- 明确请求重构只授权该范围内的结构调整，不等于初始化入口、改写产品行为或批准无关长期偏好；已批准的目标工程规则可按原 context 机制保存。
- 新建项目授权只覆盖已选用的工程规则和已知事实，不允许捏造产品规则、推断长期 UI 偏好或覆盖既有指令。入口冲突按初始化 skill 处理，其他独立工作可继续。
- 不安装全局工具、不发布、不重写项目历史；外部操作保持原任务的授权范围。

## Completion Contract

方案阶段报告 Foundation Decision、未决项和集中路由解析出的一个下一步，不宣称项目已创建。

以下是内部检查信息，只处理当前适用项；默认汇报结果、相关证据与未解决问题，省略无变化或不适用字段：

- Structure：采用的 profile、真实入口和模块契约。
- Rules：生效规则、工具配置入口、适用例外及理由。
- Reproducibility：实际安装、运行和范围化验证命令与结果。
- Context And Entry：事实源路径、入口设置结果及授权依据。
- Evidence：最小用例、适用边界检查和失败退出码的证据；缺口与复验方式。
- Locality：触发时检查规模预警与理解路径；未触发不报告，不增加全仓库检查。

重构额外报告 Behavior Preservation（受保护行为及证据）、Structural Improvement（原问题如何改善）、Migration Status（调用方切换、过渡结构清理及剩余项）。证据不能证明等价时明确缺口，不以“测试全绿”代替结构改善验收。

未运行、被阻塞或不适用的检查明确区分；不以空目录、模板测试或绿色占位命令作为完成证据。
