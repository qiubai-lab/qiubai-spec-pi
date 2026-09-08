---
id: QB-20260908-safe-recovery
type: design
tier: strict
status: archived
created: 2026-09-08
updated: 2026-09-08
supersedes: []
---

# Safe Archive Recovery — Plan

## Tasks

### TASK-001 [REQ-001, AC-001]

实现严格 journal parser 与只读 recovery analyzer，复用路径安全和 SHA-256 primitives。

### TASK-002 [depends: TASK-001] [REQ-001, REQ-005, AC-001]

将 classification 放入 doctor paginated findings/details，保持输出有界和只读。

### TASK-003 [depends: TASK-001] [REQ-002, REQ-003, REQ-004, AC-002, AC-003, AC-004]

实现 `recoverChange` 的 queue、root lock、expected journal hash、重新分析、complete/restore 和 fault/cancel 边界。

### TASK-004 [depends: TASK-003] [REQ-005, AC-004, AC-005]

注册严格 `qb_spec_recover` schema，更新 skill/reference、README 和行为矩阵。

### TASK-005 [depends: TASK-002, TASK-003, TASK-004] [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, AC-001, AC-002, AC-003, AC-004, AC-005]

补充 analyzer、doctor、recover、fault、concurrency、extension 和 package tests，执行仓库完整验证与真实 Pi smoke。

## Completion

- TASK-001：严格 journal parser、只读 analyzer 和安全 classification 已完成，并与 mutator 分文件保持职责边界。
- TASK-002：doctor 已返回 bounded recovery metadata，文本包含后续 recover 所需准确 hash。
- TASK-003：queue、root lock、expected hash、complete/restore、cancel 和 failure-preserving mutation 已完成。
- TASK-004：第五个严格 tool schema、skills、README、snapshot、behavior matrix 和 Directory Map 已更新。
- TASK-005：新增 9 项 recovery/extension 测试，总 suite 54/54 通过；完整 package 和真实 Pi loader 验证完成。

## Verification

### VER-001 [AC-001]

运行 recovery analyzer/doctor fixture suite，并比较调用前后 tree hash。

### VER-002 [AC-002]

运行 complete/restore、authorization、expected hash、ambiguous 和重复状态测试。

### VER-003 [AC-003]

运行 queue 顺序、根锁、取消、源变化和 fault injection 测试。

### VER-004 [AC-004]

检查 schema、成功/错误文本及生产源码，不存在 force/overwrite/legacy normalization。

### VER-005 [AC-005]

运行 `npm ci`、typecheck、完整测试、pack dry-run 和真实 Pi 注册 smoke。
