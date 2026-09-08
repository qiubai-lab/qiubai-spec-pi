---
description: 显式设置 qb-spec 入口、创建新项目基线或让已有项目采用 qb-spec
argument-hint: "[entry|bootstrap|adopt] [补充说明]"
---

处理一次显式的 qiubai-spec 初始化请求。

Mode：`${1:-未提供}`
补充说明：`${@:2}`

只接受以下三个 mode，并严格保持各自授权边界：

- `entry`：加载 `initializing-qb-spec`，只检查并新增或刷新规范 Agent 入口中的 qb-spec managed context-routing block；遇到重复、残缺或冲突入口时停止并请用户选择。
- `bootstrap`：加载 `establishing-project-foundations` 的创建模式，用于用户明确创建新项目或建立必要工程基线。该 mode 授权创建范围内必要的工程 context、Directory Map 和根 Agent 入口路由，但不授权捏造产品规则、推断长期偏好或覆盖非空项目。
- `adopt`：加载 `establishing-project-foundations` 的采用模式，评估或按明确范围让已有项目渐进采用 qb-spec。复用已有事实源，只补获批范围；该 mode 不授权修改 Agent 入口、重建项目或批量迁移 legacy 文档。

如果 mode 未提供、不是上述精确值，或补充说明使授权范围含糊：只解释可选 mode 并请求用户选择或澄清，不执行任何持久化修改。附加说明只能收窄或描述当前 mode 的范围，不能扩大其授权。

后续动作遵守 `shaping-requirements` 所引用的集中式 `workflow-routing.md`。语义决定留在 workflow skills；机械 change 操作使用 `qb_spec_*` tools，不把调用本入口视为 change approval 或 verification evidence。
