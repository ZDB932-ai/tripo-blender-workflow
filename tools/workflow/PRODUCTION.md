> 当前默认选路：[Tripo主生成、Blender辅助修正](../../docs/workflow/tripo-first.md)。先核查并利用目标相关的Tripo能力；Blender替代制作需要有证据的理由。此为技能选路规则，保留执行协议3.6及现有预算/验收约束。

> 默认交互已简化：中间与节奏检查由代理处理，最终由用户验收；旧任务可通过 work simplify 切换。见 [简洁模式](../../docs/workflow/concise-mode.md)。下文 guided 或旧 rhythm 用户要求仅适用于未启用 concise 的任务。
> 本地次数策略更新：新任务默认按进展继续，不请求增加批次数；旧任务按已有授权一次迁移。详见 [迭代策略](../../docs/workflow/iteration-policy.md)。下文数字上限规则仅适用于 explicit_budget 模式。
> 费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

# 制作状态、质量关卡与返工执行

执行协议 **3.6**。入口要求 metadata.workflow_protocol=3.6；`doctor.mjs` 可只读核对依赖与安装副本。

新生成先读取 [需求与参考循环](../../docs/workflow/reference-intake.md)，网页操作读取 [Playwright 规范](../../docs/workflow/playwright-operations.md)。动画用途须在选图/生图前明确，参考数量按复杂度选择；已有答案不重问，参考未获用户批准不得进入生成。新 prepare/check-plan/submitting 强制需求、参考和页面核对绑定；历史对账/下载继续兼容。

Studio领域选路按 [功能表](../../docs/workflow/studio-capabilities.md) 和 [配方](../../docs/workflow/studio-recipes.md)。远程推荐operation：`generate`、`mesh_edit`、`segmentation`、`part_completion`、`retopology`、`smart_uv`、`texture`、`texture_edit`、`texture_upscale`、`texture_pbr`、`rig`、`animation`、`stylize`；它们是计划命名约定，不是新增浏览器自动操作器。Quick Cap/AI Completion、文字/视频/多阶段动作等具体模式放入实际UI对应的settings，不能伪填不存在的控件。既有别名/旧run不改名。任何操作均仍需被现行policy明确覆盖；命名约定不授予范围。

所有纹理生成、编辑、放大及PBR操作继承已启用动画工作流的preflight检查；代码识别旧纹理别名及`texture_generate`、`texture_upscale`/`upscale`、`texture_pbr`/`pbr`/`pbr_generate`、`texture_style`/`remove_lighting`，避免换操作名跳过前置条件。批量、多变体和参考阶段Studio收费生图未新增执行契约，仍见配方中的适配限制。研究/选路说明不会自动认证输入兼容性或质量。

按需读取：[请求范围与首次归档](../../docs/workflow/request-modes.md)；[远程恢复与合并审阅](RECOVERY.md)；[测量、采图、属性契约](EVIDENCE.md)。只读检查/同版下载不自动建立完整制作 job。

本协议替代旧的手工 production/handoff 维护和四参数 review 命令。Tripo run 仍记录远程任务，历史 accepted 不变。当前本地制作以资产内 `production.json` 为唯一事实源，`handoff.json` 是可重建投影；资产原始 `brief.json` 保留历史需求，当前需求读 `production.requirements`。

## 现行术语与读取顺序

技能入口 → docs/workflow/skill-runtime.md → 本协议所需章节 → 对应 procedure。WORKFLOW_V3.md、WORKFLOW_CONTRACT.md 等早期设计文档用于背景，不作为命令或状态 schema 来源。远程授权使用 workflow-policy.json / quality-spec.json；本地制作质量使用 production.quality_spec 指向的版本化标准，不能混用。

制作关卡按 base_model → polish → rig（适用时）→ motion（适用时）→ engine（适用时）→ final 排列。参考与范围确认独立于制作关卡；旧文档 G0 对应参考确认，G1/G2/G3/G4 分别约对应 base_model/polish/rig 与 motion/final。engine 是独立关卡；技能名称不等于关卡名称。静态与纯绑定请求分别跳过不适用的动作关卡。

