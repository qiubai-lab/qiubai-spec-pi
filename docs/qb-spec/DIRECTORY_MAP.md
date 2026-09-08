# Directory Map

## Root Directories

- `extensions/`：负责 Pi extension 注册与 tool adapter；不承载 workflow 语义或文件系统核心规则。
- `src/`：负责 qb-spec 机械文档服务、路径安全、并发、归档和诊断；不决定需求、批准或验收充分性。
- `skills/`：负责 Pi 按需加载的 qiubai-spec 语义工作流与 references/assets；不直接实现底层文件事务。
- `prompts/`：负责 `/qiubai-spec`、`/qiubai-init` 用户入口和参数交接；不复制完整 workflow 或直接证明授权。
- `references/`：负责独立 package 的机械快照与行为矩阵；不作为任务流水账。
- `tests/`：负责机械工具和 workflow resource contract；不进入发布 tarball。
- `docs/qb-spec/`：负责当前 package 自身的 active change、归档和稳定结构索引；不进入发布 tarball。
- `docs/history/`：负责历史实施记录；不定义当前运行时规则。
- `upstream/`：负责冻结开发基线与差分审查；生产资源不得导入、执行或读取。

## Important Files

- `package.json`：Pi package 资源和 npm 发布白名单入口；不表达详细 workflow 规则。
- `extensions/index.ts`：五个 `qb_spec_*` tools 的唯一注册入口；不注册 `/qiubai-spec` 或 `/qiubai-init` commands。
- `skills/shaping-requirements/references/workflow-routing.md`：qb-spec 默认 next-action 顺序的唯一事实源。
- `prompts/qiubai-spec.md`：普通开发 Prompt Template 入口。
- `prompts/qiubai-init.md`：entry/bootstrap/adopt 初始化 Prompt Template 入口。
- `README.md`：安装、入口、能力与安全边界说明。

## Module Responsibilities

- `src/discovery.ts`、`src/inspect.ts`：定位并验证持久化 change 形态；不修改文件。
- `src/transition.ts`：执行单文档受约束 lifecycle transition；不判断授权真实性。
- `src/archive.ts`：执行带 queue、lock、hash 和 journal 的归档事务；不判断 acceptance evidence。
- `src/recovery.ts`：分析 pending journal，并只执行用户选定且 hash 可证明安全的 complete/restore；不选择动作、不 force、不重建缺失来源。
- `src/doctor.ts`：执行只读机械诊断和 recovery classification；不做规格语义审查、不替用户选择或执行恢复。
- `skills/*/SKILL.md`：分别维护需求、审查、计划、架构、测试、验证、关闭、context、初始化和 foundations 职责；默认顺序统一回连 workflow routing。
- `tests/workflow-resources.test.ts`：验证 Pi discovery、资源链接、集中路由和 Prompt Template 展开契约。

## Forbidden Contents By Directory

- `extensions/`：不得加入需求塑形、tier 决策、验收判断或长期 context 自动提升。
- `src/`：不得运行时读取 `upstream/`，不得引入 Python CLI fallback，不得把 attestation 当作证明。
- `skills/`：不得引用冻结基线路径、开发机绝对路径、缺失脚本或建立第二套默认流程顺序。
- `prompts/`：不得复制全部 skills、直接设置 true attestation、注册额外首期入口或将命令调用视为批准。
- `references/`：不得动态同步上游规则。
- `upstream/`：不得被生产代码、skills 或 prompts 作为运行时依赖。
