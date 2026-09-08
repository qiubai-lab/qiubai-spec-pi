---
name: closing-qb-change
description: Manually or recoverably close a persisted qb-spec change when automatic close during verification could not run or the user explicitly requests separate closure. Use for archive conflicts, legacy changes, recovery, or explicit close; ordinary verified changes should be archived by verifying-before-completion.
---

# Closing A qb-spec Change

## Scope

本 skill 是异常与显式操作路径，只处理已落盘 change 的手动关闭、legacy close、归档冲突或恢复。普通验证成功由 `verifying-before-completion` 在同一步归档，不再默认路由到这里。

归档不是长期 context 合并。不得因为 change 完成而自动修改产品、领域、架构、验收、风格或决策文档。

## Preconditions

- spec 具有稳定 change ID 和生命周期状态
- 所需 acceptance 均有 tier-appropriate evidence，或存在用户明确接受的缺口
- `verifying-before-completion` 已给出通过结论
- spec 与 plan 不含未解决的阻塞性 `[NEEDS CLARIFICATION]`

条件不满足时停止归档，说明最小缺口，不伪造完成状态。

## Workflow

机械文件操作使用 [change tool](references/change-tool.md) 中的 Pi-native `qb_spec_*` tools；读取该参考确认调用接口、attestation 和恢复边界。工具失败后先诊断，不以 shell、`edit` 或 `write` 绕过安全检查重做同一操作。

1. 读取当前 change 文档、存在时的独立 plan 和最终验证证据，只处理当前 change ID；standard 合并文档没有独立 plan 是正常情况。
2. 确认验证摘要已记录，刷新 `updated` 日期；不要创建临时 `verified` lifecycle 状态。
3. 解析 `docs/qb-spec/archive/YYYY/<change-id>/`。如果存在 pending/partial archive，先用 `qb_spec_doctor` 取得 recovery state、allowed actions 和 journal hash；只在用户明确选择 `complete` 或 `restore` 后调用 `qb_spec_recover`。`ambiguous`、残留锁、ID 冲突或来源不唯一时停止并请求人工处理，不覆盖。
4. 没有恢复现场且目标不存在时，只有冲突已解决或显式关闭安全才调用 `qb_spec_archive` 创建归档；恢复完成后重新检查最终 active/archive 状态。
5. 保留 Behavior Delta、trace IDs、批准记录和残余风险。不要复制源代码、测试输出全文或临时日志。
6. 如果 `supersedes` 指向旧 change，只报告关系；除非用户明确要求，不回写历史归档。
7. 识别可能需要进入长期 context 的候选，但只路由到 `maintaining-project-context` 请求明确批准，不在本 skill 中落盘。

归档移动应保留 Git 可追踪性。旧版无 lifecycle metadata 的 spec 不自动批量迁移；仅在用户明确选择关闭该 legacy change 时补最小字段。

合并文档整体保存为 `spec.md`，保留实施步骤与证据，不拆出空 `plan.md`。既有分离文档保持有效，不为新规则改写历史。

## Output Contract

- Change：change ID
- Status：archived / not closed / recovery needed
- Archive：最终归档路径
- Evidence：覆盖的 acceptance、strict `VER-*` 与已接受缺口
- Context Promotion：none / approval needed / separately completed
- Residual Risk：仍保留的风险或关闭阻塞
