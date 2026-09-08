---
name: verifying-before-completion
description: Verify implementation at the qb-spec workflow tier, report acceptance evidence, and safely finish the ordinary completion path. Use for focused checks, tests, builds, lint, typecheck, blocked evidence, and automatic conflict-free archive of persisted changes after verification passes.
---

# Verifying Before Completion

## Overview

这个 skill 负责最终验证，并在普通、无冲突的持久化 change 通过后完成归档。它不决定目标，也不替代实现计划。

完成代码不等于完成任务。只有验证证据足够，任务才算真正通过质量闸口。

## Verification Sources

优先级从高到低：

1. 当前 change spec / plan 中按 tier 约定的 acceptance-to-verification 映射
2. 直接相关的 test、build、lint、typecheck
3. 聚焦的手工验证
4. 代码阅读推断

手工验证和代码阅读只能补充，不能替代关键自动化证据。

## Verification Protocol

1. 从 change spec 读取 `tier: quick | standard | strict`；没有 tier 时按实际风险选择，并在落盘 artifact 中补齐，不维护第二套 plan level。
2. 先运行最便宜且最直接相关的自动化验证。
3. 只运行能够证明 acceptance 或基础完整性的检查，不把 test、lint、typecheck、build 当成固定清单。
4. 记录每个实际命令的结果：通过、失败或阻塞。
5. 命令失败时，判断是否由本次改动引入。
6. 如果是本次改动引入，优先修复并只重跑被修复影响的检查。
7. 如果是既有失败或环境阻塞，说明证据与影响范围。
8. 最终只汇报真实结果，不宣称“应该没问题”。

## Tier-Scaled Gates

### Quick

- 运行一个最接近改动的高信号检查；只有 acceptance 需要时才增加其他检查。
- 小型样式调整聚焦目标界面和实际受影响的状态、视口或动效，不扩展到无关系统。
- Skill 内容修改只快速校验变更 Skill；插件级校验和仓库要求的跨平台检查在最终交付时各执行一次。
- 除非影响构建、打包、公共契约或插件发现机制，否则不运行完整仓库 build、全量测试或逐 Skill 全量校验。

### Standard

- 运行受影响测试，并从 lint、typecheck、build 中选择与改动相关的检查。
- 多个命令覆盖相同风险时，优先保留信号更强或仓库明确要求的命令。

### Strict

- 保持完整的相关回归验证，并按任务风险加入权限、安全、schema、迁移、隔离、回滚或发布检查。
- “完整”指覆盖当前风险面，不等于无条件运行仓库中所有命令。

## Evidence Reuse

结构重构需同时验证行为保持与目标结构改善：对照重构前基线、声明的 Delta 和当前验收，检查目标依赖/职责、调用方切换及过渡结构清理。仅测试通过不证明原结构问题已解决；仅静态检查通过不证明行为等价。采用 [refactoring guidance](../establishing-project-foundations/references/refactoring-guidance.md) 中当前适用的验收项，明确尚未迁移的消费者和无法验证的行为，不扩大为全仓库审计。

项目工程基线创建/调整时，只对当前验收适用项检查：真实入口和最小用例可运行，安装与验证命令可复现，检查失败正确传递退出码；新增模块边界规则有代表性违规依赖被拒绝及正常结构通过的证据。具体方法按需读取 [foundation checks](../establishing-project-foundations/references/executable-checks.md)。context 和入口仅在已授权范围内更新；单模块、无构建或环境阻塞等分别说明，不强制创建占位结构。后续普通变更不重跑整套创建验收。

- 同一工作树状态下已经通过且仍覆盖当前改动的证据可以复用，不重复执行。
- 后续只改文档时，不使已经通过的代码测试失效；后续改实现时，只重跑覆盖相同文件、产物或行为的检查。
- cachebuster、重装、marketplace 刷新属于安装或发布操作，不能代替验证，也不应仅为完成验证而执行。

## Quality Gate Checklist

对本次新增、跨越规模预警、已超线且明显增长或承担新职责的文件，按项目策略和 [code locality](../establishing-project-foundations/references/code-locality.md) 检查处理结论。检查目标规则/测试是否容易定位，拆分是否减少无关理解而没有制造转发层；复用相关行为验证。区分正常、已处理预警和未解决缺口，不以行数变少判定成功，不审计未受影响的历史大文件。

所有任务检查：

- 关键 requirement 是否有对应验收和验证证据
- quick：inline acceptance 已覆盖；standard：每条 `AC-*` 有直接证据；strict：每条 `AC-*` 已被 `VER-*` 覆盖、阻塞或明确标记未覆盖
- 关键自动化命令是否实际运行
- 失败是否被准确归因
- 残余风险是否显式交代

