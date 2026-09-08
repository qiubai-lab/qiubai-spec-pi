---
name: maintaining-project-context
description: Use when long-lived qb-spec project context should be created or updated outside ordinary change specs. Trigger for project bootstrap, durable product or architecture decisions, recurring acceptance standards, approved Behavior Delta promotion, or user-approved UI and engineering style preferences. Do not persist inferred facts or preferences without explicit approval.
---

# Maintaining Project Context

## Overview

这个 skill 只负责低频、长期有效的项目上下文。普通 task spec 不需要触发它。

目标是让后续 agent 能快速理解项目的产品目标、领域规则、架构约束、跨任务验收口径和重要决策，而不是每次从零推断。

## When To Use

使用本 skill 的信号：

- 用户明确要求 bootstrap qb-spec 文档
- 产品目标、领域规则、架构边界或验收口径发生长期变化
- 缺少该上下文会导致后续 plan、实现或验证反复失真
- 当前任务产出了长期有效的产品、领域、架构、验收或决策信息
- 已验证 change 的 Behavior Delta 包含值得提升为当前长期事实的内容，并且用户明确批准该提升
- 用户明确批准将新识别的 UI、前端或后端风格偏好作为长期规范保存

不要为了单次普通 change 更新长期 context。若只影响当前 change，保留在 change spec 即可。

## Context Files

优先维护这些文件：

- `docs/qb-spec/context/PRODUCT_SPEC.md`：产品目标、核心用户、关键流程
- `docs/qb-spec/context/DOMAIN_SPEC.md`：领域术语、核心规则、边界
- `docs/qb-spec/context/ARCHITECTURE_SPEC.md`：模块职责、依赖方向、关键约束
- `docs/qb-spec/context/ACCEPTANCE_SPEC.md`：跨多个任务重复适用的验收标准
- `docs/qb-spec/context/UI_STYLE_SPEC.md`：长期 UI 视觉与交互偏好、设计系统入口和适用范围
- `docs/qb-spec/context/ENGINEERING_STYLE_SPEC.md`：长期前后端编码约定、可执行规范入口和适用范围
- `docs/qb-spec/context/DECISIONS.md`：仍然有效的重要技术或产品决策

## Output Location

长期 context 写入 `docs/qb-spec/context/`，除非用户明确指定其他路径。

## Workflow

1. 先读取已有 `docs/qb-spec/context/` 中相关 context。
2. 判断本次信息是否长期有效，还是只属于当前任务。
3. 只更新受影响的 context 文件。
4. 用稳定规则、边界和决策替代临时过程记录。
5. 在输出中说明更新了哪些长期 context，以及为什么。

用户明确要求按 `establishing-project-foundations` 创建新项目时，已包含将所采用的工程基线和已知架构决定写入必要 context 的授权。已有项目中明确批准的基线调整也可按批准范围保存，不重复确认。此授权不包含推断产品规则、长期 UI 偏好或无关架构变化；自动选择 skill 不等于批准。已有等价文档优先复用并记录入口。

归档 change 或出现 ADDED / MODIFIED / REMOVED Delta 只产生候选，不等于获得长期 context 更新授权。先比较已有事实源，向用户说明拟提升的规则、范围和冲突，再等待明确批准。

## Durable Style Preferences

相关功能完成后，可能会发现值得跨任务保留的 UI、前端或后端风格。识别候选、控制提示频率、请求用户确认和选择事实源时，读取 [references/durable-style-preferences.md](references/durable-style-preferences.md)。

- 可以主动建议，但不能把一次性调整自动升级为项目规范。
- 新推断的偏好必须在用户明确批准后才能写入长期 context。
- 用户拒绝、未回答或回答含糊时，不更新任何长期偏好文档。

## Writing Rules

- 写长期事实，不写任务流水账
- 写仍然有效的规则和边界，不写临时探索过程
- 不把 Directory Map、测试策略、产品说明混成一个文档
- 不为了完整性创建所有文件；只创建当前需要的文件
- 如果已有文档表达足够清楚，不重复改写
- 可由 formatter、linter、design tokens、schema 或测试配置执行的规则，优先维护对应配置；docs 只记录意图、范围和事实源入口
- 本 skill 不创建或更新 `AGENTS.md`、`CLAUDE.md` 等入口；已授权的入口设置由 `initializing-qb-spec` 处理
- 若写入文件，遵守 `Output Location`

## Relationship To Other Skills

- `shaping-requirements` 负责识别是否需要本 skill，并产出当前 change spec
- `checking-architecture-boundaries` 可能暴露需要同步到 `docs/qb-spec/context/ARCHITECTURE_SPEC.md` 或 `docs/qb-spec/context/DOMAIN_SPEC.md` 的边界变化
- `verifying-before-completion` 在普通成功路径中完成验证与归档，并在完成后报告 context promotion 候选；不得自动写入长期事实
- `closing-qb-change` 只处理显式或异常关闭；同样不得自动调用本 skill 写入长期事实
- `updating-directory-map` 只维护结构索引，不替代长期产品、领域或架构上下文
- `establishing-project-foundations` 提供项目工程基线的决定及授权范围，本 skill 保存其必要长期内容
- `initializing-qb-spec` 在其明确授权条件满足时维护 Agent 入口中的 context 路由，不维护 context 内容

## Output Contract

- Context Updated：更新或创建了哪些长期 context
- Context Paths：最终更新或创建的文件路径
- Reason：为什么这些信息需要长期保存
- Scope：哪些内容只留在 change spec，不进入长期 context
- Approval：新增风格偏好是否获得了明确批准
- Follow-up：后续还缺哪些长期上下文
