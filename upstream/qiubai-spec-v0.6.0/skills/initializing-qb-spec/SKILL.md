---
name: initializing-qb-spec
description: Initialize or refresh qb-spec context routing when the user explicitly invokes this skill or requests Agent entry setup, or explicitly asks establishing-project-foundations to create a new project. Never infer entry-editing permission from ordinary development or automatic skill selection.
---

# Initializing qb-spec

## Explicit Authorization

只在用户直接调用本 skill、明确要求设置/刷新 qb-spec Agent 入口，或明确要求按 `establishing-project-foundations` 创建新项目时执行。最后一种情况允许该 skill 在创建范围内调用本 skill，无需重复确认。普通开发、自动 skill 选择和既有项目仅采用工程规范均不授权入口修改。

本 skill 只维护一段轻量的长期上下文路由，不复制 context 内容，不安装 hook，不建立持续同步，也不代替 `maintaining-project-context`。

## Workflow

1. 检查项目根目录已有的 Agent 指令入口，例如 `AGENTS.md`、`CLAUDE.md` 及其导入关系。
2. 选择一个规范入口：已有共享入口时更新它；某文件已导入该入口时，不重复写入；若没有入口，默认创建根目录 `AGENTS.md`。
3. 在规范入口中新增或刷新下方唯一的 managed block。
4. 若 block 完整存在，只替换 block 内部；保留文件中的其他内容和格式。
5. 若存在重复、残缺 marker，或多个入口彼此冲突，停止修改并请用户选择规范入口。
6. 检查路由路径和 marker，不创建空 context 文件。

## Managed Block

```markdown
<!-- qb-spec:context-routing:start -->
## qb-spec 长期上下文

使用 qb-spec 开发时，按当前任务需要读取以下已存在的文件，不要默认全量加载：

- `docs/qb-spec/context/PRODUCT_SPEC.md`：产品目标与关键流程
- `docs/qb-spec/context/DOMAIN_SPEC.md`：领域术语、规则与边界
- `docs/qb-spec/context/ARCHITECTURE_SPEC.md`：架构职责与依赖约束
- `docs/qb-spec/context/ACCEPTANCE_SPEC.md`：跨任务验收标准
- `docs/qb-spec/context/UI_STYLE_SPEC.md`：UI 视觉与交互偏好
- `docs/qb-spec/context/ENGINEERING_STYLE_SPEC.md`：前后端工程风格
- `docs/qb-spec/context/DECISIONS.md`：仍然有效的重要决策
- `docs/qb-spec/DIRECTORY_MAP.md`：稳定的项目结构索引

文件不存在时跳过。只有用户明确要求或批准时，才更新长期上下文与推断出的风格偏好。
<!-- qb-spec:context-routing:end -->
```

## Boundaries

- 不修改嵌套目录中的 Agent 入口，除非用户在调用时明确指定范围。
- 不向多个平台入口复制相同 block；优先复用已有导入关系。
- 不创建仅用于占位的 context 文件。
- 不读取或改写与入口路由无关的项目内容。
- 仅作为已授权入口设置的条件动作；不加入普通开发默认链。受 `establishing-project-foundations` 调用时只返回入口结果，不重新进入需求塑形或项目创建。

## Output Contract

- Entry：作为规范入口的文件
- Routing：block 是新增、刷新还是已是最新
- Reused Imports：哪些平台入口通过导入复用规范入口
- Conflicts：需要用户处理的重复、残缺或冲突入口