仅在对应条件成立时检查：

- 如涉及长期产品、领域、架构、验收或决策变化，是否已确认 `maintaining-project-context` 是否需要执行
- 如果发生目录、模块边界或入口变化，是否已执行或计划执行 `updating-directory-map`
- 如果计划要求文档更新，是否已经完成
- change spec / plan 引用的长期 UI 或工程风格约束是否已验证
- 如果本次涉及用户主导的 UI、前端或后端风格调整，是否完成了持久偏好检查

## Existing Style Conformance

如果 change spec 或 plan 引用了 `UI_STYLE_SPEC.md` 或 `ENGINEERING_STYLE_SPEC.md`：

1. 只检查本次范围内适用的规则，不扩展成全项目风格审计。
2. 优先使用 design tokens、formatter、linter、schema 或测试等可执行证据；没有自动化来源时做聚焦手工检查。
3. 记录符合项、已批准的局部例外和无法验证的项。
4. 如果用户的当前指令形成了可能长期适用的新方向，继续执行下面的 Durable Preference Check；在获得明确批准前，不更新旧规格。

## Durable Preference Check

当任务涉及用户主导的 UI 样式、前端编码风格或后端编码风格调整时，在功能与验证完成后：

1. 检查是否出现新的、可能跨任务适用的稳定偏好。
2. 若存在高置信度候选，路由到 `maintaining-project-context`，按其 durable style preferences 指引向用户提出一次聚焦的落盘建议。
3. 在用户明确批准前，不创建或修改长期风格文档。
4. 若只是局部调整、临时实验、Agent 自选方案或已有规范，不询问、不落盘。

这项检查不阻塞当前功能的完成。需要用户确认的长期偏好作为独立的 context 更新继续处理，不能把未批准的候选报告成已同步文档。

## Completion And Automatic Close

确认验收后，优先调用共享 [change tool](../closing-qb-change/references/change-tool.md) 执行归档，仍在本步骤完成；不因此额外调用 closing skill。Python 不可用才使用原生工具，脚本冲突或中断进入诊断/恢复，不能自动降级重试。

验证通过后按以下规则完成任务：

1. inline quick change：直接报告完成，不创建 lifecycle 或 archive artifact。
2. 持久化 change：确认所有必需验收已有证据、没有阻塞性澄清、所需 Directory Map 已更新、归档目标不存在且来源唯一。
3. 条件满足时，在同一步记录证据，刷新 `updated`，创建 `docs/qb-spec/archive/YYYY/<change-id>/`。合并 change 整体保存为 `spec.md`，保留其实施步骤和证据；仅实际存在独立 plan 时保存 `plan.md`。将 spec `status` 设置为 `archived`；standard 缺少独立 plan 不构成阻塞，既有分离格式仍有效。
4. 保留 Behavior Delta、trace IDs、批准记录和残余风险；不复制测试输出全文或临时日志。
5. 归档冲突、部分移动、legacy close、用户要求手动关闭或无法确定唯一来源时，不修改目标，报告 `Close: blocked` 并转入 `closing-qb-change`。

普通成功归档不再产生一次独立 `closing-qb-change` handoff。归档也不授权写入长期 context；候选仍按独立、非阻塞的批准流程处理。

## Blocked Verification

当无法完成理想验证时，最终输出必须包含：

- 未完成的命令
- 阻塞原因
- 已执行的替代验证
- 仍然存在的风险
- 用户或后续 agent 可以复验的最小命令

## Pairing Guidance

- 读取 change 的 type、tier、acceptance、Behavior Delta 和计划验证映射。
- 汇总 `protecting-critical-behavior` 相关证据，并确认必需的 Directory Map 更新已完成。
- 只有自动关闭遇到异常或用户显式要求独立关闭时才使用 `closing-qb-change`。
- 后续动作遵守集中式 [workflow routing](../shaping-requirements/references/workflow-routing.md)。

## Anti-Patterns

- 没跑命令却声称已验证
- 命令失败但不记录
- 用“大概没问题”替代证据
- 只给通过结论，不给失败或阻塞信息

## Output Contract

内部保留实际检查及结果、验收覆盖与缺口、完成/归档状态和适用例外；strict 回连 `VER-*`。默认用户汇报只有结果、相关验证和未解决问题，必要时附文档链接。无缺口不制造风险段落；审计或用户要求时才展开完整映射，不列空的手工检查、目录图或偏好字段。
