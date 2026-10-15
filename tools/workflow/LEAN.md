# 精简执行与证据复用（协议3.6）

> 费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

只在执行本地操作、建立复用标准或采纳诊断结果时读取。用户可见流程和按需阅读见 [当前入口](../../docs/workflow/skill-runtime.md)。旧命令、状态schema和历史任务保持兼容；新字段不自动迁移历史资产。

## 1. 一个任务摘要、两个操作步骤

独立后台现可用 [run-local 自动执行](../../docs/workflow/local-automation.md) 合并以下步骤，自动归集真实回执和技术清单；仍需原有质量结果。手动/MCP 路径保留。summary.repair_routing 列出需复盘的连续失败缺陷；strategy_review 可填相对路径，不能只改策略编号继续。

```powershell
node tools/workflow/work.mjs summary ASSET
node tools/workflow/work.mjs start ASSET work/request.json
# 使用返回的native_arguments或MCP code实际执行一次
node tools/workflow/work.mjs finish ASSET work/result.json
```

summary只读正式production和远程记录，不维护另一份状态。旧brief、intake、policy、质量标准仍各自保存历史/授权/技术职责；执行者先看摘要，仅缺少当前步骤信息时读取相应文件。

start请求沿用PRODUCTION的operation、mode、defect_id、strategy_id、hypothesis、authorization_evidence、success_checks、protected_checks、output_path、execution等领域字段。自动填写job_id、当前source_sha256和quality_spec_sha256，execution.script及capability可直接填资产相对路径；指纹、实际范围和脚本不能编造。

finish只填status、summary、evidence及本次适用的baseline_report、candidate_report、regression、capability_report、comparison、reuse_proof或diagnostic_conclusion。文件项可用相对路径，candidate默认采用已预留输出；job/iteration身份及哈希自动生成。前后质量报告和真实观察仍需提供。

start内完成begin和dispatch，finish内先核对实际执行回执再finish。中断时仍保留started/unknown状态；不得再start。沿用PRODUCTION的recover-execution、reconcile-execution、abort-execution处理。finish质量校验失败可修正报告后重交，不重新执行脚本。失败的执行不能标completed。统一入口不额外授予制作、积分或重试权限。

## 2. 按实际依赖保留验收

只有修改晋升时提供 `reuse_proof`，并且当前版本化标准冻结了 `reuse_contract`，才尝试复用。各关卡按实际检查内容声明依赖，而非依据操作名推断：例如颜色身份检查需要materials，动画观感通常同时依赖geometry、rig、animation及scene。缺少任一相关依赖就是不完整标准，不得为减少检查而删掉它。标准变化仍全量失效。

```json
{
  "reuse_contract": {
    "version": 1,
    "collector_sha256": "实际采集器哈希",
    "blender_version": "实际版本",
    "dependencies": {
      "base_model": ["geometry", "uv", "materials", "scene"],
      "polish": ["geometry", "uv", "materials", "scene"],
      "rig": ["geometry", "rig", "animation", "scene"],
      "motion": ["geometry", "rig", "animation", "scene"],
      "preflight": ["geometry", "rig", "animation", "scene"],
      "rhythm": ["geometry", "rig", "animation", "scene"]
    }
  }
}
```

执行器按实际检查名强制依赖下限，configure拒绝漏项：几何至少geometry；设计身份至少geometry/uv/materials/scene；轮廓至少geometry/scene；绑定至少geometry/rig；动作以及preflight/rhythm至少geometry/rig/animation/scene。未识别的自定义检查保守依赖全部六域。旧标准漏项时停止复用并重新检查，不改写旧验收。work summary显示所需域与已配置域。

上表为保守示例，不自动装入所有资产。只含纯几何技术断言的关卡可以仅依赖geometry；包含颜色、观察场景或动作的检查不可这样缩小。不得将原有综合关卡改名为几何检查以绕过原标准。

`reuse_proof`引用JSON：`{source_sha256,output_sha256,before:{path,sha256},after:{path,sha256}}`。前后snapshot包含`schema_version:1,source_sha256,collector_sha256,blender_version,domains`。domains的geometry/uv/materials/rig/animation/scene值是实际属性内容SHA256；未覆盖、外部依赖缺失或不支持的内容必须填null，不可用同一个unknown哈希冒充未变。

只读 `blender-domain-snapshot.py` 是**有限范围的静态采集器**：可核对简单本地网格、UV、简单Principled/RGB/Value/Output节点材质及无绑定/动作的结构。带modifier/shape key、图像/组等未覆盖节点材质、骨架、动作或完整场景依赖可能返回null。它不会冒充完整动画采集器。复杂资产须扩展并实测采集器后冻结新哈希，否则重验；旧regression采集器也不能冒充完整domain快照。

