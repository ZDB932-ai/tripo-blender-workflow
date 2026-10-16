---
name: tripo-studio-reference
description: 为 Tripo Studio 资产建立需求档案，检查原图、可选 AI 整理或多视图参考，保存版本并交付用户审阅；不提交三维生成任务。
metadata:
  workflow_protocol: "3.6"
---

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

参考准备同时评估项目 `docs/workflow/studio-capabilities.md` 的 R01–R09，具体见 `docs/workflow/studio-recipes.md` 配方1。默认仍使用内置 imagegen；用户明确选择 Studio 时核实模板、抠图、多视图及费用。当前参考前付费任务尚无独立执行适配，不能伪造最终参考批准来绕过生产关卡。

# 需求与参考

建立或修订 brief、参考图/文字设计及审阅版本；不提交三维生成。

首次在本项目执行时读取项目 `docs/workflow/skill-runtime.md`；恢复运行 `node tools/workflow/work.mjs summary ASSET`。写状态和制作命令以 `tools/workflow/PRODUCTION.md` 为唯一协议。

默认职责：Tripo主生成、Blender辅助验证与局部修正。涉及内容生成、绑定/动作选路或转向Blender替代制作时，读取项目 `docs/workflow/tripo-first.md`；保留用户明确范围与既有授权。

1. 理解需求与原图；先明确仅静态、未来动画、本次只需绑定或本次需要动作。用户已明确则记录原话，不重复询问；未明确先问，不用默认 false 代替答案。
2. 需求明确后按用途选择参考数量；简单静态/概念可单图，角色/复杂结构/动画默认前、左、右、后四张独立图。保留可用视图，只补确实需要的方向。已有生图授权直接执行，否则说明缺口让用户选择提供或生成，不重复请批。
3. 生图前读取 docs/workflow/reference-intake.md，将动画用途写入 generation_brief，具体考虑参考姿势、关节、活动间隙、遮挡和部件关系，保留身份与风格；四张独立视图尺度、结构和姿势一致，推测细节明确标注。
   需要结构修正后返回Studio绑定/动画的后续任务，交接注明 `docs/workflow/roundtrip.md` 路线及独立装备随动意图；本阶段不要求提前制作权重或动作。
4. 检查并展示本版参考，用户不通过则继续修改、重新展示；当前版本批准后才交 Tripo 预检。原图直用也保存真实有效确认；AI 不能代替两种模式的参考批准。
5. manifest 绑定 intake、preparation、文件哈希和决定；按需 procedure 中的契约执行 check-reference。参考确认与费用范围分开，原授权覆盖时复用；只读旧参考分析不追溯要求重批。

仅在执行具体操作或恢复对应故障时读取 [操作细节](references/procedure.md)。

参考数量按 docs/workflow/reference-intake.md：新任务 simple_static/concept 且明确静态可选已批准单图；角色、复杂结构和动画默认四图。旧四图契约不自动迁移，逐槽核对仍保留。

本地修改次数按 docs/workflow/iteration-policy.md：新任务 progress_guarded；旧任务复用用户已有取消次数请批的指令一次迁移。不反复询问增加次数；无改善自动诊断换路，达到停滞保护时报告具体未解决要求，保留最佳候选与真实质量关卡。
