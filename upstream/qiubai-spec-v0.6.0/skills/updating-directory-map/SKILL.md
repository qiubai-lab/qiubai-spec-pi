---
name: updating-directory-map
description: Use when a project Directory Map must be created, refreshed, or maintained, either because the user explicitly asks or because structural changes occurred. Trigger after onboarding, refactors, module moves, monorepo reshapes, entrypoint moves, or ownership-boundary changes where future agents need a stable repository structure map.
---

# Updating Directory Map

## Overview

这个 skill 只负责长期结构索引。

当用户明确要求，或当前任务发生结构变化时，执行本 skill。

`Directory Map` 的目标是帮助后续 agent 快速回答：

1. 仓库顶层如何分块
2. 哪些文件是真正入口或共享契约
3. 主要目录各自负责什么、不负责什么
4. 哪些目录不应再塞入什么内容

## Workflow

1. 检查当前仓库结构与关键入口。
2. 创建或更新 `docs/qb-spec/DIRECTORY_MAP.md`。
3. 只写稳定结构与边界，不写实现细节或近期历史。
4. 只在目录边界、入口位置、职责分配真的改变时更新。

## Output Location

Directory Map 写入 `docs/qb-spec/DIRECTORY_MAP.md`，除非用户明确指定其他路径。

## Automatic Triggers

以下条件构成 Directory Map trigger；执行时机由集中式 [workflow routing](../shaping-requirements/references/workflow-routing.md) 决定：

- 顶层目录新增、删除、重命名或职责变化
- 模块边界、领域边界、adapter 边界发生迁移
- 入口文件、组合根或共享契约的位置或职责变化
- monorepo package、应用边界或长期目录约束发生变化

没有这些结构变化时，不创建或修改 `docs/qb-spec/DIRECTORY_MAP.md`，除非用户明确要求。

## Required Sections

输出文档必须保持这些章节：

1. `## Root Directories`
2. `## Important Files`
3. `## Module Responsibilities`
4. `## Forbidden Contents By Directory`

## Writing Rules

- 以目录为主，文件只保留真实入口和共享契约
- 每条都回答“负责什么；不负责什么”
- 不镜像完整 tree
- 不写 changelog、产品语义、测试策略或编码规范
- 小仓库保持简短，不为“完整”而滥写

## Good Shape

- `src/api: 负责 HTTP 路由、鉴权接入与请求编排；不直接实现核心计费规则`
- `packages/domain: 负责核心领域模型与规则；不依赖具体 Web 框架或数据库驱动`

## Anti-Patterns

- 把目录内容做成文件清单
- 记录最近修过的 bug 或迁移历史
- 把风格建议写进 Directory Map
- 例行功能迭代也频繁更新该文档
- 未按 `Output Location` 落盘 Directory Map

## Output Contract

- Map Status：新建还是更新
- Map Path：最终 Directory Map 文件路径
- Structural Changes：本次记录了哪些结构边界变化
- Important Entrypoints：新增或调整了哪些关键入口
- Skipped Areas：哪些目录被有意省略及原因