transfer 是接收模型，正式export是制作批次操作，均不是final用户验收。Blender→Studio的纯格式交换副本属于传输准备，保存源/副本哈希与设置，不记export_verified；其中的内容修正仍须正常制作计划和原预算，详见[请求范围](../../docs/workflow/request-modes.md)和[往返规范](../../docs/workflow/roundtrip.md)。指定引擎时先正式导出并回读，再engine验证，最后final。恢复看next，不能仅按production.stage或handoff投影判断；前序关卡失效时next可返回更早阶段。

## 恢复与身份

远程选中/暂存与 qa_review 恢复细节见 [RECOVERY.md](RECOVERY.md)。先运行 `node tools/workflow/production.mjs next ASSET`。它检查记录一致性、未完成本地批次、远程 run 和传输，再返回下一可执行动作。`handoff` 仅投影本地制作状态，不包含远程调度。首次接收/导入用 `attach-source ASSET REQUEST.json`，request 为 candidate 文件引用、reason、可选 run_id/receipt；附 receipt 而无 run_id 时还需 source_identity。回执必须为 received/received_and_audited，来源和归档 candidate 必须一致；历史 completed_via_bridge 经 manifest 同样核验，有效回执允许接入仍处于 exporting 的旧 run。先核对真实场景和来源。

在项目根目录执行：

```powershell
node tools/workflow/production.mjs status yellow-mascot
node tools/workflow/production.mjs check yellow-mascot
node tools/workflow/production.mjs sync yellow-mascot
```

`check` 检查模型、标准、已接受关卡的证据哈希和交接投影。`valid:true` 只代表记录一致，不能解释为模型质量通过。`unresolved_limits` 只列出适用关卡中未确定的阈值。handoff 过期/损坏是 warnings，可 sync 重建；不阻断有效主记录的远程对账提示。投影过期时 `sync` 从 production 重建，不能反过来覆盖 production。所有写命令共用 `.workflow.lock`；残留锁须先核实执行者，不自动删除。主记录原子写入；投影写入中断时主记录仍可恢复。

模型角色分开：candidate 当前候选；display_master 保留外观；repair_baseline 修复比较源；best_motion_draft 保留动作草稿；latest_diagnostic 最近实验；final_files 最终文件。每项为资产相对 `{path,sha256}`。编号最新不代表最佳。`select ASSET REQUEST.json` 可选择现有候选，request 包含 candidate 和 reason；选择会清空当前关卡，不清空返工次数或停止清单。

## 质量标准

production.quality_spec 指向版本化 `production-quality-vNNN.json`。`tools/workflow/quality-template.mjs` 是 v2 标准模板；原 `quality-spec.json` 属于远程 G0 预算/授权契约，不作为当前 Blender 质量事实源。二者职责不同，不能复制历史批准充当新标准批准。

v2 标准包含 `status=draft|active`、suite_id、motion_required、basis、observation_conditions、gates、criteria。active 表示已冻结技术工作标准，不表示用户验收。观察条件写清姿势、区域、比例单位、机位和采样时间；通过新的 configure 版本修改，禁止改原文件绕过哈希。

- metric：operator 为 lte/gte/eq，unit 明确，limit 为数字或 null。null 保持 unknown，不能通过对应关卡。
- visual/assertion：必须有实际观察与带哈希证据，仍需 AI/用户实质审阅，脚本不判断截图审美。
- 不适用只能在标准 criterion 中固定 `applicable:false` 和 `exception_reason`；报告不能自行声明豁免。
- 一次比较必须使用同一 suite、标准、测试区域与采样条件。suite_id 是记录身份，不会自动证明执行者确实运行了对应 Blender 测量；检查器计算报告内的机械比较，原始测量真实性仍依赖实际工具执行和留证。

