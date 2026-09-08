# Change File Operations

同一项目会话先用可用的 Python 命令检查一次版本，最低 Python 3.9，标准库即可。Windows 可检查 `python` 或 `py -3`，其他系统可检查 `python3`；使用实际通过检查的解释器，不自动安装。脚本位于本 skill 的 `../scripts/qb_change.py`，通过插件实际绝对路径调用，不复制进目标项目。

```text
python <plugin>/skills/closing-qb-change/scripts/qb_change.py inspect --project-root <project> --change-id <id>
python <plugin>/skills/closing-qb-change/scripts/qb_change.py update --project-root <project> --change-id <id> --status active --authorized
python <plugin>/skills/closing-qb-change/scripts/qb_change.py archive --project-root <project> --change-id <id> --verified
```

`update` 只修改指定 spec（默认）或 `--document plan` 的 status/updated；不改正文。支持同状态刷新、draft → approved → active。批准和验收由 agent 判断，`--authorized` / `--verified` 仅记录调用方明确承担该判断，不是验证结果的证明；已有充分授权无需再询问用户。其他状态或 legacy 格式先诊断，不自动转换。

`--date YYYY-MM-DD` 使用项目本地日期，默认系统日期；`--docs-root` 可指定项目内文档根。写操作可选 `--dry-run`，无需每次强制双调用。stdout 为 JSON，成功退出 0，冲突/不支持/IO 失败非零；`already_archived` 是完整归档的幂等结果。

解释字段接受普通或简单引号包围的标量；不依赖 YAML 库，不处理解释字段的注释、锚点或复杂表达式。未知字段、正文、UTF-8 BOM 和换行保留；被更新的字段行会规范化。strict 必须有独立 plan；归档时 spec 和存在的 plan 均须 active，均更新 archived。旧文档缺必要字段或状态不一致时报告，不擅自补齐。

## Failure And Fallback

- 只有执行前确认 Python 缺失/版本不兼容，才降级到系统原生工具；脚本启动后的任何失败都先诊断，不自动绕过脚本重做写入。
- 无 Python 时按原 lifecycle 和归档规则执行：明确文档根，按 ID 唯一定位，检查路径真实解析与目标冲突；只更新元数据，先复制核对再移除源。保留合并文档及可选 plan，不重写正文或用全局文本替换修改状态。
- 系统工具也无法保证完整性时保留现场并报告阻塞，不安装运行时，不声称已归档。

脚本在文档根使用排他锁，拒绝路径链接/越界和覆盖；锁只能约束遵守该工具的写入者，操作期间不要让其他进程编辑同一 change。它不是对恶意并发文件替换的安全隔离。

归档先创建目标与 `.qb-pending.json`（来源、目标及内容哈希），写入并核对全部归档后才清除源，最后移除 pending。多文件操作不宣称原子化或断电级持久性。失败时保留目标、pending 和尚存来源；重复调用拒绝自动恢复。

发现 pending、残留锁、部分移动或空目标时，用 `closing-qb-change` 检查原始文件和哈希，判断继续归档还是恢复来源。不要直接删锁重试、清空目标或覆盖修改后的文件。无法确定完整性时停止；本版不提供自动 resume 或 force。
