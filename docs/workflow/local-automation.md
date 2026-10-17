# 本地自动执行与返工选路

> 日常只需三步：制作 → 自动检查与必要修正 → 最终验收。默认按 [简洁工作流](concise-mode.md) 处理内部问题，中间审阅不逐次请示。
> 本地次数策略更新：新任务默认按进展继续，不请求增加批次数；旧任务按已有授权一次迁移。详见 [迭代策略](iteration-policy.md)。下文数字上限规则仅适用于 explicit_budget 模式。
适用于已配置的本地制作任务。不会自动提交 Studio、扩大制作范围、重试脚本或代替质量审阅。

## 一条命令启动，恢复不重跑

```powershell
node tools/workflow/run-local.mjs run ASSET work/request.json --blender '实际的/blender.exe' --result work/result.json
node tools/workflow/run-local.mjs resume ASSET --result work/result.json
```

request 沿用 [LEAN.md](../../tools/workflow/LEAN.md) 的 start 格式；result 沿用 finish 格式。路径相对资产目录。result 可在执行脚本运行时生成，也可执行后由代理根据实际检查补齐。使用显式 Blender 路径，默认进程超时 300000ms，可设 --timeout-ms，最大 3600000ms。

执行顺序：检查可执行文件→正式 start/dispatch→独立后台执行一次→保存进程日志→核对回执→收集技术清单→有 result 时执行原 finish 校验。CLI 全程持有现有资产锁。直接导入 JS 函数的调用者须自行互斥，与底层 production 函数相同。

输出保存在 `work/executions/ITERATION/`：

- process.log：本轮标准输出和错误。
- process.json：进程 PID、退出码、信号、错误及日志哈希；它不代替执行回执。
- receipt.json：worker 的输入、脚本、输出哈希与实际 Blender 版本；新回执附场景对象/网格/骨骼数量、动作名及帧范围。
- technical-REVISION.json：归集来源、标准、已验证回执、输出文件及库存信息。quality 固定为 not_evaluated，不冒充质量通过。

未传 --result 时，成功执行返回 awaiting_quality_result，保持 started，供后续 resume --result 完成原质量校验。缺报告、证据过期、文件身份不符时停止 finish；修正报告后 resume，不重跑脚本。即使 result 写 completed，真实失败回执也不能晋升候选。

有有效失败回执时自动记录失败并结束该轮，保留失败次数。超时、进程异常退出但无回执时返回 reconcile_local；resume 只读现有请求/回执并对账，绝不启动 Blender。崩溃留下 request 但无派发状态时可恢复身份；没有任何派发记录时仍需核实，不能推断从未执行。残留锁先核实执行者，不自动删除；同一输出不覆盖。标准出口码：成功执行/等待质量资料为 0；执行失败、未决对账或校验异常为非零。

后台清单描述执行后的内存场景，不能证明导出文件可回读、贴图完整、动作正确或视觉合格。质量测量、渲染、前后比较、回归报告仍须使用目标相应采集器和真实观察；允许操作脚本串联它们，但不自动编造内容。

## 连续无改善后的换路

summary.repair_routing 按 defect_id 汇总未改善批次，跨 strategy_id 计数。连续次数达到当前 stop_after_no_improvement 后，下一次正式修复必须提供 strategy_review 文件引用；work start 支持直接填相对路径。诊断和导出不计入修复连败，也不清零；已验证 improved 才重置该缺陷计数。原策略停止清单和本地预算仍生效。

strategy_review 的字段：

| 字段 | 内容 |
|---|---|
| job_id / defect_id | 当前任务与稳定缺陷身份；不能为重置次数改缺陷名 |
| source_sha256 / quality_spec_sha256 | 当前候选和标准哈希 |
| previous_attempts | summary 返回的该缺陷全部连续失败批次 ID，不能漏掉最近一轮 |
| root_cause | 实际诊断结论；证据不足应先做诊断 |
| changed_approach | 与前几轮在方法上的区别 |
| expected_improvement | 预期改善及怎样验证，需对应计划 success_checks |
| strategy_id / hypothesis | 与新计划一致 |
| evidence | 可核验文件引用数组，每项包含 path、sha256 |

执行器拒绝缺失/过期复盘、遗漏失败批次、仅改策略名但假设或脚本相同的计划；检查发生在新增批次之前。不因复盘增加预算或自动接受结果。正式通过仍取决于原来的指标、保护项和回归检查。

这些检查不能判断自然语言原因是否正确，亦不能证明改过的代码就是更好的方法。代理仍要实际审查诊断和变化，不能修改注释或重新命名缺陷应付检查。历史批次不重写，下一次正式尝试按现有记录判断是否需要复盘。