新增版本后：`configure ASSET CONFIG.json`，CONFIG 包含 reason、evidence（真实既有范围依据）、quality_spec 文件引用、requirements、review_mode、max_started。增加上限还需 limit_extension_evidence。配置变更使全部现行关卡失效，但保留事件与已开始次数；不能用更换标准重置预算。数值技术校准可在已授权范围内进行，不自动重复索要授权；实质降低已批准质量要求或扩大范围时必须有对应依据。

## 每轮本地修改

独立后台优先 [run-local.mjs](../../docs/workflow/local-automation.md) 自动执行一次并收集记录。连续无改善现在也按 defect_id 跨策略计数；达到已有停止阈值后，新正式修复计划必须提供 strategy_review，绑定当前源/标准、连续失败批次和真实诊断依据。不得以改 strategy_id 绕过；诊断与原有底层命令仍可用。

默认使用 [work start/finish统一入口](LEAN.md)，自动补身份和文件引用；以下底层命令保留兼容与故障恢复。

先保存 JSON 计划，再执行 begin；begin 成功并返回批次 ID 后才可修改 Blender 副本。

```powershell
node tools/workflow/production.mjs begin ASSET work/iteration-plan.json
node tools/workflow/production.mjs dispatch ASSET
# 实际执行返回的 code 或 native_arguments 后再核对回执
node tools/workflow/production.mjs reconcile-execution ASSET
node tools/workflow/production.mjs finish ASSET work/iteration-result.json
```

计划字段：

```json
{
  "job_id": "当前 job_id",
  "source_sha256": "当前 candidate 哈希",
  "quality_spec_sha256": "当前标准哈希",
  "operation": "geometry_repair",
  "defect_id": "hip-interface",
  "strategy_id": "local-topology-reconstruction",
  "hypothesis": "具体可证伪假设",
  "authorization_evidence": "实际用户指令或已记录范围",
  "success_checks": ["transition_stretch"],
  "protected_checks": ["silhouette", "uv_materials"],
  "output_path": "work/blender/new-version/candidate.blend",
  "execution": {"script":{"path":"work/scripts/repair.py","sha256":"实际脚本哈希"}}
}
```

operation 支持 diagnostic、geometry_repair、weight_repair、material、uv、rig、motion、export。export 必须声明 format，不需要 defect_id/strategy_id/hypothesis；其他操作保留这些字段。只读观察不消耗修改批次；在隔离副本上实施实验属于 diagnostic，仍消耗次数。rig 要求 polish 接受；motion 在 rig_required=true 时要求 rig 接受，否则要求 polish；export 要求所有适用制作关卡接受。

weight_repair 新批次按冻结标准确定关卡：rig_required=true 时必须使用含适用 weights 的 rig；无独立 rig 的旧标准优先使用含适用 weights 的 motion，否则只允许标准已明确包含 weights 的 polish。无适用权重检查（如纯刚性结构）时拒绝，先核对需求与标准，不自动增加蒙皮要求。开始前核验该关卡所有前序验收；success_checks 或 protected_checks 必须包含 weights，local 比较也不能略过其未知/失败退化。前后报告须绑定解析后的关卡，rig 权重修复还会检查该 rig gate 的结构、压力姿势等必需项；有益局部进展仍按 local 规则保留，不等于整个关卡通过。next 的 operation_readiness 与 begin 使用同一映射。已开始或完成的旧批次沿用所记录 stage，不改历史标准、预算或批准。

开始即计数，started 批次未核对完成前禁止再开始。失败/中断以 finish 写 failed/aborted，附 summary、evidence 文件引用，不能直接删记录。旧 job 的总计数上限保持原样。新 scaffold 的分类预算从零开始，配置后才能修改；repair/diagnostic/creation/export 分别计数；diagnostic/export 按操作计数，其余按 mode=repair/create 分别计入 repair/creation。motion、rig 的修复不计入 creation，material、uv 的新建计入 creation。已有记录的 budget_class 保留，不追溯改账；无该字段时按记录 mode 推导，缺省 repair。configure 的 budgets 四项须是非负整数，budget_evidence 保存真实范围依据，enforce_total=false 可在新 job 使用分类限制。已有 approved policy 的总上限仍优先；旧 job 切换分类还需 limit_extension_evidence，不自动释放历史次数。修复策略连续两轮无有效改善则停止；诊断记录单独结论，不参与修复失败计数；改 strategy_id 只能对应实质不同的假设，不能换名称规避。

