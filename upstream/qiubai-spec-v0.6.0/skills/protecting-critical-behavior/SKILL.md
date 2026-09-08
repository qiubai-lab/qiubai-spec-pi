---
name: protecting-critical-behavior
description: Use when a task changes critical logic, fixes regressions, touches business rules, permissions, data transformations, edge cases, or other behavior that needs focused automated protection. Trigger when deciding whether to write tests first, add regression coverage, or justify why automation cannot be added.
---

# Protecting Critical Behavior

## Overview

这个 skill 只负责测试保护决策，不要求所有任务都强制完整 TDD。

目标是把自动化保护集中用在真正容易回归、难以手工保证、或业务风险高的地方。

## Always Protect These Areas

- 核心业务规则
- 权限、鉴权、隔离相关行为
- 复杂数据转换与边界条件
- 已出现过的 bug 修复
- 难以通过一次手工点击稳定证明正确的逻辑

这些区域默认应先写失败的测试，或至少先补回归保护再改实现。

## Usually Lighter Treatment Is Fine

- 文案与样式微调
- 低风险脚手架
- 单纯重命名且无行为变化
- 已被更高层稳定集成测试覆盖的极小改动

即使如此，也仍应说明为什么不需要额外自动化保护。

## Test Design Rules

1. 测试描述行为，不描述实现细节。
2. 优先覆盖正常路径、边界路径、失败路径。
3. 修 bug 时优先补回归测试。
4. 不让 mock 结构掩盖真实规则。
5. 如果难以测试，先判断是不是边界放错了。
6. change spec 提供 `REQ-*` / `AC-*` 时，测试引用对应验收；仅 strict 或明确多 Agent / 审计场景回连 `VER-*`，不为 standard 另造验证编号。

## Decision Flow

重构受影响的关键行为时，先运行已有相关检查；覆盖不足则在迁移前补现状刻画或契约测试。保持行为的重构测试应在旧实现上通过，不为形式上的“先失败”制造失败；bug 修复仍先建立失败回归证据。区分需要兼容的行为、已知缺陷与未知项，不能把现状全部固化为正确需求。已有覆盖充分则复用；关键证据不足时缩小迁移并报告缺口，不凭编译通过声称行为等价。

1. 识别本次改动是否命中高价值保护区域。
2. 如果命中，优先先写失败测试或补回归保护。
3. 如果未命中，说明为何现有覆盖已足够。
4. 如果无法补自动化测试，记录原因、替代证据和残余风险。

## Pairing Guidance

- 若测试难以编写，使用 `checking-architecture-boundaries` 检查结构原因。
- 最终由 `verifying-before-completion` 汇总自动化与手工验证证据。
- 后续顺序遵守集中式 [workflow routing](../shaping-requirements/references/workflow-routing.md)。

## Common Mistakes

- 关键 bug 修复没有回归保护
- 只测 happy path
- 为了好写测试而过度 mock
- 手工点测替代关键自动化验证
- 明知无自动化保护仍不说明风险

## Output Contract

- Coverage Decision：为什么这次要或不要补自动化保护
- Tests Added：新增或更新了哪些测试，以及覆盖的 acceptance；strict 时包含 `AC-*` / `VER-*`
- Gaps：哪些行为仍未被自动化覆盖
- Follow-up：后续建议补在哪一层
