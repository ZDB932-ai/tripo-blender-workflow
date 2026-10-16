# 当前可执行工作流

> 本地次数策略更新：新任务默认按进展继续，不请求增加批次数；旧任务按已有授权一次迁移。详见 [迭代策略](iteration-policy.md)。下文数字上限规则仅适用于 explicit_budget 模式。
> 费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

本页是操作者入口，协议仍为 3.6。代理结合工具执行；CLI 管理记录、预算和校验，不会自行点击 Studio，也不会生成虚构的质量报告。历史设计文档不作为当前命令来源。

## 从哪里继续

在项目根目录执行，ASSET 替换为实际目录名：

```powershell
node tools/workflow/work.mjs list
node tools/workflow/work.mjs summary ASSET
```

list 只读扫描，逐资产返回下一步；大模型会重新计算证据哈希，可能需要等待。summary 给出当前候选、关卡、预算和未完成执行的恢复指引。没有 production 的历史目录标记 legacy_or_uninitialized，先检查已有文件，不覆盖建档。

| 返回动作 | 实际操作 | 继续条件 |
|---|---|---|
| reference_or_existing_source | 完成需求/参考，或归档并 attach-source 已有模型 | 当前来源和范围明确 |
| planned | preflight 核对输入、页面设置、报价和授权 | check-plan 成功，点击前再核对 |
| reconcile_remote | 核对 Studio 任务身份、版本和结果 | 真实结果入账；未知保留费用预留 |
| select_source_run | select-remote 或 defer-remote 记录选择 | 不按编号自动选最新 |
| studio_result_ready / qa_review | 检查外形/材质，保存绑定该 run 的报告 | ready_for_transfer 或明确 diagnostic_transfer |
| exporting / reconcile_transfer | 同版 Bridge 接收，失败按证据决定文件下载 | 回执、文件哈希与源身份一致 |
| configure_quality | 冻结适用标准、阈值和范围 | 标准 active，所需指标已定义 |
| base_model / polish / rig / motion | 验证对应质量，仅修缺陷 | 技术通过且按模式完成审阅 |
| review | 展示当前候选证据，记录真实意见 | 明确接受或退修 |
| export_for_engine / engine / final | 正式导出、干净回读、适用引擎验证、最终审阅 | 最终文件与验收证据对应 |
| repair_records | 按 blocked_by 修复损坏记录或证据 | 从可验证来源恢复，不能编造通过 |
| complete | 提供已验收文件 | 保留母版和来源证据 |

## 新任务：四阶段

1. **需求与参考**：明确用途、静态/绑定/动作、格式、引擎、保留项、费用与返工范围。只有不存在的资产目录才运行 `node tools/workflow/scaffold.mjs ASSET`。这仅创建草稿，不代表配置完成。填写 brief/intake；按[参考规范](reference-intake.md)获得真实用户批准。简单静态可单图，角色/复杂/动画默认独立四视图。
2. **Tripo 制作**：preflight 按当前 UI 准备单候选计划。远程 workflow-policy.json 与 quality-spec.json 负责授权，本地版本化 production-quality-vNNN.json 负责质量。字段以 [PRODUCTION.md](../../tools/workflow/PRODUCTION.md) 为准。有效旧授权复用；已有持续积分授权，任务范围内不再另行询问费用。顺序：prepare→check-plan→mark submitting→实际点击一次→记录结果。后处理复用确切版本，不重新生模解决下载问题。
3. **核验与必要修正**：同版导入先确认纹理选择、身份和单位。静态跳过动作；纯绑定不强加动作。需要结构修正的动画资产走[往返规范](roundtrip.md)：结构稳定副本→Tripo绑定/动作→导回核验→最终局部精修。每次修改采用 start/finish；保留原生骨架和节奏审阅要求。
4. **交付验收**：显式选择 clip，导出明确格式，干净回读检查依赖/材质/骨骼/动作。要求引擎则核验实际项目。技术通过后展示最终文件，记录真实最终意见；导出成功不等于 accepted。

## 本地操作与中断

优先用[自动执行入口](local-automation.md)，将 start、独立后台运行、日志与回执收集合并为一步。无质量结果时停在 awaiting_quality_result；补齐后 resume，不重新执行：

```powershell
node tools/workflow/run-local.mjs run ASSET work/request.json --blender '实际的/blender.exe' --result work/result.json
node tools/workflow/run-local.mjs resume ASSET --result work/result.json
```

同一缺陷连续无改善时先看 summary.repair_routing，补充真实策略复盘或执行诊断，不能只更换策略编号。下列 start/finish 仍用于手动执行或 live MCP：

```powershell
node tools/workflow/work.mjs start ASSET work/request.json
# 在独立 Blender 后台执行返回的 native_arguments 一次
# 或在确认无未保存场景风险后使用 live MCP code
node tools/workflow/work.mjs finish ASSET work/result.json
```

request/result 字段与证据见 [LEAN.md](../../tools/workflow/LEAN.md)。start 预留和返回派发描述，不执行 Blender；finish 核对真实回执及质量结果。不得失败后重复执行打印的脚本参数。

中断后重新 summary。存在 request 但状态未记录用 recover-execution；有回执用 reconcile-execution；无回执先查进程和产物。started 批次不能重新 start。人工 abort 需要停止证据，见[执行协议](../../tools/workflow/PRODUCTION.md)。残留 .workflow.lock 不自动删除，先核对原执行者。浏览器验证保留原会话，不启动竞争 profile。resolve_budget 时复用有效授权或补齐缺失范围，不重置次数。

## 安装或改动后验证

```powershell
node tools/workflow/doctor.mjs --profile local --blender '实际的/blender.exe'
node tools/workflow/validate.mjs --blender '实际的/blender.exe' --report 'docs/validation/新的验证报告.json'
```

可额外传 --installed 加实际技能安装目录，比较九个技能。报告须使用新文件名。默认 doctor 的 records 档仅证明项目记录/安装检查；local 档要求 Python 和 Blender 可运行。readiness.studio/live_blender 未检查时显示 not_checked。validate 强制指定 Blender，运行全部测试含真实后台夹具，不能因缺少环境变量静默跳过集成测试。

在线检查另行执行：Tripo tabs/snapshot→已登录工作台和目标版本；Blender MCP 读场景→检查返回正文；Bridge 接收→回执和模型身份。后台可用不代表 live MCP/Bridge 可用。测试夹具不证明任意角色的审美、权重或动画质量。

当前适用：单资产、单候选、实际 UI 核验后的制作与后处理。批量、多变体、参考批准前收费生图适配尚未完成。新资产仍需实际质量证据与验收。
