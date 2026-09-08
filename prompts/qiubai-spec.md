---
description: 按 qiubai-spec 完整生命周期处理一个开发请求
argument-hint: "<开发请求>"
---

使用本 package 提供的 qiubai-spec workflow 处理以下开发请求：

${@:-[未提供开发请求]}

先加载并遵循 `shaping-requirements` skill，并以它引用的 `workflow-routing.md` 作为 next-action 顺序的唯一事实源。按需读取当前代码、已有 change 和相关长期 context，不默认全量加载。

如果没有提供实际请求，只询问用户希望处理什么，不创建或修改任何文件。否则独立选择 change type 与 workflow tier，只在材料不确定性会改变范围、行为或验收时逐项澄清。复用对当前范围已经明确的授权，但不得把调用 `/qiubai-spec`、创建文档或进入某个阶段本身视为批准。

语义内容、规格质量、计划、架构/测试条件 gate 和验收充分性由 agent 按 skills 判断；持久化 change 的定位、metadata transition、诊断和归档优先使用 `qb_spec_*` tools。只有真实 acceptance evidence 已按 tier 检查并满足 completion gate 后，才能 caller-attest verification 并归档。