结果字段：job_id、iteration_id、status（completed/failed/aborted）、summary、evidence 引用数组。completed 还包含 candidate（必须是预留 output_path）。修复/动作完成需 baseline_report 与 candidate_report 引用；export 只需 final 阶段 candidate_report，source 绑定原母版且 deliverables 包含预留导出文件。通过回读的导出记录 export_verified，保留当前母版身份，仍需 evaluate/decide 完成最终审阅。

修复 mode=repair 的前后报告以同一标准比较：当前 gate 加计划 success_checks/protected_checks 的并集全部参与检查；默认 comparison_scope=gate 时任何未知或超出比较容差的退化都不能晋升；success_checks 至少一项有效改善才视为 improved。comparison_scope=local 仅用于 repair，可保留与本轮成功/保护项无关的基线 unknown；所有已知项仍检查不退化，不能把已知项变为 unknown。本轮成功项和保护项不得 unknown；晋升后仍需全量 gate。首次制作 mode=create 仅支持 motion/rig/material/uv：候选全部适用检查须通过，基线目标项可尚未制作，但 protected_checks 的基线和候选必须可比较且不退化。create 不等于最终接受。completed 不等于 improved。未改善保留旧 candidate，实验仅更新 latest_diagnostic。晋升时按冻结依赖和 reuse_proof 保留已证明不受影响的验收，其余失效；无证明时全部失效。诊断不自动晋升，但可用 adopt-diagnostic 采纳确切合格产物并重新走正式关卡；completed diagnostic 必须有 diagnostic_conclusion=supported|refuted|inconclusive，失败/中断为 execution_failed；有用的诊断可支持后续不同策略，不能据此认定成品通过。

## 报告与审阅

```powershell
node tools/workflow/production.mjs evaluate ASSET polish work/report.json
node tools/workflow/production.mjs decide ASSET polish work/decision.json
```

兼容入口为 `node tools/workflow/review.mjs ASSET STAGE REPORT`。旧 `MODE STAGE REPORT SPEC` 明确拒绝，避免继续运行弱声明检查。stage 为 base_model、polish、rig、motion、engine、final；rig_required=false 跳过 rig，静态资产跳过 motion，未请求引擎集成时跳过 engine。G0 参考批准继续走参考包/远程契约。

报告最小结构：

```json
{
  "schema_version": 2,
  "job_id": "当前 job_id",
  "stage": "polish",
  "source_sha256": "实际被测模型哈希",
  "quality_spec_sha256": "当前标准哈希",
  "suite_id": "冻结测试套件 ID",
  "checks": [
    {
      "name": "transition_stretch",
      "evidence": [{"path":"work/measurements.json","sha256":"实际哈希"}],
      "measurement": {"file":{"path":"work/measurements.json","sha256":"实际哈希"},"pointer":"/values/transition_stretch"}
    },
    {
      "name": "silhouette",
      "status": "pass",
      "observation": "实际前后观察，不是模板默认通过",
      "evidence": [{"path":"work/comparison.png","sha256":"实际哈希"}]
    }
  ]
}
```

示例只展示两项，实际必须包含当前 gate 的全部必需项。原始测量 JSON 包含 source_sha256、suite_id、units（如 `{"transition_stretch":"ratio"}`）和 pointer 对应的有限数值；脚本自行与 limit 比较，忽略 metric 的自报 pass。final 报告另包含非空 deliverables 文件引用数组。报告可以保留当前标准已定义的额外检查，阶段评价只使用该 gate 必需项；迭代比较另加入计划 success_checks/protected_checks。额外项未参与当前评价不等于通过；未知检查名仍拒绝。

