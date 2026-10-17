---
name: tripo-blender-rig-motion
description: 通过 Blender 实时 MCP 或独立后台进程检查 Tripo 原生绑定与动作，在最后一次 Tripo 往返后精修权重和动画，验证变形及导出回读；复用已有合格结果，仅在需求包含绑定或动作时使用。
metadata:
  workflow_protocol: "3.6"
---

本地后台操作优先项目 run-local.mjs run/resume，自动执行一次、收集日志/回执/技术清单；resume 不重跑，质量报告仍需真实证据。同缺陷连续失败按 summary.repair_routing 诊断换路，禁止只改策略编号；细节见 docs/workflow/local-automation.md。

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

Tripo 动作选路按项目 `docs/workflow/studio-recipes.md` 配方6覆盖预设、文字/视频定制及多阶段动画，逐 clip 记录来源和适用条件；页面未核实的视频限制不凭推测填写。冻结帧仅适用于静态姿势交付，不能替代动画验收；沿用 Tripo 骨架。

默认按项目 docs/workflow/concise-mode.md 执行：内部检查和恢复由代理处理，不将 blocked 直接变成用户请示；只在真实缺失设计输入、访问要求、范围变更或最终验收时询问。

# 骨架权重与动作

检查已有骨架/动作或按当前需求制作；静态请求跳过。

首次在本项目执行时读取项目 `docs/workflow/skill-runtime.md`；恢复运行 `node tools/workflow/work.mjs summary ASSET`。写状态和制作命令以 `tools/workflow/PRODUCTION.md` 为唯一协议。

默认职责：Tripo主生成、Blender辅助验证与局部修正。涉及内容生成、绑定/动作选路或转向Blender替代制作时，读取项目 `docs/workflow/tripo-first.md`；保留用户明确范围与既有授权。

1. 动作意图、root motion、接触、帧率/时长与目标格式来自当前 brief。挥手/飞行/机械运动不继承跑步脚底标准。
2. 先检查绑定就绪的静态结构，必要修正交 polish 后再上传交换副本；已有合格 Tripo 骨架和 clip 优先复用，不强制再绑。需要新绑定/动作时按 `docs/workflow/roundtrip.md` 交总控安排 Studio 原生能力，外部骨架、精修权重和旧动作不假定能保留。动作按明确需求→Tripo案例/预设→创作专属动画→最后在Tripo骨架上自行制作的顺序；无有效Tripo骨架时暂停依赖它的制作，不以代理骨架替代。
3. rig_required 与 motion_required 分开；纯绑定通过 rig gate。按 skinned/rigid/mixed 选择结构，混合结构先固定两类区域；刚性关节不用蒙皮伸缩标准。新标准 polish→rig→可选 motion，隔离压力姿势可用于 diagnostic。
4. 按 PRODUCTION.md“Blender 执行路径”选择实时 MCP 或独立后台进程。weight_repair 按冻结标准进入 rig 或兼容旧关卡，计划必须将 weights 列入成功或保护检查；不能用 polish 外观报告代替权重验证。新修改采用 work start→实际执行一次→work finish（自动衔接底层记录）；首次制作使用 mode=create，旧 clip 可不存在，保护项不能 unknown；修复使用 mode=repair 和同条件前后报告。
5. 接收先只读核对来源与属性；新绑定须重新验证 rig 和对应 motion，不能继承旧版验收。最后一次 Tripo 往返后再精修权重、实际存在的刚性附件问题及动作。自动权重仅为起点；验证实际语义影响、压力姿势及完整目标 clip。测量明确 root_object、可选 root_bone 和 root_removal，避免将根骨运动误计为变形。按需读取 procedure，局部案例细节不得变为通用阈值。
6. 每批修改按所选路径检查产物和视觉证据，保留编辑 rig；导出副本按格式烘焙并回读。所有适用 rig/motion 通过后交 deliver，指定引擎再验证。

仅在执行具体操作或恢复对应故障时读取 [操作细节](references/procedure.md)。

动画用途的往返顺序按项目 `docs/workflow/roundtrip.md`，动作审阅按 `docs/workflow/animation-review.md`。草稿节奏按当前交互模式审阅后精修（concise 由代理审阅）。每种刺激覆盖反向保护区，提供适用的多视角、近景、实时与慢放证据；局部修改做属性指纹与受影响动作回归。已有同版本意见复用，新绑定不能继承旧 rig/motion 验收；仅纹理修改不触发重新往返。

导入排错、单动作隔离播放及当前展示统一按项目 `docs/workflow/import-and-presentation.md` 执行。修模型前先区分源问题与播放问题；CURRENT.md由presentation.json生成，不能把最新草稿自动标为成品。

本地修改次数按 docs/workflow/iteration-policy.md：新任务 progress_guarded；旧任务复用用户已有取消次数请批的指令一次迁移。不反复询问增加次数；无改善自动诊断换路，达到停滞保护时报告具体未解决要求，保留最佳候选与真实质量关卡。
