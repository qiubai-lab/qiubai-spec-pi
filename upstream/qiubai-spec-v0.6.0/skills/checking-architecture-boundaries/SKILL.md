---
name: checking-architecture-boundaries
description: Use when a task touches module structure, domain rules, layering, service boundaries, adapters, DTOs, or ownership of business logic. Trigger on refactors, new features with non-trivial rules, architecture cleanup, or any work that risks mixing domain logic into controllers, UI, persistence, or transport layers.
---

# Checking Architecture Boundaries

## Overview

这个 skill 只负责保持结构清晰与职责边界，不负责计划分级，也不代替完整 DDD 方法论。

目标不是引入重模式，而是避免代码继续向“什么都能放”的无边界状态滑落。

## Core Rules

1. 核心业务规则放在稳定的领域或应用边界内，不塞进 controller、handler、UI、ORM model 或 transport adapter。
2. Domain Model、API DTO、Persistence Model 不混用。
3. 依赖方向保持单向清晰；低层实现不反向控制高层规则。
4. 只有在当前任务需要时才拆层，不为了“看起来专业”而抽象。
5. 边界调整必须服务于当前任务，不做无关大重构。

## What To Check

已有工程基线时，按需读取 `ARCHITECTURE_SPEC.md`、`ENGINEERING_STYLE_SPEC.md` 或其已有事实源，检查当前范围内的公开契约、允许依赖和已批准例外。跨模块私有导入、循环依赖、客户端导入服务端实现及绕过模块的数据访问均是边界信号。优先复用可执行规则，不因存在基线而重新创建项目或强拆简单模块。

- 业务规则现在应该归谁负责
- 新增逻辑是否落在了错误层
- 现有文件是否承担了多种冲突职责
- 输入输出模型是否被错误复用
- 是否需要引入更明确的接口或编排层

受影响文件超出项目规模预警、明显增长或新增职责时，按 [code locality](../establishing-project-foundations/references/code-locality.md) 检查职责与理解路径，决定拆分或记录保留理由。小文件的混合职责、隐式副作用和多层无意义转发同样是信号。没有项目阈值时仍检查具体风险，不为一次任务擅自设立长期阈值，不扩展到未触及大文件。

## Lightweight Boundary Heuristics

适合拆边界的信号：

- 一个 handler 同时承担参数解析、权限判断、领域规则和持久化
- 相同业务规则散落在多个 transport / UI / adapter 文件
- 数据库存储结构正在驱动领域语义
- 代码难以为核心规则写稳定测试

不应强拆的信号：

- 只是一次微小样式或文案调整
- 只有单一简单映射逻辑，没有可独立的业务意义
- 拆分成本明显高于当前收益，且不会影响后续维护

## Apply Changes Conservatively

- 优先移动业务规则到更合适位置，而不是先大规模重命名
- 优先明确“谁负责什么”，而不是先搭框架
- 优先让关键路径更易测试，而不是追求目录漂亮

## Pairing Guidance

- 本 skill 只报告边界结论和关键行为保护信号，不维护默认执行顺序。
- 后续动作遵守集中式 [workflow routing](../shaping-requirements/references/workflow-routing.md)。

## Anti-Patterns

- controller / route / resolver 直接承载复杂规则
- repository / ORM model 混入决策逻辑
- 页面状态、接口 schema、数据库 schema 被当成领域模型
- 为了复用而过早抽象出无人拥有的“万能 util”
- 把架构重整扩展成与当前任务无关的大清洗

## Output Contract

- Boundary Decision：本次哪些职责需要明确或迁移
- Placement：关键逻辑最终放在哪里，为什么
- Model Separation：哪些模型需要区分或保持区分
- Tradeoff：这次没有继续拆分的地方及理由