evaluate 先核对同一候选的所有前序 gate，再核对当前报告及证据。失败记录 blocked 并返回非零。技术通过仅进入 user_review 或 ai_review。guided 全部由用户审阅；autonomous 中间 AI、final 用户。

decision 文件包含 job_id、stage、source_sha256、quality_spec_sha256、report_sha256、reviewer=user|ai、decision=accepted|rejected、evidence（实际原话/审阅依据）。不得捏造用户批准。decide 会再次校验技术证据，源文件/报告/标准变化会拒绝旧决定。记录工具无法认证自然语言证据是谁说的，执行者仍须引用真实对话。

## 当前黄色角色迁移

历史 production/handoff 已备份到 `production-history/pre-v2-2026-09-24/`，旧 run、brief、模型和批准记录不变。当前 candidate=018，display_master=polish-001，repair_baseline=012，latest_diagnostic=024；状态 polish/needs_revision。历史失败策略已进入停止清单，历史返工计数 unknown，新周期从 0 开始。5 项形变/接触容差暂缺可靠标准，保持 null，不从历史诊断阈值伪造批准。

远程提交缺 workflow-policy 不再进入 legacy 豁免；历史任务 status/下载恢复不受此改变影响。准备新的付费任务时，根据真实既有范围建立策略，积分绑定 credit-policy.md 的持续授权；维护不自动扩展资产制作目标。

执行边界：这些是受工具检查的工作流约束，不能阻止任意 Python、手改 JSON 或绕过工具的 UI 操作。SKILL 必须经过此入口；不得将本地检查描述为 Blender 沙箱或远程事务锁。

## 引擎与最终文件

requirements.engine 为 `{required:true,name,version,project}` 时，标准必须 engine_required=true 并定义 gates.engine。engine 报告包含相同 name/version/project 的 engine 对象、export_iteration_id 和非空 imported_files 文件引用，外加实际运行 checks。imported_files 必须与当前候选、当前标准下最新成功导出批次的 deliverables 集合完全一致。final 必须先有 engine accepted，export_iteration_id 和 deliverables 也须对应同一批次和文件集合。不能偷偷增加未测试的模型文件；说明文档、截图等放 evidence。即使未请求引擎，只要当前候选已有导出尝试，final 也须匹配有效导出批次；未经过导出而直接交付母版的流程仍可用。先用 export 生成测试文件，再引擎验证，再最终用户审阅；不要为生成引擎测试文件要求提前引擎通过。导出回读报告建议从开始就填写 export_iteration_id；回读完成可记录 export_verified，但不执行最终用户验收。较新的失败/中断/进行中导出使较旧成功导出不再可用；文件损坏、删除、标准改变也不能沿用旧批次。新导出或候选/配置变化清空当前 final_files，历史报告保留。

## 视觉比较

纯视觉 pass→pass 无法证明改善。修复 result 可增加 comparison 文件引用，内容包含 before_report_sha256、after_report_sha256、source_sha256、candidate_sha256、quality_spec_sha256、reviewer（guided=user，autonomous=ai）、decision=improved、observation、evidence 文件引用数组。comparison 另须非空 checks，每项包含 name、decision=improved、observation、evidence。name 只能是本轮 success_checks 内适用的 visual，前后该项均须 pass，禁止替代 metric。仍先执行保护项和指标不退化检查。记录工具不判断审美，也不认证自然语言批准。

## 传输回执

`production.mjs transfer ASSET RECORD.json` 接受 id、source_identity、route=bridge|file、status=sending|unknown|received|failed、evidence 文件引用数组。发送前先记录 sending；未知状态只能用同 id/来源/route 核对，禁止再次 sending。received 另需归档 candidate 文件引用。sending/unknown 期间 begin、select、configure、attach-source、evaluate、decide 统一拒绝修改制作上下文；status/check/next、同一传输对账和派生投影 sync 可用。失败后换文件路线需按 Bridge 说明断开旧连接并确认迟到对象，记录新意图。成功回执后 attach-source，接收成功不等于质量通过。

## 远程输入和对账

