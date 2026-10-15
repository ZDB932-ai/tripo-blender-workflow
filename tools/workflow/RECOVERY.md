# 远程恢复与审阅协议（执行协议 3.5）

由 [PRODUCTION.md](PRODUCTION.md) 路由到本页。以下命令在项目根目录执行；文件路径均相对资产目录。

## 活动远程任务

`production.mjs next ASSET` 始终优先暴露未对账的提交、执行和传输。handoff 缺失、过期或 JSON 损坏是可重建警告，使用 sync；主记录、模型或质量证据损坏仍返回 repair_records，不能忽略。

已有候选且有未接收远程结果时，next 返回 select_source_run。结合当前请求、plan 和来源证据决定选中或暂存，不因阶段切换重新索要已存在的授权。不得自动选择最新 run 或覆盖旧候选。

```powershell
node tools/workflow/production.mjs select-remote ASSET work/remote-choice.json
node tools/workflow/production.mjs defer-remote ASSET work/remote-choice.json
```

文件字段为 `{run_id,source_sha256,purpose,reason}`。source_sha256 是当前本地候选哈希；无候选写 null。选择记录固定当前来源、目标任务和目的，不改模型、不提交任务、不批准费用。选中任务的来源过期需重新判断；切换其他任务前明确暂存当前任务。未知提交/进行中任务不能通过 defer 隐藏，exporting 先核对传输。

选中结果经真实检查、传输和归档后使用 attach-source，且 run_id 必须一致；这一步才替换当前候选并清空选中任务。既有来源 run 不反复推荐。未选任务仍可见，deferred 任务只有显式重新选择后继续。历史记录不批量改写。

## Studio 检查与传输

### 用户明确授权保留未知记录并继续

仅在用户明确批准调整恢复规则并继续已成功的替代结果时，使用 `production.mjs continue-remote ASSET REQUEST.json`。不是自动重试，也不是服务对账。请求含 reviewer=user、decision=continue_with_replacement、authorization 原话、budget_release=false、unknown_run_id、replacement_run_id、source_sha256，以及 unknown_state、unknown_plan、replacement_plan、replacement_evidence 文件哈希引用。替代证据绑定 run_id、plan_sha256、真实 source_identity 和实际证据。

仅 submission_unknown 可登记；processing/submitting 不可使用。旧状态/计划、替代计划或证据改变会重新阻塞。旧结果始终未知并保留全部费用预留，next 持续显示警告。新的未知提交、未决传输及质量关卡不受影响。之后仍需 select-remote 与正式传输，不自动切换候选。

`studio_result_ready → qa_review` 表示开始检查；qa_review 中断后继续 refine，不直接跳 deliver。

检查结束生成带哈希证据的独立报告：

```json
{
  "run_id": "目标run",
  "plan_sha256": "当前run计划哈希",
  "source_identity": "实际Studio URL与版本",
  "disposition": "ready_for_transfer",
  "observation": "实际已检查项、缺陷与未知",
  "reason": "为何转入传输",
  "evidence": [{"path":"work/observed-evidence.json","sha256":"实际哈希"}]
}
```

完成检查可使用 ready_for_transfer；需要内部网格诊断时使用 diagnostic_transfer，并在 observation/reason 明确未通过的项目。两者都不代表 base_model 或最终质量通过。

```powershell
node tools/workflow/workflow.mjs mark ASSET RUN ready_for_transfer work/studio-review.json
# 或 diagnostic_transfer；随后：
node tools/workflow/workflow.mjs mark ASSET RUN exporting "实际同版传输意图依据"
```

旧 qa_review 恢复时补充真实报告，不能假定检查完成；已进入 exporting/downloaded 的历史结果保持可恢复。export_failed 只恢复同一结果。Bridge sending/unknown 的禁止重发规则仍适用。

## 合并人工审阅

执行许可复用、技术重验证、用户对当前候选的质量判断是三件事。候选改变后仅按LEAN.md的冻结依赖及实际属性证据复用；不根据“仅改了动作”的说明继承旧结果。

同一候选的连续适用关卡可以汇总为一次展示。先生成各关卡完整报告，再用只读预检：

```powershell
node tools/workflow/production.mjs review-bundle ASSET work/review-bundle.json
```

bundle 字段：job_id、source_sha256、quality_spec_sha256、items。items 按关卡顺序列 `{stage,report:{path,sha256}}`，须连续；之前不在本批中的关卡仍须已接受。预检不写 gate、不伪造用户批准，也不授予后续制作权限。

技术通过后给用户一次展示每个关卡的结果和文件范围。真实意见覆盖列出的全部关卡时，为每项生成原有 decision 格式，在 items 中补 `decision:{path,sha256}`，再执行：

```powershell
node tools/workflow/production.mjs accept-bundle ASSET work/review-bundle-approved.json
```

全部报告和决定再次核验后一次提交；任何项失败不部分接受。只接受全部明确 accepted 的 bundle；拒绝意见使用原 evaluate/decide 流程记录。自主模式仍要求中间 AI、final 用户，不能把一次模糊“继续”当作全部质量批准。

动画用途新增协议见 [动画试验、观感与回归](../../docs/workflow/animation-review.md)。新任务显式配置；历史任务不自动迁移。
