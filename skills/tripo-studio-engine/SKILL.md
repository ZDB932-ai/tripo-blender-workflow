---
name: tripo-studio-engine
description: 将Tripo与Blender流程导出的资产接入用户指定的Unity、Unreal、Godot或Three.js项目，验证材质、尺度、碰撞、性能及动画；提供最终用户验收前的引擎证据。
metadata:
  workflow_protocol: "3.6"
---

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

接入前按项目 `docs/workflow/studio-recipes.md` 配方7核实实际三角数、LOD、材质通道与逐 clip 输出；8K 不代表所有贴图都是8K。Smart Mesh、超分或压缩是否有益须由目标引擎的外观、变形、内存和性能验证，Studio 查看器不能替代引擎验收。

默认按项目 docs/workflow/concise-mode.md 执行：内部检查和恢复由代理处理，不将 blocked 直接变成用户请示；只在真实缺失设计输入、访问要求、范围变更或最终验收时询问。

# 目标引擎验证

将同版导出接入用户指定项目，形成最终验收的必要证据。

首次在本项目执行时读取项目 `docs/workflow/skill-runtime.md`；恢复运行 `node tools/workflow/work.mjs summary ASSET`。写状态和制作命令以 `tools/workflow/PRODUCTION.md` 为唯一协议。

默认职责：Tripo主生成、Blender辅助验证与局部修正。涉及内容生成、绑定/动作选路或转向Blender替代制作时，读取项目 `docs/workflow/tripo-first.md`；保留用户明确范围与既有授权。

1. 确认引擎名称、版本、项目和实际用途；requirements.engine.required 与 quality spec 同步配置。不自动建立新游戏。
2. Unity 操作读 unity-cli，UPM 改动读 unity-package-management；其他引擎使用项目现有工具和规范。
3. 检查单位/轴向/pivot、材质通道、纹理、骨架和 clip，按需求验证碰撞/LOD/性能及实际运行。
   往返资产按 `docs/workflow/roundtrip.md` 选用最后一次必要往返后精修并正式回读的文件；交换副本和原生动作回传不能冒充该最终导出批次，clip名称须对应实际骨骼运动。
4. engine 报告绑定目标 project/version/name、export_iteration_id、imported_files 哈希及运行证据；文件集合须等于当前候选的有效导出清单，evaluate/decide 后才进入最终验收。
5. 导出文件改变就重新验证；不能用 Blender 视口或静态 accepted 代替引擎运行。

仅在执行具体操作或恢复对应故障时读取 [操作细节](references/procedure.md)。

本地修改次数按 docs/workflow/iteration-policy.md：新任务 progress_guarded；旧任务复用用户已有取消次数请批的指令一次迁移。不反复询问增加次数；无改善自动诊断换路，达到停滞保护时报告具体未解决要求，保留最佳候选与真实质量关卡。