新计划可使用 input：
- local_file：file 文件引用、format。
- studio_asset：asset_url、明确 version、带哈希 evidence。
- bridge_receipt：receipt 和 file 文件引用。

旧 source_file/source_sha256/source_run_id 格式仍可读取并核验。使用 typed input 不意味着当前 Studio 支持任意格式，preflight 仍须验证输入入口。纯文本 reference 使用 kind=text、prompt 文件引用及真实 decision；图片仍使用 files 数组。

`workflow.mjs reconcile ASSET RUN RECORD.json` 处理 submitting/submission_unknown/processing：outcome 为 failed/cancelled/not_created/processing/studio_result_ready，附 reason 和 evidence 文件引用。除 not_created 外须 remote_identity；not_created 须 confirmation=explicit_service_confirmation，仅一次列表中未发现不能证明未创建。对账不会释放预算、推定退款或复活 run；重试必须新计划且原范围覆盖。

## 配置与兼容

质量模板 qualityTemplate(motionRequired, options) 支持 profile=static-prop|deforming-character|articulated-prop，以及 rig_required、locomotion_contact、uses_ik、engine_required。新模板把压力姿势、权重和接口检查移到 rig，避免创建 rig 前要求通过变形测试。只在实际需求适用时启用脚底/IK 检查；motion_intent 来自当前 motion brief。profile 不代替阈值和真实验证。

候选变更按 [精简执行](LEAN.md) 的冻结依赖及实际指纹复用；没有完整证据时保持全量失效，不按“只改动作/材质”的声明继承。引擎及最终交付不继承。历史 accepted、原标准及计数不因本次重构自动变化。`sync` 仅重建 handoff；旧架构审查探针是修复前快照，当前回归入口为 `node --test tools/workflow/*.test.mjs`。

## 下一步可执行性

`next` 在对账后检查标准是否 active，以及下一 gate 的未定数值阈值；返回 configure_quality 和具体缺失项，不猜阈值。普通阶段返回 operation_readiness（operation/mode/blocked_by）及 stopped_strategies，先选仍可执行且未停止的策略。预算耗尽只阻止新增制作批次，已有文件的证据收集与审阅仍允许。引擎缺有效导出时返回 export_for_engine；导出预算也不足则返回 resolve_budget，不隐含扩额授权。所有 begin 命令使用同一预算检查器再次检查，已有总上限不放宽。


## 诊断、绑定与比较

requirements.rig_required 与标准 rig_required 一致。旧标准未声明时按 false 兼容，历史 motion 中绑定检查不被删除。新变形角色动作模板默认要求 rig；纯绑定显式 rig_required=true、motion_required=false 并配置 gates.rig。新建 rig 使用 create，保护项仍须有效。

metric 可声明 comparison={absolute,relative,minimum_improvement}，均为非负有限数。改善须严格大于 absolute、relative×数值尺度、minimum_improvement 和浮点保护量中的最大值。未配置 absolute/relative 时各取 1e-9，作为保守数值噪声底线，不是资产验收阈值；应按实际测量校准并冻结。pass→fail 永远拒绝，最终 gate 的 limit 不随比较容差放宽。local 比较只允许保留研究进展，最终未知项仍拒绝。

## Blender 执行路径

本地制作可使用实时 MCP 或独立后台 Blender。先按任务需要选择，均遵守同一 begin/dispatch/reconcile-execution/finish 协议、源文件身份、质量标准与预算；Bridge 是传输路径，不替代制作执行回执。用户明确指定路径时沿用该范围。

| 路径 | 执行前 | 执行与证据 |
|---|---|---|
| 实时 MCP | get_addon_status/get_scene_info 确认连接、实际版本、对象及已保存的干净源场景；正文连接错误即失败。不得清空或替换未保存用户场景 | 在已准备的隔离工作场景执行 dispatch 返回的 code 一次；查看场景清单和视口截图，并核对归档输出与回执 |
| 独立后台 | 核对 Blender 可执行文件及实际版本、归档源哈希、脚本和独立输出；无需 MCP 连接。需要的 live 修改尚未保存时先完成归档，不能把旧磁盘源当作最新场景 | 用 dispatch 返回的 native_arguments 启动独立后台进程；Windows 隐藏进程窗口。保存日志，核对回执和输出，独立回读审计并采图，不操作 live 场景 |

