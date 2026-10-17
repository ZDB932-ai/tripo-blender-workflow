---
name: tripo-blender-polish
description: 通过 Blender 实时 MCP 或独立后台进程审计和修整 Tripo 模型；在绑定前处理必要的几何、分件与 UV，或在最后一次 Tripo 往返后精修材质，保留可编辑母版与质量证据。
metadata:
  workflow_protocol: "3.6"
---

本地后台操作优先项目 run-local.mjs run/resume，自动执行一次、收集日志/回执/技术清单；resume 不重跑，质量报告仍需真实证据。同缺陷连续失败按 summary.repair_routing 诊断换路，禁止只改策略编号；细节见 docs/workflow/local-automation.md。

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

替代制作前读取项目 `docs/workflow/studio-recipes.md` 配方3–5，评估原生分件/补全、重拓扑、Smart UV、局部纹理、超分和 PBR 是否更适合当前缺陷；不可用或精度不足须有依据。保留用户明确授权的 Blender 局部修正，并验证本轮保护属性没有受损。

默认按项目 docs/workflow/concise-mode.md 执行：内部检查和恢复由代理处理，不将 blocked 直接变成用户请示；只在真实缺失设计输入、访问要求、范围变更或最终验收时询问。

# Blender 几何与材质

对指定模型进行审计或局部几何、UV、材质修整。

首次在本项目执行时读取项目 `docs/workflow/skill-runtime.md`；恢复运行 `node tools/workflow/work.mjs summary ASSET`。写状态和制作命令以 `tools/workflow/PRODUCTION.md` 为唯一协议。

默认职责：Tripo主生成、Blender辅助验证与局部修正。涉及内容生成、绑定/动作选路或转向Blender替代制作时，读取项目 `docs/workflow/tripo-first.md`；保留用户明确范围与既有授权。

1. 按 PRODUCTION.md“Blender 执行路径”选择实时 MCP 或独立后台进程；分别核实连接/场景或可执行文件/归档源。后台路径不以 MCP 接通为前提，已派发未知批次先对账。
2. 只读审计可先执行；真实修改在独立副本上 work start→实际执行一次→work finish（自动衔接底层记录），绑定脚本与产物回执。不覆盖未保存场景或 accepted。
3. 按需读取 procedure 和 docs/workflow/recipes.md；基础审计未测项保留 unknown；实际变形数据使用协议中的 blender-measure.py 与冻结配置。缺陷选路交总控，不把所有修复默认留在 Blender。需要返回 Studio 绑定/动画时按 `docs/workflow/roundtrip.md`，先完成必要结构修正，保留母版并导出交换副本；最终权重和动作精修留在最后一次往返后。
4. 本轮计划明确 success_checks 与 protected_checks，评价器实际检查它们。新标准必须冻结测量与视觉契约；按协议使用 blender-capture.py 采图，不能仅靠任意截图声明同条件。操作 capability 固定版本、格式和属性保留/改变要求。
5. 按所选路径检查实际产物和视觉证据，保存可回退版本。拓扑变化重新建立 UV/权重映射；被测区域变拓扑时按 EVIDENCE.md 冻结 region_variants、样本对应及误差上限，不能直接替换同拓扑配置。修复无改善触发停止；diagnostic 单独记录支持/否定/未决，不伪称模型改善。
6. 候选保留与最终通过分开。polish evaluate/decide 后由 next 决定后续；只审计合格模型不强制修改。

仅在执行具体操作或恢复对应故障时读取 [操作细节](references/procedure.md)。

动画用途的往返顺序按项目 `docs/workflow/roundtrip.md`，动作审阅按 `docs/workflow/animation-review.md`。已有合格结构、绑定和动作直接复用，不为了执行往返而重绑或重生成；仅改纹理不触发新一轮绑定/动画。草稿节奏按当前交互模式审阅后精修（concise 由代理审阅），局部修改做属性保护与适用动作回归；同版本意见复用，新绑定不能继承旧 rig/motion 验收。

导入排错、单动作隔离播放及当前展示统一按项目 `docs/workflow/import-and-presentation.md` 执行。修模型前先区分源问题与播放问题；CURRENT.md由presentation.json生成，不能把最新草稿自动标为成品。

本地修改次数按 docs/workflow/iteration-policy.md：新任务 progress_guarded；旧任务复用用户已有取消次数请批的指令一次迁移。不反复询问增加次数；无改善自动诊断换路，达到停滞保护时报告具体未解决要求，保留最佳候选与真实质量关卡。