```powershell
blender --background --factory-startup SOURCE.blend --python-exit-code 1 --python tools/workflow/blender-domain-snapshot.py -- snapshot.json
```

比较通过后保留原报告、原用户决定和原源身份，在gate.reuse内追加到新候选的证据链。读取时重新检查每个链路及原证据；不伪造一份用户对新文件的批准。没有证明、域变化、collector变化或证据损坏均不复用。engine/final与最终导出文件总是重新核验。受影响的前序关卡通过前，保留的后序证据不能单独用于交付。

preflight/rhythm使用相同机制，仅依赖未变才复用；reference/费用授权仍按原身份规则，不由domain指纹替代。

## 3. 合格诊断产物直接接续正式制作

```powershell
node tools/workflow/production.mjs adopt-diagnostic ASSET work/adopt.json
```

请求：`{iteration_id,reason,evidence,plan:{path,sha256},result:{path,sha256}}`。诊断必须在执行前声明 `adoption_operation`，且来自当前候选与当前标准、已完成、结论supported、真实执行回执有效。旧的无回执或未声明采纳用途的诊断不能直接采纳。

plan/result为普通正式制作计划和结果：正式operation与预声明一致，defect_id、strategy_id和执行脚本与诊断一致，输出为确切诊断产物。命令运行正常的前序关卡、预算、停止策略、前后质量比较、保护项、回归和能力验证；缺失证据或没有改善不更新正式任务。

采纳新增一次正式制作记录，正常消耗相应制作/修复与总次数预算；原诊断次数保留。它不再次运行脚本，也不自动接受任何正式关卡。已审阅且对应同一诊断产物的preflight/rhythm可保留；其他草稿不继承。动作节奏仍须用户真实审阅，Tripo骨架来源要求不变。后续导出和最终用户验收照常执行。

## 4. 能力范围分清楚

| 范围 | 当前行为 |
|---|---|
| 已接入执行规则 | 单输入单候选Studio生成/后处理，经实际UI兼容与报价检查；本地统一入口、证据复用及诊断采纳 |
| 当前账户/源模型待核实 | Mesh Edit、特定分件子控件、视频细则和旧风格化；先核实，不能据目录直接执行 |
| 执行器待适配 | 一次多变体、远程批量、参考批准前的Studio付费生图；不绕过单任务/参考关卡 |

不为这些待适配功能在每件资产上重复做完整评估。需要时再查 [功能表](../../docs/workflow/studio-capabilities.md)。

## 5. 纹理输入必须与动画预检对应

动画资产提交纹理处理时，`ui_verification`引用的观察记录必须有 `source_input`，与计划的typed `input`完全一致；此字段来自真实页面观察。旧source_file/source_sha256输入按local_file归一化。

输入是当前candidate的确切路径与哈希时直接绑定。输入为其他文件、Studio版本或Bridge传输结果时，plan须附 `preflight_input_binding:{path,sha256}`：

```json
{
  "schema_version":1,
  "job_id":"当前任务",
  "candidate":{"path":"当前候选路径","sha256":"当前候选哈希"},
  "quality_spec_sha256":"当前标准哈希",
  "checkpoint_sha256":"当前preflight检查点哈希",
  "input":{"kind":"studio_asset","asset_url":"实际URL","version":"实际版本","evidence":{"path":"源证据","sha256":"实际哈希"}},
  "relation":"verified_geometry_equivalence",
  "comparison":{"path":"输入对应性报告","sha256":"实际哈希"}
}
```

comparison包含candidate_sha256、与计划完全相同的input，以及geometry、scale_axes、rig_correspondence三个checks；每项须有status=pass、真实observation和非空evidence文件引用。核对几何、单位轴向及预检骨架与源几何的对应关系；不要求未绑定的Studio源凭空具有诊断骨架。URL相同、文件名相同或文字声明不能证明对应，无法验证则重新准备预检。输入版本、候选、标准或检查点改变必须更新对应性证据。

## 6. 根据交付用途配置质量范围

调用quality-template的 `qualityTemplate(motionRequired, {delivery_tier: ...})` 时，同时在configure的requirements中记录一致的delivery_tier和真实delivery_tier_evidence；不自动降级旧任务。

| delivery_tier | 用途与检查范围 |
|---|---|
| concept_preview | 明确的静态概念预览；保留轮廓、几何、预览材质和可编辑母版，允许明确无纹理；观察视图可精简为正面和四分之三 |
| static_asset | 正式静态资产，完整适用材质与交付检查 |
| animated_asset | 包含骨架或动作，启用对应绑定/动作要求 |
| engine_asset | 明确引擎交付，执行引擎接入核验 |

静态档不能隐藏绑定、动作或引擎范围。概念档仍保留身份、依赖、回读及最终用户验收，不冒充正式成品。未显式选档的旧模板保持原行为。