两条路径的正式冻结视觉证据均用独立后台 blender-capture.py；MCP 视口截图可用于观察，不能代替新标准的冻结视觉回执。脚本依赖 UI 上下文或插件时须核实后台兼容性，不能假设 MCP 脚本都可直接后台运行。现有 worker 输入为已归档 .blend 场景；外部格式须先通过正式接收/导入归档为候选。

未 dispatch 且已有已保存源时，MCP 连接失败允许继续范围内的独立后台工作；不得绕过执行权限或用户明确路径限制。dispatch 后无论是否收到工具响应，都先对账，不能改走另一条路径执行同一批次。确认进程停止但无回执时按下节 abort-execution 留证并 finish aborted；需要重试时另开新批次。两条路径都无法执行时保留现场，继续允许的分析并报告具体缺口。

## 本地执行回执

新开始批次的 plan.execution 提供 script 文件引用，可冻结 blender_version。脚本可读取 request.output；输出必须是预留路径，未自行保存 .blend 时 worker 自动另存。已开始的历史无回执批次仍可按旧证据结案。execution_required=false 仅保留旧记录/测试兼容，不是生产跳过回执的推荐配置。

1. begin ASSET PLAN.json 验证并计数。
2. dispatch ASSET 只生成一次请求，持久化 execution_unknown，返回 MCP Python code 和后台 Blender native_arguments。
3. 确认实际版本和隔离场景后执行 code，或在独立后台 Blender 使用 native_arguments。worker 要求干净且已保存的输入场景，核对源和脚本哈希，以独占 started 文件拒绝重放。
4. reconcile-execution ASSET 验证回执、版本和输出哈希；再 finish。未知状态不能直接结束批次或开始下一轮，MCP 正常外层响应不能替代回执。
5. 请求已落盘但派发状态未保存时，recover-execution ASSET 重建 unknown；该命令不重新派发，随后核对回执。
6. 无回执且进程确实已停止时，abort-execution ASSET RECORD.json 需要 iteration_id、confirmed_process_stopped=true、reason 和带哈希 evidence，再 finish aborted。超时本身不证明进程停止。

失败回执不代表回滚；副本可能有部分修改。新的尝试必须使用新批次/新输出。该协议不是任意 Python 的沙箱，也不认证人工填写证据的真实性。

## 测量、采图与属性契约

执行这些操作时读取 [EVIDENCE.md](EVIDENCE.md)，包含实际网格测量、结构类型、固定采图和属性契约。拓扑变更的映射比较也在该文件中定义。

动画用途新增协议见 [动画试验、观感与回归](../../docs/workflow/animation-review.md)。新任务显式配置；历史任务不自动迁移。

## 导入诊断与展示投影

按 [导入排错与版本展示](../../docs/workflow/import-and-presentation.md) 先核对实际网格、骨架、Action/slot、NLA、坐标及贴图，再开始内容修正。`presentation.mjs ASSET check|write` 校验已记录源和媒体来源，生成CURRENT.md；不修改production或替代质量验收。新scaffold采用adaptive_reference_v1：简单静态/概念且参考获批可single_image_v1；其他默认四图。旧四图契约不迁移；用户明确例外保存在preparation.input_exception，不以删字段跳过。动画生成顺序和Tripo骨架来源属于技能规则，执行器不认证自然语言证据。

协议3.6补充：诊断采纳需预声明adoption_operation，提交正式plan/result，经普通制作的预算、停止策略、比较、保护项和回归检查，新增正式次数但不重执行脚本。纹理输入绑定当前动画预检；复用依赖有机器强制下限；显式交付档位不能缩减已确认范围。字段与兼容边界见[LEAN.md](LEAN.md)第2、3、5、6节。
