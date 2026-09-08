---
id: QB-20260908-safe-recovery
type: design
tier: strict
status: archived
created: 2026-09-08
updated: 2026-09-08
supersedes: []
---

# Safe Archive Recovery

## Approval

用户已采纳“增强 doctor 只读恢复分析 + 一个严格受限 recover tool；暂缓 legacy 自动 normalization”的建议，并明确批准实施。

## Goal

在不引入 force、overwrite 或语义自动决策的前提下，让 pending/partial archive 从只能报告提升为可分析、并在 hash 可证明安全时由用户选择 complete 或 restore。

## Requirements

### REQ-001 — Read-only recovery analysis

共享分析器必须校验 journal 结构、change ID、路径、source/target 集合、SHA-256、额外文件和链接，返回 `safe_to_complete`、`safe_to_restore`、`choice_required` 或 `ambiguous`。doctor 只读报告状态和允许动作，不修复现场。

### REQ-002 — Constrained recovery mutation

新增 `qb_spec_recover`，只接受明确 change ID、`complete | restore`、expected journal SHA-256、caller authorization 和可选 dry-run。进入全部 mutation queues 和根锁后重新分析；expected hash 或现场变化必须失败关闭。

### REQ-003 — Safe action semantics

complete 只在所有目标存在且 target hash 匹配、所有尚存来源 source hash 匹配时删除尚存来源和 pending。restore 只在所有来源存在且 source hash 匹配、所有已有目标 target hash 匹配且目标目录无额外文件时删除已知目标和 pending，并仅在目录为空时删除目录。缺失来源不得从 archived payload 猜测重建。

### REQ-004 — Authority and scope

用户/Agent 选择 complete 或 restore；工具只证明所选动作机械安全。authorization 声明不是独立证明。首期不处理 legacy metadata、不删除未知文件、不自动恢复、不支持 force。

### REQ-005 — Packaging and bounded output

第五个工具使用严格 TypeBox/StringEnum schema，成功 details/text 有界；README、workflow skill 和行为矩阵说明恢复边界。现有四工具契约不得回归。

## Behavior Delta

### ADDED

- REQ-001：doctor 提供可行动的只读 recovery classification。
- REQ-002、REQ-003：新增受 hash 和现场约束的 `qb_spec_recover`。

### MODIFIED

- REQ-004、REQ-005：异常关闭可执行范围从“仅诊断”扩展为“仅在机械可证明时 complete/restore”；模糊现场仍人工处理。

## Acceptance Criteria

### AC-001 [REQ-001]

Fixtures 覆盖 journal 后无副本、完整副本未删除来源、部分删除来源、损坏 source/target、损坏 journal、额外文件与链接；doctor 前后 tree hash 一致，并报告正确 state/actions/journal hash。

### AC-002 [REQ-002, REQ-003]

recover 测试证明 safe complete、safe restore、choice-required 两种用户选择和幂等后状态；拒绝错误 action、错误 expected hash、缺少 authorization、ambiguous、源/目标变化、额外文件和锁冲突。

### AC-003 [REQ-002, REQ-003]

并发/故障测试证明所有 journal/source/target/lock 路径先排序取得 mutation queues，再取得根锁并重新分析；首次持久化前取消无写入，提交段故障保留可诊断现场且重复分析安全。

### AC-004 [REQ-004]

源码/schema/text 不含 force、overwrite、自动 action 或 legacy normalization；成功文案明确 caller-attested，doctor 不把 allowed action 表述为用户决定。

### AC-005 [REQ-005]

真实/fake Pi 注册恰好五个 tools；typecheck、完整测试和 pack dry-run 通过，tarball 继续排除 tests/docs/upstream。

## Verification Evidence

- **AC-001：** 新增独立只读 `recovery-analysis.ts`。fixtures 覆盖 journal 后无副本、完整副本、部分来源删除、source/target 变化、额外文件、target symlink 和 malformed journal；doctor 调用前后 tree hash 一致，并在 model-visible text/details 返回 state、allowed actions 与 journal SHA-256。
- **AC-002：** `recoverChange` 覆盖 safe restore、safe complete、choice-required 的两个用户选择、dry-run、幂等结果、缺少 authorization、错误 expected hash 和不安全 action；所有拒绝路径保留现场。
- **AC-003：** 测试确认 recovery 对 lock/journal/target directory/source/target 去重排序后取得 mutation queues，再取得根锁；提交前取消零写入，source 在 commit 前变化时失败关闭，删除中断后仍分类为 safe_to_complete，残留根锁拒绝操作。
- **AC-004：** tool 只接受 `complete | restore`，要求用户选择的 caller attestation 和 exact journal hash；生产实现无 force、overwrite、自动 action 或 legacy normalization。changed、linked、unexpected 和 malformed 现场均为 ambiguous。
- **AC-005：** 真实 Pi `DefaultResourceLoader` 加载结果为 5 个 tools、11 个 skills、2 个 prompts，无 extension errors。`npm ci` audit 0 vulnerabilities；typecheck 通过；Node suite 54/54 通过；pack dry-run 为 46 entries、67,239 bytes packed、196,556 bytes unpacked，包含两个 recovery runtime 文件且排除 tests/docs/upstream。
- `git diff --check` 和 `qb_spec_doctor` 通过。Linux 已验证；Windows runner 仍未提供。

## Risks

恢复本身是破坏性操作。只允许可由 journal 和当前 bytes 证明的动作；任何路径、hash、集合或状态不确定都返回 ambiguous。restore 不承诺恢复已删除来源，complete 不接受缺失或损坏目标。多文件操作仍非文件系统级原子事务。
