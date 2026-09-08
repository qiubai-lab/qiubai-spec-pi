# Change File Operations

qb-spec 的机械文档操作使用本 package 注册的 Pi tools，不探测 Python，不拼接插件绝对路径，也不直接执行冻结基线中的脚本。

| Intent | Pi tool |
| --- | --- |
| 定位并读取一个持久化 change | `qb_spec_inspect` |
| 更新一个 spec 或独立 plan 的 lifecycle metadata | `qb_spec_transition` |
| 归档已验证且所有来源均 active 的 change | `qb_spec_archive` |
| 诊断 metadata、trace、lock、pending 或 partial archive | `qb_spec_doctor` |

`qb_spec_transition` 每次只修改明确指定的 `spec` 或 `plan`，支持同状态刷新和 `draft → approved → active`。批准由 agent 根据现有用户授权判断；`authorizationDeclared` 只是调用方 attestation，不是独立证明。不得因为创建了文档或调用了入口命令就将其设为 true。

`qb_spec_archive` 保留合并文档和已有独立 plan 的形态，要求所有实际来源均为 active。归档前由 agent 检查 acceptance evidence、阻塞性 clarification、适用的 Directory Map 更新及其他 completion gate；`verificationConfirmed` 只是调用方 attestation，不是验证证据。普通成功归档由 `verifying-before-completion` 调用，显式或异常关闭由 `closing-qb-change` 调用。

工具接受项目内相对 `docsRoot` 和可选日期；transition/archive 支持 `dryRun`，但不要求每次固定双调用。工具保留受支持 frontmatter 以外的正文、未知字段、UTF-8 BOM 和换行风格。strict 必须有独立 plan；历史 split-standard 保持分离；standard 缺少独立 plan 是正常形态。

## Failure And Recovery

- 工具错误带稳定 `QB_*` code。失败后先使用 `qb_spec_doctor` 诊断，不绕过工具以 shell、`edit` 或 `write` 强制重复同一机械操作。
- 发现 `.qb-pending.json`、残留根锁、部分移动、空目标或 active/archive 冲突时停止自动关闭，转入 `closing-qb-change` 的显式恢复路径。
- 不直接删除 lock/pending，不覆盖 archive，不自动 resume、force 或批量迁移 legacy 文档。
- 多文件归档不是文件系统级原子事务，也不承诺断电持久性；失败现场可能同时包含 archive 副本、pending journal 和尚存来源。
- mutation queue 与 qb-spec 根锁只协调合作的 Pi 文件工具。不要在同一 tool batch 中让 `edit`/`write` 与 qb-spec 写工具修改同一个 change；不合作的外部进程仍属于残余风险。

语义正文继续由 agent 使用 Pi 的普通读取和精确编辑能力维护。工具不得决定 requirement、approval、acceptance、Directory Map 或长期 context。
