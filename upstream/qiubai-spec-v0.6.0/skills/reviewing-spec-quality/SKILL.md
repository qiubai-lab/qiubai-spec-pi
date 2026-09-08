---
name: reviewing-spec-quality
description: Independently review a shaped qb-spec for semantic completeness, consistency, measurable acceptance, tier-appropriate traceability, behavior deltas, and relevant risks. Use for strict changes, user-requested review, or standard changes whose embedded quality check found material ambiguity; do not add it to ordinary quick or standard work.
---

# Reviewing Spec Quality

## Scope

本 skill 只审查规格本身，不验证实现，也不代替用户批准需求。

strict 在进入 plan 前执行。standard 只有 shaping 的内嵌检查发现高影响歧义、用户明确要求或需要独立审计时执行；ordinary quick / standard 不增加独立阶段。

## Review

1. 读取当前 change spec 及其直接引用的相关长期 context，不全量加载无关文档。
2. 检查 frontmatter 的 `id`、`type`、`tier`、`status`、日期和 `supersedes`；确认 change ID 未冲突。
3. 检查每个 `REQ-*` 是否清楚、无实现泄漏，并有对应 `AC-*` 或明确例外。
4. 检查每个 `AC-*` 是否可观察、可判断，并能映射到后续验证；只有 strict 或明确多 Agent / 审计场景才要求 `TASK-*` / `VER-*`。
5. 检查 Behavior Delta 的 ADDED / MODIFIED / REMOVED 是否与需求一致；MODIFIED 必须说明被替代行为，REMOVED 必须说明兼容影响。
6. 按实际范围检查主路径、备选路径、错误、恢复、边界条件和相关 NFR；不强制生成无关章节。
7. 检查需求内部以及与已引用长期 context 之间的冲突。
8. 将真正阻塞的歧义标记为 `[NEEDS CLARIFICATION: ...]`，一次只向用户确认一个决定点。

## Outcomes

- `PASS`：可以进入 planning。
- `PASS WITH NOTES`：存在不阻塞的假设或后续项，已明确记录。
- `NEEDS CLARIFICATION`：语义缺口会改变范围、行为或验收；暂停 planning。
- `FAIL`：规格内部矛盾、ID/Delta 无法对应或缺少关键验收；先修订规格。

可以直接修复非语义性的格式、断链引用和重复 ID。不得在未确认的情况下补写会改变产品行为、范围或长期规则的内容。

## Output Contract

- Result：PASS / PASS WITH NOTES / NEEDS CLARIFICATION / FAIL
- Spec：审查的 change ID 与路径
- Findings：按严重度列出最少且可行动的问题
- Traceability：REQ / AC / Delta 覆盖是否闭合
- Next Action：按 [workflow routing](../shaping-requirements/references/workflow-routing.md) 进入 planning、修订规格或等待一个明确决定
