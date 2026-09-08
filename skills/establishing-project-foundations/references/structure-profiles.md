# Structure Profiles

先遵循用户选择、现有工程和框架要求，再选最小 profile。profile 与 quick / standard / strict 相互独立：小项目也可能包含高风险行为。

| Project | Starting point | Grow when |
| --- | --- | --- |
| 单应用、业务服务 | 一个部署单元，按业务模块组织 | 模块内有独立规则或外部适配器才拆内部层次 |
| 前端、全栈框架 | 保留约定路由，功能实现按业务聚合 | 有真实共享 UI 或跨功能编排时建立对应边界 |
| 库、CLI、小型工具 | 原生包布局、明确导出或命令入口 | 多种独立能力出现后再增加模块，不预建领域层 |
| 多应用仓库 | 只有真实多应用/包需求才使用 workspace | 发布、运行时或复用边界明确时拆包 |
| 桌面、移动端 | 保留原生资源、生命周期与平台工程布局 | 平台 I/O 与核心逻辑确需独立测试时增加适配边界 |

## Single Application Example

下例只说明 TypeScript 服务的职责安排，不是必须生成的模板。

```text
src/
  bootstrap/                    # 启动与依赖装配
  modules/
    orders/
      public.ts                 # 跨模块公开能力
      create-order.ts           # 用例编排
      order.ts                  # 规则与模型
      order-repository.ts       # 当前需要的存储接口
      adapters/
        sql-order-repository.ts
      create-order.test.ts
  platform/                     # 日志、连接等技术设施
tests/
  integration/
  e2e/
docs/qb-spec/                   # 只创建当前需要的文档
```

简单模块可只有实现和测试文件。多条规则、多个用例或适配器出现后，才考虑模块内部 `domain/`、`application/`、`adapters/`。仅一个模块时不制造模块间依赖检查样例作为产品代码。

公开入口不要求固定文件名，也不强制所有模块集中 barrel export。模块内部使用直接引用，避免从自身公开入口反向导入形成循环。

## Frontend And Full Stack

保留框架的 `app/`、`pages/` 等保留路径。页面负责组合和交互，独立业务规则有明确归属。前端展示校验不能代替服务端授权和领域约束。

服务端秘密、数据库适配器和浏览器模块分开导出，避免一个公共 barrel 把服务端代码带入客户端。测试和样式跟随所属功能；跨页面通用 UI 只在真实复用时提取。

## Libraries And CLI

遵守原生包发现和测试约定，如 Python 的选定包布局、Go 的包与 `internal` 边界；不要迁移为 TypeScript 示例结构。库声明支持的运行环境和公开 API，CLI 将参数解析与核心行为分开。依赖锁定遵循该生态对应用、库和开发环境的区别。

## Multiple Applications

`apps/`、`packages/` 只是可选布局。拆包要能说明运行时、发布或复用原因；同库不等于必须共享领域模型。记录各包入口、允许依赖及范围化命令，避免每次验证都运行所有应用。

默认模块化单体的推荐仅适用于没有独立部署约束的业务应用。已有服务边界、离线约束或用户明确指定微服务时尊重这些事实，说明运行与验证成本。
